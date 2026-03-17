import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Integer, DateTime, Text, Boolean, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Repository(Base):
    __tablename__ = "repositories"

    __table_args__ = (
        Index('ix_repositories_owner_name', 'owner', 'name', unique=True),
        Index('ix_repositories_source_active', 'source', 'is_active'),
    )

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

    # ── Auto-discovery tracking ───────────────────────────────────────────────
    # is_active  : False repos are skipped during daily ingestion (but kept in
    #              DB for historical data). Gets flipped back to True if a repo
    #              resurfaces in GitHub Trending / Search.
    # source     : "seed" repos (from repos.yaml) are NEVER auto-deactivated.
    #              "auto_discovered" repos are deactivated after STALE_DAYS
    #              (default 60) of not appearing in any trending/search result.
    # discovered_at      : timestamp when first auto-added to the DB.
    # last_seen_trending : updated every day the repo appears in any
    #                      trending/search result — drives deactivation logic.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="seed")
    discovered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)
    last_seen_trending: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)

    # GitHub topic tags — JSON array of strings, e.g. '["llm","rag","langchain"]'
    # Populated from GitHub's repositoryTopics API; refreshed on each ingestion run.
    topics: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)

    # Current total stars snapshot — denormalised here for fast Early-Radar
    # queries without joining daily_metrics. Updated by the ingestion pipeline.
    stars_snapshot: Mapped[int] = mapped_column(Integer, default=0)

    # AI-generated plain-English summary (3 sentences, refreshed weekly)
    repo_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    repo_summary_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)

    # Commit activity heatmap — JSON array of {date, count} for 52 weeks
    commit_activity_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    commit_activity_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)

    # Relationships
    daily_metrics: Mapped[List["DailyMetric"]] = relationship("DailyMetric", back_populates="repository", cascade="all, delete-orphan")
    computed_metrics: Mapped[List["ComputedMetric"]] = relationship("ComputedMetric", back_populates="repository", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Repository {self.owner}/{self.name} [{self.category}]>"
