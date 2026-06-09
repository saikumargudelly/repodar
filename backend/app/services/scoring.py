"""
Scoring engine — computes TrendScore, SustainabilityScore, and category growth.
Uses native SQLAlchemy queries and pure Python for maximum lightweight performance.
Writes results to computed_metrics table.
"""

import math
import logging
import os
from datetime import date, datetime, timezone, timedelta
from collections import defaultdict

from app.database import SessionLocal, engine
from app.models import Repository, DailyMetric, ComputedMetric, TrendAlert, CategoryMetricDaily
from app.models.watchlist import WatchlistItem
from app.services.alert_engine import evaluate_alert_rules

logger = logging.getLogger(__name__)

SPIKE_Z_THRESHOLD = float(os.getenv("SPIKE_Z_THRESHOLD", "1.8"))
SPIKE_MIN_HISTORY_DAYS = int(os.getenv("SPIKE_MIN_HISTORY_DAYS", "7"))
SPIKE_SUSTAINED_Z_THRESHOLD = float(os.getenv("SPIKE_SUSTAINED_Z_THRESHOLD", "1.5"))


def _today() -> date:
    return datetime.now(timezone.utc).date()


# ─── Window data loader ──────────────────────────────────────────────────────

def _load_window_df(repo_id: str, days: int = 60) -> list[dict]:
    """Load the last N days of daily_metrics for a repo via SQLAlchemy."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        rows = (
            db.query(DailyMetric)
            .filter(DailyMetric.repo_id == repo_id, DailyMetric.captured_at >= cutoff)
            .order_by(DailyMetric.captured_at.asc())
            .all()
        )
        return [{
            "day": r.captured_at.date(),
            "stars": r.stars,
            "forks": r.forks,
            "contributors": r.contributors,
            "open_issues": r.open_issues,
            "open_prs": getattr(r, 'open_prs', 0) or 0,
            "merged_prs": r.merged_prs,
            "releases": r.releases,
            "daily_star_delta": r.daily_star_delta or 0,
            "daily_fork_delta": getattr(r, 'daily_fork_delta', 0) or 0,
            "daily_pr_delta": getattr(r, 'daily_pr_delta', 0) or 0,
            "commit_count": getattr(r, 'commit_count', 0) or 0,
            "daily_commit_delta": getattr(r, 'daily_commit_delta', 0) or 0,
        } for r in rows]
    except Exception as e:
        logger.error(f"SQLAlchemy load failed for {repo_id}: {e}")
        return []
    finally:
        db.close()


# ─── Type conversion utility ────────────────────────────────────────────────────

def _ensure_python_types(d: dict) -> dict:
    """Pass-through legacy helper."""
    return d


# ─── Metric computations ─────────────────────────────────────────────────────

def _star_velocity(df: list[dict], window: int) -> float:
    """Mean daily star delta over last N days."""
    if not df or len(df) < 2:
        return 0.0
    tail = df[-window:]
    deltas = [r["daily_star_delta"] for r in tail if r["daily_star_delta"] is not None]
    if not deltas:
        return 0.0
    return float(sum(deltas) / len(deltas))


def _acceleration(df: list[dict]) -> float:
    """7d velocity minus prior 7d velocity."""
    if len(df) < 14:
        return 0.0
    recent_vel = _star_velocity(df[-14:-7], 7)  # prior 7d
    current_vel = _star_velocity(df[-7:], 7)          # current 7d
    return current_vel - recent_vel


def _contributor_growth_rate(df: list[dict]) -> float:
    if len(df) < 7:
        return 0.0
    old_val = float(df[-7]["contributors"] or 0)
    new_val = float(df[-1]["contributors"] or 0)
    if old_val == 0:
        return 0.0
    return float((new_val - old_val) / old_val)


def _release_boost(df: list[dict]) -> float:
    """1.0 if releases increased in last 7 days, else 0.0."""
    if len(df) < 2:
        return 0.0
    old = float(df[-min(7, len(df))]["releases"] or 0)
    new = float(df[-1]["releases"] or 0)
    return 1.0 if new > old else 0.0


def _pr_activity_score(df: list[dict]) -> float:
    """
    PR activity signal combining:
    - Merged PR velocity over last 7 days (daily_pr_delta sum)
    - Open PR count normalised (more open PRs = more active development)
    Returns a value in [0, 1] (capped).
    """
    if not df:
        return 0.0
    
    tail_7 = df[-7:]
    pr_velocity = float(sum(r.get("daily_pr_delta", 0) or 0 for r in tail_7))
    if pr_velocity == 0.0 and len(df) >= 2:
        pr_velocity = float((df[-1].get("merged_prs", 0) or 0) - (df[0].get("merged_prs", 0) or 0))

    open_pr_norm = min(1.0, float(df[-1].get("open_prs", 0) or 0) / 50.0)
    combined = (min(1.0, pr_velocity / 20.0) * 0.7) + (open_pr_norm * 0.3)
    return round(min(1.0, combined), 4)


def _issue_spike(df: list[dict]) -> float:
    """Normalized open issue delta over 7 days."""
    if len(df) < 7:
        return 0.0
    old = float(df[-7]["open_issues"] or 0)
    new = float(df[-1]["open_issues"] or 0)
    baseline = max(old, 1.0)
    return float((new - old) / baseline)


def _issue_close_rate(df: list[dict]) -> float:
    """Approximated: stability in open issues (lower growth = higher close rate)."""
    if not df:
        return 0.5
    spike = _issue_spike(df)
    return float(max(0.0, min(1.0, 0.5 - spike)))


def _release_frequency(df: list[dict], age_weeks: float) -> float:
    """Releases per week based on total release count."""
    if not df or age_weeks == 0:
        return 0.0
    total_releases = float(df[-1]["releases"] or 0)
    return float(total_releases / max(age_weeks, 1.0))


def _fork_to_star_ratio(df: list[dict]) -> float:
    if not df:
        return 0.0
    stars = float(df[-1]["stars"] or 0)
    forks = float(df[-1]["forks"] or 0)
    if stars == 0:
        return 0.0
    return float(forks / stars)


def _fork_growth_score(df: list[dict]) -> float:
    """
    Fork growth signal: % increase in forks over the last 7 days.
    Normalised so that 5 % fork growth/week ≈ 1.0.
    """
    if len(df) < 2:
        return 0.0
    tail_7 = df[-7:]
    delta = float(sum(r.get("daily_fork_delta", 0) or 0 for r in tail_7))
    if delta == 0.0:
        old_forks = float(df[-min(7, len(df))]["forks"] or 0)
        delta = float((df[-1]["forks"] or 0) - old_forks)
    
    idx = -min(7, len(df))
    baseline = max(float(df[idx]["forks"] or 0), 1.0)
    pct = delta / baseline
    return float(round(min(1.0, pct / 0.05), 4))   # 5 % / week → 1.0


def _commit_frequency_score(df: list[dict]) -> float:
    """
    Commit frequency signal: average new commits per day over the last 7 days.
    Normalised so that 10 commits/day ≈ 1.0.
    """
    if not df:
        return 0.0
    tail_7 = df[-7:]
    avg = float(sum(r.get("daily_commit_delta", 0) or 0 for r in tail_7) / len(tail_7)) if tail_7 else 0.0
    return float(round(min(1.0, avg / 10.0), 4))   # 10 commits/day → 1.0


# ─── Composite scores ────────────────────────────────────────────────────────

def compute_trend_score(df: list[dict], age_days: int) -> dict:
    """
    TrendScore (0–100 normalised) — momentum signal across 7 signals:

      Signal              Weight   Rationale
      ─────────────────── ────── ───────────────────────────────────────────
      star_velocity_7d     0.30   Primary demand signal
      acceleration         0.20   Is demand accelerating?
      commit_frequency     0.15   Developer activity
      contributor_growth   0.10   Community growth
      pr_activity          0.10   Contribution health
      fork_growth          0.10   Downstream usage signal
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

    vel_7d_norm = min(1.0, vel_7d / 100.0)
    accel_norm = min(1.0, max(0.0, accel) / 50.0)
    contrib_growth_norm = min(1.0, max(0.0, contrib_growth))
    issue_s_norm = min(1.0, max(0.0, issue_s))

    raw = float(
        vel_7d_norm    * 0.30 +
        accel_norm     * 0.20 +
        commit_freq    * 0.15 +
        contrib_growth_norm * 0.10 +
        pr_activity    * 0.10 +
        fork_growth    * 0.10 +
        release_b      * 0.03 +
        issue_s_norm   * 0.02
    )

    age_log = math.log(max(age_days, 2))
    trend = float(raw / age_log) if age_log > 0 else 0.0
    trend = min(1.0, trend)

    return {
        "star_velocity_7d": float(round(vel_7d, 4)),
        "star_velocity_30d": float(round(vel_30d, 4)),
        "acceleration": float(round(accel, 4)),
        "contributor_growth_rate": float(round(contrib_growth, 4)),
        "trend_score": float(round(trend, 6)),
    }


