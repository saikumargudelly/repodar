"""
SavedFilterPreset model — store user filter configurations.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SavedFilterPreset(Base):
    __tablename__ = "saved_filter_presets"

    __table_args__ = (
        Index("ix_saved_filter_presets_user_id", "user_id"),
    )

    id:          Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id:     Mapped[str] = mapped_column(String(255), nullable=False)
    name:        Mapped[str] = mapped_column(String(200), nullable=False)

    # Full filter DTO serialised as JSON
    filter_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    created_at:  Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at:  Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    def __repr__(self):
        return f"<SavedFilterPreset {self.user_id}: {self.name!r}>"
