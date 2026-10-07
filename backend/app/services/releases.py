"""
GitHub Releases fetcher — ingests the last 10 releases per repo into repo_releases table.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta

import aiohttp

logger = logging.getLogger(__name__)

_GH_HEADERS = {
    "Authorization": f"Bearer {os.getenv('GITHUB_TOKEN', '')}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

_MAX_BODY_LENGTH = 500  # truncate release notes


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def fetch_releases_for_repo(
    session: aiohttp.ClientSession,
    repo_id: str,
    owner: str,
    name: str,
    per_page: int = 10,
) -> list[dict]:
    """Fetch the latest releases from GitHub REST API for a single repo."""
    try:
        async with session.get(
            f"https://api.github.com/repos/{owner}/{name}/releases",
            headers=_GH_HEADERS,
            params={"per_page": per_page},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 404:
                return []
            if resp.status != 200:
                logger.debug(f"Releases fetch {owner}/{name}: HTTP {resp.status}")
                return []
            releases = await resp.json()
            results = []
            for r in releases:
                published_str = r.get("published_at") or r.get("created_at")
                if not published_str:
                    continue
                try:
                    published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    published_at = _utcnow()
                body = r.get("body") or ""
                results.append({
                    "repo_id": repo_id,
                    "tag_name": r.get("tag_name", ""),
                    "name": r.get("name") or r.get("tag_name", ""),
                    "body_truncated": body[:_MAX_BODY_LENGTH] if body else None,
                    "published_at": published_at,
                    "is_prerelease": bool(r.get("prerelease", False)),
                    "html_url": r.get("html_url"),
                })
            return results
    except Exception as e:
        logger.debug(f"Releases fetch failed for {owner}/{name}: {e}")
        return []


async def run_releases_pipeline(top_n: int = 100) -> dict:
    """
    Refresh releases for the top-N tracked repos.
    Replaces stored releases (delete + re-insert) to keep data current.
    Skips repos fetched within the last 20 hours.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric
    from app.models.repo_release import RepoRelease
    from datetime import date

    db = SessionLocal()
    repos_to_fetch = []
    skipped = 0

    try:
        today = date.today()
        cutoff = _utcnow() - timedelta(hours=20)
        top = (
            db.query(ComputedMetric, Repository)
            .join(Repository, Repository.id == ComputedMetric.repo_id)
            .filter(ComputedMetric.date == today, Repository.is_active == True)
            .order_by(ComputedMetric.trend_score.desc())
            .limit(top_n)
            .all()
        )
        repo_ids = [repo.id for cm, repo in top]
        recent_fetched = set(
            row[0] for row in db.query(RepoRelease.repo_id)
            .filter(RepoRelease.repo_id.in_(repo_ids), RepoRelease.fetched_at >= cutoff)
            .distinct()
            .all()
        )
        for cm, repo in top:
            if repo.id in recent_fetched:
                skipped += 1
                continue
            repos_to_fetch.append({
                "id": repo.id,
                "owner": repo.owner,
                "name": repo.name
            })
    except Exception as e:
        logger.error(f"Releases pipeline query failed: {e}")
        return {"written": 0, "skipped": 0, "error": str(e)}
    finally:
        db.close()

    if not repos_to_fetch:
        return {"written": 0, "skipped": skipped}

    # Fetch releases concurrently with bounded concurrency
    all_releases = {}
    sem = asyncio.Semaphore(10)
    async with aiohttp.ClientSession() as session:
        async def _fetch(r):
            async with sem:
                res = await fetch_releases_for_repo(session, r["id"], r["owner"], r["name"])
                return r["id"], res

        tasks = [_fetch(r) for r in repos_to_fetch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, tuple) and res[1]:
                all_releases[res[0]] = res[1]

    if not all_releases:
        return {"written": 0, "skipped": skipped}

    # Save to database in a new short-lived session
    db = SessionLocal()
    written = 0
    try:
        now = _utcnow()
        for repo_id, releases in all_releases.items():
            db.query(RepoRelease).filter_by(repo_id=repo_id).delete()
            for r in releases:
                rr = RepoRelease(
                    id=str(uuid.uuid4()),
                    repo_id=r["repo_id"],
                    tag_name=r["tag_name"],
                    name=r["name"],
                    body_truncated=r["body_truncated"],
                    published_at=r["published_at"],
                    is_prerelease=r["is_prerelease"],
                    html_url=r["html_url"],
                    fetched_at=now,
                )
                db.add(rr)
                written += 1
        db.commit()
        logger.info(f"Releases pipeline: {written} release records written")
        return {"written": written}
    except Exception as e:
        db.rollback()
        logger.error(f"Releases pipeline save failed: {e}")
        return {"written": 0, "error": str(e)}
    finally:
        db.close()