def compute_sustainability_score(df: list[dict], age_days: int) -> dict:
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

def compute_category_growth(days: int = 7) -> list[dict]:
    """
    Per-category aggregated metrics + composite TrendScore using:
      Star velocity 40% | Acceleration 20% | Contributor growth 20%
      Release boost 10% | Issue activity 10%
    All signals are min-max normalised across categories before weighting.
    """
    fetch_days = max(days + 7, 35)
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
    except Exception as e:
        logger.error(f"SQLAlchemy category growth failed: {e}")
        return []
    finally:
        db.close()

    if not rows:
        return []

    # Group metrics by category, and inside by repo_id
    category_data = defaultdict(lambda: defaultdict(list))
    for r in rows:
        metric = {
            "day": r.captured_at.date(),
            "stars": r.stars or 0,
            "daily_star_delta": r.daily_star_delta or 0,
            "contributors": r.contributors or 0,
            "open_issues": r.open_issues or 0,
            "releases": r.releases or 0,
            "merged_prs": r.merged_prs or 0,
            "open_prs": r.open_prs or 0,
            "daily_pr_delta": r.daily_pr_delta or 0,
        }
        category_data[r.category][r.repo_id].append(metric)

    raw_results = []
    
    today_ref = _today()
    period_cutoff_date = today_ref - timedelta(days=days)
    last_7_date = today_ref - timedelta(days=7)
    prior_7_start_date = today_ref - timedelta(days=14)
    prior_all_start_date = today_ref - timedelta(days=35)

    for category, repos_dict in category_data.items():
        latest_metrics = {}
        earliest_metrics = {}
        
        period_metrics = defaultdict(list)
        last7_metrics = defaultdict(list)
        prior7_metrics = defaultdict(list)
        prior_all_metrics = defaultdict(list)

        for repo_id, m_list in repos_dict.items():
            m_list.sort(key=lambda x: x["day"])
            latest_metrics[repo_id] = m_list[-1]
            earliest_metrics[repo_id] = m_list[0]

            for m in m_list:
                day = m["day"]
                if day > period_cutoff_date:
                    period_metrics[repo_id].append(m)
                if day >= last_7_date:
                    last7_metrics[repo_id].append(m)
                if prior_7_start_date <= day < last_7_date:
                    prior7_metrics[repo_id].append(m)
                if prior_all_start_date <= day < last_7_date:
                    prior_all_metrics[repo_id].append(m)

        total_stars = sum(m["stars"] for m in latest_metrics.values())
        total_contributors = sum(m["contributors"] for m in latest_metrics.values())
        total_merged_prs = sum(m["merged_prs"] for m in latest_metrics.values())
        repo_count = len(latest_metrics)

        # Period star gain
        period_star_gain = 0
        for repo_id, p_list in period_metrics.items():
            delta_sum = sum(m["daily_star_delta"] for m in p_list)
            if delta_sum != 0:
                period_star_gain += delta_sum
            else:
                p_list.sort(key=lambda x: x["day"])
                period_star_gain += (p_list[-1]["stars"] - p_list[0]["stars"])

        if period_star_gain == 0:
            period_star_gain = sum(latest_metrics[rid]["stars"] - earliest_metrics[rid]["stars"] for rid in latest_metrics)

        # Star velocity (40 %)
        star_velocity = 0.0
        for repo_id, l7_list in last7_metrics.items():
            delta_sum = sum(m["daily_star_delta"] for m in l7_list)
            if delta_sum != 0:
                star_velocity += delta_sum
            else:
                l7_list.sort(key=lambda x: x["day"])
                star_velocity += (l7_list[-1]["stars"] - l7_list[0]["stars"])

        # Acceleration (20 %)
        prior_velocity = 0.0
        for repo_id, pr7_list in prior7_metrics.items():
            delta_sum = sum(m["daily_star_delta"] for m in pr7_list)
            if delta_sum != 0:
                prior_velocity += delta_sum
            elif len(pr7_list) >= 2:
                pr7_list.sort(key=lambda x: x["day"])
                prior_velocity += (pr7_list[-1]["stars"] - pr7_list[0]["stars"])
        acceleration = star_velocity - prior_velocity

        # Contributor growth (20 %)
        contributor_growth = sum(latest_metrics[rid]["contributors"] - earliest_metrics[rid]["contributors"] for rid in latest_metrics)

        # Release boost (10 %)
        release_boost_count = 0
        for rid in latest_metrics:
            if latest_metrics[rid]["releases"] > earliest_metrics[rid]["releases"]:
                release_boost_count += 1
        release_boost = release_boost_count / max(repo_count, 1)

        # Issue activity (10 %)
        issue_activity = sum(abs(latest_metrics[rid]["open_issues"] - earliest_metrics[rid]["open_issues"]) for rid in latest_metrics)

        # MoM
        prior_gain = 0.0
        for repo_id, pa_list in prior_all_metrics.items():
            delta_sum = sum(m["daily_star_delta"] for m in pa_list)
            if delta_sum != 0:
                prior_gain += delta_sum
            elif len(pa_list) >= 2:
                pa_list.sort(key=lambda x: x["day"])
                prior_gain += (pa_list[-1]["stars"] - pa_list[0]["stars"])
        mom_growth = ((star_velocity - prior_gain) / max(abs(prior_gain), 1)) * 100

        # Period PR gain
        period_pr_gain = 0
        for repo_id, p_list in period_metrics.items():
            delta_sum = sum(m["daily_pr_delta"] for m in p_list)
            if delta_sum > 0:
                period_pr_gain += delta_sum
            elif len(p_list) >= 2:
                p_list.sort(key=lambda x: x["day"])
                period_pr_gain += (p_list[-1]["merged_prs"] - p_list[0]["merged_prs"])

        avg_open_prs = sum(m["open_prs"] for m in latest_metrics.values()) / max(repo_count, 1)

        raw_results.append({
            "category":           category,
            "total_stars":        total_stars,
            "total_contributors": total_contributors,
            "total_merged_prs":   total_merged_prs,
            "weekly_velocity":    round(star_velocity, 1),
            "mom_growth_pct":     round(mom_growth, 2),
            "repo_count":         repo_count,
            "period_star_gain":   period_star_gain,
            "period_pr_gain":     period_pr_gain,
            "avg_open_prs":       round(avg_open_prs, 1),
            "_vel":   star_velocity,
            "_accel": acceleration,
            "_cont":  contributor_growth,
            "_rel":   release_boost,
            "_iss":   issue_activity,
        })

    if not raw_results:
        return []

    # If all velocity/contrib/issue delta signals are zero, fall back to absolute totals
    all_delta_zero = (
        all(r["_vel"] == 0 for r in raw_results) and
        all(r["_cont"] == 0 for r in raw_results) and
        all(r["_iss"] == 0 for r in raw_results)
    )
    if all_delta_zero:
        for r in raw_results:
            rc = max(r["repo_count"], 1)
            r["_vel"]  = r["total_stars"] / rc
            r["_accel"] = r["total_merged_prs"] / rc
            r["_cont"] = r["total_contributors"] / rc

    # Min-max normalise each signal
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
_ALERT_THRESHOLDS: dict[str, dict] = {
    "star_spike_24h": {"window_days": 1, "min_daily_stars": 30},
    "star_spike_48h": {"window_days": 2, "min_daily_stars": 25},
    "momentum_surge": {"min_trend_score_jump": 0.05},
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


def _statistical_spike_context(df: list[dict], column: str) -> dict | None:
    if not df or len(df) < SPIKE_MIN_HISTORY_DAYS + 1:
        return None

    series = []
    for r in df:
        val = r.get(column)
        if val is not None:
            series.append(float(val))

    if len(series) < SPIKE_MIN_HISTORY_DAYS + 1:
        return None

    history = series[:-1][-max(SPIKE_MIN_HISTORY_DAYS, 14):]
    current = float(series[-1])
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

    recent_window = series[-2:]
    sustained = all(((value - mean) / stddev) >= SPIKE_SUSTAINED_Z_THRESHOLD for value in recent_window)
    percentile = round(_normal_cdf(z_score) * 100, 2)

    return {
        "current": round(current, 4),
        "baseline_mean": round(mean, 4),
        "baseline_stddev": round(stddev, 4),
        "z_score": round(z_score, 4),
        "percentile": percentile,
        "is_sustained": sustained,
        "momentum_direction": _momentum_direction(series[-6:]),
    }


def _create_new_breakout_alerts(db, today: date) -> int:
    new_alerts = 0
    breakout_rows = (
        db.query(ComputedMetric, Repository)
        .join(Repository, Repository.id == ComputedMetric.repo_id)
        .filter(
            ComputedMetric.date == today,
            Repository.age_days <= 45,
            ComputedMetric.trend_score >= 0.1,
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
                threshold=0.1,
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
    df: list[dict],
    today_trend_score: float,
    yesterday_trend_score: float,
) -> int:
    """
    Checks a single repo against hard and adaptive thresholds and writes TrendAlert rows.
    """
    if not df:
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

    # Star spike 24 h
    thresh_24h = _ALERT_THRESHOLDS["star_spike_24h"]
    if len(df) >= 1:
        daily_stars = int(df[-1]["daily_star_delta"])
        if daily_stars >= thresh_24h["min_daily_stars"]:
            _write(
                "star_spike_24h",
                f"{repo.owner}/{repo.name} gained {daily_stars:,} stars in 24 h",
                value=daily_stars,
                threshold=thresh_24h["min_daily_stars"],
                window_days=1,
            )

    # Star spike 48 h
    thresh_48h = _ALERT_THRESHOLDS["star_spike_48h"]
    if len(df) >= 2:
        stars_48h = int(sum(r["daily_star_delta"] for r in df[-2:]))
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

    # Momentum surge
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
    `category_metrics_daily`.
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
    """
    db = SessionLocal()
    today = _today()
    scored = 0
    failed = 0
    alert_count = 0

    try:
        repos = db.query(Repository).all()
        logger.info(f"Starting scoring for {len(repos)} repos")

        from collections import defaultdict
        from sqlalchemy import and_, func as _func

        # 1. Pre-load all ComputedMetrics for today to prevent N+1 checks
        existing_today_map = {
            cm.repo_id: cm
            for cm in db.query(ComputedMetric).filter(ComputedMetric.date == today).all()
        }

        # 2. Pre-load last 60 days of DailyMetrics for ALL active repos in 1 query
        cutoff = datetime.now(timezone.utc) - timedelta(days=60)
        all_daily_metrics = (
            db.query(DailyMetric)
            .filter(DailyMetric.captured_at >= cutoff.replace(tzinfo=None))
            .order_by(DailyMetric.captured_at.asc())
            .all()
        )
        metrics_by_repo = defaultdict(list)
        for r in all_daily_metrics:
            metrics_by_repo[r.repo_id].append({
                "day": r.captured_at.date(),
                "stars": r.stars,
                "forks": r.forks,
                "contributors": r.contributors,
                "open_issues": r.open_issues,
                "open_prs": getattr(r, 'open_prs', 0) or 0,
                "merged_prs": r.merged_prs,
                "releases": r.releases,
                "daily_star_delta": r.daily_star_delta or 0,
                "daily_fork_delta": getattr(r, 'daily_fork_delta', 0) or 0,
                "daily_pr_delta": getattr(r, 'daily_pr_delta', 0) or 0,
                "commit_count": getattr(r, 'commit_count', 0) or 0,
                "daily_commit_delta": getattr(r, 'daily_commit_delta', 0) or 0,
            })

        # 3. Pre-load the latest ComputedMetric before today for all repos in 1 query
        max_prev_cm_subq = (
            db.query(
                ComputedMetric.repo_id.label("repo_id"),
                _func.max(ComputedMetric.date).label("max_date")
            )
            .filter(ComputedMetric.date < today)
            .group_by(ComputedMetric.repo_id)
            .subquery()
        )
        prev_cms = (
            db.query(ComputedMetric)
            .join(
                max_prev_cm_subq,
                and_(
                    ComputedMetric.repo_id == max_prev_cm_subq.c.repo_id,
                    ComputedMetric.date == max_prev_cm_subq.c.max_date
                )
            )
            .all()
        )
        prev_cm_map = {row.repo_id: row for row in prev_cms}

        for repo in repos:
            try:
                # Check from map
                existing = existing_today_map.get(repo.id)

                # Get from pre-loaded dictionary
                df = metrics_by_repo.get(repo.id, [])
                if not df:
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

                # Alert detection: get from map
                previous_metric = prev_cm_map.get(repo.id)
                yesterday_score = previous_metric.trend_score if previous_metric and previous_metric.trend_score else 0.0
                alert_count += detect_and_write_alerts(
                    db, repo, df,
                    today_trend_score=trend_metrics["trend_score"],
                    yesterday_trend_score=yesterday_score,
                )

                # Evaluate Real-time User Alert Rules
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
