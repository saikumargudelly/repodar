"""
Watchlist endpoints — server-side per-user repo subscriptions.
Authentication is assumed to be handled upstream (Clerk token is passed in the
X-Clerk-User-Id header for now; swap for proper JWT middleware in production).
"""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, ComputedMetric
from app.models.watchlist import WatchlistItem

router = APIRouter(prefix="/watchlist", tags=["Watchlist"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _require_user(x_clerk_user_id: Optional[str] = Header(None)) -> str:
    """Extract Clerk user_id from request header. Raises 401 if missing."""
    if not x_clerk_user_id:
        raise HTTPException(status_code=401, detail="Authentication required. Pass X-Clerk-User-Id header.")
    return x_clerk_user_id


# ─── Schemas ─────────────────────────────────────────────────────────────────

class WatchlistItemCreate(BaseModel):
    repo_id: str
    alert_threshold: Optional[float] = None
    notify_email: Optional[str] = None
    notify_webhook: Optional[str] = None


class WatchlistItemUpdate(BaseModel):
    alert_threshold: Optional[float] = None
    notify_email: Optional[str] = None
    notify_webhook: Optional[str] = None


class WatchlistItemOut(BaseModel):
    id: str
    repo_id: str
    owner: str
    name: str
    category: str
    github_url: str
    primary_language: Optional[str]
    age_days: int
    stars: int
    trend_score: Optional[float]
    sustainability_label: Optional[str]
    acceleration: Optional[float]
    alert_threshold: Optional[float]
    notify_email: Optional[str]
    notify_webhook: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[WatchlistItemOut])
def get_watchlist(
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """Return all watchlist items for the authenticated user with latest scores."""
    from sqlalchemy import func

    latest_date = (
        db.query(func.max(ComputedMetric.date)).scalar()
    )

    items = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == user_id)
        .all()
    )

    result = []
    for item in items:
        repo = db.query(Repository).filter_by(id=item.repo_id).first()
        if not repo:
            continue

        cm = None
        if latest_date:
            cm = (
                db.query(ComputedMetric)
                .filter_by(repo_id=item.repo_id, date=latest_date)
                .first()
            )

        result.append(WatchlistItemOut(
            id=item.id,
            repo_id=item.repo_id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            primary_language=repo.primary_language,
            age_days=repo.age_days,
            stars=repo.stars_snapshot or 0,
            trend_score=cm.trend_score if cm else None,
            sustainability_label=cm.sustainability_label if cm else None,
            acceleration=cm.acceleration if cm else None,
            alert_threshold=item.alert_threshold,
            notify_email=item.notify_email,
            notify_webhook=item.notify_webhook,
            created_at=item.created_at.isoformat() if item.created_at else "",
        ))

    return result


@router.post("", response_model=WatchlistItemOut, status_code=201)
def add_to_watchlist(
    body: WatchlistItemCreate,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """Pin a repo to the user's server-side watchlist."""
    from sqlalchemy import func

    # Validate repo exists
    repo = db.query(Repository).filter_by(id=body.repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail=f"Repository {body.repo_id} not found")

    # Deduplicate
    existing = (
        db.query(WatchlistItem)
        .filter_by(user_id=user_id, repo_id=body.repo_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Repo already in watchlist")

    item = WatchlistItem(
        user_id=user_id,
        repo_id=body.repo_id,
        alert_threshold=body.alert_threshold,
        notify_email=body.notify_email,
        notify_webhook=body.notify_webhook,
        created_at=_utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    latest_date = db.query(func.max(ComputedMetric.date)).scalar()
    cm = (
        db.query(ComputedMetric)
        .filter_by(repo_id=body.repo_id, date=latest_date)
        .first()
    ) if latest_date else None

    return WatchlistItemOut(
        id=item.id,
        repo_id=item.repo_id,
        owner=repo.owner,
        name=repo.name,
        category=repo.category,
        github_url=repo.github_url,
        primary_language=repo.primary_language,
        age_days=repo.age_days,
        stars=repo.stars_snapshot or 0,
        trend_score=cm.trend_score if cm else None,
        sustainability_label=cm.sustainability_label if cm else None,
        acceleration=cm.acceleration if cm else None,
        alert_threshold=item.alert_threshold,
        notify_email=item.notify_email,
        notify_webhook=item.notify_webhook,
        created_at=item.created_at.isoformat(),
    )


@router.patch("/{item_id}", response_model=WatchlistItemOut)
def update_watchlist_item(
    item_id: str,
    body: WatchlistItemUpdate,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """Update alert threshold or notification config for a watchlist item."""
    from sqlalchemy import func

    item = (
        db.query(WatchlistItem)
        .filter_by(id=item_id, user_id=user_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    if body.alert_threshold is not None:
        item.alert_threshold = body.alert_threshold
    if body.notify_email is not None:
        item.notify_email = body.notify_email
    if body.notify_webhook is not None:
        item.notify_webhook = body.notify_webhook

    db.commit()
    db.refresh(item)

    repo = db.query(Repository).filter_by(id=item.repo_id).first()
    latest_date = db.query(func.max(ComputedMetric.date)).scalar()
    cm = (
        db.query(ComputedMetric)
        .filter_by(repo_id=item.repo_id, date=latest_date)
        .first()
    ) if latest_date else None

    return WatchlistItemOut(
        id=item.id,
        repo_id=item.repo_id,
        owner=repo.owner if repo else "",
        name=repo.name if repo else "",
        category=repo.category if repo else "",
        github_url=repo.github_url if repo else "",
        primary_language=repo.primary_language if repo else None,
        age_days=repo.age_days if repo else 0,
        stars=repo.stars_snapshot if repo else 0,
        trend_score=cm.trend_score if cm else None,
        sustainability_label=cm.sustainability_label if cm else None,
        acceleration=cm.acceleration if cm else None,
        alert_threshold=item.alert_threshold,
        notify_email=item.notify_email,
        notify_webhook=item.notify_webhook,
        created_at=item.created_at.isoformat() if item.created_at else "",
    )


@router.delete("/{item_id}", status_code=204)
def remove_from_watchlist(
    item_id: str,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """Remove a repo from the user's watchlist."""
    item = (
        db.query(WatchlistItem)
        .filter_by(id=item_id, user_id=user_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    db.delete(item)
    db.commit()


@router.get("/check/{repo_id}")
def check_watchlist(
    repo_id: str,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """Quick check if a specific repo is in the user's watchlist. Returns item_id or null."""
    item = (
        db.query(WatchlistItem)
        .filter_by(user_id=user_id, repo_id=repo_id)
        .first()
    )
    return {"in_watchlist": item is not None, "item_id": item.id if item else None}
