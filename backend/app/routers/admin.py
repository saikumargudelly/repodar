"""
Admin endpoints — development-only triggers for manual pipeline runs.
These are not protected in v1 (no auth). Add API key middleware before exposing publicly.
"""

import asyncio
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin"])


class PipelineStatus(BaseModel):
    status: str
    detail: str


@router.post("/ingest", response_model=PipelineStatus)
async def trigger_ingestion(background_tasks: BackgroundTasks):
    """
    Manually trigger a full ingestion run for all repos.
    Runs async in the background — returns immediately.
    """
    from app.celery_worker import task_daily_ingestion
    task = task_daily_ingestion.delay()
    return PipelineStatus(
        status="queued",
        detail=f"Ingestion task queued. Celery task ID: {task.id}",
    )


@router.post("/score", response_model=PipelineStatus)
def trigger_scoring():
    """Manually trigger daily scoring."""
    from app.celery_worker import task_daily_scoring
    task = task_daily_scoring.delay()
    return PipelineStatus(
        status="queued",
        detail=f"Scoring task queued. Celery task ID: {task.id}",
    )


@router.post("/explain", response_model=PipelineStatus)
def trigger_explanations():
    """Manually trigger LLM explanation generation for top repos."""
    from app.celery_worker import task_daily_explanations
    task = task_daily_explanations.delay()
    return PipelineStatus(
        status="queued",
        detail=f"Explanation task queued. Celery task ID: {task.id}",
    )


@router.post("/run-all", response_model=PipelineStatus)
async def run_full_pipeline():
    """
    Run the full pipeline synchronously (ingest → score → explain).
    Useful for first-run setup and local testing.
    WARNING: Blocks for several minutes while fetching all 80+ repos.
    """
    from app.services.ingestion import run_daily_ingestion
    from app.services.scoring import run_daily_scoring
    from app.services.explanation import enrich_top_repos_with_explanations

    try:
        ingest_result = await run_daily_ingestion()
        score_result = run_daily_scoring()
        explain_count = enrich_top_repos_with_explanations(top_n=20)
        return PipelineStatus(
            status="complete",
            detail=(
                f"Ingested: {ingest_result.get('ingested', 0)} repos | "
                f"Scored: {score_result.get('scored', 0)} repos | "
                f"Explanations: {explain_count}"
            ),
        )
    except Exception as e:
        return PipelineStatus(status="error", detail=str(e))


@router.get("/status", response_model=dict)
def get_status():
    """Pipeline health: repo count, latest ingestion date, latest scoring date."""
    from app.database import SessionLocal
    from app.models import Repository, DailyMetric, ComputedMetric

    db = SessionLocal()
    try:
        total_repos = db.query(Repository).count()
        latest_metric = db.query(DailyMetric).order_by(DailyMetric.captured_at.desc()).first()
        latest_score = db.query(ComputedMetric).order_by(ComputedMetric.date.desc()).first()

        return {
            "total_repos": total_repos,
            "latest_ingestion": latest_metric.captured_at.isoformat() if latest_metric else None,
            "latest_scoring_date": str(latest_score.date) if latest_score else None,
            "pipeline_ready": total_repos > 0 and latest_metric is not None,
        }
    finally:
        db.close()
