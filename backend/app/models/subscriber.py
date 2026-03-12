"""Email subscriber model for digests and onboarding preferences."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Subscriber(Base):
    __tablename__ = "subscribers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    # JSON array of vertical keys e.g. '["ai_ml","devtools"]'
    verticals_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email_frequency: Mapped[str] = mapped_column(String(24), nullable=False, default="weekly")
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    confirm_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    unsubscribe_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_digest_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
