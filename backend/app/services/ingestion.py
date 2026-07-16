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

import os
import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone, date, timedelta

INGEST_BATCH_SIZE = int(os.getenv("INGEST_BATCH_SIZE", "100"))

from app.database import SessionLocal
from app.models import Repository, DailyMetric
from app.utils.executor import run_in_pipeline_thread
from app.services.github_client import (
    fetch_repo_metrics,
    get_top_contributors,
    get_notable_forks,
)
from app.services.github_search import (
    search_top_repos,
    search_by_star_threshold,
    _infer_category,
    VERTICAL_TOPIC_QUERIES,
)

logger = logging.getLogger(__name__)

# Auto-discovered repos inactive after this many days without re-appearing
# Increased to 90 days — popular repos can stay off trending for months and still be valuable
STALE_DAYS = 90

# Repos with at least this many stars are NEVER auto-deactivated (they remain relevant)
STALE_MIN_STARS_GUARD = 500

# Discovery config: (period, vertical, limit) tuples.
# Now includes 1d for all verticals to catch breaking news fast.
# Limits scaled strategically: 50 base, 100+ for high-signal searches.
DISCOVERY_SEARCHES = [
    # ── AI / ML ───────────────────────────────────────────────────────
    ("1d",  "ai_ml",     150),  # 150 daily AI/ML results due to high volume
    ("7d",  "ai_ml",     100),
    ("30d", "ai_ml",     100),
    # ── Dev Tools ────────────────────────────────────────────────────
    ("1d",  "devtools",   75),  # Now has 1d trending too
    ("7d",  "devtools",   75),
    # ── Web + Mobile ─────────────────────────────────────────────────
    ("1d",  "web_mobile", 75),
    ("7d",  "web_mobile", 75),
    ("30d", "web_mobile", 75),
    # ── Data + Infrastructure ────────────────────────────────────────
    ("1d",  "data_infra", 75),
    ("7d",  "data_infra", 75),
    ("30d", "data_infra", 75),
    # ── Security ─────────────────────────────────────────────────────
    ("1d",  "security",   50),
    ("7d",  "security",   50),
    # ── OSS Tools ────────────────────────────────────────────────────
    ("1d",  "oss_tools",  50),
    ("7d",  "oss_tools",  50),
    ("30d", "oss_tools",  50),
    # ── Blockchain ───────────────────────────────────────────────────
    ("1d",  "blockchain", 50),
    ("7d",  "blockchain", 50),
    # ── Science & Research ───────────────────────────────────────────
    ("1d",  "science",    50),
    ("7d",  "science",    50),
    # ── Creative & Gaming ────────────────────────────────────────────
    ("1d",  "creative",   50),
    ("7d",  "creative",   50),
]

