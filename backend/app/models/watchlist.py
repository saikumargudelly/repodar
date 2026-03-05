"""
Watchlist — persists per-user repo subscriptions tied to a Clerk user_id.
Supports optional alert thresholds for TrendScore spikes.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # Clerk user ID — opaque string, no FK since users live in Clerk
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    # Alert config — null means "no threshold alert"
    alert_threshold: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notify_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notify_webhook: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # One entry per (user, repo)
    __table_args__ = (
        UniqueConstraint("user_id", "repo_id", name="uq_watchlist_user_repo"),
    )

    def __repr__(self):
        return f"<WatchlistItem user={self.user_id} repo={self.repo_id}>"
