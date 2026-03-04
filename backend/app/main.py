import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Repository, DailyMetric, ComputedMetric  # noqa — registers models
from app.database import Base
from app.routers import (
    repos_router,
    metrics_router,
    dashboard_router,
    reports_router,
    admin_router,
    widgets_router,
    orgs_router,
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
    if include_explanations:
        try:
            explain_count = enrich_top_repos_with_explanations(top_n=20)
            logger.info(f"[pipeline] Explanations: {explain_count}")
        except Exception as e:
            logger.warning(f"[pipeline] Explanation generation failed (non-fatal): {e}")

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

# CORS — allow frontend dev server and production domain
app.add_middleware(
    CORSMiddleware,
allow_origins=[
    "http://localhost:3000",
    "https://repodar.up.railway.app",
    "https://repodar.io",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(repos_router)
app.include_router(metrics_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(admin_router)
app.include_router(widgets_router)
app.include_router(orgs_router)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "Repodar v1.0"}


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Repodar",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
