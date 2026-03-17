"""
Scoring engine — computes TrendScore, SustainabilityScore, and category growth.
Uses DuckDB for efficient columnar aggregations over the SQLite daily_metrics data.
Writes results to computed_metrics table.
"""

import math
import logging
import os
from datetime import date, datetime, timezone, timedelta

import duckdb
import pandas as pd

from app.database import SessionLocal, engine
from app.models import Repository, DailyMetric, ComputedMetric, TrendAlert, CategoryMetricDaily
from app.models.watchlist import WatchlistItem
from app.services.alert_engine import evaluate_alert_rules

logger = logging.getLogger(__name__)

SPIKE_Z_THRESHOLD = float(os.getenv("SPIKE_Z_THRESHOLD", "2.5"))
SPIKE_MIN_HISTORY_DAYS = int(os.getenv("SPIKE_MIN_HISTORY_DAYS", "7"))
SPIKE_SUSTAINED_Z_THRESHOLD = float(os.getenv("SPIKE_SUSTAINED_Z_THRESHOLD", "2.0"))


def _today() -> date:
    return datetime.now(timezone.utc).date()


# ─── DuckDB connection over SQLite or PostgreSQL ──────────────────────────────

def _get_duck_conn():
    """Open a DuckDB connection with SQLite/PostgreSQL attached (read-only)."""
    import os
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.getenv("DATABASE_URL", "sqlite:///./repodar.db")

    # Normalise legacy postgres:// scheme
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # Use the same extension directory that was pre-installed at startup
    ext_dir = os.getenv("DUCKDB_EXTENSION_DIRECTORY", "/tmp/.duckdb/extensions")
    os.makedirs(ext_dir, exist_ok=True)

    conn = duckdb.connect()
    conn.execute(f"SET extension_directory='{ext_dir}';")

    if db_url.startswith("postgresql://"):
        # Production: PostgreSQL on Railway
        # Install and load PostgreSQL extension for DuckDB
        try:
            conn.execute("INSTALL postgres; LOAD postgres;")
            conn.execute(f"ATTACH '{db_url}' AS repodar (TYPE postgres)")
        except Exception as e:
            # If PostgreSQL extension fails, DuckDB fallback will trigger when _load_window_df_pandas is called
            logger.warning(f"DuckDB PostgreSQL extension failed: {e}. Will use Pandas fallback.")
            conn.close()
            raise
    else:
        # Local development: SQLite
        sqlite_path = db_url.replace("sqlite:///", "")
        conn.execute("INSTALL sqlite; LOAD sqlite;")
        conn.execute(f"ATTACH '{sqlite_path}' AS repodar (TYPE sqlite)")

    return conn


# ─── Window data loader ──────────────────────────────────────────────────────

def _load_window_df(repo_id: str, days: int = 60) -> pd.DataFrame:
    """Load the last N days of daily_metrics for a repo via DuckDB."""
    try:
        conn = _get_duck_conn()
        cutoff = (_today() - timedelta(days=days)).isoformat()
        df = conn.execute("""
            SELECT
                DATE(captured_at) AS day,
                stars,
                forks,
                contributors,
                open_issues,
                open_prs,
                merged_prs,
                releases,
                daily_star_delta,
                daily_fork_delta,
                daily_pr_delta,
                COALESCE(commit_count, 0)       AS commit_count,
                COALESCE(daily_commit_delta, 0) AS daily_commit_delta
            FROM repodar.daily_metrics
            WHERE repo_id = ?
              AND DATE(captured_at) >= ?
            ORDER BY day ASC
        """, [repo_id, cutoff]).fetchdf()
        conn.close()
        return df
    except Exception as e:
        logger.warning(f"DuckDB load failed for {repo_id}, falling back to Pandas: {e}")
        return _load_window_df_pandas(repo_id, days)


