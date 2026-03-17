"""
Recommendations router.

GET /recommendations?user_id=xxx&limit=10
  Returns repos similar to the user's watchlist using topic cosine similarity.

GET /recommendations/trending-for-me
  Upcoming repos the user might like, filtered by their interest profile.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Repository
from app.models.watchlist import WatchlistItem
from app.services.recommendations import (
    RecommendedRepo, compute_recommendations, repo_to_vector,
)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[RecommendedRepo])
def get_recommendations(
    user_id: str = Query(..., description="Clerk user ID"),
    limit:   int = Query(10, ge=1, le=50),
    category: Optional[str] = Query(None, description="Optionally filter candidates by category"),
    db: Session = Depends(get_db),
):
    """
    Recommend repos based on the user's watchlist using topic cosine similarity.
    Returns repos the user hasn't watched yet, ranked by similarity score.
    """
    # Load user watchlist
    watchlist_rows = db.query(WatchlistItem).filter_by(user_id=user_id).all()
    if not watchlist_rows:
        # Cold start: return top trending repos instead
        q = db.query(Repository).filter(Repository.is_active == True)  # noqa
        if category:
            q = q.filter(Repository.category == category.lower())
        repos = q.order_by(Repository.stars_snapshot.desc()).limit(limit).all()
        return [
            RecommendedRepo(
                repo_id=r.id,
                full_name=f"{r.owner}/{r.name}",
                description=r.description,
                primary_language=r.primary_language,
                topics=json.loads(r.topics) if r.topics else [],
                stars=r.stars_snapshot or 0,
                category=r.category,
                score=0.5,
                reason="trending repo (build your watchlist for personalised picks)",
            )
            for r in repos
        ]

    watchlist_repo_ids = {w.repo_id for w in watchlist_rows}

    # Build watchlist vectors
    watchlist_repos = (
        db.query(Repository)
        .filter(Repository.id.in_(watchlist_repo_ids))
        .all()
    )
    watchlist_vectors = [repo_to_vector(r) for r in watchlist_repos]

    # Candidate pool
    candidate_q = db.query(Repository).filter(
        Repository.is_active == True,  # noqa
        Repository.id.notin_(watchlist_repo_ids),
    )
    if category:
        candidate_q = candidate_q.filter(Repository.category == category.lower())
    candidates = candidate_q.limit(2000).all()  # reasonable pool size
    candidate_vectors = [repo_to_vector(r) for r in candidates]

    return compute_recommendations(
        watchlist=watchlist_vectors,
        candidates=candidate_vectors,
        top_n=limit,
    )


@router.get("/similar/{owner}/{name}", response_model=list[RecommendedRepo])
def get_similar_repos(
    owner: str,
    name:  str,
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """
    Find repos similar to a given repo by topic/language/category cosine similarity.
    Useful for 'You might also like...' on the repo detail page.
    """
    repo = db.query(Repository).filter_by(owner=owner, name=name).first()
    if not repo:
        raise HTTPException(status_code=404, detail=f"{owner}/{name} not found")

    pivot = repo_to_vector(repo)
    candidates = (
        db.query(Repository)
        .filter(Repository.is_active == True, Repository.id != repo.id)  # noqa
        .limit(2000)
        .all()
    )
    candidate_vectors = [repo_to_vector(r) for r in candidates]

    return compute_recommendations(
        watchlist=[pivot],
        candidates=candidate_vectors,
        top_n=limit,
    )
