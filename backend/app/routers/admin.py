"""
Admin endpoints — development-only triggers for manual pipeline runs.
These are not protected in v1 (no auth). Add API key middleware before exposing publicly.
"""

import asyncio
import aiohttp
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin"])


class PipelineStatus(BaseModel):
    status: str
    detail: str


class GitHubStatus(BaseModel):
    token_valid: bool
    rate_limit_remaining: int
    rate_limit_reset: str
    rate_limit_limit: int
    message: str


@router.get("/github-status", response_model=GitHubStatus)
async def check_github_status():
    """
    Check GitHub API token validity and current rate limit status.
    Useful for diagnosing fetching errors.
    """
    import os
    from datetime import datetime, timezone
    
    token = os.getenv("GITHUB_TOKEN", "")
    
    if not token:
        return GitHubStatus(
            token_valid=False,
            rate_limit_remaining=0,
            rate_limit_reset="N/A",
            rate_limit_limit=60,
            message="No GITHUB_TOKEN found in environment — using unauthenticated rate limit (60/hr)"
        )
    
    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            }
            async with session.get(
                "https://api.github.com/rate_limit",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                data = await resp.json()
                
                if resp.status != 200:
                    return GitHubStatus(
                        token_valid=False,
                        rate_limit_remaining=0,
                        rate_limit_reset="N/A",
                        rate_limit_limit=0,
                        message=f"HTTP {resp.status}: Token invalid or network error"
                    )
                
                core_limit = data.get("resources", {}).get("core", {})
                remaining = core_limit.get("remaining", 0)
                limit = core_limit.get("limit", 5000)
                reset_ts = core_limit.get("reset", 0)
                reset_dt = datetime.fromtimestamp(reset_ts, tz=timezone.utc).isoformat()
                
                if remaining < 100:
                    msg = f"⚠️  Low rate limit: {remaining}/{limit} remaining (resets at {reset_dt})"
                else:
                    msg = f"✓ Rate limit healthy: {remaining}/{limit} remaining"
                
                return GitHubStatus(
                    token_valid=True,
                    rate_limit_remaining=remaining,
                    rate_limit_reset=reset_dt,
                    rate_limit_limit=limit,
                    message=msg
                )
    except Exception as e:
        return GitHubStatus(
            token_valid=False,
            rate_limit_remaining=0,
            rate_limit_reset="N/A",
            rate_limit_limit=0,
            message=f"Error checking rate limit: {str(e)}"
        )


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
    Run the full pipeline synchronously (discover → ingest → score → explain).
    Useful for first-run setup and local testing.
    WARNING: Blocks for several minutes while fetching all active repos.
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
                f"Discovered: {ingest_result.get('discovered', 0)} new repos | "
                f"Reactivated: {ingest_result.get('reactivated', 0)} | "
                f"Deactivated: {ingest_result.get('deactivated', 0)} stale | "
                f"Ingested: {ingest_result.get('ingested', 0)} | "
                f"Scored: {score_result.get('scored', 0)} | "
                f"Explanations: {explain_count}"
            ),
        )
    except Exception as e:
        return PipelineStatus(status="error", detail=str(e))


@router.post("/discover", response_model=PipelineStatus)
async def trigger_discovery():
    """
    Run auto-discovery only: query GitHub Trending + Search, upsert new repos,
    update last_seen_trending, and deactivate stale auto-discovered repos.
    Does NOT run ingestion or scoring — use /ingest after this if desired.
    """
    from app.services.ingestion import auto_discover_and_sync, deactivate_stale_repos

    try:
        discovery = await auto_discover_and_sync()
        deactivated = deactivate_stale_repos()
        return PipelineStatus(
            status="complete",
            detail=(
                f"Discovered: {discovery.get('discovered', 0)} new repos | "
                f"Reactivated: {discovery.get('reactivated', 0)} | "
                f"Refreshed: {discovery.get('refreshed', 0)} | "
                f"Deactivated: {deactivated} stale"
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
