"""
Fork Intelligence endpoints — notable forks gaining their own traction.
Surfaces forks that have significant stars, diverged from the parent,
or are more active than the parent repo. (Feature 6)
"""

from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, ComputedMetric
from app.models.fork_snapshot import ForkSnapshot

router = APIRouter(prefix="/forks", tags=["Fork Intelligence"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class NotableFork(BaseModel):
    fork_owner: str
    fork_name: str
    fork_full_name: str
    github_url: str
    stars: int
    forks: int
    open_issues: int
    primary_language: Optional[str]
    last_push_at: Optional[str]
    parent_owner: str
    parent_name: str
    parent_trend_score: float
    snapshot_date: str


class ForkLeaderboardEntry(BaseModel):
    fork_full_name: str
    github_url: str
    stars: int
    parent_owner: str
    parent_name: str
    parent_category: str
    snapshot_date: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/repo/{owner}/{name}", response_model=List[NotableFork])
def get_notable_forks_for_repo(
    owner: str = Path(...),
    name: str = Path(...),
    min_stars: int = Query(20, description="Minimum fork star count"),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
):
    """
    Returns notable forks of a specific repo — those exceeding min_stars,
    ordered by star count descending.
    """
    from sqlalchemy import func

    repo = db.query(Repository).filter_by(owner=owner, name=name).first()
    if not repo:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"{owner}/{name} not tracked")

    latest_date = (
        db.query(func.max(ForkSnapshot.snapshot_date))
        .filter(ForkSnapshot.parent_repo_id == repo.id)
        .scalar()
    )
    if not latest_date:
        return []

    latest_score = (
        db.query(ComputedMetric)
        .filter_by(repo_id=repo.id)
        .order_by(ComputedMetric.date.desc())
        .first()
    )

    forks = (
        db.query(ForkSnapshot)
        .filter(
            ForkSnapshot.parent_repo_id == repo.id,
            ForkSnapshot.snapshot_date == latest_date,
            ForkSnapshot.stars >= min_stars,
        )
        .order_by(ForkSnapshot.stars.desc())
        .limit(limit)
        .all()
    )

    return [
        NotableFork(
            fork_owner=f.fork_owner,
            fork_name=f.fork_name,
            fork_full_name=f.fork_full_name,
            github_url=f.github_url,
            stars=f.stars,
            forks=f.forks,
            open_issues=f.open_issues,
            primary_language=f.primary_language,
            last_push_at=f.last_push_at.isoformat() if f.last_push_at else None,
            parent_owner=repo.owner,
            parent_name=repo.name,
            parent_trend_score=latest_score.trend_score if latest_score else 0,
            snapshot_date=f.snapshot_date.isoformat(),
        )
        for f in forks
    ]


@router.get("/leaderboard", response_model=List[ForkLeaderboardEntry])
def get_fork_leaderboard(
    min_stars: int = Query(50, description="Minimum star count for a fork to appear"),
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
):
    """
    Cross-project fork leaderboard — the most-starred notable forks across
    all tracked repos. Reveals where communities are building on top of
    foundational AI/ML projects.
    """
    from sqlalchemy import func

    # Get latest snapshot date per parent repo
    latest_date = db.query(func.max(ForkSnapshot.snapshot_date)).scalar()
    if not latest_date:
        return []

    forks = (
        db.query(ForkSnapshot)
        .filter(
            ForkSnapshot.snapshot_date == latest_date,
            ForkSnapshot.stars >= min_stars,
        )
        .order_by(ForkSnapshot.stars.desc())
        .limit(limit)
        .all()
    )

    repo_map = {r.id: r for r in db.query(Repository).all()}
    results = []
    for f in forks:
        parent = repo_map.get(f.parent_repo_id)
        if not parent:
            continue
        results.append(ForkLeaderboardEntry(
            fork_full_name=f.fork_full_name,
            github_url=f.github_url,
            stars=f.stars,
            parent_owner=parent.owner,
            parent_name=parent.name,
            parent_category=parent.category,
            snapshot_date=f.snapshot_date.isoformat(),
        ))

    return results
