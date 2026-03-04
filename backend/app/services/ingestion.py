"""
Daily ingestion pipeline.
Fetches raw GitHub metrics for all repos and writes one DailyMetric row per repo per day.
Idempotent: skips repos that already have a row captured today.

Auto-discovery:
  Every run first calls auto_discover_and_sync() which queries GitHub Trending
  (1d, 7d) + Search API (30d) across all verticals and upserts any new repos.
  Then deactivate_stale_repos() marks auto_discovered repos that haven't
  appeared in trending/search for STALE_DAYS (60) as is_active=False.
  Seed repos are NEVER deactivated.
"""

import uuid
import json
import logging
from datetime import datetime, timezone, date, timedelta

from app.database import SessionLocal
from app.models import Repository, DailyMetric
from app.services.github_client import fetch_repo_metrics
from app.services.github_search import (
    search_top_repos,
    _infer_category,
    VERTICAL_TOPIC_QUERIES,
)

logger = logging.getLogger(__name__)

# Auto-discovered repos inactive after this many days without re-appearing
STALE_DAYS = 60

# Discovery config: (period, vertical) pairs run on every ingestion cycle.
# Keep short periods + all verticals so we catch genuinely trending repos fast.
DISCOVERY_SEARCHES = [
    ("1d",  "ai_ml"),
    ("7d",  "ai_ml"),
    ("30d", "ai_ml"),
    ("7d",  "devtools"),
    ("7d",  "web_frameworks"),
    ("7d",  "security"),
    ("7d",  "data_engineering"),
    ("7d",  "blockchain"),
]


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _calc_age_days(created_at_str: str) -> int:
    """Calculate repo age in days from ISO timestamp string."""
    if not created_at_str:
        return 0
    try:
        created = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - created).days
    except Exception:
        return 0


# ─── Auto-discovery ───────────────────────────────────────────────────────────

async def auto_discover_and_sync() -> dict:
    """
    Query GitHub Trending + Search for all DISCOVERY_SEARCHES, then:
      - Insert any new repo not yet in the DB (source="auto_discovered")
      - Re-activate repos that had gone inactive but are trending again
      - Update last_seen_trending=now for every repo seen in any result

    Returns: {"discovered": N, "reactivated": N, "refreshed": N}
    """
    import asyncio

    db = SessionLocal()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    discovered = 0
    reactivated = 0
    refreshed = 0

    try:
        # Run all searches in parallel
        search_tasks = [
            search_top_repos(period=period, limit=50, vertical=vertical)
            for period, vertical in DISCOVERY_SEARCHES
        ]
        all_results = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Flatten and deduplicate by full_name
        seen_slugs: dict[str, dict] = {}
        for result in all_results:
            if isinstance(result, Exception):
                logger.warning(f"Discovery search failed: {result}")
                continue
            for repo_data in result:
                # Normalise to owner/name slug
                if "full_name" in repo_data:
                    slug = repo_data["full_name"].lower()
                else:
                    login = (repo_data.get("owner") or {}).get("login", "")
                    rname = repo_data.get("name", "")
                    if not login or not rname:
                        continue
                    slug = f"{login}/{rname}".lower()
                if slug not in seen_slugs:
                    seen_slugs[slug] = repo_data

        logger.info(f"Auto-discovery: {len(seen_slugs)} unique repos found across all searches")

        for slug, repo_data in seen_slugs.items():
            try:
                if "full_name" in repo_data:
                    owner, name = repo_data["full_name"].split("/", 1)
                else:
                    owner = (repo_data.get("owner") or {}).get("login", "")
                    name = repo_data.get("name", "")

                if not owner or not name:
                    continue

                existing = (
                    db.query(Repository)
                    .filter_by(owner=owner, name=name)
                    .first()
                )

                if existing:
                    # Always refresh last_seen_trending
                    existing.last_seen_trending = now
                    if not existing.is_active:
                        # Repo is back — reactivate it
                        existing.is_active = True
                        reactivated += 1
                        logger.info(f"Reactivated: {owner}/{name}")
                    else:
                        refreshed += 1
                else:
                    # Brand new repo — insert it
                    category = _infer_category(repo_data)
                    description = (repo_data.get("description") or "")[:500]
                    language = repo_data.get("language")

                    new_repo = Repository(
                        id=str(uuid.uuid4()),
                        owner=owner,
                        name=name,
                        category=category,
                        description=description,
                        github_url=repo_data.get("html_url", f"https://github.com/{owner}/{name}"),
                        primary_language=language,
                        source="auto_discovered",
                        is_active=True,
                        discovered_at=now,
                        last_seen_trending=now,
                    )
                    db.add(new_repo)
                    discovered += 1
                    logger.info(f"Discovered: {owner}/{name} [{category}]")

            except Exception as e:
                logger.error(f"Error upserting discovered repo {slug}: {e}")
                continue

        db.commit()
        summary = {"discovered": discovered, "reactivated": reactivated, "refreshed": refreshed}
        logger.info(f"Auto-discovery complete: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Auto-discovery pipeline error: {e}", exc_info=True)
        return {"discovered": 0, "reactivated": 0, "refreshed": 0, "error": str(e)}
    finally:
        db.close()


