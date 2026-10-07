"""
Dynamic Organization model for database-driven, static-free organization discovery.
Stores organizations and their dynamically detected technology achievements.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Integer, DateTime, Boolean, Index
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DynamicOrganization(Base):
    __tablename__ = "dynamic_organizations"

    __table_args__ = (
        Index("ix_dynamic_orgs_active_synced", "is_active", "delta_status", "last_synced_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    login: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    primary_technology: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    technologies: Mapped[Optional[List[str]]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True, default=list)
    repo_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="dynamic_discovery")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    delta_status: Mapped[str] = mapped_column(String(50), nullable=False, default="active", index=True)  # active, stale, archived, deleted
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
    signal_metadata: Mapped[Optional[dict]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True, default=None)

    def __repr__(self):
        return f"<DynamicOrganization {self.login} [tech={self.primary_technology}, stars={self.total_stars}, status={self.delta_status}]>"
