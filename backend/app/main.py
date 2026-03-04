import logging
from contextlib import asynccontextmanager

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

    logger.info("Repodar ready. Celery handles scheduled ingestion.")
    yield
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
    "http://127.0.0.1:3000",
    "https://repodar.vercel.app",
    "https://terrific-vitality-production-f122.up.railway.app",
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