def _load_window_df_pandas(repo_id: str, days: int = 60) -> pd.DataFrame:
    """Pure SQLAlchemy fallback for when DuckDB can't attach."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        rows = (
            db.query(DailyMetric)
            .filter(DailyMetric.repo_id == repo_id, DailyMetric.captured_at >= cutoff)
            .order_by(DailyMetric.captured_at.asc())
            .all()
        )
        if not rows:
            return pd.DataFrame()
        data = [{
            "day": r.captured_at.date(),
            "stars": r.stars,
            "forks": r.forks,
            "contributors": r.contributors,
            "open_issues": r.open_issues,
            "open_prs": getattr(r, 'open_prs', 0) or 0,
            "merged_prs": r.merged_prs,
            "releases": r.releases,
            "daily_star_delta": r.daily_star_delta,
            "daily_fork_delta": getattr(r, 'daily_fork_delta', 0) or 0,
            "daily_pr_delta": getattr(r, 'daily_pr_delta', 0) or 0,
            "commit_count": getattr(r, 'commit_count', 0) or 0,
            "daily_commit_delta": getattr(r, 'daily_commit_delta', 0) or 0,
        } for r in rows]
        return pd.DataFrame(data)
    finally:
        db.close()


# ─── Type conversion utility ────────────────────────────────────────────────────

def _ensure_python_types(d: dict) -> dict:
    """Recursively convert all numpy types to native Python types."""
    result = {}
    for k, v in d.items():
        if isinstance(v, dict):
            result[k] = _ensure_python_types(v)
        elif hasattr(v, 'item'):  # numpy scalar
            result[k] = v.item() if callable(v.item) else float(v)
        elif isinstance(v, (float, int, bool, str, type(None))):
            result[k] = v
        else:
            result[k] = float(v) if isinstance(v, (int, float)) else v
    return result


# ─── Metric computations ─────────────────────────────────────────────────────

def _star_velocity(df: pd.DataFrame, window: int) -> float:
    """Mean daily star delta over last N days."""
    if df.empty or len(df) < 2:
        return 0.0
    tail = df.tail(window)
    return float(tail["daily_star_delta"].mean())


def _acceleration(df: pd.DataFrame) -> float:
    """7d velocity minus prior 7d velocity."""
    if len(df) < 14:
        return 0.0
    recent_vel = _star_velocity(df.tail(14).head(7), 7)  # prior 7d
    current_vel = _star_velocity(df.tail(7), 7)          # current 7d
    return current_vel - recent_vel


def _contributor_growth_rate(df: pd.DataFrame) -> float:
    if len(df) < 7:
        return 0.0
    old_val = float(df.iloc[-7]["contributors"])
    new_val = float(df.iloc[-1]["contributors"])
    if old_val == 0:
        return 0.0
    return float((new_val - old_val) / old_val)


def _release_boost(df: pd.DataFrame) -> float:
    """1.0 if releases increased in last 7 days, else 0.0."""
    if len(df) < 2:
        return 0.0
    old = float(df.iloc[-min(7, len(df))]["releases"])
    new = float(df.iloc[-1]["releases"])
    return 1.0 if new > old else 0.0


def _pr_activity_score(df: pd.DataFrame) -> float:
    """
    PR activity signal combining:
    - Merged PR velocity over last 7 days (daily_pr_delta sum; or merged_prs diff)
    - Open PR count normalised (more open PRs = more active development)
    Returns a value in [0, 1] (capped).
    """
    if df.empty:
        return 0.0
    # Merged PR velocity
    if "daily_pr_delta" in df.columns and df["daily_pr_delta"].sum() > 0:
        pr_velocity = float(df.tail(7)["daily_pr_delta"].sum())
    elif "merged_prs" in df.columns and len(df) >= 2:
        pr_velocity = float(df.iloc[-1]["merged_prs"] - df.iloc[0]["merged_prs"])
    else:
        pr_velocity = 0.0

    # Open PR count: normalise so that 50 open PRs ≈ 1.0
    open_pr_norm = 0.0
    if "open_prs" in df.columns:
        open_pr_norm = min(1.0, float(df.iloc[-1]["open_prs"]) / 50.0)

    # Combine: velocity dominates; open count adds context
    combined = (min(1.0, pr_velocity / 20.0) * 0.7) + (open_pr_norm * 0.3)
    return round(min(1.0, combined), 4)


def _issue_spike(df: pd.DataFrame) -> float:
    """Normalized open issue delta over 7 days."""
    if len(df) < 7:
        return 0.0
    old = float(df.iloc[-7]["open_issues"])
    new = float(df.iloc[-1]["open_issues"])
    baseline = max(old, 1.0)
    return float((new - old) / baseline)


def _issue_close_rate(df: pd.DataFrame) -> float:
    """Approximated: stability in open issues (lower growth = higher close rate)."""
    if df.empty:
        return 0.5
    spike = _issue_spike(df)
    # Invert: negative spike (issues decreasing) = high close rate
    return float(max(0.0, min(1.0, 0.5 - spike)))


def _release_frequency(df: pd.DataFrame, age_weeks: float) -> float:
    """Releases per week based on total release count."""
    if df.empty or age_weeks == 0:
        return 0.0
    total_releases = float(df.iloc[-1]["releases"])
    return float(total_releases / max(age_weeks, 1))


def _fork_to_star_ratio(df: pd.DataFrame) -> float:
    if df.empty:
        return 0.0
    stars = float(df.iloc[-1]["stars"])
    forks = float(df.iloc[-1]["forks"])
    if stars == 0:
        return 0.0
    return float(forks / stars)


def _fork_growth_score(df: pd.DataFrame) -> float:
    """
    Fork growth signal: % increase in forks over the last 7 days.
    Normalised so that 5 % fork growth/week ≈ 1.0.
    Uses daily_fork_delta when available, falls back to absolute diff.
    """
    if len(df) < 2:
        return 0.0
    if "daily_fork_delta" in df.columns and df["daily_fork_delta"].sum() > 0:
        delta = float(df.tail(7)["daily_fork_delta"].sum())
    else:
        old_forks = float(df.iloc[-min(7, len(df))]["forks"])
        delta = float(float(df.iloc[-1]["forks"]) - old_forks)
    baseline = max(float(df.iloc[-min(7, len(df))]["forks"]), 1.0)
    pct = float(delta / baseline)
    return float(round(min(1.0, pct / 0.05), 4))   # 5 % / week → 1.0


def _commit_frequency_score(df: pd.DataFrame) -> float:
    """
    Commit frequency signal: average new commits per day over the last 7 days.
    Normalised so that 10 commits/day ≈ 1.0.
    Uses daily_commit_delta when populated, falls back to 0 gracefully.
    """
    if df.empty:
        return 0.0
    if "daily_commit_delta" in df.columns:
        avg = float(df.tail(7)["daily_commit_delta"].mean())
    else:
        avg = 0.0
    return float(round(min(1.0, avg / 10.0), 4))   # 10 commits/day → 1.0


# ─── Composite scores ────────────────────────────────────────────────────────

def compute_trend_score(df: pd.DataFrame, age_days: int) -> dict:
    """
    TrendScore (0–100 normalised) — momentum signal across 7 signals:

      Signal              Weight   Rationale
      ─────────────────── ────── ───────────────────────────────────────────
      star_velocity_7d     0.30   Primary demand signal
      acceleration         0.20   Is demand accelerating?
      commit_frequency     0.15   Developer activity (new: commit delta)
      contributor_growth   0.10   Community growth
      pr_activity          0.10   Contribution health
      fork_growth          0.10   Downstream usage signal (new)
      release_boost        0.03   Shipping cadence
      issue_spike          0.02   Issue interest (minor)

    Raw score is log-damped by repo age so newer repos aren't artificially
    inflated for raw star counts.
    """
    vel_7d  = float(_star_velocity(df, 7))
    vel_30d = float(_star_velocity(df, 30))
    accel   = float(_acceleration(df))
    contrib_growth   = float(_contributor_growth_rate(df))
    release_b        = float(_release_boost(df))
    issue_s          = float(_issue_spike(df))
    pr_activity      = float(_pr_activity_score(df))
    fork_growth      = float(_fork_growth_score(df))
    commit_freq      = float(_commit_frequency_score(df))

    raw = float(
        vel_7d         * 0.30 +
        accel          * 0.20 +
        commit_freq    * 0.15 +
        contrib_growth * 0.10 +
        pr_activity    * 0.10 +
        fork_growth    * 0.10 +
        release_b      * 0.03 +
        issue_s        * 0.02
    )

    age_log = math.log(max(age_days, 2))
    trend = float(raw / age_log) if age_log > 0 else 0.0

    return {
        "star_velocity_7d": float(round(vel_7d, 4)),
        "star_velocity_30d": float(round(vel_30d, 4)),
        "acceleration": float(round(accel, 4)),
        "contributor_growth_rate": float(round(contrib_growth, 4)),
        "trend_score": float(round(trend, 6)),
    }


def compute_sustainability_score(df: pd.DataFrame, age_days: int) -> dict:
    """
    SustainabilityScore = (active_contrib×0.3 + issue_close×0.3 + rel_freq×0.2 + fork_star×0.2)
    Label: GREEN>0.6, YELLOW 0.3–0.6, RED<0.3
    """
    # Use contributor_growth_rate as proxy for active contributors (normalized 0-1)
    cg = float(min(1.0, max(0.0, float(_contributor_growth_rate(df)) + 0.5)))
    ic = float(_issue_close_rate(df))
    age_weeks = float(age_days / 7.0)
    rf = float(min(1.0, float(_release_frequency(df, age_weeks)) / 2.0))  # cap at 2/week = 1.0
    fsr = float(min(1.0, float(_fork_to_star_ratio(df)) * 5))             # 20% fork rate = 1.0

    score = float((cg * 0.3) + (ic * 0.3) + (rf * 0.2) + (fsr * 0.2))
    score = float(round(score, 4))

    if score >= 0.6:
        label = "GREEN"
    elif score >= 0.3:
        label = "YELLOW"
    else:
        label = "RED"

    return {
        "issue_close_rate": float(round(ic, 4)),
        "release_frequency": float(round(rf, 4)),
        "fork_to_star_ratio": float(round(float(_fork_to_star_ratio(df)), 4)),
        "sustainability_score": score,
        "sustainability_label": label,
    }


# ─── Category growth model ───────────────────────────────────────────────────

def _category_growth_df_sqlalchemy(fetch_days: int) -> "pd.DataFrame":
    """
    SQLAlchemy/Pandas fallback that returns a DataFrame identical to the
    DuckDB query used in compute_category_growth().  Used on PostgreSQL when
    the DuckDB postgres extension is unavailable (e.g. cold Railway deploy).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=fetch_days)
    db = SessionLocal()
    try:
        rows = (
            db.query(
                Repository.category,
                Repository.id.label("repo_id"),
                DailyMetric.captured_at,
                DailyMetric.stars,
                DailyMetric.daily_star_delta,
                DailyMetric.contributors,
                DailyMetric.open_issues,
                DailyMetric.releases,
                DailyMetric.merged_prs,
                DailyMetric.open_prs,
                DailyMetric.daily_pr_delta,
            )
            .join(DailyMetric, Repository.id == DailyMetric.repo_id)
            .filter(DailyMetric.captured_at >= cutoff.replace(tzinfo=None))
            .all()
        )
        if not rows:
            return pd.DataFrame()
        data = [
            {
                "category": r.category,
                "repo_id": r.repo_id,
                "day": pd.Timestamp(r.captured_at.date()),
                "stars": r.stars or 0,
                "daily_star_delta": r.daily_star_delta or 0,
                "contributors": r.contributors or 0,
                "open_issues": r.open_issues or 0,
                "releases": r.releases or 0,
                "merged_prs": r.merged_prs or 0,
                "open_prs": r.open_prs or 0,
                "daily_pr_delta": r.daily_pr_delta or 0,
            }
            for r in rows
        ]
        return pd.DataFrame(data)
    finally:
        db.close()


