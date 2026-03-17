"""
Filter Engine — decoupled from routers/UI.

Architecture:
  RepoFilterDTO  → validated input contract
  FilterParser   → canonicalise / sanitise raw params
  QueryBuilder   → builds SQLAlchemy query expression

Usage:
  dto  = RepoFilterDTO(**raw_params)
  expr = QueryBuilder(dto).build()
  rows = db.query(Repository).filter(expr).all()
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Query

from app.models import Repository, ComputedMetric

logger = logging.getLogger(__name__)

# ─── DTO ──────────────────────────────────────────────────────────────────────

class RepoFilterDTO(BaseModel):
    """Strict, typed filter contract. All fields optional — empty = no filter."""

    # Multi-select
    languages:   list[str] = Field(default_factory=list, description="Primary language filter (OR logic)")
    categories:  list[str] = Field(default_factory=list, description="Category filter (OR logic)")
    topics:      list[str] = Field(default_factory=list, description="Topic tag filter (repo must have at least one)")

    # Star range
    min_stars:   Optional[int]   = Field(None, ge=0)
    max_stars:   Optional[int]   = Field(None, ge=0)

    # Age range (days)
    min_age_days: Optional[int]  = Field(None, ge=0)
    max_age_days: Optional[int]  = Field(None, ge=0)

    # Score ranges [0–1]
    min_trend_score:         Optional[float] = Field(None, ge=0, le=1)
    max_trend_score:         Optional[float] = Field(None, ge=0, le=1)
    min_sustainability_score: Optional[float] = Field(None, ge=0, le=1)
    max_sustainability_score: Optional[float] = Field(None, ge=0, le=1)

    # Velocity
    min_star_velocity_7d:  Optional[float] = Field(None)
    max_star_velocity_7d:  Optional[float] = Field(None)

    # Source / activity
    sources:       list[str] = Field(default_factory=list)  # seed | auto_discovered | on_demand
    active_only:   bool = True

    # Sort
    sort_by:  str = Field("trend_score", description="trend_score|sustainability_score|stars|star_velocity_7d|age_days")
    sort_dir: str = Field("desc", pattern=r"^(asc|desc)$")

    # Pagination
    page:     int = Field(1, ge=1)
    per_page: int = Field(50, ge=1, le=200)

    @field_validator("languages", "categories", "topics", "sources", mode="before")
    @classmethod
    def split_comma_string(cls, v):
        """Allow comma-separated string or list."""
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v or []

    @field_validator("sort_by")
    @classmethod
    def validate_sort(cls, v):
        allowed = {"trend_score", "sustainability_score", "stars", "star_velocity_7d", "age_days", "acceleration"}
        return v if v in allowed else "trend_score"


# ─── FilterParser ─────────────────────────────────────────────────────────────

class FilterParser:
    """Canonicalise raw dict → RepoFilterDTO. Strips unknowns, normalises case."""

    @staticmethod
    def parse(raw: dict) -> RepoFilterDTO:
        norm = {k.lower(): v for k, v in raw.items()}
        # Normalise language names to title-case for comparison
        if "languages" in norm and isinstance(norm["languages"], list):
            norm["languages"] = [l.title() if l.lower() != "c++" else "C++" for l in norm["languages"]]
        return RepoFilterDTO(**norm)


# ─── QueryBuilder ─────────────────────────────────────────────────────────────

class QueryBuilder:
    """
    Builds a SQLAlchemy ORM query from a RepoFilterDTO.
    Returns (query, total_count) — caller applies .offset/.limit.
    """

    def __init__(self, db, dto: RepoFilterDTO):
        self._db  = db
        self._dto = dto

    def build(self):
        """
        Returns:
            (paginated_results: list[tuple[Repository, ComputedMetric|None]],
             total_count: int)
        """
        dto = self._dto
        db  = self._db

        from sqlalchemy import func as _func

        # ── Latest computed metric subquery ─────────────────────────────────
        latest_cm_sub = (
            db.query(
                Repository.id.label("repo_id"),
                _func.max(ComputedMetric.date).label("max_date"),
            )
            .outerjoin(ComputedMetric, Repository.id == ComputedMetric.repo_id)
            .group_by(Repository.id)
            .subquery()
        )

        q = (
            db.query(Repository, ComputedMetric)
            .outerjoin(latest_cm_sub, Repository.id == latest_cm_sub.c.repo_id)
            .outerjoin(
                ComputedMetric,
                and_(
                    Repository.id == ComputedMetric.repo_id,
                    ComputedMetric.date == latest_cm_sub.c.max_date,
                ),
            )
        )

        # ── Filters ─────────────────────────────────────────────────────────
        if dto.active_only:
            q = q.filter(Repository.is_active == True)  # noqa: E712

        if dto.languages:
            q = q.filter(
                or_(*[Repository.primary_language.ilike(lang) for lang in dto.languages])
            )

        if dto.categories:
            q = q.filter(Repository.category.in_([c.lower() for c in dto.categories]))

        if dto.sources:
            q = q.filter(Repository.source.in_(dto.sources))

        if dto.min_stars is not None:
            q = q.filter(Repository.stars_snapshot >= dto.min_stars)
        if dto.max_stars is not None:
            q = q.filter(Repository.stars_snapshot <= dto.max_stars)

        if dto.min_age_days is not None:
            q = q.filter(Repository.age_days >= dto.min_age_days)
        if dto.max_age_days is not None:
            q = q.filter(Repository.age_days <= dto.max_age_days)

        if dto.topics:
            # Topic is JSON array text — use LIKE matching
            topic_conditions = [
                Repository.topics.like(f'%"{t}"%') for t in dto.topics
            ]
            q = q.filter(or_(*topic_conditions))

        # Score filters (only applies if ComputedMetric exists)
        if dto.min_trend_score is not None:
            q = q.filter(ComputedMetric.trend_score >= dto.min_trend_score)
        if dto.max_trend_score is not None:
            q = q.filter(ComputedMetric.trend_score <= dto.max_trend_score)
        if dto.min_sustainability_score is not None:
            q = q.filter(ComputedMetric.sustainability_score >= dto.min_sustainability_score)
        if dto.max_sustainability_score is not None:
            q = q.filter(ComputedMetric.sustainability_score <= dto.max_sustainability_score)
        if dto.min_star_velocity_7d is not None:
            q = q.filter(ComputedMetric.star_velocity_7d >= dto.min_star_velocity_7d)
        if dto.max_star_velocity_7d is not None:
            q = q.filter(ComputedMetric.star_velocity_7d <= dto.max_star_velocity_7d)

        # ── Count before pagination ──────────────────────────────────────────
        total_count = q.count()

        # ── Sort ─────────────────────────────────────────────────────────────
        sort_col_map = {
            "trend_score":         ComputedMetric.trend_score,
            "sustainability_score": ComputedMetric.sustainability_score,
            "star_velocity_7d":    ComputedMetric.star_velocity_7d,
            "acceleration":        ComputedMetric.acceleration,
            "stars":               Repository.stars_snapshot,
            "age_days":            Repository.age_days,
        }
        sort_col = sort_col_map.get(dto.sort_by, ComputedMetric.trend_score)
        if dto.sort_dir == "asc":
            q = q.order_by(sort_col.asc().nullslast())
        else:
            q = q.order_by(sort_col.desc().nullslast())

        # ── Paginate ─────────────────────────────────────────────────────────
        offset = (dto.page - 1) * dto.per_page
        rows = q.offset(offset).limit(dto.per_page).all()

        return rows, total_count
