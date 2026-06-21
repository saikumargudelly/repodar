"""
Export router — CSV / JSON bulk export of repo data.

GET /export/repos?format=csv|json
  Full repo catalogue with latest computed metrics. Streams rows in batches;
  never loads the full table into server memory.

GET /export/metrics/{owner}/{name}?format=csv|json
  Daily metric history for a single repo.

All endpoints require a valid Clerk JWT in the Authorization header.
"""

import csv
import io
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Generator, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
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

EXPORT_BATCH_SIZE = 500   # rows per DB fetch — caps memory usage per batch


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
    _user: str = Depends(get_current_user),   # ← verified JWT, not spoofable header
):
    """
    Export all tracked repositories with latest computed scores.
    Streams results in batches of EXPORT_BATCH_SIZE; never loads the
    full table into server memory.
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
        .order_by(Repository.id)
    )

    if active_only:
        q = q.filter(Repository.is_active == True)  # noqa
    if category:
        q = q.filter(Repository.category == category.lower())
    if min_stars is not None:
        q = q.filter(Repository.stars_snapshot >= min_stars)

    def _row_to_dict(repo: Repository, cm: Optional[ComputedMetric]) -> dict:
        return {
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
        }

    filename = f"repodar_repos_{datetime.now(timezone.utc).strftime('%Y%m%d')}"

    if format == "csv":
        def _csv_stream() -> Generator[str, None, None]:
            """Yield CSV rows one batch at a time."""
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=REPO_CSV_HEADERS, extrasaction="ignore")
            writer.writeheader()
            yield buf.getvalue()
            offset = 0
            while True:
                batch = q.offset(offset).limit(EXPORT_BATCH_SIZE).all()
                if not batch:
                    break
                for repo, cm in batch:
                    buf = io.StringIO()
                    writer = csv.DictWriter(buf, fieldnames=REPO_CSV_HEADERS, extrasaction="ignore")
                    writer.writerow(_row_to_dict(repo, cm))
                    yield buf.getvalue()
                offset += EXPORT_BATCH_SIZE

        return StreamingResponse(
            _csv_stream(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    else:
        def _json_stream() -> Generator[str, None, None]:
            """Yield a valid JSON array one batch at a time."""
            yield "["
            first = True
            offset = 0
            while True:
                batch = q.offset(offset).limit(EXPORT_BATCH_SIZE).all()
                if not batch:
                    break
                for repo, cm in batch:
                    row_json = json.dumps(_row_to_dict(repo, cm))
                    if not first:
                        yield ","
                    yield row_json
                    first = False
                offset += EXPORT_BATCH_SIZE
            yield "]"

        return StreamingResponse(
            _json_stream(),
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
    owner: str = Path(..., pattern=r"^[A-Za-z0-9_.-]+$"),
    name: str = Path(..., pattern=r"^[A-Za-z0-9_.-]+$"),
    format: str = Query("json", pattern=r"^(json|csv)$"),
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),   # ← auth guard
):
    """
    Export daily metric history for a single repository.
    """
    repo = db.query(Repository).filter_by(owner=owner, name=name).first()
    if not repo:
        raise HTTPException(status_code=404, detail=f"{owner}/{name} not found")

    from sqlalchemy import func
    latest_dt = db.query(func.max(DailyMetric.captured_at)).filter(DailyMetric.repo_id == repo.id).scalar()
    if not latest_dt:
        latest_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = latest_dt - timedelta(days=days)
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
