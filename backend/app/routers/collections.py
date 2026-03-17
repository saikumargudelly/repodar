"""
Community Collections router.

GET    /collections/trending         → returns collections sorted by velocity of votes
POST   /collections                  → create a collection
PATCH  /collections/{id}             → add/remove repos
POST   /collections/{id}/vote        → upvote/downvote collection
GET    /collections/{user_id}/mine   → collections created by a user
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.models.collection import Collection, CollectionVote
from app.models.repository import Repository

router = APIRouter(prefix="/collections", tags=["Collections"])
logger = logging.getLogger(__name__)


# ─── Schema ───────────────────────────────────────────────────────────────────

class CollectionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    repo_ids: list[str] = []
    is_public: bool = True

class CollectionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    add_repo_ids: list[str] = []
    remove_repo_ids: list[str] = []

class CollectionResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    repo_count: int
    votes: int
    is_public: bool
    created_by: str
    created_at: str
    updated_at: str

class VoteRequest(BaseModel):
    direction: int  # 1 or -1


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/trending", response_model=list[CollectionResponse])
def get_trending_collections(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Returns trending public collections. For now, sorts by total votes.
    (Future: sort by vote velocity over last 7 days).
    """
    rows = (
        db.query(Collection)
        .filter(Collection.is_public == True)  # noqa
        .order_by(Collection.votes.desc())
        .limit(limit)
        .all()
    )
    import json
    return [
        CollectionResponse(
            id=c.id, title=c.title, description=c.description,
            repo_count=len(json.loads(c.repo_ids_json)),
            votes=c.votes, is_public=c.is_public,
            created_by=c.created_by,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in rows
    ]


@router.post("", response_model=CollectionResponse, status_code=201)
def create_collection(
    body: CollectionCreate,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    import json
    # Validate repos exist (not strictly required, but good practice)
    valid_ids = []
    if body.repo_ids:
        repos = db.query(Repository.id).filter(Repository.id.in_(body.repo_ids)).all()
        valid_ids = [r[0] for r in repos]

    c = Collection(
        title=body.title,
        description=body.description,
        repo_ids_json=json.dumps(valid_ids),
        is_public=body.is_public,
        created_by=x_user_id,
    )
    db.add(c)
    db.commit()
    return CollectionResponse(
        id=c.id, title=c.title, description=c.description,
        repo_count=len(valid_ids), votes=0, is_public=c.is_public,
        created_by=c.created_by, created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


@router.patch("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: str,
    body: CollectionUpdate,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    c = db.query(Collection).filter_by(id=collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    if c.created_by != x_user_id:
        raise HTTPException(status_code=403, detail="Not authorised")

    import json
    current_ids = json.loads(c.repo_ids_json)

    if body.title:
        c.title = body.title
    if body.description is not None:
        c.description = body.description

    if body.add_repo_ids:
        current_ids.extend(r for r in body.add_repo_ids if r not in current_ids)
    if body.remove_repo_ids:
        current_ids = [r for r in current_ids if r not in body.remove_repo_ids]

    c.repo_ids_json = json.dumps(current_ids)
    db.commit()

    return CollectionResponse(
        id=c.id, title=c.title, description=c.description,
        repo_count=len(current_ids), votes=c.votes, is_public=c.is_public,
        created_by=c.created_by, created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


@router.post("/{collection_id}/vote", response_model=dict)
def vote_collection(
    collection_id: str,
    body: VoteRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    c = db.query(Collection).filter_by(id=collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    dir_val = 1 if body.direction > 0 else -1
    vote = db.query(CollectionVote).filter_by(collection_id=collection_id, user_id=x_user_id).first()
    
    if vote:
        if vote.direction == dir_val:
            # removing vote
            db.delete(vote)
            c.votes -= dir_val
        else:
            # swapping vote
            vote.direction = dir_val
            c.votes += (dir_val * 2)
    else:
        # new vote
        new_vote = CollectionVote(collection_id=collection_id, user_id=x_user_id, direction=dir_val)
        db.add(new_vote)
        c.votes += dir_val
        
    db.commit()
    return {"votes": c.votes}
