import json
import math
from enum import Enum
from typing import Callable, List, Optional
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel, Field
from fastapi_cache.decorator import cache

from app.database import get_db
from app.models import Repository, DailyMetric, ComputedMetric, TrendAlert, CategoryMetricDaily
from app.services.scoring import compute_category_growth


def _latest_scored_date(db: Session) -> date:
    """Return the most recent date that has computed_metrics rows, falling back to today."""
    result = db.query(func.max(ComputedMetric.date)).scalar()
    return result if result else date.today()

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# RepoDar targets Python 3.11+ (see README), so built-in generics like
# list[str], dict[str, T], and tuple[...] are import-safe here.


def _parse_topics(topics_raw: Optional[str]) -> list[str]:
    if not topics_raw:
        return []
    try:
        parsed = json.loads(topics_raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(topic) for topic in parsed if isinstance(topic, str) and topic.strip()]


def _repo_key(owner: str, name: str) -> str:
    return f"{owner.strip().lower()}/{name.strip().lower()}"


def _latest_metric_subquery(db: Session, scored_date: date):  # noqa: ARG001
    """
    Returns the single most-recent ComputedMetric row per repo, regardless of
    which date it was scored on.  Using a per-repo window function (row_number
    partitioned by repo_id, ordered by computed_at DESC) instead of a global
    date filter means repos remain visible in radar views even when the scoring
    pipeline has been down for several days and some repos' latest scores are
    older than the global latest date.
    """
    ranked = (
        db.query(
            ComputedMetric.repo_id.label("repo_id"),
            ComputedMetric.trend_score.label("trend_score"),
            ComputedMetric.acceleration.label("acceleration"),
            ComputedMetric.star_velocity_7d.label("star_velocity_7d"),
            ComputedMetric.star_velocity_30d.label("star_velocity_30d"),
            ComputedMetric.contributor_growth_rate.label("contributor_growth_rate"),
            ComputedMetric.sustainability_score.label("sustainability_score"),
            ComputedMetric.sustainability_label.label("sustainability_label"),
            func.row_number().over(
                partition_by=ComputedMetric.repo_id,
                order_by=ComputedMetric.computed_at.desc(),
            ).label("rn"),
        )
        # No date filter — always use each repo's own latest scored row.
        .subquery()
    )

    return (
        db.query(
            ranked.c.repo_id,
            ranked.c.trend_score,
            ranked.c.acceleration,
            ranked.c.star_velocity_7d,
            ranked.c.star_velocity_30d,
            ranked.c.contributor_growth_rate,
            ranked.c.sustainability_score,
            ranked.c.sustainability_label,
        )
        .filter(ranked.c.rn == 1)
        .subquery()
    )


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


# Radar is a broad ecosystem ranking feed. It intentionally stays compact and
# excludes early-only predictive diagnostics (e.g., breakout signals / ETA).
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


class BreakoutSignal(str, Enum):
    """Human-readable signals attached to each scored repo."""
    STAR_ACCELERATION = "star_acceleration"
    CONSISTENT_GROWTH = "consistent_growth"
    VELOCITY_INFLECTION = "velocity_inflection"
    CONTRIBUTOR_SURGE = "contributor_surge"
    HIGH_NOVELTY = "high_novelty"
    LOW_HEADROOM = "low_headroom"
    FORK_MOMENTUM = "fork_momentum"
    SUSTAINED_VELOCITY = "sustained_velocity"
    PRE_VIRAL = "pre_viral"
    CATEGORY_OUTPACE = "category_outpace"
    MOMENTUM_STALL = "momentum_stall"


class MomentumStage(str, Enum):
    """Lifecycle stage derived from velocity + acceleration signals."""
    DORMANT = "dormant"
    EMERGING = "emerging"
    ACCELERATING = "accelerating"
    PRE_VIRAL = "pre_viral"
    BREAKOUT = "breakout"


