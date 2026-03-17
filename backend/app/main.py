import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware import APIKeyMiddleware

from app.database import engine
from app.models import Repository, DailyMetric, ComputedMetric  # noqa — registers models
from app.models import WatchlistItem, ApiKey, RepoContributor, ForkSnapshot, EcosystemReport  # noqa
from app.models.a2a_service import A2AService, A2ACapability  # noqa — ensure A2A tables are created
from app.models.social_mention import SocialMention  # noqa
from app.models.repo_release import RepoRelease  # noqa
from app.models.subscriber import Subscriber  # noqa
from app.models.weekly_snapshot import WeeklySnapshot  # noqa
from app.models.alert_notification import AlertNotification  # noqa
from app.models.user_onboarding import UserOnboarding  # noqa
from app.models.research import (  # noqa — ensures research tables are created
    ResearchSession, ResearchMessage, ResearchPin, ResearchReport, ResearchShare
)
from app.database import Base
from app.routers import (
    repos_router,
    metrics_router,
    dashboard_router,
    reports_router,
    admin_router,
    widgets_router,
    orgs_router,
    watchlist_router,
    topics_router,
    contributors_router,
    forks_router,
    apikeys_router,
    services_router,
    feed_router,
    subscribe_router,
    search_router,
    snapshots_router,
    onboarding_router,
    profile_router,
    research_router,
)
from app.seed.seeder import seed_repos

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Background pipeline (APScheduler — no Redis required) ───────────────────

async def _run_pipeline_sync(include_explanations: bool = False) -> dict:
    """
    Full delta-sync: ingest (upsert) → score → optionally explain.
    Called by APScheduler every 4 hours AND by the /admin/run-all-sync endpoint.
    """
    from app.services.ingestion import run_daily_ingestion
    from app.services.scoring import run_daily_scoring
    from app.services.explanation import enrich_top_repos_with_explanations
    from app.services.notification_service import dispatch_pending_watchlist_alert_emails

    run_at = datetime.now(timezone.utc).isoformat()
    logger.info(f"[pipeline] Starting delta-sync at {run_at}")

    try:
        ingest_result = await run_daily_ingestion()
        logger.info(f"[pipeline] Ingestion: inserted={ingest_result.get('inserted',0)} "
                    f"updated={ingest_result.get('updated',0)} failed={ingest_result.get('failed',0)}")
    except Exception as e:
        logger.error(f"[pipeline] Ingestion failed: {e}", exc_info=True)
        return {"run_at": run_at, "status": "error", "phase": "ingestion", "detail": str(e)}

    try:
        score_result = run_daily_scoring()
        logger.info(f"[pipeline] Scoring: scored={score_result.get('scored',0)} "
                    f"failed={score_result.get('failed',0)}")
    except Exception as e:
        logger.error(f"[pipeline] Scoring failed: {e}", exc_info=True)
        score_result = {"scored": 0, "failed": 0, "alerts": 0, "categories_cached": 0, "date": None}

    explain_count = 0
    summary_count = 0
    notification_result = {"sent": 0, "failed": 0, "skipped": 0}
    if include_explanations:
        try:
            explain_count = enrich_top_repos_with_explanations(top_n=20)
            logger.info(f"[pipeline] Explanations: {explain_count}")
        except Exception as e:
            logger.warning(f"[pipeline] Explanation generation failed (non-fatal): {e}")
        try:
            from app.services.explanation import enrich_repos_with_summaries
            summary_count = enrich_repos_with_summaries(top_n=30)
            logger.info(f"[pipeline] Summaries: {summary_count}")
        except Exception as e:
            logger.warning(f"[pipeline] Summary generation failed (non-fatal): {e}")

    try:
        notification_result = dispatch_pending_watchlist_alert_emails()
        logger.info(f"[pipeline] Alert notifications: {notification_result}")
    except Exception as e:
        logger.warning(f"[pipeline] Alert notifications failed (non-fatal): {e}")

    return {
        "run_at": run_at,
        "status": "complete",
        "discovered": ingest_result.get("discovered", 0),
        "reactivated": ingest_result.get("reactivated", 0),
        "inserted": ingest_result.get("inserted", 0),
        "updated": ingest_result.get("updated", 0),
        "ingested": ingest_result.get("ingested", 0),
        "failed_ingestion": ingest_result.get("failed", 0),
        "scored": score_result.get("scored", 0),
        "failed_scoring": score_result.get("failed", 0),
        "alerts_generated": score_result.get("alerts", 0),
        "categories_cached": score_result.get("categories_cached", 0),
        "explanations": explain_count,
        "summaries": summary_count,
        "alert_emails_sent": notification_result.get("sent", 0),
        "scoring_date": score_result.get("date"),
    }


