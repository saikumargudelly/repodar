from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, ComputedMetric

router = APIRouter(prefix="/repos", tags=["Repositories"])


# ─── Response schemas ────────────────────────────────────────────────────────

class RepoSummary(BaseModel):
    id: str
    owner: str
    name: str
    category: str
    description: Optional[str]
    github_url: str
    primary_language: Optional[str]
    age_days: int

    # Latest computed scores (nullable if not yet scored)
    trend_score: Optional[float] = None
    sustainability_score: Optional[float] = None
    sustainability_label: Optional[str] = None
    star_velocity_7d: Optional[float] = None
    acceleration: Optional[float] = None

    class Config:
        from_attributes = True


class RepoDetail(RepoSummary):
    star_velocity_30d: Optional[float] = None
    contributor_growth_rate: Optional[float] = None
    fork_to_star_ratio: Optional[float] = None
    issue_close_rate: Optional[float] = None
    explanation: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[RepoSummary])
def list_repos(
    category: Optional[str] = Query(None, description="Filter by ecosystem category"),
    sort_by: str = Query("trend_score", description="trend_score | sustainability_score | stars"),
    limit: int = Query(100, le=200),
    db: Session = Depends(get_db),
):
    """List all repos with their latest computed scores."""
    from datetime import date
    today = date.today()

    query = db.query(Repository)
    if category:
        query = query.filter(Repository.category == category)
    repos = query.all()

    results = []
    for repo in repos:
        latest_cm = (
            db.query(ComputedMetric)
            .filter_by(repo_id=repo.id)
            .order_by(ComputedMetric.date.desc())
            .first()
        )
        summary = RepoSummary(
            id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            description=repo.description,
            github_url=repo.github_url,
            primary_language=repo.primary_language,
            age_days=repo.age_days,
            trend_score=latest_cm.trend_score if latest_cm else None,
            sustainability_score=latest_cm.sustainability_score if latest_cm else None,
            sustainability_label=latest_cm.sustainability_label if latest_cm else None,
            star_velocity_7d=latest_cm.star_velocity_7d if latest_cm else None,
            acceleration=latest_cm.acceleration if latest_cm else None,
        )
        results.append(summary)

    # Sort
    reverse = True
    if sort_by == "trend_score":
        results.sort(key=lambda x: x.trend_score or 0, reverse=reverse)
    elif sort_by == "sustainability_score":
        results.sort(key=lambda x: x.sustainability_score or 0, reverse=reverse)

    return results[:limit]


@router.get("/{repo_id}", response_model=RepoDetail)
def get_repo(repo_id: str, db: Session = Depends(get_db)):
    """Get full repo detail with latest scores and LLM explanation."""
    repo = db.query(Repository).filter_by(id=repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    latest_cm = (
        db.query(ComputedMetric)
        .filter_by(repo_id=repo_id)
        .order_by(ComputedMetric.date.desc())
        .first()
    )

    return RepoDetail(
        id=repo.id,
        owner=repo.owner,
        name=repo.name,
        category=repo.category,
        description=repo.description,
        github_url=repo.github_url,
        primary_language=repo.primary_language,
        age_days=repo.age_days,
        trend_score=latest_cm.trend_score if latest_cm else None,
        sustainability_score=latest_cm.sustainability_score if latest_cm else None,
        sustainability_label=latest_cm.sustainability_label if latest_cm else None,
        star_velocity_7d=latest_cm.star_velocity_7d if latest_cm else None,
        star_velocity_30d=latest_cm.star_velocity_30d if latest_cm else None,
        acceleration=latest_cm.acceleration if latest_cm else None,
        contributor_growth_rate=latest_cm.contributor_growth_rate if latest_cm else None,
        fork_to_star_ratio=latest_cm.fork_to_star_ratio if latest_cm else None,
        issue_close_rate=latest_cm.issue_close_rate if latest_cm else None,
        explanation=latest_cm.explanation if latest_cm else None,
    )
