from typing import List, Optional
from datetime import date, timedelta, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, DailyMetric, ComputedMetric

router = APIRouter(prefix="/repos", tags=["Metrics"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class DailyMetricPoint(BaseModel):
    date: str
    stars: int
    forks: int
    contributors: int
    open_issues: int
    merged_prs: int
    releases: int
    daily_star_delta: int

    class Config:
        from_attributes = True


class ComputedMetricPoint(BaseModel):
    date: str
    trend_score: float
    sustainability_score: float
    sustainability_label: str
    star_velocity_7d: float
    star_velocity_30d: float
    acceleration: float
    contributor_growth_rate: float
    fork_to_star_ratio: float
    issue_close_rate: float

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/{repo_id:path}/metrics", response_model=List[DailyMetricPoint])
def get_daily_metrics(
    repo_id: str,
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
):
    """Time-series of raw daily metrics for a repo."""
    repo = db.query(Repository).filter_by(id=repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(DailyMetric)
        .filter(
            DailyMetric.repo_id == repo_id,
            DailyMetric.captured_at >= cutoff.replace(tzinfo=None),
        )
        .order_by(DailyMetric.captured_at.asc())
        .all()
    )

    return [
        DailyMetricPoint(
            date=r.captured_at.date().isoformat(),
            stars=r.stars,
            forks=r.forks,
            contributors=r.contributors,
            open_issues=r.open_issues,
            merged_prs=r.merged_prs,
            releases=r.releases,
            daily_star_delta=r.daily_star_delta,
        )
        for r in rows
    ]


@router.get("/{repo_id:path}/scores", response_model=List[ComputedMetricPoint])
def get_computed_scores(
    repo_id: str,
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
):
    """Time-series of computed trend and sustainability scores for a repo."""
    repo = db.query(Repository).filter_by(id=repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    cutoff = date.today() - timedelta(days=days)
    rows = (
        db.query(ComputedMetric)
        .filter(
            ComputedMetric.repo_id == repo_id,
            ComputedMetric.date >= cutoff,
        )
        .order_by(ComputedMetric.date.asc())
        .all()
    )

    return [
        ComputedMetricPoint(
            date=r.date.isoformat(),
            trend_score=r.trend_score or 0,
            sustainability_score=r.sustainability_score or 0,
            sustainability_label=r.sustainability_label or "YELLOW",
            star_velocity_7d=r.star_velocity_7d or 0,
            star_velocity_30d=r.star_velocity_30d or 0,
            acceleration=r.acceleration or 0,
            contributor_growth_rate=r.contributor_growth_rate or 0,
            fork_to_star_ratio=r.fork_to_star_ratio or 0,
            issue_close_rate=r.issue_close_rate or 0,
        )
        for r in rows
    ]
