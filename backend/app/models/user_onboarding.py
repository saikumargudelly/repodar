import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserOnboarding(Base):
    __tablename__ = "user_onboarding"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    selected_verticals_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    current_step: Mapped[str] = mapped_column(String(24), nullable=False, default="interests")
    interests_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    watchlist_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    alerts_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tour_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    skipped_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    @property
    def selected_verticals(self) -> list[str]:
        try:
            parsed = json.loads(self.selected_verticals_json or "[]")
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    def set_selected_verticals(self, verticals: list[str]) -> None:
        self.selected_verticals_json = json.dumps(verticals)