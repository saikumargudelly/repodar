"""
Public API v1 — documented endpoints accessible with an X-API-Key header.

All routes here are mounted under /api/v1 in main.py.
Rate limits are enforced by APIKeyMiddleware in app/middleware.py.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.repository import Repository
from app.models.computed_metrics import ComputedMetric

router = APIRouter(prefix="/api/v1", tags=["Public API v1"])


# ─── Shared response schemas ─────────────────────────────────────────────────

class RepoOut(BaseModel):
    repo_id: str
    owner: str
    name: str
    category: str
    description: Optional[str]
    primary_language: Optional[str]
    stars: Optional[int]
    forks: Optional[int]
    open_issues: Optional[int]
    github_url: str
    trend_score: Optional[float]
    sustainability_score: Optional[float]
    sustainability_label: Optional[str]
    repo_summary: Optional[str]

    class Config:
        from_attributes = True


class ScoreOut(BaseModel):
    repo_id: str
    date: Optional[str]
    trend_score: Optional[float]
    sustainability_score: Optional[float]
    momentum_score: Optional[float]
    acceleration: Optional[float]
    star_velocity_7d: Optional[float]
    star_velocity_30d: Optional[float]

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get(
    "/repos",
    response_model=List[RepoOut],
    summary="List tracked repositories",
    description="Returns all tracked AI/ML repositories with current metric snapshots.",
)
def list_repos(
    limit: int = Query(50, ge=1, le=200, description="Max repos to return"),
    offset: int = Query(0, ge=0),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    db: Session = Depends(get_db),
):
    q = db.query(Repository).filter(Repository.is_active == True)  # noqa: E712
    if category:
        q = q.filter(Repository.category == category)
    repos = q.order_by(Repository.stars.desc()).offset(offset).limit(limit).all()
    return [
        RepoOut(
            repo_id=r.repo_id,
            owner=r.owner,
            name=r.name,
            category=r.category,
            description=r.description,
            primary_language=r.primary_language,
            stars=r.stars,
            forks=r.forks,
            open_issues=r.open_issues,
            github_url=r.github_url,
            trend_score=None,
            sustainability_score=None,
            sustainability_label=r.sustainability_label,
            repo_summary=r.repo_summary,
        )
        for r in repos
    ]


@router.get(
    "/repos/{repo_id:path}",
    response_model=RepoOut,
    summary="Get a single repository",
)
def get_repo(
    repo_id: str = Path(..., description="owner/name e.g. huggingface/transformers"),
    db: Session = Depends(get_db),
):
    repo = db.query(Repository).filter(Repository.repo_id == repo_id).first()
    if not repo:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Repository '{repo_id}' not found.")
    return RepoOut(
        repo_id=repo.repo_id,
        owner=repo.owner,
        name=repo.name,
        category=repo.category,
        description=repo.description,
        primary_language=repo.primary_language,
        stars=repo.stars,
        forks=repo.forks,
        open_issues=repo.open_issues,
        github_url=repo.github_url,
        trend_score=None,
        sustainability_score=None,
        sustainability_label=repo.sustainability_label,
        repo_summary=repo.repo_summary,
    )


@router.get(
    "/scores",
    response_model=List[ScoreOut],
    summary="Latest trend scores for all repos",
    description="Returns the most recent computed metric snapshot for every tracked repo.",
)
def list_scores(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    from sqlalchemy import desc
    scores = (
        db.query(ComputedMetric)
        .order_by(desc(ComputedMetric.trend_score))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        ScoreOut(
            repo_id=s.repo_id,
            date=s.date.isoformat() if s.date else None,
            trend_score=s.trend_score,
            sustainability_score=s.sustainability_score,
            momentum_score=s.momentum_score,
            acceleration=s.acceleration,
            star_velocity_7d=s.star_velocity_7d,
            star_velocity_30d=s.star_velocity_30d,
        )
        for s in scores
    ]


@router.get(
    "/scores/{repo_id:path}",
    response_model=ScoreOut,
    summary="Get latest score for a repo",
)
def get_score(
    repo_id: str = Path(..., description="owner/name"),
    db: Session = Depends(get_db),
):
    from sqlalchemy import desc
    from fastapi import HTTPException
    score = (
        db.query(ComputedMetric)
        .filter(ComputedMetric.repo_id == repo_id)
        .order_by(desc(ComputedMetric.date))
        .first()
    )
    if not score:
        raise HTTPException(status_code=404, detail=f"No scores found for '{repo_id}'.")
    return ScoreOut(
        repo_id=score.repo_id,
        date=score.date.isoformat() if score.date else None,
        trend_score=score.trend_score,
        sustainability_score=score.sustainability_score,
        momentum_score=score.momentum_score,
        acceleration=score.acceleration,
        star_velocity_7d=score.star_velocity_7d,
        star_velocity_30d=score.star_velocity_30d,
    )
