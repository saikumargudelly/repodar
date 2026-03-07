"""
Email subscription endpoints.

POST /subscribe          — add subscriber + send confirmation email
GET  /subscribe/confirm  — confirm via token
GET  /unsubscribe        — opt out via signed token
"""
import json
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.subscriber import Subscriber

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Subscriptions"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://repodar.vercel.app")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "digest@repodar.vercel.app")


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _send_email(to: str, subject: str, html: str) -> bool:
    """Send email via Resend. Returns True on success."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email send")
        return False
    try:
        import httpx
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SubscribeBody(BaseModel):
    email: EmailStr
    verticals: Optional[List[str]] = None   # e.g. ["ai_ml", "devtools"]


class SubscribeResponse(BaseModel):
    message: str
    confirmed: bool


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/subscribe", response_model=SubscribeResponse)
def subscribe(body: SubscribeBody, db: Session = Depends(get_db)):
    """Add a subscriber. Sends a confirmation email with a one-click link."""
    existing = db.query(Subscriber).filter_by(email=body.email).first()
    if existing:
        if existing.is_confirmed:
            return SubscribeResponse(message="Already subscribed.", confirmed=True)
        # Resend confirmation
        _dispatch_confirmation(existing)
        return SubscribeResponse(message="Confirmation email resent.", confirmed=False)

    confirm_token = secrets.token_urlsafe(32)
    unsub_token = secrets.token_urlsafe(32)
    sub = Subscriber(
        email=body.email,
        verticals_json=json.dumps(body.verticals or []),
        is_confirmed=False,
        confirm_token=confirm_token,
        unsubscribe_token=unsub_token,
        created_at=_utcnow(),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    _dispatch_confirmation(sub)
    return SubscribeResponse(message="Check your inbox to confirm your subscription.", confirmed=False)


def _dispatch_confirmation(sub: Subscriber):
    confirm_url = f"{FRONTEND_URL}/subscribe/confirm?token={sub.confirm_token}"
    html = f"""
    <h2>Confirm your Repodar digest subscription</h2>
    <p>You asked to receive the weekly Repodar AI/ML momentum digest.</p>
    <p><a href="{confirm_url}" style="background:#00e5ff;color:#000;padding:10px 20px;text-decoration:none;border-radius:4px;">Confirm subscription</a></p>
    <p style="color:#888;font-size:12px;">If you did not sign up, ignore this email.</p>
    """
    _send_email(sub.email, "Confirm your Repodar digest subscription", html)


@router.get("/subscribe/confirm")
def confirm_subscription(token: str = Query(...), db: Session = Depends(get_db)):
    """Confirm a subscription via the emailed token."""
    sub = db.query(Subscriber).filter_by(confirm_token=token).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Invalid or expired confirmation token.")
    sub.is_confirmed = True
    sub.confirmed_at = _utcnow()
    sub.confirm_token = None  # invalidate after use
    db.commit()
    return {"message": "Subscription confirmed! You'll receive your first digest next Monday."}


@router.get("/unsubscribe")
def unsubscribe(token: str = Query(...), db: Session = Depends(get_db)):
    """Opt out via the unsubscribe token in every digest email."""
    sub = db.query(Subscriber).filter_by(unsubscribe_token=token).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe token.")
    db.delete(sub)
    db.commit()
    return {"message": "You have been unsubscribed from the Repodar digest."}