def _schedule_pipeline():
    """
    Set up APScheduler to run the full pipeline every 4 hours.
    APScheduler runs in-process — no Redis or separate worker needed.
    Perfect for Railway single-dyno deployments.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler(timezone="UTC")

        async def _job():
            # Include explanations only at the 00:00 UTC run (once per day)
            hour_utc = datetime.now(timezone.utc).hour
            include_explain = (hour_utc < 4)   # true for the midnight slot
            result = await _run_pipeline_sync(include_explanations=include_explain)
            logger.info(f"[scheduler] Pipeline job finished: {result}")

        # Every 4 hours: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
        scheduler.add_job(_job, CronTrigger(hour="*/4", minute=0), id="pipeline_4h", replace_existing=True)

        async def _a2a_job():
            from app.services.a2a_ingestion import run_a2a_discovery_pipeline
            logger.info("[a2a_scheduler] Starting A2A discovery pipeline")
            try:
                await run_a2a_discovery_pipeline()
                logger.info("[a2a_scheduler] A2A discovery pipeline complete")
            except Exception as exc:
                logger.error(f"[a2a_scheduler] A2A pipeline failed: {exc}", exc_info=True)

        # Daily A2A discovery at 02:00 UTC
        scheduler.add_job(_a2a_job, CronTrigger(hour=2, minute=0), id="a2a_discovery_24h", replace_existing=True)

        # Weekly snapshot — Monday 06:00 UTC
        async def _snapshot_job():
            from app.services.weekly_snapshots import publish_weekly_snapshot
            try:
                result = publish_weekly_snapshot()
                logger.info(f"[snapshot_scheduler] {result}")
            except Exception as exc:
                logger.error(f"[snapshot_scheduler] Failed: {exc}", exc_info=True)

        scheduler.add_job(_snapshot_job, CronTrigger(day_of_week="mon", hour=6, minute=0), id="weekly_snapshot", replace_existing=True)

        async def _daily_digest_job():
            from app.services.notification_service import dispatch_digest_emails
            result = dispatch_digest_emails("daily")
            logger.info(f"[digest_scheduler] Daily digest result: {result}")

        scheduler.add_job(_daily_digest_job, CronTrigger(hour=9, minute=0), id="daily_digest", replace_existing=True)

        async def _weekly_digest_job():
            from app.services.notification_service import dispatch_digest_emails
            result = dispatch_digest_emails("weekly")
            logger.info(f"[digest_scheduler] Weekly digest result: {result}")

        scheduler.add_job(_weekly_digest_job, CronTrigger(day_of_week="mon", hour=9, minute=15), id="weekly_digest", replace_existing=True)

        async def _monthly_digest_job():
            from app.services.notification_service import dispatch_digest_emails
            result = dispatch_digest_emails("monthly")
            logger.info(f"[digest_scheduler] Monthly digest result: {result}")

        scheduler.add_job(_monthly_digest_job, CronTrigger(day=1, hour=9, minute=30), id="monthly_digest", replace_existing=True)

        # Social mentions + releases + commit activity — daily at 03:00 UTC
        async def _enrichment_job():
            try:
                from app.services.social_mentions import run_social_mentions_pipeline
                await run_social_mentions_pipeline(top_n=50)
            except Exception as exc:
                logger.warning(f"[enrichment] Social mentions failed: {exc}")
            try:
                from app.services.releases import run_releases_pipeline
                await run_releases_pipeline(top_n=100)
            except Exception as exc:
                logger.warning(f"[enrichment] Releases pipeline failed: {exc}")
            try:
                from app.services.commit_activity import run_commit_activity_pipeline
                await run_commit_activity_pipeline(top_n=100)
            except Exception as exc:
                logger.warning(f"[enrichment] Commit activity pipeline failed: {exc}")

        scheduler.add_job(_enrichment_job, CronTrigger(hour=3, minute=30), id="enrichment_daily", replace_existing=True)

        scheduler.start()
        logger.info("APScheduler started — pipeline runs every 4 h (00/04/08/12/16/20 UTC)")
        return scheduler
    except Exception as e:
        logger.warning(f"APScheduler init failed (non-fatal — manual triggers still work): {e}")
        return None


# ─── Startup / Shutdown ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Repodar starting up...")

    # Create all tables (idempotent)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")

    # Seed repos from YAML (idempotent)
    try:
        inserted = seed_repos()
        logger.info(f"Seed: {inserted} new repos inserted.")
    except Exception as e:
        logger.error(f"Seed failed (non-fatal): {e}")

    # Pre-install DuckDB extensions so the scoring service works on first run.
    try:
        import duckdb, os
        ext_dir = os.getenv("DUCKDB_EXTENSION_DIRECTORY", "/tmp/.duckdb/extensions")
        os.makedirs(ext_dir, exist_ok=True)
        conn = duckdb.connect()
        conn.execute(f"SET extension_directory='{ext_dir}';")
        conn.execute("INSTALL sqlite; LOAD sqlite;")
        db_url = os.getenv("DATABASE_URL", "")
        if db_url.startswith("postgresql"):
            conn.execute("INSTALL postgres; LOAD postgres;")
            logger.info("DuckDB postgres extension ready.")
        conn.close()
        logger.info("DuckDB extensions pre-installed.")
    except Exception as e:
        logger.warning(f"DuckDB extension pre-install failed (non-fatal): {e}")

    # Start in-process 4-hour scheduler
    scheduler = _schedule_pipeline()

    # Initialize Redis caching
    try:
        import os
        from redis import asyncio as aioredis
        from fastapi_cache import FastAPICache
        from fastapi_cache.backends.redis import RedisBackend

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=False)
        FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
        logger.info("FastAPI-Cache initialized with Redis.")
    except Exception as e:
        logger.warning(f"Failed to initialize Redis cache: {e}")

    logger.info("Repodar ready. Pipeline scheduled every 4 h via APScheduler.")
    yield

    # Graceful shutdown
    if scheduler:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped.")
    logger.info("Repodar shutting down.")


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Repodar",
    description="Real-time GitHub AI/ML ecosystem radar — trending repos, star velocity, sustainability scores.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

import os

# CORS — allow frontend dev server and production domain
origins_env = os.getenv("ALLOWED_ORIGINS")
if origins_env:
    allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "https://repodar.vercel.app",
        "https://repodar.up.railway.app",  
        "https://repodar.io",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

from app.middleware import LoggingMiddleware
app.add_middleware(LoggingMiddleware)

# API Key middleware — validates X-API-Key for /api/v1/* routes
app.add_middleware(APIKeyMiddleware)

# ─── Routers ─────────────────────────────────────────────────────────────────

# metrics_router must come before repos_router — repos_router has a /{repo_id:path}
# catch-all that would swallow /uuid/metrics, /uuid/scores etc. if registered first.
app.include_router(metrics_router)
app.include_router(repos_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(admin_router)
app.include_router(widgets_router)
app.include_router(orgs_router)
app.include_router(watchlist_router)
app.include_router(topics_router)
app.include_router(contributors_router)
app.include_router(forks_router)
app.include_router(apikeys_router)
app.include_router(services_router)
app.include_router(feed_router)
app.include_router(subscribe_router)
app.include_router(search_router)
app.include_router(snapshots_router)
app.include_router(onboarding_router)
app.include_router(profile_router)
app.include_router(research_router)

# ─── Public API v1 (X-API-Key required) ──────────────────────────────────────
from app.routers.public_api import router as public_api_router
app.include_router(public_api_router)


# ─── Health ──────────────────────────────────────────────────────────────────

from fastapi import Depends
from sqlalchemy.orm import Session
from app.database import get_db

@app.get("/health", tags=["Health"])
def health(db: Session = Depends(get_db)):
    from sqlalchemy import text
    status = {"status": "ok", "service": "Repodar v1.0", "db": "ok", "redis": "ok"}
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        status["db"] = f"error: {str(e)}"
        status["status"] = "error"
        
    try:
        from fastapi_cache import FastAPICache
        if not FastAPICache.get_backend():
            status["redis"] = "Not initialized"
    except Exception as e:
        status["redis"] = f"error: {str(e)}"
        
    from fastapi.responses import JSONResponse
    if status["status"] == "error":
        return JSONResponse(content=status, status_code=503)
        
    return status


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Repodar",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
