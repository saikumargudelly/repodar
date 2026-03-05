import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class A2AService(Base):
    """Catalog of AI services that expose an /a2a-card endpoint."""

    __tablename__ = "a2a_services"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    base_url: Mapped[str] = mapped_column(String(512), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # JSON-encoded list of category strings, e.g. '["rag","embeddings"]'
    categories: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # "active" | "unreachable" | "invalid"
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)

    # Round-trip latency of the last /a2a-card fetch in milliseconds
    response_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Rich metadata extracted from the capability card
    auth_schemes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)      # JSON list e.g. '["Bearer","ApiKey"]'
    input_modes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)       # JSON list e.g. '["text","voice"]'
    output_modes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)      # JSON list e.g. '["text","audio"]'
    documentation_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    supports_streaming: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    capabilities: Mapped[list["A2ACapability"]] = relationship(
        "A2ACapability",
        back_populates="service",
        cascade="all, delete-orphan",
        lazy="select",
    )

    __table_args__ = (
        Index("ix_a2a_services_status_last_seen", "status", "last_seen_at"),
    )


class A2ACapability(Base):
    """Individual capability exposed by a registered A2A service."""

    __tablename__ = "a2a_capabilities"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    service_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("a2a_services.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(16), nullable=False, default="GET")
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    service: Mapped["A2AService"] = relationship("A2AService", back_populates="capabilities")
