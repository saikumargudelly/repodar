"""
Scoring engine — computes TrendScore, SustainabilityScore, and category growth.
Uses DuckDB for efficient columnar aggregations over the SQLite daily_metrics data.
Writes results to computed_metrics table.
"""

import math
import logging
from datetime import date, datetime, timezone, timedelta

import duckdb
import pandas as pd

from app.database import SessionLocal, engine
from app.models import Repository, DailyMetric, ComputedMetric

logger = logging.getLogger(__name__)


def _today() -> date:
    return datetime.now(timezone.utc).date()


# ─── DuckDB connection over SQLite ───────────────────────────────────────────

def _get_duck_conn():
    """Open a DuckDB connection with the SQLite file attached (read-only)."""
    import os
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.getenv("DATABASE_URL", "sqlite:///./repodar.db")
    sqlite_path = db_url.replace("sqlite:///", "")
    conn = duckdb.connect()
    conn.execute(f"INSTALL sqlite; LOAD sqlite;")
    conn.execute(f"ATTACH '{sqlite_path}' AS repodar (TYPE sqlite)")
    return conn


# ─── Window data loader ──────────────────────────────────────────────────────

def _load_window_df(repo_id: str, days: int = 60) -> pd.DataFrame:
    """Load the last N days of daily_metrics for a repo via DuckDB."""
    try:
        conn = _get_duck_conn()
        cutoff = (_today() - timedelta(days=days)).isoformat()
        df = conn.execute(f"""
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
                daily_pr_delta
            FROM repodar.daily_metrics
            WHERE repo_id = '{repo_id}'
              AND DATE(captured_at) >= '{cutoff}'
            ORDER BY day ASC
        """).fetchdf()
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
            "daily_pr_delta": getattr(r, 'daily_pr_delta', 0) or 0,
        } for r in rows]
        return pd.DataFrame(data)
    finally:
        db.close()


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
    old_val = df.iloc[-7]["contributors"]
    new_val = df.iloc[-1]["contributors"]
    if old_val == 0:
        return 0.0
    return (new_val - old_val) / old_val


def _release_boost(df: pd.DataFrame) -> float:
    """1.0 if releases increased in last 7 days, else 0.0."""
    if len(df) < 2:
        return 0.0
    old = df.iloc[-min(7, len(df))]["releases"]
    new = df.iloc[-1]["releases"]
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
    old = df.iloc[-7]["open_issues"]
    new = df.iloc[-1]["open_issues"]
    baseline = max(old, 1)
    return (new - old) / baseline


def _issue_close_rate(df: pd.DataFrame) -> float:
    """Approximated: stability in open issues (lower growth = higher close rate)."""
    if df.empty:
        return 0.5
    spike = _issue_spike(df)
    # Invert: negative spike (issues decreasing) = high close rate
    return max(0.0, min(1.0, 0.5 - spike))


def _release_frequency(df: pd.DataFrame, age_weeks: float) -> float:
    """Releases per week based on total release count."""
    if df.empty or age_weeks == 0:
        return 0.0
    total_releases = df.iloc[-1]["releases"]
    return total_releases / max(age_weeks, 1)


def _fork_to_star_ratio(df: pd.DataFrame) -> float:
    if df.empty:
        return 0.0
    stars = df.iloc[-1]["stars"]
    forks = df.iloc[-1]["forks"]
    if stars == 0:
        return 0.0
    return forks / stars


# ─── Composite scores ────────────────────────────────────────────────────────

def compute_trend_score(df: pd.DataFrame, age_days: int) -> dict:
    """
    TrendScore = (vel×0.35 + accel×0.2 + contrib×0.15 + pr_activity×0.15 + release×0.1 + issue×0.05)
                 / log(age_days)
    """
    vel_7d = _star_velocity(df, 7)
    vel_30d = _star_velocity(df, 30)
    accel = _acceleration(df)
    contrib_growth = _contributor_growth_rate(df)
    release_b = _release_boost(df)
    issue_s = _issue_spike(df)
    pr_activity = _pr_activity_score(df)

    raw = (
        vel_7d * 0.35 +
        accel * 0.2 +
        contrib_growth * 0.15 +
        pr_activity * 0.15 +
        release_b * 0.1 +
        issue_s * 0.05
    )

    age_log = math.log(max(age_days, 2))
    trend = raw / age_log if age_log > 0 else 0.0

    return {
        "star_velocity_7d": round(vel_7d, 4),
        "star_velocity_30d": round(vel_30d, 4),
        "acceleration": round(accel, 4),
        "contributor_growth_rate": round(contrib_growth, 4),
        "trend_score": round(trend, 6),
    }