def compute_category_growth(days: int = 7) -> list[dict]:
    """
    Per-category aggregated metrics + composite TrendScore using:
      Star velocity 40% | Acceleration 20% | Contributor growth 20%
      Release boost 10% | Issue activity 10%
    All signals are min-max normalised across categories before weighting.
    """
    fetch_days = max(days + 7, 35)
    try:
        conn = _get_duck_conn()
        cutoff = (_today() - timedelta(days=fetch_days)).isoformat()
        df = conn.execute("""
            SELECT
                r.category,
                r.id AS repo_id,
                DATE(dm.captured_at) AS day,
                dm.stars,
                dm.daily_star_delta,
                dm.contributors,
                dm.open_issues,
                dm.releases,
                dm.merged_prs,
                COALESCE(dm.open_prs, 0)       AS open_prs,
                COALESCE(dm.daily_pr_delta, 0) AS daily_pr_delta
            FROM repodar.repositories r
            JOIN repodar.daily_metrics dm ON dm.repo_id = r.id
            WHERE DATE(dm.captured_at) >= ?
        """, [cutoff]).fetchdf()
        conn.close()
    except Exception as e:
        logger.warning(f"DuckDB category growth failed: {e}. Falling back to SQLAlchemy.")
        try:
            df = _category_growth_df_sqlalchemy(fetch_days)
        except Exception as e2:
            logger.error(f"SQLAlchemy category growth fallback also failed: {e2}")
            return []

    if df.empty:
        return []

    raw_results = []
    for category, grp in df.groupby("category"):
        grp     = grp.sort_values("day")
        latest  = grp.groupby("repo_id").last().reset_index()
        earliest = grp.groupby("repo_id").first().reset_index()

        total_stars         = int(latest["stars"].sum())
        total_contributors  = int(latest["contributors"].sum())
        total_merged_prs    = int(latest["merged_prs"].sum())

        # Period star gain
        period_cutoff = grp["day"].max() - pd.Timedelta(days=days)
        period_data   = grp[grp["day"] > period_cutoff].sort_values("day")

        if period_data["daily_star_delta"].sum() != 0:
            period_star_gain = int(period_data["daily_star_delta"].sum())
        else:
            p_lat = period_data.groupby("repo_id")["stars"].last()
            p_ear = period_data.groupby("repo_id")["stars"].first()
            period_star_gain = int((p_lat - p_ear).sum())
            if period_star_gain == 0:
                period_star_gain = int((latest["stars"] - earliest["stars"]).sum())

        # Star velocity (40 %)
        last7 = grp[grp["day"] >= (grp["day"].max() - pd.Timedelta(days=7))]
        star_velocity = float(last7["daily_star_delta"].sum())
        if star_velocity == 0:
            l7l = last7.groupby("repo_id")["stars"].last()
            l7e = last7.groupby("repo_id")["stars"].first()
            star_velocity = float((l7l - l7e).sum())

        # Acceleration (20 %)
        prior7 = grp[
            (grp["day"] < (grp["day"].max() - pd.Timedelta(days=7))) &
            (grp["day"] >= (grp["day"].max() - pd.Timedelta(days=14)))
        ]
        prior_velocity = float(prior7["daily_star_delta"].sum())
        if prior_velocity == 0 and len(prior7) >= 2:
            prl = prior7.groupby("repo_id")["stars"].last()
            pre = prior7.groupby("repo_id")["stars"].first()
            prior_velocity = float((prl - pre).sum())
        acceleration = star_velocity - prior_velocity

        # Contributor growth (20 %)
        contributor_growth = float(latest["contributors"].sum()) - float(earliest["contributors"].sum())

        # Release boost (10 %)
        rl  = latest.set_index("repo_id")["releases"]
        re_ = earliest.set_index("repo_id")["releases"]
        common = rl.index.intersection(re_.index)
        release_boost = float((rl[common] > re_[common]).sum()) / max(len(common), 1)

        # Issue activity (10 %)
        il = latest.set_index("repo_id")["open_issues"]
        ie = earliest.set_index("repo_id")["open_issues"]
        ci = il.index.intersection(ie.index)
        issue_activity = float((il[ci] - ie[ci]).abs().sum()) if len(ci) > 0 else 0.0

        # MoM
        prior_all = grp[
            (grp["day"] < (grp["day"].max() - pd.Timedelta(days=7))) &
            (grp["day"] >= (grp["day"].max() - pd.Timedelta(days=35)))
        ]
        prior_gain = float(prior_all["daily_star_delta"].sum())
        if prior_gain == 0 and len(prior_all) >= 2:
            prl2 = prior_all.groupby("repo_id")["stars"].last()
            pre2 = prior_all.groupby("repo_id")["stars"].first()
            prior_gain = float((prl2 - pre2).sum())
        mom_growth = ((star_velocity - prior_gain) / max(abs(prior_gain), 1)) * 100

        # Period PR gain
        if "daily_pr_delta" in period_data.columns and period_data["daily_pr_delta"].sum() > 0:
            period_pr_gain = int(period_data["daily_pr_delta"].sum())
        elif "merged_prs" in period_data.columns and len(period_data) >= 2:
            ppl = period_data.groupby("repo_id")["merged_prs"].last()
            ppe = period_data.groupby("repo_id")["merged_prs"].first()
            period_pr_gain = int((ppl - ppe).sum())
        else:
            period_pr_gain = 0

        avg_open_prs = round(float(latest["open_prs"].mean()) if "open_prs" in latest.columns else 0.0, 1)

        raw_results.append({
            "category":           category,
            "total_stars":        total_stars,
            "total_contributors": total_contributors,
            "total_merged_prs":   total_merged_prs,
            "weekly_velocity":    round(star_velocity, 1),
            "mom_growth_pct":     round(mom_growth, 2),
            "repo_count":         int(latest["repo_id"].nunique()),
            "period_star_gain":   period_star_gain,
            "period_pr_gain":     period_pr_gain,
            "avg_open_prs":       avg_open_prs,
            "_vel":   star_velocity,
            "_accel": acceleration,
            "_cont":  contributor_growth,
            "_rel":   release_boost,
            "_iss":   issue_activity,
        })

    if not raw_results:
        return []

    # If all velocity/contrib/issue delta signals are zero (single-snapshot data),
    # fall back to absolute totals so categories still rank meaningfully.
    all_delta_zero = (
        all(r["_vel"] == 0 for r in raw_results) and
        all(r["_cont"] == 0 for r in raw_results) and
        all(r["_iss"] == 0 for r in raw_results)
    )
    if all_delta_zero:
        for r in raw_results:
            rc = max(r["repo_count"], 1)
            r["_vel"]  = r["total_stars"] / rc        # avg stars per repo
            r["_accel"] = r["total_merged_prs"] / rc  # avg merged PRs (proxy for momentum)
            r["_cont"] = r["total_contributors"] / rc  # avg contributors per repo
            # _rel and _iss come from the loop above; if still 0 use issue count from latest snapshot
            # (already set per-category; keep if nonzero, else proxy)

    # Min-max normalise each signal across categories, then compute composite
    def _minmax(vals):
        mn, mx = min(vals), max(vals)
        return [0.5] * len(vals) if mx == mn else [(v - mn) / (mx - mn) for v in vals]

    signal_keys = [("_vel", 0.40), ("_accel", 0.20), ("_cont", 0.20), ("_rel", 0.10), ("_iss", 0.10)]
    for key, _ in signal_keys:
        normed = _minmax([r[key] for r in raw_results])
        for r, n in zip(raw_results, normed):
            r[key + "_n"] = n

    for r in raw_results:
        r["trend_composite"] = round(
            sum(r[key + "_n"] * w for key, w in signal_keys), 4
        )
        for key, _ in signal_keys:
            del r[key]
            del r[key + "_n"]

    return sorted(raw_results, key=lambda x: x["trend_composite"], reverse=True)