# Early Radar is intentionally richer than RadarRepo because it powers
# pre-viral detection and explainable breakout diagnostics.
class EarlyRadarRepo(BaseModel):
    # Core identity
    repo_id: str
    owner: str
    name: str
    category: str
    github_url: str
    primary_language: Optional[str]
    topics: Optional[List[str]]
    age_days: int
    stars: int

    # Raw metric signals
    trend_score: float
    acceleration: float
    star_velocity_7d: float
    star_velocity_30d: float
    contributor_growth_rate: float
    sustainability_score: float
    sustainability_label: str

    # Derived signals
    breakout_score: float = Field(
        description="Composite early-breakout score (0–infinity). Higher = more likely to trend soon."
    )
    novelty_score: float = Field(
        description="0-1. How early you are: 1 = brand-new repo gaining stars, 0 = near max age/stars."
    )
    velocity_ratio: float = Field(
        description="star_velocity_7d / (|star_velocity_30d| + 1). >1 means momentum is accelerating."
    )
    fork_proxy_score: float = Field(
        description=(
            "Proxy for fork momentum: high recent velocity + low star count "
            "suggests developer adoption before mainstream awareness."
        )
    )
    estimated_viral_eta_days: Optional[int] = Field(
        default=None,
        description=(
            "Estimated days to reach 5,000 stars at current 7d velocity. "
            "None if already past threshold or velocity <= 0."
        )
    )

    # Classification
    momentum_stage: MomentumStage = Field(
        description="Lifecycle stage: dormant -> emerging -> accelerating -> pre_viral -> breakout"
    )
    active_signals: List[BreakoutSignal] = Field(
        description="Ordered list of signals contributing to this repo's ranking."
    )

    # Category context
    category_velocity_avg: float = Field(
        default=0.0,
        description="Average weekly star velocity for repos in this category."
    )
    outpaces_category: bool = Field(
        default=False,
        description="True if this repo's 7d velocity beats category average."
    )


_VIRAL_STAR_THRESHOLD = 5000
# Composite breakout weighting (must sum to 1.0)
# - acceleration: 0.26
# - velocity_7d: 0.21
# - inflection: 0.15
# - trend_score: 0.12
# - novelty: 0.06
# - headroom: 0.04
# - contrib_growth: 0.04
# - fork_proxy: 0.02
# - sustained: 0.02
# - consistency: 0.08
_W = {
    "acceleration": 0.26,
    "velocity_7d": 0.21,
    "inflection": 0.15,
    "trend_score": 0.12,
    "novelty": 0.06,
    "headroom": 0.04,
    "contrib_growth": 0.04,
    "fork_proxy": 0.02,
    "sustained": 0.02,
    "consistency": 0.08,
}

assert abs(sum(_W.values()) - 1.0) < 1e-9, "Weights must sum to 1.0"


def _compute_velocity_consistency(repo_id: str, db: Session, days: int = 7) -> tuple[float, float, bool]:
    """Measure whether stars are climbing steadily over the recent N-day window."""
    window_days = max(int(days or 1), 1)

    # Pull N+1 rows so we can compute N day-over-day gains.
    rows = (
        db.query(DailyMetric.captured_at, DailyMetric.stars)
        .filter(DailyMetric.repo_id == repo_id)
        .order_by(DailyMetric.captured_at.desc())
        .limit(window_days + 1)
        .all()
    )

    if len(rows) < 2:
        return 0.0, 0.0, False

    ordered = list(reversed(rows))
    gains: list[int] = []
    for (_, prev_stars), (_, curr_stars) in zip(ordered, ordered[1:]):
        prev = max(int(prev_stars or 0), 0)
        curr = max(int(curr_stars or 0), 0)
        gains.append(curr - prev)

    if not gains:
        return 0.0, 0.0, False

    positive_days = sum(1 for gain in gains if gain > 0)
    consistency_score = positive_days / len(gains)
    avg_daily_gain = sum(gains) / len(gains)

    if window_days >= 7:
        is_sustained = positive_days >= 5
    else:
        required_positive_days = max(1, math.ceil(window_days * 0.7))
        is_sustained = positive_days >= required_positive_days

    return consistency_score, avg_daily_gain, is_sustained