def compute_sustainability_score(df: pd.DataFrame, age_days: int) -> dict:
    """
    SustainabilityScore = (active_contrib×0.3 + issue_close×0.3 + rel_freq×0.2 + fork_star×0.2)
    Label: GREEN>0.6, YELLOW 0.3–0.6, RED<0.3
    """
    # Use contributor_growth_rate as proxy for active contributors (normalized 0-1)
    cg = min(1.0, max(0.0, _contributor_growth_rate(df) + 0.5))
    ic = _issue_close_rate(df)
    age_weeks = age_days / 7.0
    rf = min(1.0, _release_frequency(df, age_weeks) / 2.0)  # cap at 2/week = 1.0
    fsr = min(1.0, _fork_to_star_ratio(df) * 5)             # 20% fork rate = 1.0

    score = (cg * 0.3) + (ic * 0.3) + (rf * 0.2) + (fsr * 0.2)
    score = round(score, 4)

    if score >= 0.6:
        label = "GREEN"
    elif score >= 0.3:
        label = "YELLOW"
    else:
        label = "RED"

    return {
        "issue_close_rate": round(ic, 4),
        "release_frequency": round(rf, 4),
        "fork_to_star_ratio": round(_fork_to_star_ratio(df), 4),
        "sustainability_score": score,
        "sustainability_label": label,
    }


# ─── Category growth model ───────────────────────────────────────────────────

