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


# ─── Releases ─────────────────────────────────────────────────────────────────

class ReleaseItem(BaseModel):
    id: str
    tag_name: str
    name: Optional[str]
    body_truncated: Optional[str]
    published_at: str
    is_prerelease: bool
    html_url: Optional[str]


@router.get("/{repo_id:path}/releases", response_model=List[ReleaseItem])
def get_releases(
    repo_id: str,
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Last N GitHub releases for a repo."""
    from app.models.repo_release import RepoRelease
    repo = db.query(Repository).filter_by(id=repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    rows = (
        db.query(RepoRelease)
        .filter_by(repo_id=repo_id)
        .order_by(RepoRelease.published_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ReleaseItem(
            id=r.id,
            tag_name=r.tag_name,
            name=r.name,
            body_truncated=r.body_truncated,
            published_at=r.published_at.isoformat(),
            is_prerelease=r.is_prerelease,
            html_url=r.html_url,
        )
        for r in rows
    ]


# ─── Social Mentions ──────────────────────────────────────────────────────────

class SocialMentionItem(BaseModel):
    id: str
    platform: str
    post_title: Optional[str]
    post_url: str
    upvotes: int
    comment_count: int
    subreddit: Optional[str]
    posted_at: str


@router.get("/{repo_id:path}/mentions", response_model=List[SocialMentionItem])
def get_social_mentions(
    repo_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """HN and Reddit posts that referenced this repo."""
    from app.models.social_mention import SocialMention
    repo = db.query(Repository).filter_by(id=repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    rows = (
        db.query(SocialMention)
        .filter_by(repo_id=repo_id)
        .order_by(SocialMention.posted_at.desc())
        .limit(limit)
        .all()
    )
    return [
        SocialMentionItem(
            id=r.id,
            platform=r.platform,
            post_title=r.post_title,
            post_url=r.post_url,
            upvotes=r.upvotes,
            comment_count=r.comment_count,
            subreddit=r.subreddit,
            posted_at=r.posted_at.isoformat(),
        )
        for r in rows
    ]


# ─── Commit Activity ─────────────────────────────────────────────────────────

class CommitActivityPoint(BaseModel):
    date: str
    count: int


@router.get("/{repo_id:path}/commit-activity", response_model=List[CommitActivityPoint])
def get_commit_activity(repo_id: str, db: Session = Depends(get_db)):
    """52-week daily commit activity (heatmap data)."""
    import json
    repo = db.query(Repository).filter_by(id=repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not repo.commit_activity_json:
        return []
    try:
        points = json.loads(repo.commit_activity_json)
        return [CommitActivityPoint(**p) for p in points]
    except Exception:
        return []