# ─── Alert thresholds ────────────────────────────────────────────────────────
# Thresholds are conservative to avoid noise.  Adjust via config later.
_ALERT_THRESHOLDS: dict[str, dict] = {
    "star_spike_24h": {"window_days": 1, "min_daily_stars": 300},
    "star_spike_48h": {"window_days": 2, "min_daily_stars": 200},
    "momentum_surge": {"min_trend_score_jump": 0.5},   # trend_score increase in 1 day
}


def _normal_cdf(z_score: float) -> float:
    return 0.5 * (1.0 + math.erf(z_score / math.sqrt(2.0)))


def _momentum_direction(values: list[float]) -> str:
    if len(values) < 6:
        return "stable"
    recent = sum(values[-3:]) / 3
    earlier = sum(values[-6:-3]) / 3
    if earlier == 0:
        if recent > 0:
            return "accelerating"
        return "stable"
    delta = (recent - earlier) / abs(earlier)
    if delta > 0.3:
        return "accelerating"
    if delta < -0.3:
        return "declining"
    return "stable"


def _statistical_spike_context(df: pd.DataFrame, column: str) -> dict | None:
    if column not in df.columns or len(df) < SPIKE_MIN_HISTORY_DAYS + 1:
        return None

    series = pd.to_numeric(df[column], errors="coerce").dropna().astype(float)
    if len(series) < SPIKE_MIN_HISTORY_DAYS + 1:
        return None

    history = series.iloc[:-1].tail(max(SPIKE_MIN_HISTORY_DAYS, 14)).tolist()
    current = float(series.iloc[-1])
    if len(history) < SPIKE_MIN_HISTORY_DAYS:
        return None

    mean = float(sum(history) / len(history))
    variance = float(sum((value - mean) ** 2 for value in history) / len(history))
    stddev = math.sqrt(variance)
    if stddev == 0:
        if current <= mean:
            return None
        stddev = max(abs(mean) * 0.1, 1.0)

    z_score = float((current - mean) / stddev)
    if z_score < SPIKE_Z_THRESHOLD:
        return None

    recent_window = series.iloc[-2:].tolist()
    sustained = all(((value - mean) / stddev) >= SPIKE_SUSTAINED_Z_THRESHOLD for value in recent_window)
    percentile = round(_normal_cdf(z_score) * 100, 2)

    return {
        "current": round(current, 4),
        "baseline_mean": round(mean, 4),
        "baseline_stddev": round(stddev, 4),
        "z_score": round(z_score, 4),
        "percentile": percentile,
        "is_sustained": sustained,
        "momentum_direction": _momentum_direction(series.tail(6).tolist()),
    }