def compute_category_growth(days: int = 7) -> list[dict]:
    """
    For each category: total stars, weekly velocity, MoM growth, period star
    gain, and repo count.  `days` controls the period window so the heatmap
    reflects the currently selected time-range.
    Returns list of dicts for the dashboard/categories endpoint.
    """
    try:
        conn = _get_duck_conn()
        fetch_days = max(days + 7, 35)  # always fetch enough for MoM baseline
        cutoff = (_today() - timedelta(days=fetch_days)).isoformat()
        df = conn.execute(f"""
            SELECT
                r.category,
                r.id AS repo_id,
                DATE(dm.captured_at) AS day,
                dm.stars,
                dm.daily_star_delta,
                dm.merged_prs,
                COALESCE(dm.open_prs, 0) AS open_prs,
                COALESCE(dm.daily_pr_delta, 0) AS daily_pr_delta
            FROM repodar.repositories r
            JOIN repodar.daily_metrics dm ON dm.repo_id = r.id
            WHERE DATE(dm.captured_at) >= '{cutoff}'
        """).fetchdf()
        conn.close()
    except Exception as e:
        logger.warning(f"DuckDB category growth failed: {e}")
        return []

    if df.empty:
        return []

    results = []
    for category, grp in df.groupby("category"):
        grp = grp.sort_values("day")
        latest = grp.groupby("repo_id").last().reset_index()
        earliest = grp.groupby("repo_id").first().reset_index()
        total_stars = int(latest["stars"].sum())

        # ── Period star gain ──────────────────────────────────────────────────
        # Primary: use daily_star_delta sum if any non-zero values exist
        period_cutoff = grp["day"].max() - pd.Timedelta(days=days)
        period_data = grp[grp["day"] > period_cutoff].sort_values("day")

        if period_data["daily_star_delta"].sum() != 0:
            # Have real delta values
            period_star_gain = int(period_data["daily_star_delta"].sum())
        else:
            # Fallback: last_stars – first_stars per repo within the window
            # (works even when daily_star_delta was never populated)
            p_latest = period_data.groupby("repo_id")["stars"].last()
            p_earliest = period_data.groupby("repo_id")["stars"].first()
            period_star_gain = int((p_latest - p_earliest).sum())

            # If still 0 (only 1 snapshot per repo in window), widen to all data
            if period_star_gain == 0:
                period_star_gain = int((latest["stars"] - earliest["stars"]).sum())

        # Weekly velocity
        last7 = grp[grp["day"] >= (grp["day"].max() - pd.Timedelta(days=7))]
        weekly_velocity = float(last7["daily_star_delta"].sum())
        if weekly_velocity == 0:
            l7_latest = last7.groupby("repo_id")["stars"].last()
            l7_earliest = last7.groupby("repo_id")["stars"].first()
            weekly_velocity = float((l7_latest - l7_earliest).sum())

        # MoM: compare last 7d vs prior 7d–35d star gains
        last7_gain = weekly_velocity
        prior = grp[
            (grp["day"] < (grp["day"].max() - pd.Timedelta(days=7))) &
            (grp["day"] >= (grp["day"].max() - pd.Timedelta(days=35)))
        ]
        prior_gain = float(prior["daily_star_delta"].sum())
        if prior_gain == 0:
            pr_latest = prior.groupby("repo_id")["stars"].last()
            pr_earliest = prior.groupby("repo_id")["stars"].first()
            prior_gain = float((pr_latest - pr_earliest).sum())
        mom_growth = ((last7_gain - prior_gain) / max(abs(prior_gain), 1)) * 100

        # ── Period PR gain ────────────────────────────────────────────────────
        if "daily_pr_delta" in period_data.columns and period_data["daily_pr_delta"].sum() > 0:
            period_pr_gain = int(period_data["daily_pr_delta"].sum())
        elif "merged_prs" in period_data.columns and len(period_data) >= 2:
            p_pr_latest = period_data.groupby("repo_id")["merged_prs"].last()
            p_pr_earliest = period_data.groupby("repo_id")["merged_prs"].first()
            period_pr_gain = int((p_pr_latest - p_pr_earliest).sum())
        else:
            period_pr_gain = 0

        # Open PRs / merged PRs across the category (latest snapshot)
        avg_open_prs = round(float(latest["open_prs"].mean()) if "open_prs" in latest.columns else 0.0, 1)
        total_open_prs = int(latest["open_prs"].sum()) if "open_prs" in latest.columns else 0
        total_merged_prs = int(latest["merged_prs"].sum()) if "merged_prs" in latest.columns else 0
        total_contributors = int(latest["contributors"].sum()) if "contributors" in latest.columns else 0
        total_open_issues = int(latest["open_issues"].sum()) if "open_issues" in latest.columns else 0

        # Raw signals for trend_composite (cross-category normalisation done below)
        # star_velocity proxy: weekly stars gained (or total if no delta)
        star_signal = weekly_velocity if weekly_velocity > 0 else total_stars
        # acceleration proxy: mom_growth_pct (can be negative)
        accel_signal = max(mom_growth, 0.0)
        contrib_signal = float(total_contributors)
        release_signal = float(int(latest["releases"].sum()) if "releases" in latest.columns else 0)
        issue_signal = float(total_open_issues)  # will be inverted during normalisation

        results.append({
            "category": category,
            "total_stars": total_stars,
            "weekly_velocity": round(weekly_velocity, 1),
            "mom_growth_pct": round(mom_growth, 2),
            "repo_count": int(latest["repo_id"].nunique()),
            "period_star_gain": period_star_gain,
            "period_pr_gain": period_pr_gain,
            "avg_open_prs": avg_open_prs,
            "total_open_prs": total_open_prs,
            "total_merged_prs": total_merged_prs,
            "total_contributors": total_contributors,
            "total_open_issues": total_open_issues,
            # raw signals – normalised after loop
            "_star_signal": star_signal,
            "_accel_signal": accel_signal,
            "_contrib_signal": contrib_signal,
            "_release_signal": release_signal,
            "_issue_signal": issue_signal,
            "trend_composite": 0.0,
        })

    # ── Cross-category normalisation → trend_composite ────────────────────────
    def _norm(vals: list[float]) -> list[float]:
        mn, mx = min(vals), max(vals)
        return [((v - mn) / (mx - mn)) if mx > mn else 0.5 for v in vals]

    if results:
        s_norm  = _norm([r["_star_signal"]    for r in results])
        a_norm  = _norm([r["_accel_signal"]   for r in results])
        c_norm  = _norm([r["_contrib_signal"] for r in results])
        rl_norm = _norm([r["_release_signal"] for r in results])
        # Issue: more open issues = more active (not inverted here)
        i_norm  = _norm([r["_issue_signal"]   for r in results])

        for i, row in enumerate(results):
            row["trend_composite"] = round(
                s_norm[i]  * 0.40 +
                a_norm[i]  * 0.20 +
                c_norm[i]  * 0.20 +
                rl_norm[i] * 0.10 +
                i_norm[i]  * 0.10,
                4,
            )
            # Remove temporary raw signal keys
            for k in ("_star_signal", "_accel_signal", "_contrib_signal",
                      "_release_signal", "_issue_signal"):
                row.pop(k, None)

    return sorted(results, key=lambda x: x["trend_composite"], reverse=True)


# ─── Main daily scoring runner ───────────────────────────────────────────────

def run_daily_scoring() -> dict:
    """
    Computes trend and sustainability scores for all repos that have today's
    daily_metrics row. Upserts into computed_metrics.
    """
    db = SessionLocal()
    today = _today()
    scored = 0
    failed = 0

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

                trend_metrics = compute_trend_score(df, max(repo.age_days, 1))
                sustain_metrics = compute_sustainability_score(df, max(repo.age_days, 1))

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

                scored += 1

            except Exception as e:
                logger.error(f"Scoring failed for {repo.owner}/{repo.name}: {e}")
                failed += 1

        db.commit()
        summary = {"scored": scored, "failed": failed, "date": str(today)}
        logger.info(f"Scoring complete: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Scoring pipeline error: {e}", exc_info=True)
        raise
    finally:
        db.close()
