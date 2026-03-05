"""
API Key management endpoints — programmatic access to Repodar scoring data.
Keys are issued per user (Clerk user_id), stored as SHA-256 hashes.
Rate limits are enforced per key per day.

Tiers:
  free       — 100 calls/day
  pro        — 5,000 calls/day
  enterprise — unlimited
"""

import hashlib
import secrets
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.api_key import ApiKey

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dev", tags=["API Keys"])

RATE_LIMITS = {"free": 100, "pro": 5000, "enterprise": 10_000_000}


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _require_user(x_clerk_user_id: Optional[str] = Header(None)) -> str:
    if not x_clerk_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return x_clerk_user_id


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str = "My API Key"


class ApiKeyOut(BaseModel):
    id: str
    name: str
    tier: str
    calls_today: int
    calls_this_month: int
    calls_total: int
    day_limit: int
    created_at: str
    last_used_at: Optional[str]
    is_active: bool
    # Only returned once at creation
    raw_key: Optional[str] = None


class RateLimitStatus(BaseModel):
    key_id: str
    tier: str
    calls_today: int
    day_limit: int
    remaining_today: int
    calls_this_month: int
    calls_total: int
    last_used_at: Optional[str]


# ─── FastAPI dependency: validate API key header ──────────────────────────────

def validate_api_key(
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> ApiKey:
    """
    Dependency: validates the X-Api-Key header, enforces rate limits,
    increments usage counters. Raises 401/403/429 as appropriate.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-Api-Key header")

    key_hash = _hash_key(x_api_key)
    key = db.query(ApiKey).filter_by(key_hash=key_hash, is_active=True).first()
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    now = _utcnow()

    # Reset daily counter if day has rolled over
    if key.calls_day_reset_at:
        if now.date() > key.calls_day_reset_at.date():
            key.calls_today = 0
            key.calls_day_reset_at = now
    else:
        key.calls_day_reset_at = now

    # Enforce rate limit
    limit = RATE_LIMITS.get(key.tier, 100)
    if key.calls_today >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {limit} calls/day for {key.tier} tier. "
                   f"Upgrade at repodar.app/dev",
        )

    # Increment counters
    key.calls_today += 1
    key.calls_this_month += 1
    key.calls_total += 1
    key.last_used_at = now
    db.commit()

    return key


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/keys", response_model=ApiKeyOut, status_code=201)
def create_api_key(
    body: ApiKeyCreate,
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """
    Issue a new API key for the authenticated user.
    The raw key is returned ONCE and never stored — save it immediately.
    """
    # Cap at 5 keys per user
    existing_count = db.query(ApiKey).filter_by(user_id=user_id, is_active=True).count()
    if existing_count >= 5:
        raise HTTPException(status_code=400, detail="Max 5 active API keys per account")

    raw_key = f"rdr_{secrets.token_urlsafe(32)}"
    key = ApiKey(
        key_hash=_hash_key(raw_key),
        user_id=user_id,
        name=body.name[:255],
        tier="free",
        created_at=_utcnow(),
        calls_day_reset_at=_utcnow(),
    )
    db.add(key)
    db.commit()
    db.refresh(key)

    logger.info(f"API key created: id={key.id} user={user_id}")

    return ApiKeyOut(
        id=key.id,
        name=key.name,
        tier=key.tier,
        calls_today=key.calls_today,
        calls_this_month=key.calls_this_month,
        calls_total=key.calls_total,
        day_limit=key.day_limit(),
        created_at=key.created_at.isoformat(),
        last_used_at=None,
        is_active=key.is_active,
        raw_key=raw_key,          # ← shown once only
    )


@router.get("/keys", response_model=List[ApiKeyOut])
def list_api_keys(
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """List all API keys for the authenticated user (raw keys not shown)."""
    keys = db.query(ApiKey).filter_by(user_id=user_id, is_active=True).all()
    return [
        ApiKeyOut(
            id=k.id,
            name=k.name,
            tier=k.tier,
            calls_today=k.calls_today,
            calls_this_month=k.calls_this_month,
            calls_total=k.calls_total,
            day_limit=k.day_limit(),
            created_at=k.created_at.isoformat() if k.created_at else "",
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            is_active=k.is_active,
        )
        for k in keys
    ]


@router.delete("/keys/{key_id}", status_code=204)
def revoke_api_key(
    key_id: str = Path(...),
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """Revoke (deactivate) an API key."""
    key = db.query(ApiKey).filter_by(id=key_id, user_id=user_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    db.commit()
    logger.info(f"API key revoked: id={key_id} user={user_id}")


@router.get("/keys/{key_id}/status", response_model=RateLimitStatus)
def get_key_status(
    key_id: str = Path(...),
    user_id: str = Depends(_require_user),
    db: Session = Depends(get_db),
):
    """Get usage stats and rate limit status for a specific key."""
    key = db.query(ApiKey).filter_by(id=key_id, user_id=user_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    limit = RATE_LIMITS.get(key.tier, 100)
    return RateLimitStatus(
        key_id=key.id,
        tier=key.tier,
        calls_today=key.calls_today,
        day_limit=limit,
        remaining_today=max(0, limit - key.calls_today),
        calls_this_month=key.calls_this_month,
        calls_total=key.calls_total,
        last_used_at=key.last_used_at.isoformat() if key.last_used_at else None,
    )
