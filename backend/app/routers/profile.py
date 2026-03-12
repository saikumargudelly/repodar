import json
import secrets
from datetime import datetime, timezone
from typing import Literal, Optional, cast

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Subscriber
from app.models.user_onboarding import UserOnboarding

router = APIRouter(prefix="/profile", tags=["Profile"])

DigestFrequency = Literal["realtime", "daily", "weekly", "monthly", "off"]
ALLOWED_FREQUENCIES = {"realtime", "daily", "weekly", "monthly", "off"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _require_user(x_clerk_user_id: Optional[str] = Header(None)) -> str:
    if not x_clerk_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return x_clerk_user_id


def _parse_verticals(raw_json: Optional[str]) -> list[str]:
    if not raw_json:
        return []
    try:
        parsed = json.loads(raw_json)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _clean_verticals(verticals: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in verticals:
        value = raw.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        cleaned.append(value)
    return cleaned


def _resolve_verticals(db: Session, user_id: str, subscriber: Optional[Subscriber]) -> list[str]:
    subscriber_verticals = _parse_verticals(subscriber.verticals_json) if subscriber else []
    if subscriber_verticals:
        return subscriber_verticals

    onboarding = db.query(UserOnboarding).filter_by(user_id=user_id).first()
    if onboarding:
        return onboarding.selected_verticals

    return []


def _normalize_frequency(raw_value: Optional[str]) -> DigestFrequency:
    if raw_value in ALLOWED_FREQUENCIES:
        return cast(DigestFrequency, raw_value)
    return "weekly"


class ProfilePreferencesOut(BaseModel):
    user_id: str
    email: Optional[EmailStr] = None
    digest_frequency: DigestFrequency = "weekly"
    verticals: list[str]
    is_confirmed: bool


class ProfilePreferencesUpdateIn(BaseModel):
    email: Optional[EmailStr] = None
    digest_frequency: Optional[DigestFrequency] = None
    verticals: Optional[list[str]] = None


@router.get("/preferences", response_model=ProfilePreferencesOut)
def get_profile_preferences(
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    subscriber = db.query(Subscriber).filter_by(user_id=user_id).first()

    return ProfilePreferencesOut(
        user_id=user_id,
        email=subscriber.email if subscriber else None,
        digest_frequency=_normalize_frequency(subscriber.email_frequency if subscriber else None),
        verticals=_resolve_verticals(db, user_id, subscriber),
        is_confirmed=bool(subscriber.is_confirmed) if subscriber else False,
    )


@router.patch("/preferences", response_model=ProfilePreferencesOut)
def update_profile_preferences(
    body: ProfilePreferencesUpdateIn,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    if body.email is None and body.digest_frequency is None and body.verticals is None:
        raise HTTPException(status_code=400, detail="No preference fields provided")

    subscriber = db.query(Subscriber).filter_by(user_id=user_id).first()

    if body.email is not None:
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
        if body.email is None:
            raise HTTPException(status_code=400, detail="Email is required when initializing preferences")
        subscriber = Subscriber(email=body.email)
        db.add(subscriber)

    subscriber.user_id = user_id
    if body.email is not None:
        subscriber.email = body.email
    if body.digest_frequency is not None:
        subscriber.email_frequency = body.digest_frequency
    if body.verticals is not None:
        subscriber.verticals_json = json.dumps(_clean_verticals(body.verticals))
    elif not subscriber.verticals_json:
        onboarding = db.query(UserOnboarding).filter_by(user_id=user_id).first()
        if onboarding:
            subscriber.verticals_json = json.dumps(onboarding.selected_verticals)

    subscriber.is_confirmed = True
    subscriber.confirmed_at = subscriber.confirmed_at or _utcnow()
    subscriber.unsubscribe_token = subscriber.unsubscribe_token or secrets.token_urlsafe(32)

    db.commit()
    db.refresh(subscriber)

    return ProfilePreferencesOut(
        user_id=user_id,
        email=subscriber.email,
        digest_frequency=_normalize_frequency(subscriber.email_frequency),
        verticals=_resolve_verticals(db, user_id, subscriber),
        is_confirmed=bool(subscriber.is_confirmed),
    )
