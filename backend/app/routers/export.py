"""
Export router — CSV / JSON bulk export of repo data.

GET /export/repos?format=csv|json
  Full repo catalogue with latest computed metrics.

GET /export/metrics/{owner}/{name}?format=csv|json
  Daily metric history for a single repo.

Exports are synchronous (streaming response) — suitable for up to ~50k rows.
"""

import csv
import io
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Repository, ComputedMetric, DailyMetric

router = APIRouter(prefix="/export", tags=["Export"])
logger = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _stream_csv(headers: list[str], rows: list[dict]):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    output.seek(0)
    yield output.getvalue()


def _ts_str(dt: Optional[datetime]) -> str:
    return dt.isoformat() if dt else ""


# ─── /export/repos ─────────────────────────────────────────────────────────────

REPO_CSV_HEADERS = [
    "id", "owner", "name", "category", "primary_language", "description",
    "github_url", "stars", "age_days", "trend_score", "sustainability_score",
    "sustainability_label", "star_velocity_7d", "acceleration",
    "fork_to_star_ratio", "source", "is_active", "topics",
]


@router.get("/repos")
def export_repos(
    format: str = Query("json", pattern=r"^(json|csv)$"),
    category: Optional[str] = Query(None),
    min_stars: Optional[int] = Query(None, ge=0),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    """
    Export all tracked repositories with latest computed scores.
    Supports CSV and JSON output formats.
    """
    from sqlalchemy import and_, func

    latest_cm_sub = (
        db.query(
            Repository.id.label("repo_id"),
            func.max(ComputedMetric.date).label("max_date"),
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

    if active_only:
        q = q.filter(Repository.is_active == True)  # noqa
    if category:
        q = q.filter(Repository.category == category.lower())
    if min_stars is not None:
        q = q.filter(Repository.stars_snapshot >= min_stars)

    rows_data = []
    for repo, cm in q.all():
        rows_data.append({
            "id":                   repo.id,
            "owner":                repo.owner,
            "name":                 repo.name,
            "category":             repo.category,
            "primary_language":     repo.primary_language or "",
            "description":          (repo.description or "")[:200],
            "github_url":           repo.github_url,
            "stars":                repo.stars_snapshot or 0,
            "age_days":             repo.age_days or 0,
            "trend_score":          round(cm.trend_score or 0, 6) if cm else None,
            "sustainability_score": round(cm.sustainability_score or 0, 4) if cm else None,
            "sustainability_label": cm.sustainability_label if cm else None,
            "star_velocity_7d":     round(cm.star_velocity_7d or 0, 2) if cm else None,
            "acceleration":         round(cm.acceleration or 0, 4) if cm else None,
            "fork_to_star_ratio":   round(cm.fork_to_star_ratio or 0, 4) if cm else None,
            "source":               repo.source,
            "is_active":            repo.is_active,
            "topics":               repo.topics or "[]",
        })

    filename = f"repodar_repos_{datetime.now(timezone.utc).strftime('%Y%m%d')}"

    if format == "csv":
        return StreamingResponse(
            _stream_csv(REPO_CSV_HEADERS, rows_data),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    else:
        return StreamingResponse(
            iter([json.dumps(rows_data, indent=2)]),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )


# ─── /export/metrics/{owner}/{name} ────────────────────────────────────────────

METRICS_CSV_HEADERS = [
    "date", "stars", "forks", "watchers", "contributors",
    "open_issues", "open_prs", "merged_prs", "releases",
    "daily_star_delta", "commit_count",
]


@router.get("/metrics/{owner}/{name}")
def export_repo_metrics(
    owner: str,
    name: str,
    format: str = Query("json", pattern=r"^(json|csv)$"),
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """
    Export daily metric history for a single repository.
    """
    repo = db.query(Repository).filter_by(owner=owner, name=name).first()
    if not repo:
        raise HTTPException(status_code=404, detail=f"{owner}/{name} not found")

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    rows = (
        db.query(DailyMetric)
        .filter(DailyMetric.repo_id == repo.id, DailyMetric.captured_at >= cutoff)
        .order_by(DailyMetric.captured_at.asc())
        .all()
    )

    rows_data = [
        {
            "date":             r.captured_at.date().isoformat(),
            "stars":            r.stars,
            "forks":            r.forks,
            "watchers":         r.watchers,
            "contributors":     r.contributors,
            "open_issues":      r.open_issues,
            "open_prs":         getattr(r, "open_prs", 0) or 0,
            "merged_prs":       r.merged_prs,
            "releases":         r.releases,
            "daily_star_delta": r.daily_star_delta or 0,
            "commit_count":     getattr(r, "commit_count", 0) or 0,
        }
        for r in rows
    ]

    filename = f"repodar_{owner}_{name}_metrics_{datetime.now(timezone.utc).strftime('%Y%m%d')}"

    if format == "csv":
        return StreamingResponse(
            _stream_csv(METRICS_CSV_HEADERS, rows_data),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    else:
        return StreamingResponse(
            iter([json.dumps(rows_data, indent=2)]),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )
