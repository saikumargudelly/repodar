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

# Broad star-threshold discovery: verticals to scan every cycle.
# Surfaces established repos (stars >= floor) that don't appear in Trending.
# Runs once per vertical so GitHub rate-limit impact is minimal.
STAR_THRESHOLD_SEARCHES = [
    "ai_ml",
    "devtools",
    "data_engineering",
    "security",
    "web_frameworks",
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
        # Run all searches in parallel: trending/period-based + broad star-threshold
        search_tasks = (
            [
                search_top_repos(period=period, limit=50, vertical=vertical)
                for period, vertical in DISCOVERY_SEARCHES
            ] + [
                search_by_star_threshold(vertical=vertical, limit=50)
                for vertical in STAR_THRESHOLD_SEARCHES
            ]
        )
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
    discovery_summary = await auto_discover_and_sync()

    # ── Step 2: Deactivate stale auto-discovered repos ────────────────────────
    deactivated = deactivate_stale_repos()

    # ── Step 3: Delta-sync metrics for all active repos ───────────────────────
    db = SessionLocal()
    try:
        repos = db.query(Repository).filter(Repository.is_active == True).all()  # noqa: E712
        today = _today_utc()
        now   = datetime.now(timezone.utc).replace(tzinfo=None)
        logger.info(f"Starting delta-sync for {len(repos)} repos on {today}")

        # Build a map of existing today-rows so we can upsert them
        today_start = datetime.combine(today, datetime.min.time())
        today_end   = datetime.combine(today, datetime.max.time())
        existing_today: dict[str, DailyMetric] = {
            row.repo_id: row
            for row in db.query(DailyMetric).filter(
                DailyMetric.captured_at >= today_start,
                DailyMetric.captured_at <  today_end,
            ).all()
        }

        # Build incremental GitHub API cursors (since last fetch)
        since_map: dict[str, str] = {}
        for r in repos:
            if r.last_fetched_at:
                since_map[r.id] = r.last_fetched_at.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Fetch fresh data from GitHub for ALL active repos
        all_pending = [{"id": r.id, "owner": r.owner, "name": r.name} for r in repos]
        metrics_list = await fetch_repo_metrics(all_pending, since_map=since_map)

        inserted = 0
        updated  = 0
        failed   = 0
        repo_map = {r.id: r for r in repos}

        for m in metrics_list:
            repo_id = m["repo_id"]
            try:
                # Always compute deltas vs the most recent PREVIOUS-DAY snapshot
                # (not today's existing row) so re-runs don't inflate them.
                prev = (
                    db.query(DailyMetric)
                    .filter(
                        DailyMetric.repo_id == repo_id,
                        DailyMetric.captured_at < today_start,
                    )
                    .order_by(DailyMetric.captured_at.desc())
                    .first()
                )

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
                    # ── UPSERT: refresh the existing today row ─────────────
                    existing.captured_at        = now
                    existing.stars              = m.get("stars", 0)
                    existing.forks              = m.get("forks", 0)
                    existing.watchers           = m.get("watchers", 0)
                    existing.contributors       = m.get("contributors", 0)
                    existing.open_issues        = m.get("open_issues", 0)
                    existing.open_prs           = m.get("open_prs", 0)
                    existing.merged_prs         = m.get("merged_prs", 0)
                    existing.releases           = m.get("releases", 0)
                    existing.commit_count       = commit_count
                    existing.daily_star_delta   = daily_star_delta
                    existing.daily_fork_delta   = daily_fork_delta
                    existing.daily_pr_delta     = daily_pr_delta
                    existing.daily_commit_delta = daily_commit_delta
                    existing.language_breakdown = json.dumps(m.get("language_breakdown", {}))
                    updated += 1
                else:
                    # ── INSERT: first run of the day ───────────────────────
                    metric = DailyMetric(
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
                        language_breakdown=json.dumps(m.get("language_breakdown", {})),
                    )
                    db.add(metric)
                    # Track for potential subsequent upserts in this same run
                    existing_today[repo_id] = metric
                    inserted += 1

                # Update repo metadata & advance the GitHub API cursor.
                # Persist topics and stars_snapshot for Early-Radar + Topic Intelligence.
                if repo_id in repo_map:
                    repo = repo_map[repo_id]
                    repo.age_days = _calc_age_days(m.get("repo_created_at", ""))
                    if m.get("primary_language"):
                        repo.primary_language = m["primary_language"]
                    # Persist GitHub topic tags as a JSON array
                    raw_topics = m.get("topics")
                    if raw_topics is not None:
                        repo.topics = json.dumps(raw_topics)
                    # Denormalised star count for fast Early-Radar queries
                    repo.stars_snapshot = m.get("stars", 0)
                    repo.last_fetched_at = now

            except Exception as e:
                logger.error(f"Failed to save metric for repo {repo_id}: {e}")
                failed += 1

        db.commit()

        # ── Step 4: Enrich high-momentum repos with contributors & forks ──────
        # Run for repos that pushed fresh metrics this cycle.
        # We only target a top slice to keep GitHub API usage low.
        high_momentum = [
            r for r in repos
            if r.id in {m["repo_id"] for m in metrics_list}
            and (r.stars_snapshot or 0) > 500
        ][:60]   # cap at 60 to stay well within hourly rate limits

        if high_momentum:
            await _enrich_contributors_and_forks(high_momentum, today)

        summary = {
            "total": len(repos),
            "inserted": inserted,
            "updated": updated,
            "ingested": inserted + updated,   # backward-compat key
            "skipped": 0,
            "failed": failed,
            "discovered": discovery_summary.get("discovered", 0),
            "reactivated": discovery_summary.get("reactivated", 0),
            "deactivated": deactivated,
        }
        logger.info(f"Delta-sync complete: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Ingestion pipeline error: {e}", exc_info=True)
        raise
    finally:
        db.close()


async def _enrich_contributors_and_forks(repos: list, today) -> None:
    """
    For the given repos, fetch top contributors and notable forks from GitHub
    and upsert them into repo_contributors / fork_snapshots.
    Runs in parallel where possible.
    """
    from app.models import RepoContributor, ForkSnapshot

    db = SessionLocal()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    async def _enrich_one(repo):
        try:
            # ── Contributors ──────────────────────────────────────────────
            contributors = await get_top_contributors(repo.owner, repo.name, limit=25)
            for c in contributors:
                if not c.get("login"):
                    continue
                existing = (
                    db.query(RepoContributor)
                    .filter_by(repo_id=repo.id, login=c["login"])
                    .first()
                )
                if existing:
                    existing.contributions = c["contributions"]
                    existing.avatar_url = c.get("avatar_url", "")
                    existing.updated_at = now
                else:
                    db.add(RepoContributor(
                        repo_id=repo.id,
                        login=c["login"],
                        avatar_url=c.get("avatar_url", ""),
                        contributions=c["contributions"],
                        updated_at=now,
                    ))

            # ── Notable forks (only for repos with > 1_000 stars to limit API use) ──
            if (repo.stars_snapshot or 0) > 1000:
                forks = await get_notable_forks(repo.owner, repo.name, min_stars=20, limit=20)
                for f in forks:
                    if not f.get("fork_full_name"):
                        continue
                    existing_fork = (
                        db.query(ForkSnapshot)
                        .filter_by(
                            parent_repo_id=repo.id,
                            fork_full_name=f["fork_full_name"],
                            snapshot_date=today,
                        )
                        .first()
                    )
                    push_dt = None
                    if f.get("last_push_at"):
                        try:
                            push_dt = datetime.fromisoformat(
                                f["last_push_at"].replace("Z", "+00:00")
                            ).replace(tzinfo=None)
                        except Exception:
                            pass

                    if existing_fork:
                        existing_fork.stars = f["stars"]
                        existing_fork.forks = f["forks"]
                        existing_fork.last_push_at = push_dt
                        existing_fork.captured_at = now
                    else:
                        db.add(ForkSnapshot(
                            parent_repo_id=repo.id,
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
                        ))
        except Exception as e:
            logger.warning(f"Enrichment failed for {repo.owner}/{repo.name}: {e}")

    try:
        # Process in parallel batches of 10 to respect rate limits
        batch_size = 10
        for start in range(0, len(repos), batch_size):
            batch = repos[start:start + batch_size]
            await asyncio.gather(*[_enrich_one(r) for r in batch], return_exceptions=True)
            db.commit()
            if start + batch_size < len(repos):
                await asyncio.sleep(2)  # gentle pacing
    except Exception as e:
        logger.error(f"Contributor/fork enrichment error: {e}")
        db.rollback()
    finally:
        db.close()
