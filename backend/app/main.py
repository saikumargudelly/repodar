import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware import APIKeyMiddleware

from app.database import engine, ensure_db_schema_upgraded
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
    filters_router,
    forecast_router,
    export_router,
    recommendations_router,
    webhooks_router,
    collections_router,
)
from app.seed.seeder import seed_repos

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Background pipeline (APScheduler — no Redis required) ───────────────────

from app.utils.lock import pipeline_lock

async def _run_pipeline_sync(include_explanations: bool = False) -> dict:
    """
    Full delta-sync: ingest (upsert) → score → optionally explain.
    Called by APScheduler every 2 hours AND by the /admin/run-all-sync endpoint.
    Guarded by an execution lock to prevent concurrent overlapping executions.
    """
    from app.services.ingestion import run_daily_ingestion
    from app.services.scoring import run_daily_scoring
    from app.services.explanation import enrich_top_repos_with_explanations
    from app.services.notification_service import dispatch_pending_watchlist_alert_emails

    if pipeline_lock.locked():
        logger.warning("[pipeline] Pipeline execution requested but another instance is already running. Skipping execution.")
        return {"status": "skipped", "detail": "Pipeline execution already in progress."}

    async with pipeline_lock:
        from app.utils.pipeline_state import pipeline_tracker
        run_at = datetime.now(timezone.utc).isoformat()
        logger.info(f"[pipeline] Starting delta-sync at {run_at}")
        pipeline_tracker.start("ingestion")

        try:
            ingest_result = await run_daily_ingestion()
            logger.info(f"[pipeline] Ingestion: inserted={ingest_result.get('inserted',0)} "
                        f"updated={ingest_result.get('updated',0)} failed={ingest_result.get('failed',0)}")
        except Exception as e:
            logger.error(f"[pipeline] Ingestion failed: {e}", exc_info=True)
            pipeline_tracker.end(success=False)
            return {"run_at": run_at, "status": "error", "phase": "ingestion", "detail": str(e)}

        from app.utils.executor import run_in_pipeline_thread

        try:
            pipeline_tracker.update_stage("scoring")
            score_result = await run_in_pipeline_thread(run_daily_scoring)
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
                pipeline_tracker.update_stage("explanations")
                explain_count = await run_in_pipeline_thread(enrich_top_repos_with_explanations, 20)
                logger.info(f"[pipeline] Explanations: {explain_count}")
            except Exception as e:
                logger.warning(f"[pipeline] Explanation generation failed (non-fatal): {e}")
            try:
                from app.services.explanation import enrich_repos_with_summaries
                summary_count = await run_in_pipeline_thread(enrich_repos_with_summaries, 30)
                logger.info(f"[pipeline] Summaries: {summary_count}")
            except Exception as e:
                logger.warning(f"[pipeline] Summary generation failed (non-fatal): {e}")

        try:
            pipeline_tracker.update_stage("notifications")
            notification_result = await dispatch_pending_watchlist_alert_emails()
            logger.info(f"[pipeline] Alert notifications: {notification_result}")
        except Exception as e:
            logger.warning(f"[pipeline] Alert notifications failed (non-fatal): {e}")

        # Refresh materialized views concurrently on PostgreSQL
        def _refresh_views():
            from app.database import SessionLocal
            from sqlalchemy import text
            db_session = SessionLocal()
            try:
                if db_session.bind.dialect.name == "postgresql":
                    logger.info("[pipeline] Refreshing materialized views concurrently...")
                    db_session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_language_radar"))
                    db_session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_topic_momentum"))
                    db_session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard"))
                    db_session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_health"))
                    db_session.commit()
                    logger.info("[pipeline] Materialized views refreshed successfully.")
            finally:
                db_session.close()

        try:
            pipeline_tracker.update_stage("materialized_view_refresh")
            await run_in_pipeline_thread(_refresh_views)
        except Exception as e:
            logger.warning(f"[pipeline] Failed to refresh materialized views: {e}")

        # Invalidate specific cache namespaces to avoid database load spikes and stampedes
        try:
            pipeline_tracker.update_stage("cache_invalidation")
            from fastapi_cache import FastAPICache
            backend = FastAPICache.get_backend()
            if backend:
                namespaces_to_clear = ["repo", "dashboard", "forecast", "recommendation", "fork", "feed"]
                for ns in namespaces_to_clear:
                    await backend.clear(namespace=ns)
                logger.info(f"[pipeline] Targeted cache namespaces invalidated successfully post-sync: {namespaces_to_clear}")
        except Exception as e:
            logger.warning(f"[pipeline] Targeted cache invalidation failed: {e}")

        # Purge Cloudflare Edge Cache if configured
        try:
            from app.utils.cloudflare import purge_cloudflare_cache
            await purge_cloudflare_cache()
        except Exception as e:
            logger.warning(f"[pipeline] Cloudflare Edge Cache purge failed: {e}")

        pipeline_tracker.end(success=True)

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
    Set up APScheduler to run the full pipeline every 2 hours.
    APScheduler runs in-process — no Redis or separate worker needed.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler(timezone="UTC")

        async def _job():
            hour_utc = datetime.now(timezone.utc).hour
            include_explain = (hour_utc == 0)
            result = await _run_pipeline_sync(include_explanations=include_explain)
            logger.info(f"[scheduler] Pipeline job finished: {result}")

        # Every 2 hours: 00:00, 02:00, 04:00, ..., 22:00 UTC
        scheduler.add_job(_job, CronTrigger(hour="*/2", minute=0), id="pipeline_2h", replace_existing=True)

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
            from app.utils.executor import run_in_pipeline_thread
            from app.services.weekly_snapshots import publish_weekly_snapshot
            try:
                result = await run_in_pipeline_thread(publish_weekly_snapshot)
                logger.info(f"[snapshot_scheduler] {result}")
            except Exception as exc:
                logger.error(f"[snapshot_scheduler] Failed: {exc}", exc_info=True)

        scheduler.add_job(_snapshot_job, CronTrigger(day_of_week="mon", hour=6, minute=0), id="weekly_snapshot", replace_existing=True)

        async def _daily_digest_job():
            from app.services.notification_service import dispatch_digest_emails
            result = await dispatch_digest_emails("daily")
            logger.info(f"[digest_scheduler] Daily digest result: {result}")

        scheduler.add_job(_daily_digest_job, CronTrigger(hour=9, minute=0), id="daily_digest", replace_existing=True)

        async def _weekly_digest_job():
            from app.services.notification_service import dispatch_digest_emails
            result = await dispatch_digest_emails("weekly")
            logger.info(f"[digest_scheduler] Weekly digest result: {result}")

        scheduler.add_job(_weekly_digest_job, CronTrigger(day_of_week="mon", hour=9, minute=15), id="weekly_digest", replace_existing=True)

        async def _monthly_digest_job():
            from app.services.notification_service import dispatch_digest_emails
            result = await dispatch_digest_emails("monthly")
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
        logger.info("APScheduler started")
        return scheduler
    except Exception as e:
        logger.warning(f"APScheduler init failed: {e}")
        return None


