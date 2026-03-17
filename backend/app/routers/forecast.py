"""
Forecast router — star growth forecasting + breakout scoring.

GET /forecast/{owner}/{name}
  Returns ForecastResult for a single repo.

GET /forecast/bulk?ids=owner1/name1,owner2/name2
  Returns ForecastResult list for multiple repos.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Repository, DailyMetric
from app.services.forecasting import ForecastResult, compute_forecast

router = APIRouter(prefix="/forecast", tags=["Forecasting"])
logger = logging.getLogger(__name__)


def _load_and_forecast(owner: str, name: str, db: Session, days: int = 90) -> ForecastResult:
    """Internal helper: load daily metrics for a repo and compute forecast."""
    repo = db.query(Repository).filter_by(owner=owner, name=name).first()
    if not repo:
        raise HTTPException(status_code=404, detail=f"Repository {owner}/{name} not found")

    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)

    rows = (
        db.query(DailyMetric)
        .filter(DailyMetric.repo_id == repo.id, DailyMetric.captured_at >= cutoff)
        .order_by(DailyMetric.captured_at.asc())
        .all()
    )

    daily_stars  = [r.stars for r in rows]
    daily_deltas = [r.daily_star_delta or 0 for r in rows]

    return compute_forecast(
        repo_id=f"{owner}/{name}",
        daily_stars=daily_stars,
        daily_deltas=daily_deltas,
    )


@router.get("/{owner}/{name}", response_model=ForecastResult)
def get_repo_forecast(
    owner: str,
    name: str,
    days: int = Query(90, ge=7, le=365, description="Days of historical data to use"),
    db: Session = Depends(get_db),
):
    """
    Compute a growth forecast for a single repository.
    Returns predicted stars for 7d / 30d / 90d horizons plus breakout probability.
    """
    return _load_and_forecast(owner, name, db, days=days)


@router.get("/bulk/batch", response_model=list[ForecastResult])
def get_bulk_forecast(
    ids: str = Query(..., description="Comma-separated owner/name pairs, max 20"),
    days: int = Query(90, ge=7, le=365),
    db: Session = Depends(get_db),
):
    """
    Compute forecasts for up to 20 repos in a single request.
    """
    pairs = [p.strip() for p in ids.split(",") if "/" in p.strip()][:20]
    if not pairs:
        raise HTTPException(status_code=422, detail="Provide at least one owner/name pair")

    results = []
    for pair in pairs:
        try:
            o, n = pair.split("/", 1)
            results.append(_load_and_forecast(o, n, db, days=days))
        except HTTPException:
            continue   # skip repos not found
        except Exception as e:
            logger.warning(f"Forecast failed for {pair}: {e}")
    return results