# Broad star-threshold discovery: verticals to scan every cycle.
# Surfaces established repos (stars >= floor) that don't appear in Trending.
STAR_THRESHOLD_SEARCHES = [
    ("ai_ml",     100),  # Scaled limits for star-threshold too
    ("devtools",   75),
    ("web_mobile", 75),
    ("data_infra", 75),
    ("security",   50),
    ("oss_tools",  50),
    ("blockchain", 50),
    ("science",    50),
    ("creative",   50),
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

# ─── Synchronous Database Helpers for Background Pipeline ─────────────────────

def _get_discovery_cooldown_sync(now: datetime) -> tuple[bool, timedelta]:
    db = SessionLocal()
    FULL_SEARCH_INTERVAL = timedelta(hours=4)
    try:
        system_repo = db.query(Repository).filter(Repository.id == "system:last_search_discovery").first()
        if not system_repo or not system_repo.last_seen_trending:
            return True, FULL_SEARCH_INTERVAL
        else:
            time_elapsed = now - system_repo.last_seen_trending
            if time_elapsed > FULL_SEARCH_INTERVAL:
                return True, FULL_SEARCH_INTERVAL
            else:
                return False, FULL_SEARCH_INTERVAL - time_elapsed
    except Exception as e:
        logger.warning(f"Failed to query system discovery row from DB: {e}")
        return True, FULL_SEARCH_INTERVAL
    finally:
        db.close()


def _persist_discovered_repos_sync(seen_slugs: dict, now: datetime, run_full_search: bool) -> dict:
    db = SessionLocal()
    discovered = 0
    reactivated = 0
    refreshed = 0
    try:
        # Phase 3 optimization: project only the 4 fields needed for slug deduplication.
        # Avoids loading JSONB/Text columns (commit_activity_json, ecosystem_data_json,
        # repo_summary, topics, tech_stack_json) that are never read here.
        _repo_rows = db.query(
            Repository.id,
            Repository.owner,
            Repository.name,
            Repository.is_active,
        ).all()
        existing_map = {f"{r.owner.lower()}/{r.name.lower()}": r for r in _repo_rows}

        active_to_refresh_ids = []
        inactive_to_reactivate_ids = []
        new_repos = []

        for slug, repo_data in seen_slugs.items():
            try:
                if "full_name" in repo_data:
                    owner, name = repo_data["full_name"].split("/", 1)
                else:
                    owner = (repo_data.get("owner") or {}).get("login", "")
                    name = repo_data.get("name", "")

                if not owner or not name:
                    continue

                existing = existing_map.get(f"{owner.lower()}/{name.lower()}")

                if existing:
                    if existing.is_active:
                        active_to_refresh_ids.append(existing.id)
                        refreshed += 1
                    else:
                        inactive_to_reactivate_ids.append(existing.id)
                        reactivated += 1
                else:
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
                    new_repos.append(new_repo)
                    discovered += 1
            except Exception as e:
                logger.error(f"Error processing discovered repo {slug}: {e}")
                continue

        if active_to_refresh_ids:
            db.query(Repository).filter(Repository.id.in_(active_to_refresh_ids)).update(
                {Repository.last_seen_trending: now},
                synchronize_session=False
            )
        if inactive_to_reactivate_ids:
            db.query(Repository).filter(Repository.id.in_(inactive_to_reactivate_ids)).update(
                {Repository.last_seen_trending: now, Repository.is_active: True},
                synchronize_session=False
            )
        if new_repos:
            db.bulk_save_objects(new_repos)

        if run_full_search:
            try:
                system_repo = db.query(Repository).filter(Repository.id == "system:last_search_discovery").first()
                if not system_repo:
                    system_repo = Repository(
                        id="system:last_search_discovery",
                        owner="system",
                        name="last_search_discovery",
                        category="system",
                        github_url="",
                        source="system",
                        is_active=False,
                        discovered_at=now,
                        last_seen_trending=now
                    )
                    db.add(system_repo)
                else:
                    system_repo.last_seen_trending = now
            except Exception as e:
                logger.warning(f"Failed to stage system discovery timestamp in DB: {e}")

        db.commit()
        return {"discovered": discovered, "reactivated": reactivated, "refreshed": refreshed}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist discovered repos: {e}", exc_info=True)
        raise
    finally:
        db.close()


def _get_active_repos_sync() -> tuple[list[dict], dict[str, str]]:
    db = SessionLocal()
    try:
        # Phase 3 optimization: project only the 4 fields _get_active_repos_sync actually reads.
        # Before: full ORM load including all JSONB columns
        # After: named-tuple rows with id, owner, name, last_fetched_at only
        repos = db.query(
            Repository.id,
            Repository.owner,
            Repository.name,
            Repository.last_fetched_at,
        ).filter(Repository.is_active == True).all()  # noqa: E712
        since_map: dict[str, str] = {}
        for r in repos:
            if r.last_fetched_at:
                since_map[r.id] = r.last_fetched_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        all_pending = [{"id": r.id, "owner": r.owner, "name": r.name} for r in repos]
        return all_pending, since_map
    finally:
        db.close()


def _persist_daily_metrics_sync(metrics_list: list, today: date, now: datetime) -> tuple[dict, list]:
    db = SessionLocal()
    try:
        # Project all columns accessed during ingestion and high-momentum checks to prevent KeyErrors
        repos = db.query(
            Repository.id,
            Repository.owner,
            Repository.name,
            Repository.primary_language,
            Repository.topics,
            Repository.stars_snapshot,
        ).filter(Repository.is_active == True).all()  # noqa: E712
        
        today_start = datetime.combine(today, datetime.min.time())
        today_end   = datetime.combine(today, datetime.max.time())
        existing_today: dict[str, DailyMetric] = {
            row.repo_id: row
            for row in db.query(DailyMetric).filter(
                DailyMetric.captured_at >= today_start,
                DailyMetric.captured_at <  today_end,
            ).all()
        }

        inserted = 0
        updated  = 0
        failed   = 0
        repo_map = {r.id: r for r in repos}

        from sqlalchemy import and_, func as _func
        
        latest_prev_subq = (
            db.query(
                DailyMetric.repo_id.label("repo_id"),
                _func.max(DailyMetric.captured_at).label("max_captured_at")
            )
            .filter(DailyMetric.captured_at < today_start)
            .group_by(DailyMetric.repo_id)
            .subquery()
        )
        
        prev_metrics_list = (
            db.query(DailyMetric)
            .join(
                latest_prev_subq,
                and_(
                    DailyMetric.repo_id == latest_prev_subq.c.repo_id,
                    DailyMetric.captured_at == latest_prev_subq.c.max_captured_at
                )
            )
            .all()
        )
        prev_metrics_map = {row.repo_id: row for row in prev_metrics_list}

        new_metrics = []
        metric_updates = []
        repo_updates = []

        for m in metrics_list:
            repo_id = m["repo_id"]
            try:
                prev = prev_metrics_map.get(repo_id)

                daily_star_delta = max(m["stars"] - (prev.stars if prev else m["stars"]), 0)
                daily_fork_delta = max(m["forks"] - (prev.forks if prev else m["forks"]), 0)
                daily_pr_delta   = max(
                    m.get("merged_prs", 0) - (prev.merged_prs if prev else m.get("merged_prs", 0)), 0
                )

                raw_commit = m.get("commit_count", 0)
                is_delta   = m.get("commit_is_delta", False)
                if is_delta:
                    daily_commit_delta = max(raw_commit, 0)
                    prev_total = prev.commit_count if prev else 0
                    commit_count = prev_total + daily_commit_delta
                else:
                    commit_count       = raw_commit
                    daily_commit_delta = max(
                        raw_commit - (prev.commit_count if prev else raw_commit), 0
                    )

                existing = existing_today.get(repo_id)

                if existing:
                    metric_updates.append({
                        "id": existing.id,
                        "captured_at": now,
                        "stars": m.get("stars", 0),
                        "forks": m.get("forks", 0),
                        "watchers": m.get("watchers", 0),
                        "contributors": m.get("contributors", 0),
                        "open_issues": m.get("open_issues", 0),
                        "open_prs": m.get("open_prs", 0),
                        "merged_prs": m.get("merged_prs", 0),
                        "releases": m.get("releases", 0),
                        "commit_count": commit_count,
                        "daily_star_delta": daily_star_delta,
                        "daily_fork_delta": daily_fork_delta,
                        "daily_pr_delta": daily_pr_delta,
                        "daily_commit_delta": daily_commit_delta,
                        "language_breakdown": m.get("language_breakdown", {})
                    })
                    updated += 1
                else:
                    new_id = str(uuid.uuid4())
                    metric = DailyMetric(
                        id=new_id,
                        repo_id=repo_id,
                        captured_at=now,
                        stars=m.get("stars", 0),
                        forks=m.get("forks", 0),
                        watchers=m.get("watchers", 0),
                        contributors=m.get("contributors", 0),
                        open_issues=m.get("open_issues", 0),
                        open_prs=m.get("open_prs", 0),
                        merged_prs=m.get("merged_prs", 0),
                        releases=m.get("releases", 0),
                        commit_count=commit_count,
                        daily_star_delta=daily_star_delta,
                        daily_fork_delta=daily_fork_delta,
                        daily_pr_delta=daily_pr_delta,
                        daily_commit_delta=daily_commit_delta,
                        language_breakdown=m.get("language_breakdown", {}),
                    )
                    new_metrics.append(metric)
                    existing_today[repo_id] = metric
                    inserted += 1

                if repo_id in repo_map:
                    repo = repo_map[repo_id]
                    topics_val = m.get("topics") if m.get("topics") is not None else repo.topics
                    desc_val = repo.description or ""
                    lang_val = m.get("primary_language") or repo.primary_language or ""
                    name_val = repo.name
                    
                    temp_repo = {
                        "name": name_val,
                        "topics": topics_val,
                        "description": desc_val,
                        "primary_language": lang_val,
                    }
                    
                    from app.services.ecosystem import EcosystemClassifier
                    inferred_cat, inferred_cats = EcosystemClassifier.infer_category(temp_repo)
                    
                    repo_updates.append({
                        "id": repo.id,
                        "age_days": _calc_age_days(m.get("repo_created_at", "")),
                        "primary_language": lang_val,
                        "topics": topics_val,
                        "category": inferred_cat,
                        "categories": inferred_cats,
                        "stars_snapshot": m.get("stars", 0),
                        "last_fetched_at": now
                    })

            except Exception as e:
                logger.error(f"Failed to prepare metric for repo {repo_id}: {e}")
                failed += 1

        chunk_size = INGEST_BATCH_SIZE
        if new_metrics:
            for idx in range(0, len(new_metrics), chunk_size):
                db.bulk_save_objects(new_metrics[idx:idx + chunk_size])
                db.commit()
        if metric_updates:
            for idx in range(0, len(metric_updates), chunk_size):
                db.bulk_update_mappings(DailyMetric, metric_updates[idx:idx + chunk_size])
                db.commit()
        if repo_updates:
            for idx in range(0, len(repo_updates), chunk_size):
                db.bulk_update_mappings(Repository, repo_updates[idx:idx + chunk_size])
                db.commit()

        high_momentum_repos = [
            {
                "id": r.id,
                "owner": r.owner,
                "name": r.name,
                "stars_snapshot": r.stars_snapshot
            }
            for r in repos
            if r.id in {m["repo_id"] for m in metrics_list}
            and (r.stars_snapshot or 0) > 500
        ][:60]

        summary = {
            "total": len(repos),
            "inserted": inserted,
            "updated": updated,
            "skipped": 0,
            "failed": failed,
        }
        db.commit()
        return summary, high_momentum_repos
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist daily metrics: {e}", exc_info=True)
        raise
    finally:
        db.close()


def _persist_enriched_data_sync(fetched_data: list, today: date, now: datetime) -> None:
    from app.models import RepoContributor, ForkSnapshot
    db = SessionLocal()
    try:
        repo_ids = [item[0] for item in fetched_data]
        
        all_existing_contribs = (
            db.query(RepoContributor)
            .filter(RepoContributor.repo_id.in_(repo_ids))
            .all()
        )
        contrib_map = {(row.repo_id, row.login): row for row in all_existing_contribs}
        
        all_existing_forks = (
            db.query(ForkSnapshot)
            .filter(
                ForkSnapshot.parent_repo_id.in_(repo_ids),
                ForkSnapshot.snapshot_date == today
            )
            .all()
        )
        fork_map = {(row.parent_repo_id, row.fork_full_name): row for row in all_existing_forks}

        new_contribs = []
        contrib_updates = []
        new_forks = []
        fork_updates = []

        for repo_id, contributors, forks in fetched_data:
            for c in contributors:
                if not c.get("login"):
                    continue
                existing = contrib_map.get((repo_id, c["login"]))
                if existing:
                    contrib_updates.append({
                        "id": existing.id,
                        "contributions": c["contributions"],
                        "avatar_url": c.get("avatar_url", ""),
                        "updated_at": now
                    })
                else:
                    new_id = str(uuid.uuid4())
                    new_contrib = RepoContributor(
                        id=new_id,
                        repo_id=repo_id,
                        login=c["login"],
                        avatar_url=c.get("avatar_url", ""),
                        contributions=c["contributions"],
                        updated_at=now,
                    )
                    new_contribs.append(new_contrib)
                    contrib_map[(repo_id, c["login"])] = new_contrib

            for f in forks:
                if not f.get("fork_full_name"):
                    continue
                existing_fork = fork_map.get((repo_id, f["fork_full_name"]))
                push_dt = None
                if f.get("last_push_at"):
                    try:
                        push_dt = datetime.fromisoformat(
                            f["last_push_at"].replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                    except Exception:
                        pass

                if existing_fork:
                    fork_updates.append({
                        "id": existing_fork.id,
                        "stars": f["stars"],
                        "forks": f["forks"],
                        "last_push_at": push_dt,
                        "captured_at": now
                    })
                else:
                    new_id = str(uuid.uuid4())
                    new_fork = ForkSnapshot(
                        id=new_id,
                        parent_repo_id=repo_id,
                        fork_owner=f["fork_owner"],
                        fork_name=f["fork_name"],
                        fork_full_name=f["fork_full_name"],
                        github_url=f["github_url"],
                        stars=f["stars"],
                        forks=f["forks"],
                        open_issues=f["open_issues"],
                        primary_language=f.get("primary_language"),
                        last_push_at=push_dt,
                        snapshot_date=today,
                        captured_at=now,
                    )
                    new_forks.append(new_fork)
                    fork_map[(repo_id, f["fork_full_name"])] = new_fork

        chunk_size = INGEST_BATCH_SIZE
        if new_contribs:
            for idx in range(0, len(new_contribs), chunk_size):
                db.bulk_save_objects(new_contribs[idx:idx + chunk_size])
                db.commit()
        if contrib_updates:
            for idx in range(0, len(contrib_updates), chunk_size):
                db.bulk_update_mappings(RepoContributor, contrib_updates[idx:idx + chunk_size])
                db.commit()
        if new_forks:
            for idx in range(0, len(new_forks), chunk_size):
                db.bulk_save_objects(new_forks[idx:idx + chunk_size])
                db.commit()
        if fork_updates:
            for idx in range(0, len(fork_updates), chunk_size):
                db.bulk_update_mappings(ForkSnapshot, fork_updates[idx:idx + chunk_size])
                db.commit()
        logger.info(f"Enrichment completed and saved successfully for {len(fetched_data)} repos")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save enriched contributors/forks to DB: {e}")
        raise
    finally:
        db.close()


# ─── Auto-discovery ───────────────────────────────────────────────────────────

async def auto_discover_and_sync(force: bool = False) -> dict:
    """
    Query GitHub Trending + Search for all DISCOVERY_SEARCHES, then:
      - Insert any new repo not yet in the DB (source="auto_discovered")
      - Re-activate repos that had gone inactive but are trending again
      - Update last_seen_trending=now for every repo seen in any result

    Returns: {"discovered": N, "reactivated": N, "refreshed": N}
    """
    import os
    import time

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Determine whether to run full search-based discovery
    # Offload the database read to the pipeline executor
    run_full_search = force
    if not run_full_search:
        run_full_search, remaining_or_cooldown = await run_in_pipeline_thread(
            _get_discovery_cooldown_sync, now
        )
        if not run_full_search:
            logger.info(f"Full discovery is on cooldown. Remaining: {remaining_or_cooldown}")

    try:
        # If running full search, run all discovery searches with proper batching.
        # Otherwise, run a lean set of high-signal searches to catch trends without API strain.
        if run_full_search:
            logger.info(f"Running full auto-discovery with {len(DISCOVERY_SEARCHES)} searches + {len(STAR_THRESHOLD_SEARCHES)} star-thresholds.")
            search_tasks = (
                [
                    search_top_repos(period=period, limit=limit, vertical=vertical)
                    for period, vertical, limit in DISCOVERY_SEARCHES
                ] + [
                    search_by_star_threshold(vertical=vertical, limit=limit)
                    for vertical, limit in STAR_THRESHOLD_SEARCHES
                ]
            )
        else:
            # Lean mode: catch daily trends + key established repos without hitting Search API hard
            logger.info("Running lean discovery (trending HTML scrape + top star repos).")
            search_tasks = (
                [
                    search_top_repos(period=period, limit=100, vertical="ai_ml")
                    for period in ["1d", "7d"]
                ] + [
                    search_top_repos(period="1d", limit=50, vertical=v)
                    for v in ["devtools", "web_mobile", "data_infra"]
                ] + [
                    search_by_star_threshold(vertical="ai_ml", limit=75),
                    search_by_star_threshold(vertical="web_mobile", limit=50),
                ]
            )

        # Process the search tasks in chunks of 4 to prevent API congestion and secondary rate limiting
        all_results = []
        chunk_size = 4
        for i in range(0, len(search_tasks), chunk_size):
            chunk = search_tasks[i:i + chunk_size]
            chunk_results = await asyncio.gather(*chunk, return_exceptions=True)
            all_results.extend(chunk_results)
            if i + chunk_size < len(search_tasks):
                await asyncio.sleep(1.5)  # Pause between chunks to yield the event loop and ease rate limits

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

        # Offload the database updates and inserts to the pipeline executor
        summary = await run_in_pipeline_thread(
            _persist_discovered_repos_sync, seen_slugs, now, run_full_search
        )
        logger.info(f"Auto-discovery complete: {summary}")
        return summary

    except Exception as e:
        logger.error(f"Auto-discovery pipeline error: {e}", exc_info=True)
        return {"discovered": 0, "reactivated": 0, "refreshed": 0, "error": str(e)}


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
                # Never deactivate popular repos — they remain relevant even off trending
                Repository.stars_snapshot < STALE_MIN_STARS_GUARD,
            )
            .all()
        )

        if stale:
            for repo in stale:
                logger.info(
                    f"Deactivated stale repo: {repo.owner}/{repo.name} "
                    f"(last seen trending: {repo.last_seen_trending})"
                )
            
            stale_ids = [repo.id for repo in stale]
            # Perform bulk update to avoid sequential roundtrips
            db.query(Repository).filter(Repository.id.in_(stale_ids)).update(
                {Repository.is_active: False}, synchronize_session=False
            )
            db.commit()
            logger.info(f"Deactivated {len(stale)} stale auto-discovered repos")
        return len(stale)

    except Exception as e:
        db.rollback()
        logger.error(f"Deactivation error: {e}", exc_info=True)
        return 0
    finally:
        db.close()


