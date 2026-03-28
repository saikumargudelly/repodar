import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import String, Float, Date, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ComputedMetric(Base):
    __tablename__ = "computed_metrics"

    __table_args__ = (
        Index('ix_computed_metrics_repo_date', 'repo_id', 'date'),
        Index('ix_computed_metrics_date_trend', 'date', 'trend_score'),
        Index('ix_computed_metrics_date_sust', 'date', 'sustainability_score'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    # Velocity metrics
    star_velocity_7d: Mapped[float] = mapped_column(Float, default=0.0)
    star_velocity_30d: Mapped[float] = mapped_column(Float, default=0.0)
    acceleration: Mapped[float] = mapped_column(Float, default=0.0)

    # Growth metrics
    contributor_growth_rate: Mapped[float] = mapped_column(Float, default=0.0)
    fork_to_star_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    issue_close_rate: Mapped[float] = mapped_column(Float, default=0.0)
    release_frequency: Mapped[float] = mapped_column(Float, default=0.0)

    # Composite scores
    trend_score: Mapped[float] = mapped_column(Float, default=0.0)
    sustainability_score: Mapped[float] = mapped_column(Float, default=0.0)
    sustainability_label: Mapped[str] = mapped_column(String(10), default="YELLOW")  # GREEN / YELLOW / RED

    # LLM-generated analyst explanation
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    repository: Mapped["Repository"] = relationship("Repository", back_populates="computed_metrics")

    def __repr__(self):
        return f"<ComputedMetric repo={self.repo_id} date={self.date} trend={self.trend_score:.2f}>"
