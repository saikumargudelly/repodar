"""
EcosystemReport — persisted monthly/weekly generated reports.
Lets the frontend serve historical reports without re-generating them.
(Feature 9)
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EcosystemReport(Base):
    __tablename__ = "ecosystem_reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # "weekly" | "monthly"
    period_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # Human label e.g. "2026-W09" or "2026-02"
    period_label: Mapped[str] = mapped_column(String(30), nullable=False)

    generated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    # Full report serialised as JSON string
    report_json: Mapped[str] = mapped_column(Text, nullable=False)

    # One report per (type, label)
    __table_args__ = (
        UniqueConstraint("period_type", "period_label", name="uq_report_period"),
    )

    def __repr__(self):
        return f"<EcosystemReport {self.period_type} {self.period_label}>"
