from typing import List, Optional
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, DailyMetric, ComputedMetric, TrendAlert, CategoryMetricDaily
from app.services.scoring import compute_category_growth


def _latest_scored_date(db: Session) -> date:
    """Return the most recent date that has computed_metrics rows, falling back to today."""
    result = db.query(func.max(ComputedMetric.date)).scalar()
    return result if result else date.today()

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class BreakoutRepo(BaseModel):
    repo_id: str
    owner: str
    name: str
    category: str
    github_url: str
    trend_score: float
    acceleration: float
    star_velocity_7d: float
    sustainability_label: str
    age_days: int
    primary_language: Optional[str]


class SustainabilityEntry(BaseModel):
    repo_id: str
    owner: str
    name: str
    category: str
    sustainability_score: float
    sustainability_label: str
    trend_score: float


class CategoryMetrics(BaseModel):
    category: str
    total_stars: int
    total_contributors: int = 0
    total_merged_prs: int = 0
    weekly_velocity: float
    mom_growth_pct: float
    repo_count: int
    period_star_gain: int = 0
    period_pr_gain: int = 0
    avg_open_prs: float = 0.0
    trend_composite: float = 0.0


class AlertResponse(BaseModel):
    id: str
    repo_id: str
    owner: str
    name: str
    category: str
    alert_type: str
    window_days: int
    headline: str
    metric_value: float
    threshold: float
    baseline_mean: Optional[float] = None
    baseline_stddev: Optional[float] = None
    z_score: Optional[float] = None
    percentile: Optional[float] = None
    is_sustained: bool = False
    momentum_direction: Optional[str] = None
    triggered_at: str
    is_read: bool


class OverviewResponse(BaseModel):
    as_of: str
    total_repos: int          # active repos only (is_active=True)
    discovered_repos: int     # subset that were auto-discovered (not from seed)
    top_breakout: List[BreakoutRepo]
    sustainability_ranking: List[SustainabilityEntry]
    category_growth: List[CategoryMetrics]


class RadarRepo(BaseModel):
    repo_id: str
    owner: str
    name: str
    category: str
    github_url: str
    trend_score: float
    acceleration: float
    star_velocity_7d: float
    sustainability_label: str
    sustainability_score: float
    age_days: int
    stars: int = 0
    topics: Optional[list] = None
    primary_language: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewResponse)
def get_overview(db: Session = Depends(get_db)):
    """
    Ecosystem overview: category heatmap data, top-10 breakout repos,
    sustainability rankings.
    """
    latest_date = _latest_scored_date(db)

    # Latest score per repo (join)
    subq = (
        db.query(
            ComputedMetric.repo_id,
            ComputedMetric.trend_score,
            ComputedMetric.acceleration,
            ComputedMetric.star_velocity_7d,
            ComputedMetric.sustainability_score,
            ComputedMetric.sustainability_label,
        )
        .filter(ComputedMetric.date == latest_date)
        .subquery()
    )

    rows = (
        db.query(Repository, subq)
        .filter(Repository.is_active == True)  # noqa: E712
        .outerjoin(subq, Repository.id == subq.c.repo_id)
        .all()
    )

    breakout = []
    sustain_list = []

    for repo, ts, accel, vel, ss, sl in [
        (r, row[1], row[2], row[3], row[4], row[5]) for r, *row in rows
    ]:
        entry = BreakoutRepo(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            trend_score=ts or 0,
            acceleration=accel or 0,
            star_velocity_7d=vel or 0,
            sustainability_label=sl or "YELLOW",
            age_days=repo.age_days,
            primary_language=repo.primary_language,
        )
        breakout.append(entry)

        sustain_list.append(SustainabilityEntry(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            sustainability_score=ss or 0,
            sustainability_label=sl or "YELLOW",
            trend_score=ts or 0,
        ))

    breakout.sort(key=lambda x: x.trend_score, reverse=True)
    # Only surface repos with real non-zero trend scores as "breakouts"
    breakout_detected = [r for r in breakout if r.trend_score > 0]
    sustain_list.sort(key=lambda x: x.sustainability_score, reverse=True)
    # Only include repos that have actual scored data
    sustain_scored = [r for r in sustain_list if r.sustainability_score > 0]

    # Category growth: use today's pre-aggregated cache first (fast), fall back to live compute
    today = date.today()
    cached_cats = (
        db.query(CategoryMetricDaily)
        .filter_by(date=today, period_days=7)
        .all()
    )
    if cached_cats:
        cat_metrics = [
            CategoryMetrics(
                category=c.category,
                total_stars=c.total_stars,
                total_contributors=c.total_contributors,
                total_merged_prs=c.total_merged_prs,
                weekly_velocity=c.weekly_velocity,
                mom_growth_pct=c.mom_growth_pct,
                repo_count=c.repo_count,
                period_star_gain=c.period_star_gain,
                period_pr_gain=c.period_pr_gain,
                avg_open_prs=c.avg_open_prs,
                trend_composite=c.trend_composite,
            )
            for c in sorted(cached_cats, key=lambda x: x.trend_composite, reverse=True)
        ]
    else:
        category_growth = compute_category_growth()
        cat_metrics = [CategoryMetrics(**c) for c in category_growth]

    total_repos = db.query(Repository).filter(Repository.is_active == True).count()  # noqa: E712
    discovered_repos = (
        db.query(Repository)
        .filter(Repository.is_active == True, Repository.source == "auto_discovered")  # noqa: E712
        .count()
    )

    return OverviewResponse(
        as_of=latest_date.isoformat(),
        total_repos=total_repos,
        discovered_repos=discovered_repos,
        top_breakout=breakout_detected[:10],
        sustainability_ranking=sustain_scored[:20],
        category_growth=cat_metrics,
    )


