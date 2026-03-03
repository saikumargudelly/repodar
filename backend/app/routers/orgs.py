"""
Organization portfolio health endpoint.

GET /orgs/{org}/oss-health
  Returns aggregate health data for all public repos of a GitHub organization.
  Cross-references with Repodar's tracked repo DB for enriched scores.

Use cases:
  - "How healthy is the microsoft OSS portfolio?"
  - VC/analyst research on competitor engineering orgs
  - Dependency health for your own org's repos
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List

import aiohttp
from fastapi import APIRouter, Path, Query, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
API_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

router = APIRouter(prefix="/orgs", tags=["Organizations"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class OrgRepoHealth(BaseModel):
    name: str
    full_name: str
    description: Optional[str]
    stars: int
    forks: int
    language: Optional[str]
    open_issues: int
    age_days: int
    github_url: str
    pushed_at: Optional[str] = None
    # Repodar scores — null when not in tracked set
    trend_score: Optional[float] = None
    sustainability_score: Optional[float] = None
    sustainability_label: Optional[str] = None
    is_tracked: bool = False


class OrgHealthResponse(BaseModel):
    org: str
    total_repos: int
    total_stars: int
    top_language: Optional[str]
    tracked_repos: int
    avg_sustainability_score: Optional[float]
    repos: List[OrgRepoHealth]


# ─── Endpoint ────────────────────────────────────────────────────────────────

@router.get(
    "/{org}/oss-health",
    response_model=OrgHealthResponse,
    summary="Portfolio health for a GitHub organization",
)
async def org_oss_health(
    org: str = Path(..., description="GitHub organization login (e.g. microsoft, google, meta)"),
    limit: int = Query(25, le=50, description="Max repos to include"),
    sort_by: str = Query("stars", description="stars | updated | pushed"),
):
    """
    Fetches all public repos for a GitHub org (sorted by stars by default),
    enriches tracked repos with Repodar sustainability scores, and returns
    aggregate portfolio health.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric

    # ── 1. Fetch org repos from GitHub ──────────────────────────────────────
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"https://api.github.com/orgs/{org}/repos",
            headers=API_HEADERS,
            params={
                "type": "public",
                "sort": sort_by if sort_by in {"stars", "updated", "pushed"} else "stars",
                "per_page": min(limit * 2, 100),  # fetch extra, filter below
            },
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 404:
                raise HTTPException(status_code=404, detail=f"Organization '{org}' not found on GitHub")
            if resp.status == 403:
                raise HTTPException(status_code=403, detail="GitHub rate limit exceeded. Try again later.")
            if resp.status != 200:
                raise HTTPException(status_code=502, detail=f"GitHub API returned {resp.status}")
            raw = await resp.json()

    if not isinstance(raw, list):
        raw = []

    # Sort by stars descending, exclude forks and archived repos
    raw = [r for r in raw if not r.get("fork") and not r.get("archived")]
    raw.sort(key=lambda r: r.get("stargazers_count", 0), reverse=True)
    raw = raw[:limit]

    # ── 2. Enrich with Repodar DB scores ───────────────────────────────────
    db = SessionLocal()
    try:
        repos_out: list[OrgRepoHealth] = []
        tracked_scores: list[float] = []

        for r in raw:
            full_name = r.get("full_name", "")
            created_at = r.get("created_at", "")
            pushed_at = r.get("pushed_at", "")

            try:
                age = (
                    datetime.now(timezone.utc)
                    - datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                ).days
            except Exception:
                age = 0

            entry = OrgRepoHealth(
                name=r.get("name", ""),
                full_name=full_name,
                description=r.get("description") or "",
                stars=r.get("stargazers_count", 0),
                forks=r.get("forks_count", 0),
                language=r.get("language"),
                open_issues=r.get("open_issues_count", 0),
                age_days=age,
                github_url=r.get("html_url", f"https://github.com/{full_name}"),
                pushed_at=pushed_at,
            )

            # Check Repodar tracked set
            tracked = db.query(Repository).filter_by(id=full_name).first()
            if tracked:
                cm = (
                    db.query(ComputedMetric)
                    .filter_by(repo_id=full_name)
                    .order_by(ComputedMetric.date.desc())
                    .first()
                )
                entry.is_tracked = True
                if cm:
                    entry.trend_score = cm.trend_score
                    entry.sustainability_score = cm.sustainability_score
                    entry.sustainability_label = cm.sustainability_label
                    if cm.sustainability_score is not None:
                        tracked_scores.append(cm.sustainability_score)

            repos_out.append(entry)
    finally:
        db.close()

    # ── 3. Aggregate stats ──────────────────────────────────────────────────
    total_stars = sum(r.stars for r in repos_out)

    lang_counts: dict[str, int] = {}
    for r in repos_out:
        if r.language:
            lang_counts[r.language] = lang_counts.get(r.language, 0) + 1
    top_language = max(lang_counts, key=lambda k: lang_counts[k]) if lang_counts else None

    avg_ss = (
        round(sum(tracked_scores) / len(tracked_scores), 3)
        if tracked_scores else None
    )

    return OrgHealthResponse(
        org=org,
        total_repos=len(repos_out),
        total_stars=total_stars,
        top_language=top_language,
        tracked_repos=sum(1 for r in repos_out if r.is_tracked),
        avg_sustainability_score=avg_ss,
        repos=repos_out,
    )
