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
        week_id = _week_id()
        existing = db.query(WeeklySnapshot).filter_by(week_id=week_id).first()
        if existing:
            logger.info(f"Snapshot for {week_id} already exists — skipping.")
            return {"week_id": week_id, "status": "already_exists"}

        today = date.today()
        top = (
            db.query(ComputedMetric, Repository)
            .join(Repository, Repository.id == ComputedMetric.repo_id)
            .filter(ComputedMetric.date == today, Repository.is_active == True)
            .order_by(ComputedMetric.trend_score.desc())
            .limit(25)
            .all()
        )

        snapshot_repos = []
        for rank, (cm, repo) in enumerate(top, 1):
            dm = (
                db.query(DailyMetric)
                .filter_by(repo_id=repo.id)
                .order_by(DailyMetric.date.desc())
                .first()
            )
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
                "stars": dm.stars if dm else 0,
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