def _compute_breakout(
    accel: float,
    vel7: float,
    vel30: float,
    trend_score: float,
    contrib_growth: float,
    age_days: int,
    stars: int,
    max_age_days: int,
    max_stars: int,
    consistency_score: float,
) -> tuple[float, float, float, float, Optional[int], List[BreakoutSignal], MomentumStage]:
    """Compute composite early-breakout signals and stage classification."""
    # Guard against malformed or out-of-range numeric inputs from upstream data.
    accel = float(accel or 0.0)
    vel7 = float(vel7 or 0.0)
    vel30 = float(vel30 or 0.0)
    trend_score = float(trend_score or 0.0)
    contrib_growth = float(contrib_growth or 0.0)
    age_days = max(int(age_days or 0), 0)
    stars = max(int(stars or 0), 0)
    max_age_days = max(int(max_age_days or 1), 1)
    max_stars = max(int(max_stars or 1), 1)
    consistency_score = min(max(float(consistency_score or 0.0), 0.0), 1.0)

    velocity_ratio = vel7 / (abs(vel30) + 1.0)
    inflection = max(velocity_ratio - 1.0, 0.0)
    novelty = 1.0 - min(age_days / max_age_days, 1.0)
    headroom = 1.0 - min(stars / max_stars, 1.0)
    fork_proxy = vel7 / math.log1p(max(stars, 1))
    sustained = 1.0 if vel30 > 0 else 0.0

    breakout_score = (
        math.log1p(max(accel, 0.0)) * _W["acceleration"]
        + math.log1p(max(vel7, 0.0)) * _W["velocity_7d"]
        + inflection * _W["inflection"]
        + max(trend_score, 0.0) * _W["trend_score"]
        + novelty * _W["novelty"]
        + headroom * _W["headroom"]
        + min(max(contrib_growth, 0.0), 1.0) * _W["contrib_growth"]
        + math.log1p(max(fork_proxy, 0.0)) * _W["fork_proxy"]
        + sustained * _W["sustained"]
        + consistency_score * _W["consistency"]
    )

    stars_needed = _VIRAL_STAR_THRESHOLD - stars
    if stars >= _VIRAL_STAR_THRESHOLD or vel7 <= 0:
        eta: Optional[int] = None
    else:
        daily_rate = vel7 / 7.0
        eta = int(math.ceil(stars_needed / daily_rate))
        eta = min(eta, 9999)

    signals: List[BreakoutSignal] = []
    if accel > 0.5:
        signals.append(BreakoutSignal.STAR_ACCELERATION)
    if consistency_score > 0.7:
        signals.append(BreakoutSignal.CONSISTENT_GROWTH)
    if inflection > 0.5:
        signals.append(BreakoutSignal.VELOCITY_INFLECTION)
    if contrib_growth > 0.3:
        signals.append(BreakoutSignal.CONTRIBUTOR_SURGE)
    if novelty > 0.7:
        signals.append(BreakoutSignal.HIGH_NOVELTY)
    if fork_proxy > 1.0:
        signals.append(BreakoutSignal.FORK_MOMENTUM)
    if sustained:
        signals.append(BreakoutSignal.SUSTAINED_VELOCITY)
    if eta is not None and eta <= 14:
        signals.append(BreakoutSignal.PRE_VIRAL)
    if headroom < 0.2:
        signals.append(BreakoutSignal.LOW_HEADROOM)
    if vel7 > 0 and velocity_ratio < 0.5:
        signals.append(BreakoutSignal.MOMENTUM_STALL)

    if vel7 <= 0 and accel <= 0:
        stage = MomentumStage.DORMANT
    elif eta is not None and eta <= 14:
        stage = MomentumStage.PRE_VIRAL
    elif accel > 1.0 or inflection > 1.0:
        stage = MomentumStage.BREAKOUT
    elif accel > 0.3 or inflection > 0.3:
        stage = MomentumStage.ACCELERATING
    else:
        stage = MomentumStage.EMERGING

    return (
        breakout_score,
        novelty,
        velocity_ratio,
        fork_proxy,
        eta,
        signals,
        stage,
    )


