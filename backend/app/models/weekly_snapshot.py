"""Weekly snapshot model — immutable record of top-25 repos each week."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class WeeklySnapshot(Base):
    __tablename__ = "weekly_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # ISO week identifier, e.g. "2026-W10"
    week_id: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    # JSON blob: list of top-25 repo dicts with scores at snapshot time
    data_json: Mapped[str] = mapped_column(Text, nullable=False)
