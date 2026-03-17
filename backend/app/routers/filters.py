"""
Filters router — multi-dimensional repo filtering + saved presets.

POST /filters/repos          → apply RepoFilterDTO and return paginated results
GET  /filters/presets        → list user's saved presets
POST /filters/presets        → save a new preset
DELETE /filters/presets/{id} → delete a preset
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ComputedMetric
from app.models.saved_filter import SavedFilterPreset
from app.services.filter_engine import RepoFilterDTO, FilterParser, QueryBuilder

router = APIRouter(prefix="/filters", tags=["Filters"])
logger = logging.getLogger(__name__)


# ─── Schema ───────────────────────────────────────────────────────────────────

class RepoSummary(BaseModel):
    id: str
    owner: str
    name: str
    category: str
    description: Optional[str]
    github_url:  str
    primary_language: Optional[str]
    age_days:    int
    stars:       int
    trend_score: Optional[float]
    sustainability_score: Optional[float]
    sustainability_label: Optional[str]
    star_velocity_7d:     Optional[float]
    acceleration:         Optional[float]
    topics:               list[str]


class FilteredResponse(BaseModel):
    items:       list[RepoSummary]
    total:       int
    page:        int
    per_page:    int
    total_pages: int


class SavePresetRequest(BaseModel):
    name:   str
    filter: dict


class PresetResponse(BaseModel):
    id:          str
    name:        str
    filter:      dict
    created_at:  str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/repos", response_model=FilteredResponse)
def filter_repos(
    dto: RepoFilterDTO,
    db: Session = Depends(get_db),
):
    """
    Multi-dimensional repo filter. Accepts full RepoFilterDTO as JSON body.
    Supports: languages, categories, topics, star range, age range, score ranges,
    star velocity range, sort, pagination.
    """
    rows, total = QueryBuilder(db, dto).build()

    items = []
    for repo, cm in rows:
        topics = []
        if repo.topics:
            try:
                topics = json.loads(repo.topics)
            except Exception:
                pass

        items.append(RepoSummary(
            id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            description=repo.description,
            github_url=repo.github_url,
            primary_language=repo.primary_language,
            age_days=repo.age_days or 0,
            stars=repo.stars_snapshot or 0,
            trend_score=cm.trend_score if cm else None,
            sustainability_score=cm.sustainability_score if cm else None,
            sustainability_label=cm.sustainability_label if cm else None,
            star_velocity_7d=cm.star_velocity_7d if cm else None,
            acceleration=cm.acceleration if cm else None,
            topics=topics,
        ))

    total_pages = max(1, (total + dto.per_page - 1) // dto.per_page)
    return FilteredResponse(
        items=items, total=total, page=dto.page, per_page=dto.per_page,
        total_pages=total_pages,
    )


@router.get("/repos", response_model=FilteredResponse)
def filter_repos_get(
    languages:    str = Query(""),
    categories:   str = Query(""),
    topics:       str = Query(""),
    min_stars:    Optional[int]   = Query(None),
    max_stars:    Optional[int]   = Query(None),
    min_age_days: Optional[int]   = Query(None),
    max_age_days: Optional[int]   = Query(None),
    min_trend_score:  Optional[float] = Query(None),
    min_sustainability_score: Optional[float] = Query(None),
    min_star_velocity_7d: Optional[float] = Query(None),
    sort_by:  str = Query("trend_score"),
    sort_dir: str = Query("desc"),
    page:     int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """GET version for simple frontend use (all params as query strings)."""
    dto = FilterParser.parse({
        "languages": languages, "categories": categories, "topics": topics,
        "min_stars": min_stars, "max_stars": max_stars,
        "min_age_days": min_age_days, "max_age_days": max_age_days,
        "min_trend_score": min_trend_score,
        "min_sustainability_score": min_sustainability_score,
        "min_star_velocity_7d": min_star_velocity_7d,
        "sort_by": sort_by, "sort_dir": sort_dir,
        "page": page, "per_page": per_page,
    })
    rows, total = QueryBuilder(db, dto).build()

    items = []
    for repo, cm in rows:
        topics_list = []
        if repo.topics:
            try:
                topics_list = json.loads(repo.topics)
            except Exception:
                pass
        items.append(RepoSummary(
            id=repo.id, owner=repo.owner, name=repo.name,
            category=repo.category, description=repo.description,
            github_url=repo.github_url, primary_language=repo.primary_language,
            age_days=repo.age_days or 0, stars=repo.stars_snapshot or 0,
            trend_score=cm.trend_score if cm else None,
            sustainability_score=cm.sustainability_score if cm else None,
            sustainability_label=cm.sustainability_label if cm else None,
            star_velocity_7d=cm.star_velocity_7d if cm else None,
            acceleration=cm.acceleration if cm else None, topics=topics_list,
        ))

    total_pages = max(1, (total + dto.per_page - 1) // dto.per_page)
    return FilteredResponse(
        items=items, total=total, page=dto.page, per_page=dto.per_page,
        total_pages=total_pages,
    )


# ─── Saved Presets ────────────────────────────────────────────────────────────

@router.get("/presets", response_model=list[PresetResponse])
def list_presets(
    x_user_id: str = Header(..., alias="X-User-Id", description="Clerk user ID"),
    db: Session = Depends(get_db),
):
    """List all saved filter presets for the authenticated user."""
    rows = db.query(SavedFilterPreset).filter_by(user_id=x_user_id).all()
    return [
        PresetResponse(
            id=r.id, name=r.name,
            filter=json.loads(r.filter_json),
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/presets", response_model=PresetResponse, status_code=201)
def save_preset(
    body: SavePresetRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """Save the current filter configuration as a named preset."""
    preset = SavedFilterPreset(
        user_id=x_user_id,
        name=body.name,
        filter_json=json.dumps(body.filter),
    )
    db.add(preset)
    db.commit()
    return PresetResponse(
        id=preset.id, name=preset.name,
        filter=body.filter, created_at=preset.created_at.isoformat(),
    )


@router.delete("/presets/{preset_id}", status_code=204)
def delete_preset(
    preset_id: str,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """Delete a saved filter preset (only the owner can delete)."""
    preset = db.query(SavedFilterPreset).filter_by(id=preset_id, user_id=x_user_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    db.delete(preset)
    db.commit()