def _category_velocity_cache_key_builder(
    func: Callable[..., object],
    namespace: str = "",
    *,
    request: object = None,
    response: object = None,
    args: Optional[tuple] = None,
    kwargs: Optional[dict] = None,
) -> str:
    """Cache key that ignores DB session identity and buckets by scored_date."""
    del func, request, response
    args = args or ()
    kwargs = kwargs or {}

    scored_date = kwargs.get("scored_date")
    if scored_date is None and len(args) >= 2:
        scored_date = args[1]

    if isinstance(scored_date, date):
        scored_date_key = scored_date.isoformat()
    else:
        scored_date_key = str(scored_date or date.today().isoformat())

    return f"{namespace}:category-velocity:{scored_date_key}"


@cache(expire=3600, namespace="dashboard", key_builder=_category_velocity_cache_key_builder)  # pyright: ignore[reportArgumentType]
async def _build_category_velocity_map(db: Session, scored_date: date) -> dict[str, float]:
    return _build_category_velocity_map_uncached(db, scored_date)


def _build_category_velocity_map_uncached(db: Session, scored_date: date) -> dict[str, float]:
    """Build per-category average 7d velocity map for peer-relative scoring."""
    subq = _latest_metric_subquery(db, scored_date)
    rows = (
        db.query(
            Repository.category,
            func.avg(subq.c.star_velocity_7d).label("avg_vel"),
        )
        .outerjoin(subq, Repository.id == subq.c.repo_id)
        .filter(Repository.is_active == True)  # noqa: E712
        .group_by(Repository.category)
        .all()
    )
    return {category: float(avg_vel or 0.0) for category, avg_vel in rows}


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewResponse)
@cache(expire=300)  # pyright: ignore[reportArgumentType]
def get_overview(db: Session = Depends(get_db)):
    """
    Ecosystem overview: category heatmap data, top-10 breakout repos,
    sustainability rankings.
    """
    latest_date = _latest_scored_date(db)

    # Top 10 breakout repos (trend_score > 0)
    breakout_rows = (
        db.query(Repository, ComputedMetric)
        .join(ComputedMetric, Repository.id == ComputedMetric.repo_id)
        .filter(Repository.is_active == True)  # noqa: E712
        .filter(ComputedMetric.date == latest_date)
        .filter(ComputedMetric.trend_score > 0)
        .order_by(ComputedMetric.trend_score.desc())
        .limit(10)
        .all()
    )

    breakout_detected = []
    for repo, metric in breakout_rows:
        breakout_detected.append(BreakoutRepo(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            trend_score=metric.trend_score or 0,
            acceleration=metric.acceleration or 0,
            star_velocity_7d=metric.star_velocity_7d or 0,
            sustainability_label=metric.sustainability_label or "YELLOW",
            age_days=repo.age_days,
            primary_language=repo.primary_language,
        ))

    # Top 20 sustainability repos (sustainability_score > 0)
    sustain_rows = (
        db.query(Repository, ComputedMetric)
        .join(ComputedMetric, Repository.id == ComputedMetric.repo_id)
        .filter(Repository.is_active == True)  # noqa: E712
        .filter(ComputedMetric.date == latest_date)
        .filter(ComputedMetric.sustainability_score > 0)
        .order_by(ComputedMetric.sustainability_score.desc())
        .limit(20)
        .all()
    )

    sustain_scored = []
    for repo, metric in sustain_rows:
        sustain_scored.append(SustainabilityEntry(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            sustainability_score=metric.sustainability_score or 0,
            sustainability_label=metric.sustainability_label or "YELLOW",
            trend_score=metric.trend_score or 0,
        ))

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

    subq = _latest_metric_subquery(db, latest_date)

    query = (
        db.query(
            Repository,
            subq.c.trend_score,
            subq.c.acceleration,
            subq.c.star_velocity_7d,
            subq.c.sustainability_score,
            subq.c.sustainability_label,
        )
        .outerjoin(subq, Repository.id == subq.c.repo_id)
        .filter(Repository.is_active == True)  # noqa: E712
    )

    if new_only:
        query = query.filter(Repository.age_days <= 180)

    query = query.order_by(
        subq.c.trend_score.desc().nulls_last(),
        subq.c.acceleration.desc().nulls_last(),
        subq.c.star_velocity_7d.desc().nulls_last(),
        Repository.stars_snapshot.desc().nulls_last(),
    )

    # Fetch a slightly larger batch to allow for safe python-side deduplication
    rows = query.limit(limit * 2).all()

    # Dedupe by canonical owner/name to avoid duplicate rows from legacy data.
    deduped: dict[str, dict] = {}
    for repo, ts, accel, vel, ss, sl in rows:
        candidate = RadarRepo(
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
            topics=_parse_topics(repo.topics),
            primary_language=repo.primary_language,
        )
        key = _repo_key(repo.owner, repo.name)
        score = float(candidate.trend_score)
        existing = deduped.get(key)
        if not existing or score > existing["score"]:
            deduped[key] = {"repo": candidate, "score": score}

    ranked = sorted(
        (item["repo"] for item in deduped.values()),
        key=lambda x: (x.trend_score, x.acceleration, x.star_velocity_7d, x.stars),
        reverse=True,
    )
    return ranked[:limit]


