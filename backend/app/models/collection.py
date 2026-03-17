"""
Collection model — community-curated repo lists with vote-driven ranking.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Collection(Base):
    __tablename__ = "collections"

    __table_args__ = (
        Index("ix_collections_created_by", "created_by"),
        Index("ix_collections_votes", "votes"),
    )

    id:          Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title:       Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # JSON array of repo IDs (owner/name strings)
    repo_ids_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    # Vote count — denormalised for fast ranking queries
    votes:       Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Visibility
    is_public:   Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Author
    created_by:  Mapped[str] = mapped_column(String(255), nullable=False)  # Clerk user_id
    created_at:  Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at:  Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Share slug (optional: for public links)
    share_slug:  Mapped[Optional[str]] = mapped_column(String(100), nullable=True, unique=True)

    # Relationships
    votes_log:   Mapped[list["CollectionVote"]] = relationship(
        "CollectionVote", back_populates="collection", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Collection {self.title!r} [{self.votes} votes]>"


class CollectionVote(Base):
    """Vote log — one vote per user per collection. Prevents double-voting."""
    __tablename__ = "collection_votes"

    __table_args__ = (
        UniqueConstraint("collection_id", "user_id", name="uq_collection_vote"),
        Index("ix_collection_votes_collection_id", "collection_id"),
    )

    id:            Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id: Mapped[str] = mapped_column(String(36), ForeignKey("collections.id"), nullable=False)
    user_id:       Mapped[str] = mapped_column(String(255), nullable=False)
    direction:     Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 = up, -1 = down
    voted_at:      Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    collection: Mapped["Collection"] = relationship("Collection", back_populates="votes_log")
