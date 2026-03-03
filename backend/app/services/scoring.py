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
                releases,
                daily_star_delta
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
            "releases": r.releases,
            "daily_star_delta": r.daily_star_delta,
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
    TrendScore = (vel×0.4 + accel×0.2 + contrib×0.2 + release×0.1 + issue×0.1)
                 / log(age_days)
    """
    vel_7d = _star_velocity(df, 7)
    vel_30d = _star_velocity(df, 30)
    accel = _acceleration(df)
    contrib_growth = _contributor_growth_rate(df)
    release_b = _release_boost(df)
    issue_s = _issue_spike(df)

    raw = (
        vel_7d * 0.4 +
        accel * 0.2 +
        contrib_growth * 0.2 +
        release_b * 0.1 +
        issue_s * 0.1
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

def compute_category_growth() -> list[dict]:
    """
    For each category: total stars, weekly velocity, MoM growth, repo count.
    Returns list of dicts for the dashboard/categories endpoint.
    """
    try:
        conn = _get_duck_conn()
        cutoff = (_today() - timedelta(days=35)).isoformat()
        df = conn.execute(f"""
            SELECT
                r.category,
                r.id AS repo_id,
                DATE(dm.captured_at) AS day,
                dm.stars,
                dm.daily_star_delta
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
        latest = grp.sort_values("day").groupby("repo_id").last().reset_index()
        total_stars = int(latest["stars"].sum())

        # Weekly velocity: mean daily_star_delta last 7 days
        last7 = grp[grp["day"] >= (grp["day"].max() - pd.Timedelta(days=7))]
        weekly_velocity = float(last7["daily_star_delta"].sum())

        # MoM: compare last 7d vs prior 7d–35d
        last7_stars = float(last7["daily_star_delta"].sum())
        prior = grp[
            (grp["day"] < (grp["day"].max() - pd.Timedelta(days=7))) &
            (grp["day"] >= (grp["day"].max() - pd.Timedelta(days=35)))
        ]
        prior_stars = float(prior["daily_star_delta"].sum())
        mom_growth = ((last7_stars - prior_stars) / max(prior_stars, 1)) * 100

        results.append({
            "category": category,
            "total_stars": total_stars,
            "weekly_velocity": round(weekly_velocity, 1),
            "mom_growth_pct": round(mom_growth, 2),
            "repo_count": int(latest["repo_id"].nunique()),
        })

    return sorted(results, key=lambda x: x["weekly_velocity"], reverse=True)


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
