"""
TrendAlert — persisted alert rows written by the scoring pipeline
when a repo crosses a momentum threshold in a 24/48h window.

Design notes
────────────
- Written once per (repo_id, alert_type, window) tuple per calendar day,
  so re-running scoring is idempotent (upsert on conflict).
- `is_read` lets the front-end mark alerts as seen without deleting them.
- Index on (triggered_at, is_read) covers the most common dashboard query.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TrendAlert(Base):
    __tablename__ = "trend_alerts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # ------------------------------------------------------------------
    # Alert classification
    # ------------------------------------------------------------------
    # alert_type values (extensible, stored as plain strings):
    #   "star_spike_24h"   — gained N stars in 24 h
    #   "star_spike_48h"   — gained N stars in 48 h
    #   "momentum_surge"   — trend_score jumped > threshold vs prior day
    #   "pr_surge"         — large PR merge burst
    #   "new_breakout"     — brand-new repo entering top-10 trend
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Window that triggered the alert (1 = 24 h, 2 = 48 h, 7 = 7-day, etc.)
    window_days: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Human-readable headline stored at write-time so the API is cheap to read
    headline: Mapped[str] = mapped_column(String(512), nullable=False)

    # Raw numeric value that triggered the alert (e.g. star count gained)
    metric_value: Mapped[float] = mapped_column(Float, default=0.0)

    # Threshold that was crossed
    threshold: Mapped[float] = mapped_column(Float, default=0.0)

    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Optional JSON blob for extra context (e.g. top contributors, language mix)
    extra_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    repository: Mapped["Repository"] = relationship("Repository")

    __table_args__ = (
        Index("ix_trend_alerts_triggered_read", "triggered_at", "is_read"),
    )

    def __repr__(self):
        return f"<TrendAlert {self.alert_type} repo={self.repo_id} value={self.metric_value}>"
