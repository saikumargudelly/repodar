"""
Weekly snapshot endpoints.

GET /snapshots          — list all published snapshots
GET /snapshots/{weekId} — get a specific week's snapshot
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.weekly_snapshot import WeeklySnapshot

router = APIRouter(prefix="/snapshots", tags=["Snapshots"])


class SnapshotSummary(BaseModel):
    week_id: str
    published_at: str
    repo_count: int


class SnapshotDetail(BaseModel):
    week_id: str
    published_at: str
    repos: List[dict]


@router.get("", response_model=List[SnapshotSummary])
def list_snapshots(db: Session = Depends(get_db)):
    """List all published weekly snapshots, newest first."""
    rows = db.query(WeeklySnapshot).order_by(WeeklySnapshot.published_at.desc()).all()
    results = []
    for row in rows:
        try:
            count = len(json.loads(row.data_json))
        except Exception:
            count = 0
        results.append(SnapshotSummary(
            week_id=row.week_id,
            published_at=row.published_at.isoformat(),
            repo_count=count,
        ))
    return results


@router.get("/{week_id}", response_model=SnapshotDetail)
def get_snapshot(week_id: str, db: Session = Depends(get_db)):
    """Get the immutable top-25 snapshot for a specific ISO week (e.g. 2026-W10)."""
    row = db.query(WeeklySnapshot).filter_by(week_id=week_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"No snapshot found for {week_id}")
    try:
        repos = json.loads(row.data_json)
    except Exception:
        repos = []
    return SnapshotDetail(
        week_id=row.week_id,
        published_at=row.published_at.isoformat(),
        repos=repos,
    )