@router.get("/radar", response_model=List[RadarRepo])
def get_breakout_radar(
    new_only: bool = Query(False, description="Only repos younger than 180 days"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    """
    Breakout Radar — repos ranked by TrendScore descending.
    Toggle new_only to filter repos under 180 days old.
    """
    latest_date = _latest_scored_date(db)

    subq = (
        db.query(
            ComputedMetric.repo_id,
            ComputedMetric.trend_score,
            ComputedMetric.acceleration,
            ComputedMetric.star_velocity_7d,
            ComputedMetric.sustainability_score,
            ComputedMetric.sustainability_label,
        )
        .filter(ComputedMetric.date == latest_date)
        .subquery()
    )

    query = db.query(Repository, subq).outerjoin(subq, Repository.id == subq.c.repo_id)

    if new_only:
        query = query.filter(Repository.age_days <= 180)

    rows = query.all()

    results = []
    for row in rows:
        repo = row[0]
        ts, accel, vel, ss, sl = row[2], row[3], row[4], row[5], row[6]
        import json as _json
        topics_raw = repo.topics
        topics_list = _json.loads(topics_raw) if topics_raw else []
        results.append(RadarRepo(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            trend_score=ts or 0,
            acceleration=accel or 0,
            star_velocity_7d=vel or 0,
            sustainability_label=sl or "YELLOW",
            sustainability_score=ss or 0,
            age_days=repo.age_days,
            stars=repo.stars_snapshot or 0,
            topics=topics_list,
            primary_language=repo.primary_language,
        ))

    results.sort(key=lambda x: x.trend_score, reverse=True)
    return results[:limit]


@router.get("/early-radar", response_model=List[RadarRepo])
def get_early_radar(
    max_age_days: int = Query(90, description="Max repo age in days (default 90)"),
    max_stars: int = Query(1000, description="Max star count — surface pre-viral repos"),
    min_acceleration: float = Query(0.0, description="Min acceleration score"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    """
    Early Radar — 'Before It Trends' feed.
    Surfaces repos < max_age_days old, under max_stars stars, with positive
    acceleration — pre-viral breakouts before they hit GitHub Trending.
    """
    import json as _json
    latest_date = _latest_scored_date(db)

    subq = (
        db.query(
            ComputedMetric.repo_id,
            ComputedMetric.trend_score,
            ComputedMetric.acceleration,
            ComputedMetric.star_velocity_7d,
            ComputedMetric.sustainability_score,
            ComputedMetric.sustainability_label,
        )
        .filter(ComputedMetric.date == latest_date)
        .subquery()
    )

    q = (
        db.query(Repository, subq)
        .filter(
            Repository.is_active == True,  # noqa: E712
            Repository.age_days <= max_age_days,
            Repository.stars_snapshot <= max_stars,
        )
        .outerjoin(subq, Repository.id == subq.c.repo_id)
    )
    if category:
        q = q.filter(Repository.category == category)

    rows = q.all()
    results = []
    for row in rows:
        repo = row[0]
        ts, accel, vel, ss, sl = row[2], row[3], row[4], row[5], row[6]
        if (accel or 0) < min_acceleration:
            continue
        topics_raw = repo.topics
        topics_list = _json.loads(topics_raw) if topics_raw else []
        results.append(RadarRepo(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            trend_score=ts or 0,
            acceleration=accel or 0,
            star_velocity_7d=vel or 0,
            sustainability_label=sl or "YELLOW",
            sustainability_score=ss or 0,
            age_days=repo.age_days,
            stars=repo.stars_snapshot or 0,
            topics=topics_list,
            primary_language=repo.primary_language,
        ))

    # Sort by acceleration desc, break ties by trend_score
    results.sort(key=lambda x: (x.acceleration, x.trend_score), reverse=True)
    return results[:limit]


@router.get("/categories", response_model=List[CategoryMetrics])
def get_category_metrics(
    period: str = Query("7d", description="1d | 7d | 30d | 90d | 365d | 3y | 5y"),
    db: Session = Depends(get_db),
):
    """Category-level aggregated growth metrics.

    Reads from the pre-aggregated `category_metrics_daily` cache when
    available (written at 00:30 UTC by run_daily_scoring), otherwise falls
    back to live DuckDB computation.  Cache reads are ~10 ms vs ~200 ms live.
    """
    days = PERIOD_DAYS.get(period, 7)
    today = date.today()

    # ── Try cache first (fast path) ───────────────────────────────────────
    cached = (
        db.query(CategoryMetricDaily)
        .filter_by(date=today, period_days=days)
        .all()
    )
    if cached:
        return [
            CategoryMetrics(
                category=c.category,
                total_stars=c.total_stars,
                total_contributors=c.total_contributors,
                total_merged_prs=c.total_merged_prs,
                weekly_velocity=c.weekly_velocity,
                mom_growth_pct=c.mom_growth_pct,
                repo_count=c.repo_count,
                period_star_gain=c.period_star_gain,
                period_pr_gain=c.period_pr_gain,
                avg_open_prs=c.avg_open_prs,
                trend_composite=c.trend_composite,
            )
            for c in sorted(cached, key=lambda x: x.trend_composite, reverse=True)
        ]

    # ── Live compute fallback ─────────────────────────────────────────────
    growth = compute_category_growth(days=days)
    return [CategoryMetrics(**c) for c in growth]


@router.get("/alerts", response_model=List[AlertResponse])
def get_alerts(
    unread_only: bool = Query(False, description="Return only unread alerts"),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
):
    """
    Returns recent trend alerts — star spikes, momentum surges, etc.
    Alerts are generated by run_daily_scoring and persist in trend_alerts.
    Mark as read via PATCH /dashboard/alerts/{id}/read.
    """
    q = (
        db.query(TrendAlert, Repository.owner, Repository.name, Repository.category)
        .join(Repository, TrendAlert.repo_id == Repository.id)
        .order_by(TrendAlert.triggered_at.desc())
    )
    if unread_only:
        q = q.filter(TrendAlert.is_read == False)  # noqa: E712
    rows = q.limit(limit).all()

    return [
        AlertResponse(
            id=alert.id,
            repo_id=alert.repo_id,
            owner=owner,
            name=name,
            category=category,
            alert_type=alert.alert_type,
            window_days=alert.window_days,
            headline=alert.headline,
            metric_value=alert.metric_value,
            threshold=alert.threshold,
            baseline_mean=alert.baseline_mean,
            baseline_stddev=alert.baseline_stddev,
            z_score=alert.z_score,
            percentile=alert.percentile,
            is_sustained=alert.is_sustained,
            momentum_direction=alert.momentum_direction,
            triggered_at=alert.triggered_at.isoformat(),
            is_read=alert.is_read,
        )
        for alert, owner, name, category in rows
    ]


@router.patch("/alerts/read-all")
def mark_all_alerts_read(
    db: Session = Depends(get_db),
):
    """Mark all unread alerts as read in one shot."""
    db.query(TrendAlert).filter(TrendAlert.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()
    return {"dismissed": True}


@router.patch("/alerts/{alert_id}/read", response_model=AlertResponse)
def mark_alert_read(
    alert_id: str,
    db: Session = Depends(get_db),
):
    """Mark a single alert as read."""
    alert = db.query(TrendAlert).filter_by(id=alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    repo = db.query(Repository).filter_by(id=alert.repo_id).first()
    return AlertResponse(
        id=alert.id,
        repo_id=alert.repo_id,
        owner=repo.owner if repo else "",
        name=repo.name if repo else "",
        category=repo.category if repo else "",
        alert_type=alert.alert_type,
        window_days=alert.window_days,
        headline=alert.headline,
        metric_value=alert.metric_value,
        threshold=alert.threshold,
        baseline_mean=alert.baseline_mean,
        baseline_stddev=alert.baseline_stddev,
        z_score=alert.z_score,
        percentile=alert.percentile,
        is_sustained=alert.is_sustained,
        momentum_direction=alert.momentum_direction,
        triggered_at=alert.triggered_at.isoformat(),
        is_read=alert.is_read,
    )


# ─── Period Leaderboard ───────────────────────────────────────────────────────

PERIOD_DAYS: dict[str, int] = {
    "1d":  1,
    "7d":  7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
    "3y":  365 * 3,
    "5y":  365 * 5,
}


class LeaderboardEntry(BaseModel):
    rank: int
    repo_id: str
    owner: str
    name: str
    category: str
    github_url: str
    primary_language: Optional[str]
    age_days: int
    current_stars: int
    star_gain: int          # stars gained in the period (or absolute stars if no history)
    star_gain_pct: float    # % growth over the period
    current_forks: int
    sustainability_label: str
    sustainability_score: float
    trend_score: float
    description: Optional[str] = None
    open_issues: Optional[int] = None
    watchers: Optional[int] = None
    topics: Optional[List[str]] = None
    created_at: Optional[str] = None
    pushed_at: Optional[str] = None
    star_gain_label: Optional[str] = None  # e.g. "4,557 stars today" from GitHub Trending


class LeaderboardResponse(BaseModel):
    period: str
    period_days: int
    as_of: str
    has_history: bool       # False = ranking by absolute stars (no historical delta)
    source: str             # "github_search" or "db"
    entries: List[LeaderboardEntry]


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    period: str = Query("7d", description="1d | 7d | 30d | 90d | 365d | 3y | 5y"),
    category: Optional[str] = Query(None, description="Filter by AI/ML sub-category"),
    vertical: str = Query("ai_ml", description="ai_ml | devtools | web_frameworks | security | data_engineering | blockchain | oss_tools"),
    limit: int = Query(30, le=100),
):
    """
    Returns the top GitHub repos for the selected time window.

    Source: GitHub Search API — searches ALL of GitHub for the highest-starred
    AI/ML repos whose creation date falls within [now - period, now].
    For 1d/7d windows a "recently active" search is included alongside the
    "recently created" search to surface established repos with breakout momentum.

    star_gain = absolute star count (GitHub Search does not return historical
    star growth; a future enhancement could diff two Search snapshots taken
    days apart and stored in the DailyMetrics table).
    """
    import asyncio
    from app.services import github_search

    days = PERIOD_DAYS.get(period, 7)
    raw_repos = await github_search.search_top_repos(period, limit=limit, category_filter=category, vertical=vertical)

    entries = [
        LeaderboardEntry(**github_search.normalize_search_result(repo, rank=i + 1, period=period))
        for i, repo in enumerate(raw_repos)
    ]

    return LeaderboardResponse(
        period=period,
        period_days=days,
        as_of=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        has_history=False,   # Search API returns current snapshots only
        source="github_search",
        entries=entries,
    )


# ─── Language & Tech Stack Radar ─────────────────────────────────────────────

class LanguageStat(BaseModel):
    language: str
    repo_count: int
    total_stars: int
    avg_trend_score: float
    avg_sustainability_score: float
    weekly_star_velocity: float        # sum of 7d star velocities across repos
    growth_rank: int                   # 1 = fastest growing language this week
    categories: List[str]              # distinct categories using this language
    top_repo: Optional[str] = None     # owner/name of highest-trend repo


@router.get("/languages", response_model=List[LanguageStat])
def get_language_radar(
    min_repos: int = Query(2, description="Only languages with at least N repos"),
    db: Session = Depends(get_db),
):
    """
    Tech Stack Radar — aggregates programming languages across all active
    tracked repos and ranks them by combined star velocity + trend score.

    Returns languages sorted by total weekly star velocity (descending).
    This surfaces which programming languages are growing fastest in the
    AI/ML ecosystem — no competitor offers this view.
    """
    import json as _json

    latest_date = _latest_scored_date(db)

    # Get all active repos with their latest computed metrics
    subq = (
        db.query(
            ComputedMetric.repo_id,
            ComputedMetric.trend_score,
            ComputedMetric.star_velocity_7d,
            ComputedMetric.sustainability_score,
        )
        .filter(ComputedMetric.date == latest_date)
        .subquery()
    )

    rows = (
        db.query(Repository, subq)
        .filter(Repository.is_active == True)  # noqa: E712
        .outerjoin(subq, Repository.id == subq.c.repo_id)
        .all()
    )

    # Also pull latest DailyMetric for language_breakdown JSON
    from app.models import DailyMetric
    # Build a map: repo_id → latest language_breakdown JSON
    latest_dm_subq = (
        db.query(
            DailyMetric.repo_id,
            func.max(DailyMetric.captured_at).label("max_captured"),
        )
        .group_by(DailyMetric.repo_id)
        .subquery()
    )
    dm_rows = (
        db.query(DailyMetric.repo_id, DailyMetric.language_breakdown)
        .join(
            latest_dm_subq,
            (DailyMetric.repo_id == latest_dm_subq.c.repo_id) &
            (DailyMetric.captured_at == latest_dm_subq.c.max_captured),
        )
        .all()
    )
    lang_breakdown_map: dict[str, dict] = {}
    for repo_id, lb_json in dm_rows:
        if lb_json:
            try:
                lang_breakdown_map[repo_id] = _json.loads(lb_json)
            except Exception:
                pass

    # Aggregate per language
    lang_data: dict[str, dict] = {}

    for row in rows:
        repo = row[0]
        ts = row[2] or 0.0
        vel = row[3] or 0.0
        ss = row[4] or 0.0

        # Primary language contributes as the "main" language
        langs: set[str] = set()
        if repo.primary_language:
            langs.add(repo.primary_language)

        # Secondary: top language from breakdown (by % share), if different
        lb = lang_breakdown_map.get(repo.id, {})
        if lb:
            top_lang = max(lb, key=lambda k: lb[k], default=None)
            if top_lang and top_lang != repo.primary_language:
                langs.add(top_lang)

        for lang in langs:
            if lang not in lang_data:
                lang_data[lang] = {
                    "repo_count": 0,
                    "total_stars": 0,
                    "trend_scores": [],
                    "sustainability_scores": [],
                    "weekly_star_velocity": 0.0,
                    "categories": set(),
                    "top_repo": None,
                    "top_ts": -1.0,
                }
            d = lang_data[lang]
            d["repo_count"] += 1
            d["trend_scores"].append(ts)
            d["sustainability_scores"].append(ss)
            d["weekly_star_velocity"] += vel
            d["categories"].add(repo.category)
            if ts > d["top_ts"]:
                d["top_ts"] = ts
                d["top_repo"] = f"{repo.owner}/{repo.name}"

    # Filter + sort by weekly star velocity descending
    filtered = {
        lang: d for lang, d in lang_data.items()
        if d["repo_count"] >= min_repos and lang.strip()
    }
    sorted_langs = sorted(
        filtered.items(),
        key=lambda x: x[1]["weekly_star_velocity"],
        reverse=True,
    )

    result = []
    for rank, (lang, d) in enumerate(sorted_langs, start=1):
        n = d["repo_count"] or 1
        avg_ts = sum(d["trend_scores"]) / n
        avg_ss = sum(d["sustainability_scores"]) / n
        result.append(LanguageStat(
            language=lang,
            repo_count=d["repo_count"],
            total_stars=d["total_stars"],
            avg_trend_score=round(avg_ts, 6),
            avg_sustainability_score=round(avg_ss, 4),
            weekly_star_velocity=round(d["weekly_star_velocity"], 2),
            growth_rank=rank,
            categories=sorted(d["categories"]),
            top_repo=d["top_repo"],
        ))

    return result