def _create_new_breakout_alerts(db, today: date) -> int:
    new_alerts = 0
    breakout_rows = (
        db.query(ComputedMetric, Repository)
        .join(Repository, Repository.id == ComputedMetric.repo_id)
        .filter(
            ComputedMetric.date == today,
            Repository.age_days <= 45,
            ComputedMetric.trend_score >= 0.35,
        )
        .order_by(ComputedMetric.trend_score.desc())
        .limit(10)
        .all()
    )

    start_of_day = datetime.combine(today, datetime.min.time())
    for cm, repo in breakout_rows:
        existing = (
            db.query(TrendAlert)
            .filter(
                TrendAlert.repo_id == repo.id,
                TrendAlert.alert_type == "new_breakout",
                TrendAlert.triggered_at >= start_of_day,
            )
            .first()
        )
        if existing:
            continue
        db.add(
            TrendAlert(
                repo_id=repo.id,
                alert_type="new_breakout",
                window_days=1,
                headline=f"{repo.owner}/{repo.name} entered today's breakout cohort",
                metric_value=round(cm.trend_score or 0.0, 4),
                threshold=0.35,
                triggered_at=datetime.now(timezone.utc).replace(tzinfo=None),
                is_read=False,
                momentum_direction="accelerating",
            )
        )
        new_alerts += 1
    return new_alerts