@router.get("/early-radar", response_model=List[EarlyRadarRepo])
async def get_early_radar(
    max_age_days: int = Query(
        180,
        description="Max repo age in days. Keep low to surface truly early repos.",
    ),
    min_age_days: int = Query(
        3,
        description="Min repo age in days to avoid one-day noise.",
    ),
    max_stars: int = Query(
        50000,
        description="Ceiling star count to surface pre-viral repos.",
    ),
    min_stars: int = Query(
        10,
        description="Floor star count to remove low-signal placeholders.",
    ),
    min_acceleration: float = Query(
        0.0,
        description="Minimum acceleration score.",
    ),
    min_star_velocity_7d: float = Query(
        0.0,
        description="Minimum 7-day star velocity.",
    ),
    min_velocity_ratio: float = Query(
        0.0,
        description="Minimum vel7d/(|vel30d|+1) ratio. >1 indicates upward inflection.",
    ),
    min_breakout_score: float = Query(
        0.0,
        description="Minimum composite breakout score.",
    ),
    min_sustainability_score: float = Query(
        0.0,
        description="Minimum sustainability score.",
    ),
    require_contributor_growth: bool = Query(
        False,
        description="Require contributor_growth_rate > 0.",
    ),
    require_fork_momentum: bool = Query(
        False,
        description="Require FORK_MOMENTUM signal.",
    ),
    require_sustained_velocity: bool = Query(
        False,
        description="Require positive 30-day velocity.",
    ),
    require_consistent_growth: bool = Query(
        False,
        description="Require star growth on at least 5 of the last 7 days.",
    ),
    category: Optional[str] = Query(None, description="Filter by category"),
    language: Optional[str] = Query(
        None,
        description="Filter by primary language (case-insensitive exact match).",
    ),
    topics: Optional[str] = Query(
        None,
        description="Comma-separated topic keywords. Matches ANY keyword.",
    ),
    momentum_stage: Optional[MomentumStage] = Query(
        None,
        description="Filter stage: dormant | emerging | accelerating | pre_viral | breakout",
    ),
    require_pre_viral: bool = Query(
        False,
        description="Only return repos projected to hit 5,000 stars within 14 days.",
    ),
    sort_by: str = Query(
        "breakout_score",
        description="breakout_score | acceleration | star_velocity_7d | velocity_ratio | novelty_score | trend_score",
    ),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
) -> List[EarlyRadarRepo]:
    """
    Enhanced Early Radar feed focused on newly trending repositories.

    Uses a 10-signal composite breakout score with transparent active signals,
    stage classification, peer-category context, and robust deduplication.
    """
    # Direct in-process calls can pass FastAPI Query objects as defaults.
    # Normalise to plain values so this function remains reusable in scripts/tests.
    if not isinstance(category, str):
        category = None
    if not isinstance(language, str):
        language = None
    if not isinstance(topics, str):
        topics = None
    if not isinstance(sort_by, str):
        sort_by = "breakout_score"
    if not isinstance(momentum_stage, MomentumStage):
        momentum_stage = None
    if not isinstance(max_age_days, int):
        max_age_days = 180
    if not isinstance(min_age_days, int):
        min_age_days = 3
    if not isinstance(max_stars, int):
        max_stars = 50000
    if not isinstance(min_stars, int):
        min_stars = 10
    if not isinstance(limit, int):
        limit = 50
    if not isinstance(min_acceleration, (int, float)):
        min_acceleration = 0.0
    if not isinstance(min_star_velocity_7d, (int, float)):
        min_star_velocity_7d = 0.0
    if not isinstance(min_velocity_ratio, (int, float)):
        min_velocity_ratio = 0.0
    if not isinstance(min_breakout_score, (int, float)):
        min_breakout_score = 0.0
    if not isinstance(min_sustainability_score, (int, float)):
        min_sustainability_score = 0.0
    if not isinstance(require_contributor_growth, bool):
        require_contributor_growth = False
    if not isinstance(require_fork_momentum, bool):
        require_fork_momentum = False
    if not isinstance(require_sustained_velocity, bool):
        require_sustained_velocity = False
    if not isinstance(require_consistent_growth, bool):
        require_consistent_growth = False
    if not isinstance(require_pre_viral, bool):
        require_pre_viral = False

    latest_date = _latest_scored_date(db)
    cat_velocity_map_raw = await _build_category_velocity_map(db, latest_date)
    if isinstance(cat_velocity_map_raw, dict):
        cat_velocity_map: dict[str, float] = cat_velocity_map_raw
    else:
        # Fallback when cache middleware returns a non-dict payload.
        cat_velocity_map = _build_category_velocity_map_uncached(db, latest_date)
    subq = _latest_metric_subquery(db, latest_date)

    q = (
        db.query(
            Repository,
            subq.c.trend_score,
            subq.c.acceleration,
            subq.c.star_velocity_7d,
            subq.c.star_velocity_30d,
            subq.c.contributor_growth_rate,
            subq.c.sustainability_score,
            subq.c.sustainability_label,
        )
        .outerjoin(subq, Repository.id == subq.c.repo_id)
        .filter(
            Repository.is_active == True,  # noqa: E712
            # age_days == 0 means "not yet ingested" — treat as unknown, don't exclude
            or_(Repository.age_days == 0, Repository.age_days >= min_age_days),
            or_(Repository.age_days == 0, Repository.age_days <= max_age_days),
            # stars_snapshot == 0 means "not yet ingested" — treat as unknown, don't exclude
            or_(Repository.stars_snapshot == 0, Repository.stars_snapshot >= min_stars),
            or_(Repository.stars_snapshot == 0, Repository.stars_snapshot <= max_stars),
        )
    )

    if category:
        q = q.filter(Repository.category == category)
    if language:
        q = q.filter(func.lower(Repository.primary_language) == language.strip().lower())

    rows = q.all()

    topic_keywords: List[str] = []
    if topics:
        topic_keywords = [item.strip().lower() for item in topics.split(",") if item.strip()]

    deduped: dict[str, dict] = {}

    for repo, ts, accel, vel7, vel30, contrib_growth, ss, sl in rows:
        ts = float(ts or 0.0)
        accel = float(accel or 0.0)
        vel7 = float(vel7 or 0.0)
        vel30 = float(vel30 or 0.0)
        contrib_growth = float(contrib_growth or 0.0)
        ss = float(ss or 0.0)
        stars = repo.stars_snapshot or 0

        if accel < min_acceleration:
            continue
        if vel7 < min_star_velocity_7d:
            continue
        if ss < min_sustainability_score:
            continue
        if require_contributor_growth and contrib_growth <= 0:
            continue
        if require_sustained_velocity and vel30 <= 0:
            continue
        if vel7 <= 0 and accel <= 0:
            continue

        consistency_score, _avg_daily_gain, is_sustained = _compute_velocity_consistency(repo.id, db, days=7)
        if require_consistent_growth and not is_sustained:
            continue

        repo_topics = _parse_topics(repo.topics)
        if topic_keywords:
            repo_topics_lc = [topic.lower() for topic in repo_topics]
            if not any(any(keyword in topic for topic in repo_topics_lc) for keyword in topic_keywords):
                continue

        (
            breakout_score,
            novelty_score,
            velocity_ratio,
            fork_proxy,
            eta,
            signals,
            stage,
        ) = _compute_breakout(
            accel=accel,
            vel7=vel7,
            vel30=vel30,
            trend_score=ts,
            contrib_growth=contrib_growth,
            age_days=repo.age_days,
            stars=stars,
            max_age_days=max_age_days,
            max_stars=max_stars,
            consistency_score=consistency_score,
        )

        if velocity_ratio < min_velocity_ratio:
            continue
        if breakout_score < min_breakout_score:
            continue
        if require_fork_momentum and BreakoutSignal.FORK_MOMENTUM not in signals:
            continue
        if require_pre_viral and stage != MomentumStage.PRE_VIRAL:
            continue
        if momentum_stage and stage != momentum_stage:
            continue

        category_velocity_avg = cat_velocity_map.get(repo.category, 0.0)
        outpaces_category = vel7 > category_velocity_avg and category_velocity_avg > 0
        if outpaces_category and BreakoutSignal.CATEGORY_OUTPACE not in signals:
            signals.append(BreakoutSignal.CATEGORY_OUTPACE)

        candidate = EarlyRadarRepo(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            primary_language=repo.primary_language,
            topics=repo_topics,
            age_days=repo.age_days,
            stars=stars,
            trend_score=ts,
            acceleration=accel,
            star_velocity_7d=vel7,
            star_velocity_30d=vel30,
            contributor_growth_rate=contrib_growth,
            sustainability_score=ss,
            sustainability_label=sl or "YELLOW",
            breakout_score=round(breakout_score, 6),
            novelty_score=round(novelty_score, 4),
            velocity_ratio=round(velocity_ratio, 4),
            fork_proxy_score=round(fork_proxy, 4),
            estimated_viral_eta_days=eta,
            momentum_stage=stage,
            active_signals=signals,
            category_velocity_avg=round(category_velocity_avg, 4),
            outpaces_category=outpaces_category,
        )

        key = _repo_key(repo.owner, repo.name)
        existing = deduped.get(key)
        if not existing or breakout_score > existing["score"]:
            deduped[key] = {"repo": candidate, "score": breakout_score}

    sort_key_map = {
        "breakout_score": lambda repo: repo.breakout_score,
        "acceleration": lambda repo: repo.acceleration,
        "star_velocity_7d": lambda repo: repo.star_velocity_7d,
        "velocity_ratio": lambda repo: repo.velocity_ratio,
        "novelty_score": lambda repo: repo.novelty_score,
        "trend_score": lambda repo: repo.trend_score,
    }
    sort_fn = sort_key_map.get(sort_by, sort_key_map["breakout_score"])

    ranked = sorted(
        (item["repo"] for item in deduped.values()),
        key=sort_fn,
        reverse=True,
    )
    return ranked[:limit]


@router.get("/categories", response_model=List[CategoryMetrics])
@cache(expire=900)  # pyright: ignore[reportArgumentType]
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
    vertical: str = Query("ai_ml", description="ai_ml | devtools | web_mobile | data_infra | security | oss_tools | blockchain | science | creative"),
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

