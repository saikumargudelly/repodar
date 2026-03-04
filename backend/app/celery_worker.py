"""
Celery worker and Beat schedule.

Tasks:
  - task_daily_ingestion   : runs at 00:00 UTC — auto-discovers new trending
                             repos via GitHub Trending + Search API, deactivates
                             stale repos, then fetches GitHub metrics for all
                             active repos.
  - task_daily_scoring     : runs at 00:30 UTC — computes trend/sustainability scores
  - task_daily_explanations: runs at 01:00 UTC — generates Groq explanations for top repos

Usage:
  Worker:  celery -A app.celery_worker worker --loglevel=info --concurrency=4
  Beat:    celery -A app.celery_worker beat --loglevel=info
  Monitor: celery -A app.celery_worker flower --port=5555
"""

import os
import asyncio
import logging

from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ─── Celery app ──────────────────────────────────────────────────────────────

celery_app = Celery(
    "repodar",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,           # Re-queue task if worker dies mid-run
    worker_prefetch_multiplier=1,  # Prevent grabbing multiple heavy tasks
    task_soft_time_limit=600,      # Warn after 10 min
    task_time_limit=900,           # Kill after 15 min (hard limit)
    result_expires=86400,          # Keep results 24h
)

# ─── Beat schedule ───────────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    "daily-ingestion": {
        "task": "app.celery_worker.task_daily_ingestion",
        "schedule": crontab(hour=0, minute=0),
        "options": {"queue": "ingestion"},
    },
    "daily-scoring": {
        "task": "app.celery_worker.task_daily_scoring",
        "schedule": crontab(hour=0, minute=30),
        "options": {"queue": "scoring"},
    },
    "daily-explanations": {
        "task": "app.celery_worker.task_daily_explanations",
        "schedule": crontab(hour=1, minute=0),
        "options": {"queue": "scoring"},
    },
}

celery_app.conf.task_queues = {
    "ingestion": {},
    "scoring": {},
}
celery_app.conf.task_default_queue = "ingestion"


# ─── Tasks ───────────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.celery_worker.task_daily_ingestion",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # Retry after 5 min on failure
)
def task_daily_ingestion(self):
    """
    Auto-discover new trending repos, deactivate stale ones, then fetch
    raw GitHub metrics for all active repos. Retries up to 3× on failure.
    """
    try:
        from app.services.ingestion import run_daily_ingestion
        logger.info("Celery: starting daily ingestion")
        result = asyncio.run(run_daily_ingestion())
        logger.info(f"Celery: ingestion complete → {result}")
        return result
    except Exception as exc:
        logger.error(f"Celery: ingestion failed — retrying: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.celery_worker.task_daily_scoring",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def task_daily_scoring(self):
    """Compute TrendScore and SustainabilityScore for all repos."""
    try:
        from app.services.scoring import run_daily_scoring
        logger.info("Celery: starting daily scoring")
        result = run_daily_scoring()
        logger.info(f"Celery: scoring complete → {result}")
        return result
    except Exception as exc:
        logger.error(f"Celery: scoring failed — retrying: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.celery_worker.task_daily_explanations",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def task_daily_explanations(self):
    """Generate Groq-powered analyst explanations for top 20 trending repos."""
    try:
        from app.services.explanation import enrich_top_repos_with_explanations
        logger.info("Celery: starting explanation generation")
        count = enrich_top_repos_with_explanations(top_n=20)
        logger.info(f"Celery: explanations generated → {count}")
        return {"explanations_written": count}
    except Exception as exc:
        logger.error(f"Celery: explanation task failed — retrying: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(name="app.celery_worker.task_manual_ingest_single")
def task_manual_ingest_single(repo_id: str):
    """
    Manually trigger ingestion for a single repo (used by admin API endpoint).
    """
    from app.database import SessionLocal
    from app.models import Repository
    import asyncio
    from app.services.github_client import fetch_repo_metrics
    from app.services.ingestion import run_daily_ingestion

    db = SessionLocal()
    try:
        repo = db.query(Repository).filter_by(id=repo_id).first()
        if not repo:
            return {"error": f"Repo {repo_id} not found"}
        result = asyncio.run(run_daily_ingestion())
        return result
    finally:
        db.close()
