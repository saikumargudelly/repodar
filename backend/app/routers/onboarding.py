import json
import secrets
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Repository, Subscriber
from app.models.user_onboarding import UserOnboarding
from app.models.watchlist import WatchlistItem

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _require_user(x_clerk_user_id: Optional[str] = Header(None)) -> str:
    if not x_clerk_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return x_clerk_user_id


def _get_or_create(db: Session, user_id: str) -> UserOnboarding:
    onboarding = db.query(UserOnboarding).filter_by(user_id=user_id).first()
    if onboarding:
        return onboarding
    onboarding = UserOnboarding(user_id=user_id)
    db.add(onboarding)
    db.commit()
    db.refresh(onboarding)
    return onboarding


class OnboardingStatusOut(BaseModel):
    user_id: str
    current_step: str
    onboarding_completed: bool
    selected_verticals: list[str]
    steps_completed: dict[str, bool]


class InterestsIn(BaseModel):
    verticals: list[str]


class WatchlistIn(BaseModel):
    repos: list[str]


class AlertsIn(BaseModel):
    email: EmailStr
    frequency: Literal["realtime", "daily", "weekly", "monthly", "off"] = "weekly"


@router.get("/status", response_model=OnboardingStatusOut)
def get_onboarding_status(
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    onboarding = _get_or_create(db, user_id)
    return OnboardingStatusOut(
        user_id=user_id,
        current_step=onboarding.current_step,
        onboarding_completed=onboarding.onboarding_completed,
        selected_verticals=onboarding.selected_verticals,
        steps_completed={
            "interests": onboarding.interests_completed,
            "watchlist": onboarding.watchlist_completed,
            "alerts": onboarding.alerts_completed,
            "tour": onboarding.tour_completed,
        },
    )


@router.post("/interests", response_model=OnboardingStatusOut)
def save_interests(
    body: InterestsIn,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    onboarding = _get_or_create(db, user_id)
    onboarding.set_selected_verticals(body.verticals)
    onboarding.interests_completed = True
    onboarding.current_step = "watchlist"
    onboarding.updated_at = _utcnow()
    db.commit()
    return get_onboarding_status(user_id=user_id, db=db)


@router.post("/watchlist")
def save_watchlist(
    body: WatchlistIn,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    onboarding = _get_or_create(db, user_id)
    created = 0

    for slug in body.repos:
        if "/" not in slug:
            continue
        owner, name = slug.split("/", 1)
        repo = db.query(Repository).filter_by(owner=owner, name=name).first()
        if not repo:
            continue
        existing = db.query(WatchlistItem).filter_by(user_id=user_id, repo_id=repo.id).first()
        if existing:
            continue
        db.add(WatchlistItem(user_id=user_id, repo_id=repo.id, created_at=_utcnow()))
        created += 1

    onboarding.watchlist_completed = True
    onboarding.current_step = "alerts"
    onboarding.updated_at = _utcnow()
    db.commit()
    return {"created": created, "current_step": onboarding.current_step}


@router.post("/alerts")
def save_alert_preferences(
    body: AlertsIn,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    onboarding = _get_or_create(db, user_id)
    subscriber = db.query(Subscriber).filter_by(user_id=user_id).first()

    existing_email_subscriber = db.query(Subscriber).filter_by(email=body.email).first()
    if existing_email_subscriber and subscriber and existing_email_subscriber.id != subscriber.id:
        if existing_email_subscriber.user_id and existing_email_subscriber.user_id != user_id:
            raise HTTPException(status_code=409, detail="Email is already linked to another account")
        db.delete(existing_email_subscriber)
        db.flush()

    if not subscriber and existing_email_subscriber:
        if existing_email_subscriber.user_id and existing_email_subscriber.user_id != user_id:
            raise HTTPException(status_code=409, detail="Email is already linked to another account")
        subscriber = existing_email_subscriber

    if not subscriber:
        subscriber = Subscriber(email=body.email)
        db.add(subscriber)

    subscriber.user_id = user_id
    subscriber.email = body.email
    subscriber.email_frequency = body.frequency
    subscriber.verticals_json = json.dumps(onboarding.selected_verticals)
    subscriber.is_confirmed = True
    subscriber.confirmed_at = subscriber.confirmed_at or _utcnow()
    subscriber.unsubscribe_token = subscriber.unsubscribe_token or secrets.token_urlsafe(32)

    onboarding.alerts_completed = True
    onboarding.current_step = "tour"
    onboarding.updated_at = _utcnow()
    db.commit()
    return {"saved": True, "current_step": onboarding.current_step}


@router.post("/complete", response_model=OnboardingStatusOut)
def complete_onboarding(
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    onboarding = _get_or_create(db, user_id)
    onboarding.tour_completed = True
    onboarding.onboarding_completed = True
    onboarding.current_step = "complete"
    onboarding.completed_at = _utcnow()
    onboarding.updated_at = _utcnow()
    db.commit()
    return get_onboarding_status(user_id=user_id, db=db)


@router.post("/skip", response_model=OnboardingStatusOut)
def skip_onboarding(
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    onboarding = _get_or_create(db, user_id)
    onboarding.onboarding_completed = True
    onboarding.current_step = "complete"
    onboarding.skipped_at = _utcnow()
    onboarding.updated_at = _utcnow()
    db.commit()
    return get_onboarding_status(user_id=user_id, db=db)