# ─── Startup / Shutdown ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register a rotating file log handler (max 10 MB × 3 backups)
    try:
        file_handler = RotatingFileHandler("./pipeline.log", maxBytes=10_000_000, backupCount=3)
        file_handler.setFormatter(logging.Formatter('%(asctime)s | %(levelname)s | %(name)s | %(message)s'))
        logging.getLogger().addHandler(file_handler)
        logging.getLogger("app.admin").addHandler(file_handler)
        logging.getLogger("app.services.ingestion").addHandler(file_handler)
        logging.getLogger("app.services.scoring").addHandler(file_handler)
        logger.info("Rotating file logging handler registered to ./pipeline.log.")
    except Exception as e:
        logger.warning(f"Failed to register file logging handler: {e}")

    logger.info("Repodar starting up...")

    # Create all tables (idempotent)
    Base.metadata.create_all(bind=engine)
    ensure_db_schema_upgraded(engine)
    logger.info("Database tables ensured.")

    # Seed repos from YAML (idempotent)
    try:
        inserted = seed_repos()
        logger.info(f"Seed: {inserted} new repos inserted.")
    except Exception as e:
        logger.error(f"Seed failed (non-fatal): {e}")

    # Start in-process 2-hour scheduler (configurable via env var, defaults to false)
    if os.getenv("ENABLE_IN_APP_SCHEDULER", "false").lower() == "true":
        scheduler = _schedule_pipeline()
        logger.info("In-app APScheduler started.")
    else:
        scheduler = None
        logger.info("In-app APScheduler is disabled (ENABLE_IN_APP_SCHEDULER=false).")

    # Initialize Redis caching with fallback to in-memory caching if Redis is offline
    try:
        from redis import asyncio as aioredis
        from fastapi_cache import FastAPICache
        from fastapi_cache.backends.redis import RedisBackend

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=False)
        
        # Test connection quickly (1.5s timeout) to ensure Redis is actually up
        await asyncio.wait_for(redis.ping(), timeout=1.5)
        
        FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
        logger.info("FastAPI-Cache initialized with Redis.")
    except Exception as e:
        logger.warning(f"Failed to initialize Redis cache: {e}. Falling back to InMemoryBackend.")
        try:
            from fastapi_cache import FastAPICache
            from fastapi_cache.backends.inmemory import InMemoryBackend
            FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
            logger.info("FastAPI-Cache initialized with InMemoryBackend fallback.")
        except Exception as fallback_err:
            logger.error(f"Failed to initialize InMemoryBackend: {fallback_err}")

    logger.info("Repodar ready.")
    yield

    # Graceful shutdown
    if scheduler:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped.")
    
    from app.utils.executor import pipeline_executor
    pipeline_executor.shutdown(wait=False)
    logger.info("Pipeline ThreadPoolExecutor stopped.")
    logger.info("Repodar shutting down.")


# ─── App ─────────────────────────────────────────────────────────────────────

_is_dev = os.getenv("APP_ENV", "development") == "development"

app = FastAPI(
    title="Repodar",
    description="Real-time GitHub AI/ML ecosystem radar — trending repos, star velocity, sustainability scores.",
    version="1.0.0",
    lifespan=lifespan,
    # Disable interactive docs in production to prevent endpoint enumeration
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
)

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
    # Explicit allowlist — never use ["*"] with allow_credentials=True
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Admin-Key",
        "X-Clerk-User-Id",
        "X-User-Id",
    ],
)

from app.middleware import LoggingMiddleware
app.add_middleware(LoggingMiddleware)

# API Key middleware — validates X-API-Key for /api/v1/* routes
app.add_middleware(APIKeyMiddleware)

# Edge Cache Control middleware — sets Cache-Control header for Cloudflare/browsers
from app.middleware import CacheControlMiddleware
app.add_middleware(CacheControlMiddleware)

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
app.include_router(filters_router)
app.include_router(forecast_router)
app.include_router(export_router)
app.include_router(recommendations_router)
app.include_router(webhooks_router)
app.include_router(collections_router)

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
        backend = FastAPICache.get_backend()
        if not backend:
            status["redis"] = "Not initialized"
        else:
            status["redis"] = backend.__class__.__name__
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