async def run_daily_ingestion(force_discovery: bool = False) -> dict:
    """
    Main ingestion entry point — designed to run up to 6× per day (every 4 h).

    Each run is a full delta sync:
      - INSERT a new DailyMetric row if none exists for today.
      - UPSERT (UPDATE) the existing row if one was already written today,
        refreshing stars/forks/PRs/etc with the latest GitHub values.
      - Deltas (daily_star_delta, etc.) are always computed vs the most recent
        snapshot from a PREVIOUS day, so re-runs never inflate them.

    1. Auto-discover new trending repos and sync last_seen_trending.
    2. Deactivate auto_discovered repos not seen in STALE_DAYS days.
    3. Ingest / refresh daily metrics for all active repos.

    Returns summary dict.
    """
    # ── Step 1: Auto-discovery ────────────────────────────────────────────────
    discovery_summary = await auto_discover_and_sync(force=force_discovery)

    # ── Step 2: Deactivate stale auto-discovered repos ────────────────────────
    deactivated = await run_in_pipeline_thread(deactivate_stale_repos)

    # ── Step 3: Delta-sync metrics for all active repos ───────────────────────
    # Fetch active repos and since_map first in a pipeline executor thread
    all_pending, since_map = await run_in_pipeline_thread(_get_active_repos_sync)

    # Fetch fresh data from GitHub for ALL active repos (long-running network IO, no DB connection held!)
    metrics_list = await fetch_repo_metrics(all_pending, since_map=since_map)

    # Re-open a fresh database session for calculation and persistence inside pipeline thread
    today = _today_utc()
    now   = datetime.now(timezone.utc).replace(tzinfo=None)
    logger.info(f"Starting delta-sync for active repos on {today} using pipeline executor")

    summary, high_momentum_data = await run_in_pipeline_thread(
        _persist_daily_metrics_sync, metrics_list, today, now
    )

    # ── Step 4: Enrich high-momentum repos with contributors & forks ──────
    # Run after closing the main ingestion database session to avoid holding connections
    if high_momentum_data:
        await _enrich_contributors_and_forks(high_momentum_data, today)

    # Update summary with discovery and deactivation metrics
    summary.update({
        "ingested": summary["inserted"] + summary["updated"],
        "discovered": discovery_summary.get("discovered", 0),
        "reactivated": discovery_summary.get("reactivated", 0),
        "deactivated": deactivated,
    })

    logger.info(f"Delta-sync complete: {summary}")
    return summary


