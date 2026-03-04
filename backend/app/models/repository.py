import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Integer, DateTime, Text, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    github_url: Mapped[str] = mapped_column(String(512), nullable=False)
    primary_language: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    age_days: Mapped[int] = mapped_column(Integer, default=0)

    # Incremental-fetch cursor — updated after each successful ingestion.
    # Subsequent runs only pull GitHub data *since* this timestamp,
    # reducing API calls by ~80-90 % after the first full snapshot.
    last_fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)

    # Relationships
    daily_metrics: Mapped[List["DailyMetric"]] = relationship("DailyMetric", back_populates="repository", cascade="all, delete-orphan")
    computed_metrics: Mapped[List["ComputedMetric"]] = relationship("ComputedMetric", back_populates="repository", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Repository {self.owner}/{self.name} [{self.category}]>"
