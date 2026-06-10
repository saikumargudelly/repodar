"""
Admin endpoints — protected by X-Admin-Key header.
Requires ADMIN_SECRET_KEY env var OR an enterprise-tier API key.
Fail-secure: if ADMIN_SECRET_KEY is not configured, all admin routes return 503.
"""

import asyncio
import os
import aiohttp
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db

admin_api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

def require_admin_key(
    api_key: str = Security(admin_api_key_header),
    db: Session = Depends(get_db),
):
    # Fail-secure: if ADMIN_SECRET_KEY is not configured, deny all access
    admin_secret = os.getenv("ADMIN_SECRET_KEY")
    if not admin_secret:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoints are not available: ADMIN_SECRET_KEY is not configured on this server."
        )

    # 1. Check environment variable (primary check)
    if api_key and api_key == admin_secret:
        return

    # 2. Fallback: enterprise-tier API key
    if api_key:
        import hashlib
        from app.models.api_key import ApiKey
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        db_key = db.query(ApiKey).filter_by(key_hash=key_hash, is_active=True).first()
        if db_key and db_key.tier == "enterprise":
            return

    raise HTTPException(
        status_code=403,
        detail="Invalid admin API key or insufficient privileges."
    )

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
    background_tasks.add_task(run_daily_ingestion, force_discovery=True)
    return PipelineStatus(
        status="queued",
        detail="Ingestion task queued (with forced discovery).",
    )