def detect_and_write_alerts(
    db,
    repo: "Repository",
    df: pd.DataFrame,
    today_trend_score: float,
    yesterday_trend_score: float,
) -> int:
    """
    Checks a single repo against hard and adaptive thresholds and writes TrendAlert rows.
    Idempotent: skips if an identical (repo_id, alert_type, same calendar day)
    alert already exists.
    Returns the count of new alerts written.
    """
    if df.empty:
        return 0

    today = _today()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    alerts_written = 0

    def _already_alerted(alert_type: str) -> bool:
        return bool(
            db.query(TrendAlert)
            .filter(
                TrendAlert.repo_id == repo.id,
                TrendAlert.alert_type == alert_type,
                TrendAlert.triggered_at >= datetime.combine(today, datetime.min.time()),
            )
            .first()
        )

    def _write(
        alert_type: str,
        headline: str,
        value: float,
        threshold: float,
        window_days: int = 1,
        extra: dict | None = None,
    ):
        nonlocal alerts_written
        if _already_alerted(alert_type):
            return
        extra = extra or {}
        alert = TrendAlert(
            repo_id=repo.id,
            alert_type=alert_type,
            window_days=window_days,
            headline=headline,
            metric_value=round(value, 2),
            threshold=round(threshold, 2),
            baseline_mean=extra.get("baseline_mean"),
            baseline_stddev=extra.get("baseline_stddev"),
            z_score=extra.get("z_score"),
            percentile=extra.get("percentile"),
            is_sustained=bool(extra.get("is_sustained", False)),
            momentum_direction=extra.get("momentum_direction"),
            triggered_at=now,
            is_read=False,
            extra_json=None,
        )
        db.add(alert)
        alerts_written += 1
        logger.info(f"ALERT [{alert_type}] {repo.owner}/{repo.name}: {headline}")

    # ── Star spike 24 h ──────────────────────────────────────────────────────
    thresh_24h = _ALERT_THRESHOLDS["star_spike_24h"]
    if len(df) >= 1:
        daily_stars = int(df.iloc[-1]["daily_star_delta"])
        if daily_stars >= thresh_24h["min_daily_stars"]:
            _write(
                "star_spike_24h",
                f"{repo.owner}/{repo.name} gained {daily_stars:,} stars in 24 h",
                value=daily_stars,
                threshold=thresh_24h["min_daily_stars"],
                window_days=1,
            )

    # ── Star spike 48 h ──────────────────────────────────────────────────────
    thresh_48h = _ALERT_THRESHOLDS["star_spike_48h"]
    if len(df) >= 2:
        stars_48h = int(df.tail(2)["daily_star_delta"].sum())
        if stars_48h >= thresh_48h["min_daily_stars"] * 2:
            _write(
                "star_spike_48h",
                f"{repo.owner}/{repo.name} gained {stars_48h:,} stars in 48 h",
                value=stars_48h,
                threshold=thresh_48h["min_daily_stars"] * 2,
                window_days=2,
            )

    star_spike = _statistical_spike_context(df, "daily_star_delta")
    if star_spike:
        _write(
            "stat_spike_24h",
            f"{repo.owner}/{repo.name} is {star_spike['z_score']:.1f}σ above its normal star velocity",
            value=star_spike["current"],
            threshold=SPIKE_Z_THRESHOLD,
            window_days=1,
            extra=star_spike,
        )

    # ── Momentum surge (trend score jump) ────────────────────────────────────
    thresh_surge = _ALERT_THRESHOLDS["momentum_surge"]
    score_jump = today_trend_score - yesterday_trend_score
    if score_jump >= thresh_surge["min_trend_score_jump"]:
        _write(
            "momentum_surge",
            f"{repo.owner}/{repo.name} momentum surged +{score_jump:.2f} pts today",
            value=score_jump,
            threshold=thresh_surge["min_trend_score_jump"],
            window_days=1,
        )

    pr_spike = _statistical_spike_context(df, "daily_pr_delta")
    if pr_spike and pr_spike["current"] >= 5:
        _write(
            "pr_surge",
            f"{repo.owner}/{repo.name} merged PR volume spiked {pr_spike['z_score']:.1f}σ above baseline",
            value=pr_spike["current"],
            threshold=SPIKE_Z_THRESHOLD,
            window_days=1,
            extra=pr_spike,
        )

    return alerts_written


