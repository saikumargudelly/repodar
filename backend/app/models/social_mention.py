"""Social mention model (HN / Reddit posts referencing a tracked repo)."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SocialMention(Base):
    __tablename__ = "social_mentions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(32), nullable=False)  # "hn" | "reddit"
    post_title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    post_url: Mapped[str] = mapped_column(String(512), nullable=False)
    upvotes: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    subreddit: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    posted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    repository = relationship("Repository")

    __table_args__ = (
        Index("ix_social_mentions_repo_platform", "repo_id", "platform"),
    )
