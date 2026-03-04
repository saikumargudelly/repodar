"""
CategoryMetricDaily — pre-aggregated category-level metrics written by
the scoring pipeline (run_daily_scoring) and read by the dashboard.

Why this table exists
──────────────────────
Computing category growth on every API request requires DuckDB to JOIN
daily_metrics × repositories (O(repos × days)).  Writing once per day
at scoring time and reading from this cache makes dashboard endpoints
respond in < 5 ms regardless of how many repos/days exist.

Design notes
────────────
- Unique on (date, category) — upsert semantics in scoring.
- All signal values preserved so the API can expose raw + composite.
- `period_days` records which rolling window was used when the row
  was computed (default = 7).
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import String, Integer, Float, Date, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CategoryMetricDaily(Base):
    __tablename__ = "category_metrics_daily"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    period_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)

    # ------------------------------------------------------------------
    # Absolute totals (snapshot of the category at this date)
    # ------------------------------------------------------------------
    total_stars: Mapped[int] = mapped_column(Integer, default=0)
    total_contributors: Mapped[int] = mapped_column(Integer, default=0)
    total_merged_prs: Mapped[int] = mapped_column(Integer, default=0)
    repo_count: Mapped[int] = mapped_column(Integer, default=0)

    # ------------------------------------------------------------------
    # Period deltas
    # ------------------------------------------------------------------
    period_star_gain: Mapped[int] = mapped_column(Integer, default=0)
    period_pr_gain: Mapped[int] = mapped_column(Integer, default=0)
    avg_open_prs: Mapped[float] = mapped_column(Float, default=0.0)

    # ------------------------------------------------------------------
    # Velocity / growth signals (raw, before normalisation)
    # ------------------------------------------------------------------
    weekly_velocity: Mapped[float] = mapped_column(Float, default=0.0)
    mom_growth_pct: Mapped[float] = mapped_column(Float, default=0.0)

    # ------------------------------------------------------------------
    # Composite trend score (0-1, min-max normalised across categories)
    # ------------------------------------------------------------------
    trend_composite: Mapped[float] = mapped_column(Float, default=0.0)

    computed_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    __table_args__ = (
        UniqueConstraint("date", "category", "period_days", name="uq_category_metrics_date_cat_period"),
        Index("ix_category_metrics_date_period", "date", "period_days"),
    )

    def __repr__(self):
        return f"<CategoryMetricDaily {self.category} {self.date} trend={self.trend_composite:.4f}>"
