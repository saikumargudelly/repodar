"""
Commit activity fetcher — stores weekly commit counts (52-week) per repo.
Uses GitHub's /repos/{owner}/{repo}/stats/commit_activity endpoint.
"""
import json
import logging
import os
from datetime import datetime, timezone, timedelta, date

import aiohttp

logger = logging.getLogger(__name__)

_GH_HEADERS = {
    "Authorization": f"Bearer {os.getenv('GITHUB_TOKEN', '')}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def fetch_commit_activity(
    session: aiohttp.ClientSession, owner: str, name: str
) -> list[dict] | None:
    """
    Fetches /repos/{owner}/{name}/stats/commit_activity.
    Returns list of {date: "YYYY-MM-DD", count: int} for 52 weeks, or None on failure.
    GitHub may return 202 Accepted while computing stats — we handle that gracefully.
    """
    try:
        async with session.get(
            f"https://api.github.com/repos/{owner}/{name}/stats/commit_activity",
            headers=_GH_HEADERS,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 202:
                # GitHub is computing stats — skip for now, will be ready next run
                return None
            if resp.status != 200:
                return None
            weekly_data = await resp.json()
            if not isinstance(weekly_data, list):
                return None

            daily_points: list[dict] = []
            for week in weekly_data:
                week_start = datetime.utcfromtimestamp(week["week"])
                days = week.get("days", [0] * 7)
                for day_offset, count in enumerate(days):
                    d = (week_start + timedelta(days=day_offset)).date()
                    daily_points.append({"date": d.isoformat(), "count": count})

            return daily_points
    except Exception as e:
        logger.debug(f"Commit activity fetch failed for {owner}/{name}: {e}")
        return None


async def run_commit_activity_pipeline(top_n: int = 100) -> dict:
    """
    Fetch and store commit activity JSON for top-N repos.
    Updates Repository.commit_activity_json and commit_activity_updated_at.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric
    from datetime import date as date_type

    db = SessionLocal()
    updated = 0

    try:
        today = date_type.today()
        top = (
            db.query(ComputedMetric, Repository)
            .join(Repository, Repository.id == ComputedMetric.repo_id)
            .filter(ComputedMetric.date == today, Repository.is_active == True)
            .order_by(ComputedMetric.trend_score.desc())
            .limit(top_n)
            .all()
        )

        async with aiohttp.ClientSession() as session:
            for cm, repo in top:
                daily_points = await fetch_commit_activity(session, repo.owner, repo.name)
                if daily_points is None:
                    continue
                repo.commit_activity_json = json.dumps(daily_points)
                repo.commit_activity_updated_at = _utcnow()
                updated += 1

        db.commit()
        logger.info(f"Commit activity pipeline: {updated} repos updated")
        return {"updated": updated}

    except Exception as e:
        db.rollback()
        logger.error(f"Commit activity pipeline failed: {e}")
        return {"updated": 0, "error": str(e)}
    finally:
        db.close()
