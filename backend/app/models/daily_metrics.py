import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DailyMetric(Base):
    __tablename__ = "daily_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False, index=True)

    # Raw GitHub metrics
    stars: Mapped[int] = mapped_column(Integer, default=0)
    forks: Mapped[int] = mapped_column(Integer, default=0)
    watchers: Mapped[int] = mapped_column(Integer, default=0)
    contributors: Mapped[int] = mapped_column(Integer, default=0)
    open_issues: Mapped[int] = mapped_column(Integer, default=0)
    open_prs: Mapped[int] = mapped_column(Integer, default=0)        # open pull requests
    merged_prs: Mapped[int] = mapped_column(Integer, default=0)      # cumulative merged PRs
    releases: Mapped[int] = mapped_column(Integer, default=0)

    # Intra-day deltas (computed at ingestion time)
    daily_star_delta: Mapped[int] = mapped_column(Integer, default=0)
    daily_fork_delta: Mapped[int] = mapped_column(Integer, default=0)
    daily_pr_delta: Mapped[int] = mapped_column(Integer, default=0)   # new merged PRs since last snapshot

    # Language snapshot (JSON string)
    language_breakdown: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    repository: Mapped["Repository"] = relationship("Repository", back_populates="daily_metrics")

    def __repr__(self):
        return f"<DailyMetric repo={self.repo_id} stars={self.stars} at={self.captured_at}>"
