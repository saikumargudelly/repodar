"""
AlertRule model — user-configurable threshold conditions.

Fields:
  user_id:     Clerk user ID
  condition:   e.g. "trend_score > 0.80"
  frequency:   "instant" | "daily"
  webhook_url: optional HTTP endpoint for delivery
  channels:    JSON list: ["webhook", "email", "slack"]
  is_active:   allow disabling without deleting
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    __table_args__ = (
        Index("ix_alert_rules_user_id", "user_id"),
        Index("ix_alert_rules_active", "is_active"),
    )

    id:          Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id:     Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Optional: restrict to a specific repo (NULL = apply to all repos)
    repo_id:     Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

    # Condition string: "metric operator threshold"
    # e.g. "trend_score > 0.80", "daily_star_delta > 500", "breakout_probability >= 0.70"
    condition:   Mapped[str] = mapped_column(String(200), nullable=False)

    # Alert name for UI display
    name:        Mapped[str] = mapped_column(String(200), nullable=False, default="Custom Alert")

    # Delivery
    frequency:   Mapped[str] = mapped_column(String(20), nullable=False, default="instant")  # instant | daily
    webhook_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    channels:    Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON ["webhook","email"]

    is_active:   Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at:  Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at:  Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Last time this rule was triggered (for rate-limiting daily alerts)
    last_fired_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<AlertRule {self.user_id}: {self.condition}>"
