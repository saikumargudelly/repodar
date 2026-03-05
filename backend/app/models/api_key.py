"""
ApiKey — issued API keys for programmatic access to Repodar scoring endpoints.
Keys are stored as SHA-256 hashes; the raw key is shown once at creation.

Tiers:
  free  — 100 calls/day
  pro   — 5,000 calls/day
  enterprise — unlimited
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # SHA-256 hash of the raw key
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    # Clerk user ID (nullable = anonymous / pre-auth keys)
    user_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="My API Key")
    tier: Mapped[str] = mapped_column(String(32), nullable=False, default="free")

    calls_today: Mapped[int] = mapped_column(Integer, default=0)
    calls_this_month: Mapped[int] = mapped_column(Integer, default=0)
    calls_total: Mapped[int] = mapped_column(Integer, default=0)

    # Resets at midnight UTC
    calls_day_reset_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def day_limit(self) -> int:
        limits = {"free": 100, "pro": 5000, "enterprise": 999_999_999}
        return limits.get(self.tier, 100)

    def __repr__(self):
        return f"<ApiKey id={self.id} user={self.user_id} tier={self.tier}>"