@router.post("/backfill", response_model=PipelineStatus)
async def trigger_backfill(background_tasks: BackgroundTasks):
    """
    Lightweight backfill: fetches live GitHub metadata (stars, age, topics, language)
    for all active repos and writes it into Repository.age_days, stars_snapshot, etc.
    Does NOT create DailyMetric rows. Much faster than /ingest.

    Use this to unblock the Early Insights radar when the pipeline has never run.
    After this, call /admin/score to generate ComputedMetric rows.
    """
    async def _run_backfill():
        import json
        import logging
        from datetime import datetime, timezone

        from app.database import SessionLocal
        from app.models import Repository
        from app.services.github_client import fetch_repo_metrics
        from app.services.ingestion import _calc_age_days

        log = logging.getLogger("app.admin.backfill")
        db = SessionLocal()
        try:
            repos = db.query(Repository).filter(Repository.is_active == True).all()  # noqa: E712
            log.info(f"Backfill: fetching GitHub metadata for {len(repos)} repos")

            all_pending = [{"id": r.id, "owner": r.owner, "name": r.name} for r in repos]
            metrics_list = await fetch_repo_metrics(all_pending, since_map={})

            now = datetime.now(timezone.utc).replace(tzinfo=None)
            repo_map = {r.id: r for r in repos}
            updated = 0

            for m in metrics_list:
                repo_id = m.get("repo_id")
                if repo_id not in repo_map:
                    continue
                repo = repo_map[repo_id]
                repo.age_days = _calc_age_days(m.get("repo_created_at", ""))
                repo.stars_snapshot = m.get("stars", 0)
                if m.get("primary_language"):
                    repo.primary_language = m["primary_language"]
                raw_topics = m.get("topics")
                if raw_topics is not None:
                    repo.topics = json.dumps(raw_topics)
                repo.last_fetched_at = now
                updated += 1

            db.commit()
            log.info(f"Backfill complete: updated {updated}/{len(repos)} repos")
        except Exception as e:
            db.rollback()
            log.error(f"Backfill error: {e}", exc_info=True)
        finally:
            db.close()

    background_tasks.add_task(_run_backfill)
    return PipelineStatus(
        status="queued",
        detail="Backfill task queued. This fetches GitHub metadata (stars, age, topics) for all repos. Check /admin/status for progress.",
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


_pipeline_running = False
_last_pipeline_result = None


class PipelineStatusResponse(BaseModel):
    running: bool
    last_result: dict | None


@router.get("/pipeline-status", response_model=PipelineStatusResponse)
def get_pipeline_status():
    """Get the current running status and the outcome of the last pipeline run."""
    global _pipeline_running, _last_pipeline_result
    return {
        "running": _pipeline_running,
        "last_result": _last_pipeline_result
    }


@router.post("/run-all", response_model=PipelineStatus)
async def run_full_pipeline(background_tasks: BackgroundTasks):
    """
    Kick off the full pipeline in the background (discover → ingest → score → explain).
    Returns immediately — check /admin/status to monitor progress.
    """
    global _pipeline_running, _last_pipeline_result
    if _pipeline_running:
        raise HTTPException(
            status_code=409,
            detail="Pipeline execution is already in progress."
        )

    from app.services.ingestion import run_daily_ingestion
    from app.services.scoring import run_daily_scoring
    from app.services.explanation import enrich_top_repos_with_explanations
    import logging
    logger = logging.getLogger("app.admin")

    async def _run():
        global _pipeline_running, _last_pipeline_result
        _pipeline_running = True
        _last_pipeline_result = {"status": "running"}
        try:
            def run_heal():
                from app.database import SessionLocal
                db_heal = SessionLocal()
                try:
                    deduplicate_repositories_logic(db_heal)
                except Exception as e:
                    logger.warning("Auto-deduplication failed: %s", e)
                finally:
                    db_heal.close()

            await asyncio.to_thread(run_heal)

            ingest_result = await run_daily_ingestion(force_discovery=False)
            score_result = await asyncio.to_thread(run_daily_scoring)
            explain_count = await asyncio.to_thread(enrich_top_repos_with_explanations, 20)
            logger.info(
                "run-all complete | discovered=%s ingested=%s scored=%s explained=%s",
                ingest_result.get('discovered', 0),
                ingest_result.get('ingested', 0),
                score_result.get('scored', 0),
                explain_count,
            )
            _last_pipeline_result = {
                "status": "complete",
                "discovered": ingest_result.get('discovered', 0),
                "reactivated": ingest_result.get('reactivated', 0),
                "ingested": ingest_result.get('ingested', 0),
                "scored": score_result.get('scored', 0),
                "failed_scoring": score_result.get('failed', 0),
                "alerts_generated": score_result.get('alerts', 0),
                "categories_cached": score_result.get('categories_cached', 0),
                "explanations": explain_count,
                "scoring_date": str(score_result.get('date')) if score_result.get('date') else None,
            }
        except Exception as e:
            logger.error("run-all pipeline error: %s", e, exc_info=True)
            _last_pipeline_result = {"status": "error", "detail": str(e)}
        finally:
            _pipeline_running = False

    background_tasks.add_task(_run)
    return PipelineStatus(
        status="started",
        detail="Full pipeline is running in the background. Check /admin/status or /admin/pipeline-status for progress.",
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
        from app.database import SessionLocal
        db_heal = SessionLocal()
        try:
            deduplicate_repositories_logic(db_heal)
        except Exception as e:
            import logging
            _log = logging.getLogger("app.admin")
            _log.warning("Auto-deduplication failed: %s", e)
        finally:
            db_heal.close()

        discovery = await auto_discover_and_sync(force=True)
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


def deduplicate_repositories_logic(db: Session) -> dict:
    from sqlalchemy import func
    from datetime import datetime, timezone
    import uuid
    from app.models import Repository, DailyMetric, ComputedMetric, RepoContributor, ForkSnapshot, TrendAlert
    from app.models.watchlist import WatchlistItem
    from app.models.repo_release import RepoRelease
    from app.models.social_mention import SocialMention
    from app.models.alert_rule import AlertRule
    
    # 1. Deduplicate Repository table (case-insensitive)
    dup_slugs = (
        db.query(func.lower(Repository.owner).label('low_owner'), func.lower(Repository.name).label('low_name'))
        .group_by(func.lower(Repository.owner), func.lower(Repository.name))
        .having(func.count(Repository.id) > 1)
        .all()
    )
    
    repos_merged = 0
    metrics_deleted = 0
    
    for low_owner, low_name in dup_slugs:
        repos = (
            db.query(Repository)
            .filter(func.lower(Repository.owner) == low_owner, func.lower(Repository.name) == low_name)
            .all()
        )
        
        # Keep the most active or oldest repository
        repos.sort(key=lambda r: (not r.is_active, r.last_fetched_at is None, r.discovered_at or datetime.min))
        keep_repo = repos[0]
        duplicate_repos = repos[1:]
        
        for dup in duplicate_repos:
            dup_id = dup.id
            keep_id = keep_repo.id
            
            # Re-point foreign keys safely (row-by-row for unique-constrained tables)
            db.query(DailyMetric).filter(DailyMetric.repo_id == dup_id).update({DailyMetric.repo_id: keep_id})
            db.query(ComputedMetric).filter(ComputedMetric.repo_id == dup_id).update({ComputedMetric.repo_id: keep_id})
            db.query(TrendAlert).filter(TrendAlert.repo_id == dup_id).update({TrendAlert.repo_id: keep_id})
            db.query(RepoRelease).filter(RepoRelease.repo_id == dup_id).update({RepoRelease.repo_id: keep_id})
            db.query(SocialMention).filter(SocialMention.repo_id == dup_id).update({SocialMention.repo_id: keep_id})
            db.query(AlertRule).filter(AlertRule.repo_id == dup_id).update({AlertRule.repo_id: keep_id})

            # ForkSnapshot: merge fork snapshots safely
            dup_forks = db.query(ForkSnapshot).filter(ForkSnapshot.parent_repo_id == dup_id).all()
            for df in dup_forks:
                exists = db.query(ForkSnapshot).filter_by(
                    parent_repo_id=keep_id,
                    fork_full_name=df.fork_full_name,
                    snapshot_date=df.snapshot_date
                ).first()
                if exists:
                    db.delete(df)
                else:
                    df.parent_repo_id = keep_id

            # RepoContributor: merge Top contributors
            dup_contribs = db.query(RepoContributor).filter(RepoContributor.repo_id == dup_id).all()
            for dc in dup_contribs:
                exists = db.query(RepoContributor).filter_by(repo_id=keep_id, login=dc.login).first()
                if exists:
                    exists.contributions = max(exists.contributions, dc.contributions)
                    db.delete(dc)
                else:
                    dc.repo_id = keep_id

            # WatchlistItem: merge watchlist items
            dup_watchlist = db.query(WatchlistItem).filter(WatchlistItem.repo_id == dup_id).all()
            for dw in dup_watchlist:
                exists = db.query(WatchlistItem).filter_by(user_id=dw.user_id, repo_id=keep_id).first()
                if exists:
                    db.delete(dw)
                else:
                    dw.repo_id = keep_id
            
            db.delete(dup)
            repos_merged += 1

    db.flush()

    # 2. Deduplicate DailyMetric per (repo_id, date part of captured_at)
    dup_dms = (
        db.query(DailyMetric.repo_id, func.date(DailyMetric.captured_at).label('d_date'))
        .group_by(DailyMetric.repo_id, func.date(DailyMetric.captured_at))
        .having(func.count(DailyMetric.id) > 1)
        .all()
    )
    for repo_id, d_date in dup_dms:
        rows = (
            db.query(DailyMetric)
            .filter(DailyMetric.repo_id == repo_id, func.date(DailyMetric.captured_at) == d_date)
            .order_by(DailyMetric.captured_at.desc())
            .all()
        )
        for row in rows[1:]:
            db.delete(row)
            metrics_deleted += 1

    # 3. Deduplicate ComputedMetric per (repo_id, date)
    dup_cms = (
        db.query(ComputedMetric.repo_id, ComputedMetric.date)
        .group_by(ComputedMetric.repo_id, ComputedMetric.date)
        .having(func.count(ComputedMetric.id) > 1)
        .all()
    )
    for repo_id, d in dup_cms:
        rows = (
            db.query(ComputedMetric)
            .filter_by(repo_id=repo_id, date=d)
            .order_by(ComputedMetric.computed_at.desc())
            .all()
        )
        for row in rows[1:]:
            db.delete(row)
            metrics_deleted += 1
            
    db.commit()
    return {"repos_merged": repos_merged, "metrics_deleted": metrics_deleted}


@router.post("/deduplicate")
def trigger_deduplicate(db: Session = Depends(get_db)):
    """Find and heal duplicate repositories and metric entries in the database."""
    try:
        res = deduplicate_repositories_logic(db)
        return {
            "status": "success",
            "detail": f"Database healed! Merged {res['repos_merged']} duplicate repositories, deleted {res['metrics_deleted']} duplicate metrics."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Deduplication failed: {str(e)}")


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
        from app.database import SessionLocal
        db_heal = SessionLocal()
        try:
            deduplicate_repositories_logic(db_heal)
        except Exception as e:
            _logger.warning("Auto-deduplication failed: %s", e)
        finally:
            db_heal.close()

        _logger.info("run-all-sync: starting ingestion")
        ingest_result = await run_daily_ingestion(force_discovery=False)
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
