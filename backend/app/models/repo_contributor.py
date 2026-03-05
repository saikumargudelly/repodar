"""
RepoContributor — top contributors per repository, refreshed on each ingestion run.
Used for cross-repo contributor network analysis (Feature 4).
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RepoContributor(Base):
    __tablename__ = "repo_contributors"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    login: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    contributions: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    # One row per (repo, contributor)
    __table_args__ = (
        UniqueConstraint("repo_id", "login", name="uq_repo_contributor"),
    )

    def __repr__(self):
        return f"<RepoContributor repo={self.repo_id} login={self.login}>"
