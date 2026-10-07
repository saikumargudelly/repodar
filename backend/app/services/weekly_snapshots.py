"""
Weekly snapshot publisher — captures top-25 repos each Monday morning.
"""
import json
import logging
import uuid
from datetime import date, datetime, timezone

logger = logging.getLogger(__name__)


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _week_id(d: date | None = None) -> str:
    """Return ISO week identifier like '2026-W10'."""
    d = d or date.today()
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def publish_weekly_snapshot() -> dict:
    """
    Create an immutable weekly snapshot of the top-25 repos by TrendScore.
    Skips if a snapshot for the current week already exists.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric, DailyMetric
    from app.models.weekly_snapshot import WeeklySnapshot

    db = SessionLocal()
    try:
        # Find the latest date in ComputedMetric table to ensure we always capture valid scored data
        latest_cm = db.query(ComputedMetric).order_by(ComputedMetric.date.desc()).first()
        if not latest_cm:
            logger.warning("No ComputedMetric records found in database — skipping snapshot.")
            return {"status": "no_metrics", "detail": "No computed metrics available."}
        
        latest_date = latest_cm.date
        week_id = _week_id(latest_date)

        existing = db.query(WeeklySnapshot).filter_by(week_id=week_id).first()
        if existing:
            logger.info(f"Snapshot for {week_id} already exists — skipping.")
            return {"week_id": week_id, "status": "already_exists"}

        top = (
            db.query(ComputedMetric, Repository)
            .join(Repository, Repository.id == ComputedMetric.repo_id)
            .filter(ComputedMetric.date == latest_date, Repository.is_active == True)
            .order_by(ComputedMetric.trend_score.desc())
            .limit(25)
            .all()
        )

        repo_ids = [repo.id for cm, repo in top]
        # Batch-fetch latest stars in a single query
        from sqlalchemy import func
        latest_dm_subq = (
            db.query(DailyMetric.repo_id, func.max(DailyMetric.captured_at).label("max_cap"))
            .filter(DailyMetric.repo_id.in_(repo_ids))
            .group_by(DailyMetric.repo_id)
            .subquery()
        )
        latest_dms = (
            db.query(DailyMetric.repo_id, DailyMetric.stars)
            .join(latest_dm_subq, (DailyMetric.repo_id == latest_dm_subq.c.repo_id) & (DailyMetric.captured_at == latest_dm_subq.c.max_cap))
            .all()
        )
        stars_by_repo = {row.repo_id: row.stars for row in latest_dms}

        snapshot_repos = []
        for rank, (cm, repo) in enumerate(top, 1):
            stars_val = stars_by_repo.get(repo.id, repo.stars_snapshot or 0)
            snapshot_repos.append({
                "rank": rank,
                "repo_id": repo.id,
                "owner": repo.owner,
                "name": repo.name,
                "category": repo.category,
                "github_url": repo.github_url,
                "primary_language": repo.primary_language,
                "description": repo.description,
                "trend_score": round(cm.trend_score, 4),
                "sustainability_score": round(cm.sustainability_score, 4),
                "sustainability_label": cm.sustainability_label,
                "star_velocity_7d": round(cm.star_velocity_7d, 2),
                "acceleration": round(cm.acceleration, 4),
                "stars": stars_val,
                "age_days": repo.age_days,
            })

        snapshot = WeeklySnapshot(
            id=str(uuid.uuid4()),
            week_id=week_id,
            published_at=_utcnow(),
            data_json=json.dumps(snapshot_repos),
        )
        db.add(snapshot)
        db.commit()
        logger.info(f"Published weekly snapshot {week_id} with {len(snapshot_repos)} repos.")
        return {"week_id": week_id, "status": "published", "repo_count": len(snapshot_repos)}

    except Exception as e:
        db.rollback()
        logger.error(f"Weekly snapshot failed: {e}")
        return {"status": "error", "detail": str(e)}
    finally:
        db.close()
