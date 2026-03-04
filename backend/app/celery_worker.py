"""
Celery worker and Beat schedule.

Tasks:
  - task_pipeline_sync: runs every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
                        Full delta-sync: discover → ingest (upsert) → score → explain (once/day)
  - Legacy single-step tasks kept for manual triggers.

Usage:
  Worker:  celery -A app.celery_worker worker --loglevel=info --concurrency=4
  Beat:    celery -A app.celery_worker beat --loglevel=info
  Monitor: celery -A app.celery_worker flower --port=5555
"""

import os
import asyncio
import logging
from datetime import datetime, timezone

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
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=600,
    task_time_limit=900,
    result_expires=86400,
)

# ─── Beat schedule — every 4 hours ───────────────────────────────────────────
# Runs at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC

celery_app.conf.beat_schedule = {
    # Full delta-sync pipeline — every 4 hours
    "pipeline-sync-4h": {
        "task": "app.celery_worker.task_pipeline_sync",
        "schedule": crontab(minute=0, hour="*/4"),
        "options": {"queue": "ingestion"},
    },
    # Explanations are expensive (LLM API) — once per day at 01:00 is enough
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
    name="app.celery_worker.task_pipeline_sync",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def task_pipeline_sync(self):
    """
    Full delta-sync pipeline: discover → ingest (upsert) → score.
    Runs every 4 hours. Explanations are skipped here (done once/day separately).
    """
    try:
        from app.services.ingestion import run_daily_ingestion
        from app.services.scoring import run_daily_scoring

        logger.info("Celery pipeline-sync: starting ingestion")
        ingest_result = asyncio.run(run_daily_ingestion())
        logger.info(f"Celery pipeline-sync: ingestion done → {ingest_result}")

        logger.info("Celery pipeline-sync: starting scoring")
        score_result = run_daily_scoring()
        logger.info(f"Celery pipeline-sync: scoring done → {score_result}")

        return {
            "run_at": datetime.now(timezone.utc).isoformat(),
            **ingest_result,
            "scored": score_result.get("scored", 0),
            "failed_scoring": score_result.get("failed", 0),
            "alerts_generated": score_result.get("alerts", 0),
        }
    except Exception as exc:
        logger.error(f"Celery pipeline-sync failed — retrying: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.celery_worker.task_daily_ingestion",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def task_daily_ingestion(self):
    """Legacy single-step ingestion task (kept for backward compat / manual triggers)."""
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
    """Legacy single-step scoring task."""
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
    """Generate Groq-powered analyst explanations for top 20 trending repos (once/day)."""
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
    """Manually trigger ingestion for a single repo."""
    from app.database import SessionLocal
    from app.models import Repository
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
