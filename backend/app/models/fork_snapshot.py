"""
ForkSnapshot — tracks notable forks (those gaining their own stars or activity).
Refreshed for high-momentum repos during ingestion. (Feature 6)
"""

import uuid
from datetime import datetime, timezone, date
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ForkSnapshot(Base):
    __tablename__ = "fork_snapshots"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    parent_repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    fork_owner: Mapped[str] = mapped_column(String(255), nullable=False)
    fork_name: Mapped[str] = mapped_column(String(255), nullable=False)
    fork_full_name: Mapped[str] = mapped_column(String(512), nullable=False)
    github_url: Mapped[str] = mapped_column(String(512), nullable=False)

    # Fork's own metrics
    stars: Mapped[int] = mapped_column(Integer, default=0)
    forks: Mapped[int] = mapped_column(Integer, default=0)
    open_issues: Mapped[int] = mapped_column(Integer, default=0)
    primary_language: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Activity signals
    last_push_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_diverged: Mapped[bool] = mapped_column(Boolean, default=False)  # has own commits ahead of parent

    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    # One snapshot per (parent_repo, fork, date)
    __table_args__ = (
        UniqueConstraint("parent_repo_id", "fork_full_name", "snapshot_date",
                         name="uq_fork_snapshot_daily"),
    )

    def __repr__(self):
        return f"<ForkSnapshot parent={self.parent_repo_id} fork={self.fork_full_name}>"