async def _enrich_contributors_and_forks(repos: list, today) -> None:
    """
    For the given repos, fetch top contributors and notable forks from GitHub
    and upsert them into repo_contributors / fork_snapshots.
    Fetches GitHub REST data concurrently in parallel batches,
    then writes sequentially on a single DB session to prevent concurrency errors.
    """
    from types import SimpleNamespace
    repos_ns = [SimpleNamespace(**r) if isinstance(r, dict) else r for r in repos]
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    import aiohttp

    # 1. Asynchronous fetch helper (does not touch DB session)
    async def _fetch_one_repo_data(repo, session):
        contribs = []
        forks = []
        try:
            contribs = await get_top_contributors(repo.owner, repo.name, limit=25, session=session)
        except Exception as e:
            logger.warning(f"Failed to fetch contributors for {repo.owner}/{repo.name}: {e}")
            
        try:
            if (repo.stars_snapshot or 0) > 1000:
                forks = await get_notable_forks(repo.owner, repo.name, min_stars=20, limit=20, session=session)
        except Exception as e:
            logger.warning(f"Failed to fetch forks for {repo.owner}/{repo.name}: {e}")
            
        return repo.id, contribs, forks

    # 2. Fetch everything concurrently in pacing batches utilizing a shared ClientSession
    fetched_data = []
    batch_size = 10
    async with aiohttp.ClientSession() as gh_session:
        for start in range(0, len(repos_ns), batch_size):
            batch = repos_ns[start:start + batch_size]
            batch_results = await asyncio.gather(*[_fetch_one_repo_data(r, gh_session) for r in batch], return_exceptions=True)
            for res in batch_results:
                if isinstance(res, Exception) or not res:
                    continue
                fetched_data.append(res)
            if start + batch_size < len(repos_ns):
                await asyncio.sleep(2)  # gentle pacing

    # 3. Offload sequential database updates to the pipeline executor
    if fetched_data:
        await run_in_pipeline_thread(
            _persist_enriched_data_sync, fetched_data, today, now
        )