# ─── Category metrics cache writer ───────────────────────────────────────────

def _write_category_metrics_cache(db, days: int = 7) -> int:
    """
    Computes category growth metrics for `days` and upserts rows into
    `category_metrics_daily`.  Called from run_daily_scoring so dashboards
    read from the pre-aggregated cache instead of recomputing on each request.
    Returns the number of categories written.
    """
    today = _today()
    rows = compute_category_growth(days=days)
    if not rows:
        return 0

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    written = 0
    for r in rows:
        existing = (
            db.query(CategoryMetricDaily)
            .filter_by(date=today, category=r["category"], period_days=days)
            .first()
        )
        fields = dict(
            total_stars=r.get("total_stars", 0),
            total_contributors=r.get("total_contributors", 0),
            total_merged_prs=r.get("total_merged_prs", 0),
            repo_count=r.get("repo_count", 0),
            period_star_gain=r.get("period_star_gain", 0),
            period_pr_gain=r.get("period_pr_gain", 0),
            avg_open_prs=r.get("avg_open_prs", 0.0),
            weekly_velocity=r.get("weekly_velocity", 0.0),
            mom_growth_pct=r.get("mom_growth_pct", 0.0),
            trend_composite=r.get("trend_composite", 0.0),
            computed_at=now,
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
        else:
            db.add(CategoryMetricDaily(
                date=today,
                category=r["category"],
                period_days=days,
                **fields,
            ))
        written += 1
    return written


def run_daily_scoring() -> dict:
    """
    Computes trend and sustainability scores for all repos that have today's
    daily_metrics row.  Upserts into computed_metrics.
    Also:
    - Detects momentum / star-spike alerts and writes to trend_alerts
    - Pre-aggregates category metrics into category_metrics_daily cache
    """
    db = SessionLocal()
    today = _today()
    scored = 0
    failed = 0
    alert_count = 0

    try:
        repos = db.query(Repository).all()
        logger.info(f"Starting scoring for {len(repos)} repos")

        for repo in repos:
            try:
                # Check if already scored today
                existing = (
                    db.query(ComputedMetric)
                    .filter_by(repo_id=repo.id, date=today)
                    .first()
                )

                df = _load_window_df(repo.id, days=60)
                if df.empty:
                    continue

                trend_metrics   = _ensure_python_types(compute_trend_score(df, max(repo.age_days, 1)))
                sustain_metrics = _ensure_python_types(compute_sustainability_score(df, max(repo.age_days, 1)))

                if existing:
                    for k, v in {**trend_metrics, **sustain_metrics}.items():
                        setattr(existing, k, v)
                    existing.computed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                else:
                    cm = ComputedMetric(
                        repo_id=repo.id,
                        date=today,
                        **trend_metrics,
                        **sustain_metrics,
                    )
                    db.add(cm)

                # ── Alert detection ──────────────────────────────────────────
                previous_metric = (
                    db.query(ComputedMetric)
                    .filter(ComputedMetric.repo_id == repo.id, ComputedMetric.date < today)
                    .order_by(ComputedMetric.date.desc())
                    .first()
                )
                yesterday_score = previous_metric.trend_score if previous_metric and previous_metric.trend_score else 0.0
                alert_count += detect_and_write_alerts(
                    db, repo, df,
                    today_trend_score=trend_metrics["trend_score"],
                    yesterday_trend_score=yesterday_score,
                )

                # ── Evaluate Real-time User Alert Rules ──
                try:
                    import asyncio
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(evaluate_alert_rules(repo.id, db))
                    else:
                        loop.run_until_complete(evaluate_alert_rules(repo.id, db))
                except Exception as e:
                    logger.warning(f"Failed to evaluate custom alert rules for {repo.id}: {e}")

                scored += 1

            except Exception as e:
                logger.error(f"Scoring failed for {repo.owner}/{repo.name}: {e}")
                failed += 1

        # ── Pre-aggregate category metrics into cache ────────────────────────
        try:
            alert_count += _create_new_breakout_alerts(db, today)
        except Exception as e:
            logger.warning(f"New breakout alert generation failed (non-fatal): {e}")

        try:
            cats_written = _write_category_metrics_cache(db, days=7)
            logger.info(f"Category cache refreshed: {cats_written} categories")
        except Exception as e:
            logger.warning(f"Category cache write failed (non-fatal): {e}")
            cats_written = 0

        db.commit()
        summary = {
            "scored": scored,
            "failed": failed,
            "alerts": alert_count,
            "categories_cached": cats_written,
            "date": str(today),
        }
        logger.info(f"Scoring complete: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Scoring pipeline error: {e}", exc_info=True)
        raise
    finally:
        db.close()
