"""
Admin endpoints — development-only triggers for manual pipeline runs.
These are not protected in v1 (no auth). Add API key middleware before exposing publicly.
"""

import asyncio
import os
import aiohttp
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

admin_api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

def require_admin_key(api_key: str = Security(admin_api_key_header)):
    admin_secret = os.getenv("ADMIN_SECRET_KEY")
    if not admin_secret:
        # If no secret configured, reject to be safe
        raise HTTPException(status_code=403, detail="Admin secret not configured on server")
    if not api_key or api_key != admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin API key")

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin_key)])


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
    from app.services.ingestion import run_daily_ingestion
    background_tasks.add_task(run_daily_ingestion)
    return PipelineStatus(
        status="queued",
        detail="Ingestion task queued.",
    )


@router.post("/score", response_model=PipelineStatus)
def trigger_scoring(background_tasks: BackgroundTasks):
    """Manually trigger daily scoring."""
    from app.services.scoring import run_daily_scoring
    background_tasks.add_task(run_daily_scoring)
    return PipelineStatus(
        status="queued",
        detail="Scoring task queued.",
    )


@router.post("/explain", response_model=PipelineStatus)
def trigger_explanations(background_tasks: BackgroundTasks):
    """Manually trigger LLM explanation generation for top repos."""
    from app.services.explanation import enrich_top_repos_with_explanations
    background_tasks.add_task(enrich_top_repos_with_explanations, top_n=20)
    return PipelineStatus(
        status="queued",
        detail="Explanation task queued.",
    )


@router.post("/run-all", response_model=PipelineStatus)
async def run_full_pipeline(background_tasks: BackgroundTasks):
    """
    Kick off the full pipeline in the background (discover → ingest → score → explain).
    Returns immediately — check /admin/status to monitor progress.
    """
    from app.services.ingestion import run_daily_ingestion
    from app.services.scoring import run_daily_scoring
    from app.services.explanation import enrich_top_repos_with_explanations
    import logging
    logger = logging.getLogger("app.admin")

    async def _run():
        try:
            ingest_result = await run_daily_ingestion()
            score_result = run_daily_scoring()
            explain_count = enrich_top_repos_with_explanations(top_n=20)
            logger.info(
                "run-all complete | discovered=%s ingested=%s scored=%s explained=%s",
                ingest_result.get('discovered', 0),
                ingest_result.get('ingested', 0),
                score_result.get('scored', 0),
                explain_count,
            )
        except Exception as e:
            logger.error("run-all pipeline error: %s", e, exc_info=True)

    background_tasks.add_task(_run)
    return PipelineStatus(
        status="started",
        detail="Full pipeline is running in the background. Check /admin/status for progress.",
    )


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


@router.get("/status")
def get_status():
    """Pipeline health: repo count, latest ingestion date, latest scoring date."""
    from datetime import date as _date
    from app.database import SessionLocal
    from app.models import Repository, DailyMetric, ComputedMetric, TrendAlert

    db = SessionLocal()
    try:
        today = _date.today()
        total_repos = db.query(Repository).count()
        active_repos = db.query(Repository).filter(Repository.is_active == True).count()  # noqa: E712
        latest_metric = db.query(DailyMetric).order_by(DailyMetric.captured_at.desc()).first()
        latest_score = db.query(ComputedMetric).order_by(ComputedMetric.date.desc()).first()
        total_alerts = db.query(TrendAlert).count()
        unread_alerts = db.query(TrendAlert).filter(TrendAlert.is_read == False).count()  # noqa: E712
        scored_today = db.query(ComputedMetric).filter(
            ComputedMetric.date == today
        ).count()

        return {
            "total_repos": total_repos,
            "active_repos": active_repos,
            "latest_ingestion": latest_metric.captured_at.isoformat() if latest_metric else None,
            "latest_scoring_date": str(latest_score.date) if latest_score else None,
            "scored_today": scored_today,
            "total_alerts": total_alerts,
            "unread_alerts": unread_alerts,
            "pipeline_ready": total_repos > 0 and latest_metric is not None,
            "has_scored_data": latest_score is not None,
        }
    finally:
        db.close()


@router.post("/run-all-sync")
async def run_full_pipeline_sync():
    """
    Run full pipeline synchronously: discover → ingest → score → explain.
    Blocks until complete and returns results.  May take 2–8 minutes.
    Use /admin/run-all for a fire-and-forget variant.
    """
    from app.services.ingestion import run_daily_ingestion
    from app.services.scoring import run_daily_scoring
    from app.services.explanation import enrich_top_repos_with_explanations
    import logging
    _logger = logging.getLogger("app.admin")

    try:
        _logger.info("run-all-sync: starting ingestion")
        ingest_result = await run_daily_ingestion()
        _logger.info(f"run-all-sync: ingestion done → {ingest_result}")

        _logger.info("run-all-sync: starting scoring")
        score_result = run_daily_scoring()
        _logger.info(f"run-all-sync: scoring done → {score_result}")

        _logger.info("run-all-sync: generating explanations")
        explain_count = enrich_top_repos_with_explanations(top_n=20)
        _logger.info(f"run-all-sync: explanations done → {explain_count}")

        return {
            "status": "complete",
            "discovered": ingest_result.get("discovered", 0),
            "reactivated": ingest_result.get("reactivated", 0),
            "ingested": ingest_result.get("ingested", 0),
            "scored": score_result.get("scored", 0),
            "failed_scoring": score_result.get("failed", 0),
            "alerts_generated": score_result.get("alerts", 0),
            "categories_cached": score_result.get("categories_cached", 0),
            "explanations": explain_count,
            "scoring_date": score_result.get("date"),
        }
    except Exception as e:
        _logger.error(f"run-all-sync failed: {e}", exc_info=True)
        return {"status": "error", "detail": str(e)}
