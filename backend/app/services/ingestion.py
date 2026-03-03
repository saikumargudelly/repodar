"""
Daily ingestion pipeline.
Fetches raw GitHub metrics for all repos and writes one DailyMetric row per repo per day.
Idempotent: skips repos that already have a row captured today.
"""

import json
import logging
from datetime import datetime, timezone, date

from app.database import SessionLocal
from app.models import Repository, DailyMetric
from app.services.github_client import fetch_repo_metrics

logger = logging.getLogger(__name__)


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _calc_age_days(created_at_str: str) -> int:
    """Calculate repo age in days from ISO timestamp string."""
    if not created_at_str:
        return 0
    try:
        created = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - created).days
    except Exception:
        return 0


async def run_daily_ingestion() -> dict:
    """
    Main ingestion entry point.
    Returns summary dict: {total, ingested, skipped, failed}
    """
    db = SessionLocal()
    try:
        repos = db.query(Repository).all()
        today = _today_utc()
        logger.info(f"Starting ingestion for {len(repos)} repos on {today}")

        # Determine which repos still need today's snapshot
        already_done_ids = set(
            row.repo_id for row in db.query(DailyMetric.repo_id)
            .filter(
                DailyMetric.captured_at >= datetime.combine(today, datetime.min.time()),
                DailyMetric.captured_at < datetime.combine(today, datetime.max.time()),
            ).all()
        )

        pending = [
            {"id": r.id, "owner": r.owner, "name": r.name}
            for r in repos if r.id not in already_done_ids
        ]

        logger.info(f"Pending: {len(pending)} | Already done today: {len(already_done_ids)}")

        if not pending:
            return {"total": len(repos), "ingested": 0, "skipped": len(repos), "failed": 0}

        # Fetch from GitHub
        metrics_list = await fetch_repo_metrics(pending)

        ingested = 0
        failed = 0
        repo_map = {r.id: r for r in repos}

        for m in metrics_list:
            repo_id = m["repo_id"]
            try:
                # Calculate daily star delta vs yesterday
                prev = (
                    db.query(DailyMetric)
                    .filter_by(repo_id=repo_id)
                    .order_by(DailyMetric.captured_at.desc())
                    .first()
                )
                daily_star_delta = m["stars"] - (prev.stars if prev else m["stars"])
                daily_fork_delta = m["forks"] - (prev.forks if prev else m["forks"])

                metric = DailyMetric(
                    repo_id=repo_id,
                    captured_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    stars=m.get("stars", 0),
                    forks=m.get("forks", 0),
                    watchers=m.get("watchers", 0),
                    contributors=m.get("contributors", 0),
                    open_issues=m.get("open_issues", 0),
                    merged_prs=m.get("merged_prs", 0),
                    releases=m.get("releases", 0),
                    daily_star_delta=max(daily_star_delta, 0),
                    daily_fork_delta=max(daily_fork_delta, 0),
                    language_breakdown=json.dumps(m.get("language_breakdown", {})),
                )
                db.add(metric)

                # Update repo metadata
                if repo_id in repo_map:
                    repo = repo_map[repo_id]
                    repo.age_days = _calc_age_days(m.get("repo_created_at", ""))
                    if m.get("primary_language"):
                        repo.primary_language = m["primary_language"]

                ingested += 1
            except Exception as e:
                logger.error(f"Failed to save metric for repo {repo_id}: {e}")
                failed += 1

        db.commit()
        summary = {
            "total": len(repos),
            "ingested": ingested,
            "skipped": len(already_done_ids),
            "failed": failed,
        }
        logger.info(f"Ingestion complete: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Ingestion pipeline error: {e}", exc_info=True)
        raise
    finally:
        db.close()
