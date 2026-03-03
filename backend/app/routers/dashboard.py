from typing import List, Optional
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, DailyMetric, ComputedMetric
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
    weekly_velocity: float
    mom_growth_pct: float
    repo_count: int


class OverviewResponse(BaseModel):
    as_of: str
    total_repos: int
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

    # Category growth via DuckDB
    category_growth = compute_category_growth()
    cat_metrics = [CategoryMetrics(**c) for c in category_growth]

    total_repos = db.query(Repository).count()

    return OverviewResponse(
        as_of=latest_date.isoformat(),
        total_repos=total_repos,
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
        ts, accel, vel, ss, sl = row[1], row[2], row[3], row[4], row[5]
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
        ))

    results.sort(key=lambda x: x.trend_score, reverse=True)
    return results[:limit]


@router.get("/categories", response_model=List[CategoryMetrics])
def get_category_metrics():
    """Category-level aggregated growth metrics."""
    growth = compute_category_growth()
    return [CategoryMetrics(**c) for c in growth]


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
    category: Optional[str] = Query(None, description="Filter by category"),
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
    raw_repos = await github_search.search_top_repos(period, limit=limit, category_filter=category)

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