def deactivate_stale_repos() -> int:
    """
    Mark auto_discovered repos as is_active=False if they haven't appeared
    in any trending/search result for STALE_DAYS days.
    Seed repos are NEVER touched.

    Returns count of repos deactivated.
    """
    db = SessionLocal()
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=STALE_DAYS)

    try:
        stale = (
            db.query(Repository)
            .filter(
                Repository.source == "auto_discovered",
                Repository.is_active == True,  # noqa: E712
                Repository.last_seen_trending < cutoff,
            )
            .all()
        )

        for repo in stale:
            repo.is_active = False
            logger.info(
                f"Deactivated stale repo: {repo.owner}/{repo.name} "
                f"(last seen trending: {repo.last_seen_trending})"
            )

        db.commit()
        if stale:
            logger.info(f"Deactivated {len(stale)} stale auto-discovered repos")
        return len(stale)

    except Exception as e:
        db.rollback()
        logger.error(f"Deactivation error: {e}", exc_info=True)
        return 0
    finally:
        db.close()


async def run_daily_ingestion() -> dict:
    """
    Main ingestion entry point.
    1. Auto-discover new trending repos and sync last_seen_trending.
    2. Deactivate auto_discovered repos not seen in STALE_DAYS days.
    3. Ingest daily metrics for all active repos.
    Returns summary dict: {total, ingested, skipped, failed, discovered, reactivated, deactivated}
    """
    # ── Step 1: Auto-discovery ────────────────────────────────────────────────
    discovery_summary = await auto_discover_and_sync()

    # ── Step 2: Deactivate stale auto-discovered repos ────────────────────────
    deactivated = deactivate_stale_repos()

    # ── Step 3: Only ingest active repos ─────────────────────────────────────
    db = SessionLocal()
    try:
        repos = db.query(Repository).filter(Repository.is_active == True).all()  # noqa: E712
        today = _today_utc()
        logger.info(f"Starting ingestion for {len(repos)} repos on {today}")

        # Determine which repos still need today's snapshot
        already_done_ids = set(
            row.repo_id for row in db.query(DailyMetric.repo_id)
            .filter(
                DailyMetric.captured_at >= datetime.combine(today, datetime.min.time()),
                DailyMetric.captured_at < datetime.combine(today, datetime.max.time()),
            ).all()
        )

        pending = [
            {"id": r.id, "owner": r.owner, "name": r.name}
            for r in repos if r.id not in already_done_ids
        ]

        logger.info(f"Pending: {len(pending)} | Already done today: {len(already_done_ids)}")

        if not pending:
            return {
                "total": len(repos),
                "ingested": 0,
                "skipped": len(repos),
                "failed": 0,
                "discovered": discovery_summary.get("discovered", 0),
                "reactivated": discovery_summary.get("reactivated", 0),
                "deactivated": deactivated,
            }

        # ── Build incremental-fetch cursors ──────────────────────────────────
        # Repos that have been fetched before get a `since` timestamp so the
        # GitHub client only counts NEW commits/PRs since the last run.
        # This reduces GitHub API calls by ~80-90 % after the first snapshot.
        since_map: dict[str, str] = {}
        for r in repos:
            if r.last_fetched_at:
                # ISO-8601 with Z suffix (GitHub API requirement)
                since_map[r.id] = r.last_fetched_at.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Fetch from GitHub
        metrics_list = await fetch_repo_metrics(pending, since_map=since_map)

        ingested = 0
        failed = 0
        repo_map = {r.id: r for r in repos}

        for m in metrics_list:
            repo_id = m["repo_id"]
            try:
                # Calculate daily deltas vs yesterday's snapshot
                prev = (
                    db.query(DailyMetric)
                    .filter_by(repo_id=repo_id)
                    .order_by(DailyMetric.captured_at.desc())
                    .first()
                )
                daily_star_delta = m["stars"] - (prev.stars if prev else m["stars"])
                daily_fork_delta = m["forks"] - (prev.forks if prev else m["forks"])
                daily_pr_delta   = m.get("merged_prs", 0) - (prev.merged_prs if prev else m.get("merged_prs", 0))

                # Commit delta:
                # - If incremental mode (commit_is_delta=True), the value IS the delta.
                # - If full mode (first snapshot), delta = 0 (no baseline to diff against).
                raw_commit = m.get("commit_count", 0)
                is_delta   = m.get("commit_is_delta", False)
                if is_delta:
                    daily_commit_delta = max(raw_commit, 0)
                    # Running total = prev total + delta
                    prev_total = prev.commit_count if prev else 0
                    commit_count = prev_total + daily_commit_delta
                else:
                    commit_count       = raw_commit
                    daily_commit_delta = max(
                        raw_commit - (prev.commit_count if prev else raw_commit), 0
                    )

                metric = DailyMetric(
                    repo_id=repo_id,
                    captured_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    stars=m.get("stars", 0),
                    forks=m.get("forks", 0),
                    watchers=m.get("watchers", 0),
                    contributors=m.get("contributors", 0),
                    open_issues=m.get("open_issues", 0),
                    open_prs=m.get("open_prs", 0),
                    merged_prs=m.get("merged_prs", 0),
                    releases=m.get("releases", 0),
                    commit_count=commit_count,
                    daily_star_delta=max(daily_star_delta, 0),
                    daily_fork_delta=max(daily_fork_delta, 0),
                    daily_pr_delta=max(daily_pr_delta, 0),
                    daily_commit_delta=daily_commit_delta,
                    language_breakdown=json.dumps(m.get("language_breakdown", {})),
                )
                db.add(metric)

                # Update repo metadata
                if repo_id in repo_map:
                    repo = repo_map[repo_id]
                    repo.age_days = _calc_age_days(m.get("repo_created_at", ""))
                    if m.get("primary_language"):
                        repo.primary_language = m["primary_language"]
                    # Advance the incremental-fetch cursor so the next run
                    # only queries data *after* this exact moment.
                    repo.last_fetched_at = datetime.now(timezone.utc).replace(tzinfo=None)

                ingested += 1
            except Exception as e:
                logger.error(f"Failed to save metric for repo {repo_id}: {e}")
                failed += 1

        db.commit()
        summary = {
            "total": len(repos),
            "ingested": ingested,
            "skipped": len(already_done_ids),
            "failed": failed,
            "discovered": discovery_summary.get("discovered", 0),
            "reactivated": discovery_summary.get("reactivated", 0),
            "deactivated": deactivated,
        }
        logger.info(f"Ingestion complete: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Ingestion pipeline error: {e}", exc_info=True)
        raise
    finally:
        db.close()
