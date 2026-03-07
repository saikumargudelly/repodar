import os
import asyncio
from datetime import datetime, date, timezone, timedelta
from typing import Optional, List

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv

from app.database import get_db
from app.models import Repository, ComputedMetric

load_dotenv()

router = APIRouter(prefix="/repos", tags=["Repositories"])


# ─── Response schemas ────────────────────────────────────────────────────────

class RepoSummary(BaseModel):
    id: str
    owner: str
    name: str
    category: str
    description: Optional[str]
    github_url: str
    primary_language: Optional[str]
    age_days: int

    # Latest computed scores (nullable if not yet scored)
    trend_score: Optional[float] = None
    sustainability_score: Optional[float] = None
    sustainability_label: Optional[str] = None
    star_velocity_7d: Optional[float] = None
    acceleration: Optional[float] = None

    class Config:
        from_attributes = True


class RepoDetail(RepoSummary):
    star_velocity_30d: Optional[float] = None
    contributor_growth_rate: Optional[float] = None
    fork_to_star_ratio: Optional[float] = None
    issue_close_rate: Optional[float] = None
    explanation: Optional[str] = None
    # AI-generated plain-English summary (3 sentences)
    repo_summary: Optional[str] = None
    repo_summary_generated_at: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[RepoSummary])
def list_repos(
    category: Optional[str] = Query(None, description="Filter by ecosystem category"),
    sort_by: str = Query("trend_score", description="trend_score | sustainability_score | stars"),
    limit: int = Query(100, le=200),
    db: Session = Depends(get_db),
):
    """List all repos with their latest computed scores."""
    from datetime import date
    today = date.today()

    query = db.query(Repository)
    if category:
        query = query.filter(Repository.category == category)
    repos = query.all()

    results = []
    for repo in repos:
        latest_cm = (
            db.query(ComputedMetric)
            .filter_by(repo_id=repo.id)
            .order_by(ComputedMetric.date.desc())
            .first()
        )
        summary = RepoSummary(
            id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            description=repo.description,
            github_url=repo.github_url,
            primary_language=repo.primary_language,
            age_days=repo.age_days,
            trend_score=latest_cm.trend_score if latest_cm else None,
            sustainability_score=latest_cm.sustainability_score if latest_cm else None,
            sustainability_label=latest_cm.sustainability_label if latest_cm else None,
            star_velocity_7d=latest_cm.star_velocity_7d if latest_cm else None,
            acceleration=latest_cm.acceleration if latest_cm else None,
        )
        results.append(summary)

    # Sort
    reverse = True
    if sort_by == "trend_score":
        results.sort(key=lambda x: x.trend_score or 0, reverse=reverse)
    elif sort_by == "sustainability_score":
        results.sort(key=lambda x: x.sustainability_score or 0, reverse=reverse)

    return results[:limit]


# ─── Comparison ──────────────────────────────────────────────────────────────

class CompareEntry(BaseModel):
    repo_id: str
    owner: str
    name: str
    description: Optional[str]
    github_url: str
    primary_language: Optional[str]
    current_stars: int
    current_forks: int
    age_days: int
    trend_score: Optional[float] = None
    sustainability_score: Optional[float] = None
    sustainability_label: Optional[str] = None
    star_velocity_7d: Optional[float] = None
    acceleration: Optional[float] = None
    contributor_growth_rate: Optional[float] = None
    fork_to_star_ratio: Optional[float] = None
    issue_close_rate: Optional[float] = None
    is_tracked: bool = False


_GH_HEADERS = {
    "Authorization": f"Bearer {os.getenv('GITHUB_TOKEN', '')}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


@router.get("/compare", response_model=List[CompareEntry])
async def compare_repos(
    ids: str = Query(
        ...,
        description="Comma-separated repo IDs: owner/name,owner2/name2 (max 5)",
    ),
    db: Session = Depends(get_db),
):
    """
    Side-by-side comparison data for 2–5 repos.
    Repodar-tracked repos include full computed scores.
    Untracked repos are enriched via live GitHub REST API (no scores).
    """
    repo_ids = [i.strip() for i in ids.split(",") if "/" in i.strip()][:5]
    if not repo_ids:
        raise HTTPException(status_code=422, detail="Provide at least one valid owner/name id")

    results: list[CompareEntry] = []

    async with aiohttp.ClientSession() as session:
        for repo_id in repo_ids:
            owner, name = repo_id.split("/", 1)

            # Check tracked DB first
            repo = db.query(Repository).filter_by(id=repo_id).first()
            if repo:
                cm = (
                    db.query(ComputedMetric)
                    .filter_by(repo_id=repo_id)
                    .order_by(ComputedMetric.date.desc())
                    .first()
                )
                from app.models import DailyMetric
                dm = (
                    db.query(DailyMetric)
                    .filter_by(repo_id=repo_id)
                    .order_by(DailyMetric.captured_at.desc())
                    .first()
                )
                results.append(CompareEntry(
                    repo_id=repo_id,
                    owner=owner,
                    name=name,
                    description=repo.description,
                    github_url=repo.github_url,
                    primary_language=repo.primary_language,
                    current_stars=dm.stars if dm else 0,
                    current_forks=dm.forks if dm else 0,
                    age_days=repo.age_days,
                    trend_score=cm.trend_score if cm else None,
                    sustainability_score=cm.sustainability_score if cm else None,
                    sustainability_label=cm.sustainability_label if cm else None,
                    star_velocity_7d=cm.star_velocity_7d if cm else None,
                    acceleration=cm.acceleration if cm else None,
                    contributor_growth_rate=cm.contributor_growth_rate if cm else None,
                    fork_to_star_ratio=cm.fork_to_star_ratio if cm else None,
                    issue_close_rate=cm.issue_close_rate if cm else None,
                    is_tracked=True,
                ))
                continue

            # Untracked — fetch live from GitHub
            try:
                async with session.get(
                    f"https://api.github.com/repos/{repo_id}",
                    headers=_GH_HEADERS,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
                        raise HTTPException(status_code=404, detail=f"Repo {repo_id} not found")
                    data = await resp.json()
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"GitHub API error for {repo_id}: {e}")

            try:
                age = (
                    datetime.now(timezone.utc)
                    - datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
                ).days
            except Exception:
                age = 0

            results.append(CompareEntry(
                repo_id=repo_id,
                owner=owner,
                name=name,
                description=data.get("description") or "",
                github_url=data.get("html_url", f"https://github.com/{repo_id}"),
                primary_language=data.get("language"),
                current_stars=data.get("stargazers_count", 0),
                current_forks=data.get("forks_count", 0),
                age_days=age,
                is_tracked=False,
            ))

    return results


# ─── Compare: Star History Overlay ───────────────────────────────────────────

class RepoHistoryPoint(BaseModel):
    date: str
    stars: int
    daily_star_delta: int


class RepoHistory(BaseModel):
    repo_id: str
    owner: str
    name: str
    color_index: int
    history: List[RepoHistoryPoint]


@router.get("/compare/history", response_model=List[RepoHistory])
async def compare_history(
    ids: str = Query(
        ...,
        description="Comma-separated repo IDs: owner/name,owner2/name2 (max 5)",
    ),
    days: int = Query(30, description="Number of days of history to return", le=365),
    db: Session = Depends(get_db),
):
    """
    Returns day-by-day star history for 2–5 repos, used to render a
    time-series overlay chart in the comparison view.
    Only Repodar-tracked repos will have non-empty history arrays.
    """
    from app.models import DailyMetric as DM

    repo_ids = [i.strip() for i in ids.split(",") if "/" in i.strip()][:5]
    if not repo_ids:
        raise HTTPException(status_code=422, detail="Provide at least one valid owner/name id")

    since = datetime.now(timezone.utc).date() - timedelta(days=days)
    results: list[RepoHistory] = []

    for idx, repo_id in enumerate(repo_ids):
        owner, name = repo_id.split("/", 1)
        repo = db.query(Repository).filter_by(owner=owner, name=name).first()
        if not repo:
            results.append(RepoHistory(repo_id=repo_id, owner=owner, name=name, color_index=idx, history=[]))
            continue

        metrics = (
            db.query(DM)
            .filter(DM.repo_id == repo.id, DM.captured_at >= datetime.combine(since, datetime.min.time()))
            .order_by(DM.captured_at.asc())
            .all()
        )

        history = [
            RepoHistoryPoint(
                date=m.captured_at.strftime("%Y-%m-%d"),
                stars=m.stars,
                daily_star_delta=m.daily_star_delta,
            )
            for m in metrics
        ]
        results.append(RepoHistory(repo_id=repo_id, owner=owner, name=name, color_index=idx, history=history))

    return results


# ─── Deep Summary (must be before the /{repo_id:path} catch-all) ─────────────

class ContributorInfo(BaseModel):
    login: str
    avatar_url: str
    contributions: int
    profile_url: str


class DeepSummaryResponse(BaseModel):
    repo_id: str
    owner: str
    name: str
    what: str
    why: str
    how: str
    tech_stack: List[str]
    use_cases: List[str]
    contributors: List[ContributorInfo]
    languages: dict
    generated_at: str


@router.get("/{owner}/{name}/deep-summary", response_model=DeepSummaryResponse)
async def get_deep_summary(owner: str, name: str, db: Session = Depends(get_db)):
    """
    Returns a rich structured analysis of a repo: what/why/how, tech stack,
    use cases, top contributors, and language breakdown. Fetches live from
    GitHub API and generates analysis via Groq LLM.
    """
    repo_id = f"{owner}/{name}"

    # Get basic repo info from DB or GitHub
    repo = db.query(Repository).filter_by(id=repo_id).first()
    description = repo.description if repo else None
    primary_language = repo.primary_language if repo else None
    topics_str = repo.topics if repo else None

    async with aiohttp.ClientSession() as session:
        headers = _GH_HEADERS.copy()

        async def _fetch(url: str, accept: str = "application/vnd.github+json"):
            h = {**headers, "Accept": accept}
            try:
                async with session.get(url, headers=h, timeout=aiohttp.ClientTimeout(total=10)) as r:
                    if r.status == 200:
                        return await r.json()
                    return None
            except Exception:
                return None

        async def _fetch_text(url: str):
            try:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as r:
                    if r.status == 200:
                        return await r.text()
                    return ""
            except Exception:
                return ""

        # Fetch all in parallel
        languages_task = asyncio.create_task(_fetch(f"https://api.github.com/repos/{repo_id}/languages"))
        contrib_task = asyncio.create_task(_fetch(
            f"https://api.github.com/repos/{repo_id}/contributors?per_page=10&anon=false"
        ))
        readme_task = asyncio.create_task(_fetch_text(
            f"https://api.github.com/repos/{repo_id}/readme"
        ))
        # Also fetch repo info if not in DB
        repo_info_task = asyncio.create_task(_fetch(f"https://api.github.com/repos/{repo_id}")) if not repo else None

        languages_data, contrib_data, readme_raw = await asyncio.gather(
            languages_task, contrib_task, readme_task
        )
        if repo_info_task:
            gh_repo = await repo_info_task
            if gh_repo:
                description = description or gh_repo.get("description")
                primary_language = primary_language or gh_repo.get("language")
                if not topics_str:
                    topics_list = gh_repo.get("topics", [])
                    topics_str = ", ".join(topics_list) if topics_list else None

    languages = languages_data or {}
    # Decode README (GitHub returns base64-encoded content in JSON)
    readme_text = ""
    try:
        import json as _json
        readme_json = _json.loads(readme_raw) if readme_raw else {}
        if readme_json.get("encoding") == "base64":
            import base64
            readme_text = base64.b64decode(readme_json["content"]).decode("utf-8", errors="ignore")
        else:
            readme_text = readme_json.get("content", "")
    except Exception:
        readme_text = ""

    # Build contributor list
    contributors = []
    if isinstance(contrib_data, list):
        for c in contrib_data[:10]:
            if isinstance(c, dict) and c.get("type") == "User":
                contributors.append(ContributorInfo(
                    login=c.get("login", ""),
                    avatar_url=c.get("avatar_url", ""),
                    contributions=c.get("contributions", 0),
                    profile_url=c.get("html_url", f"https://github.com/{c.get('login', '')}"),
                ))

    # Parse topics
    github_topics: list = []
    if topics_str:
        try:
            import json as _j
            parsed = _j.loads(topics_str)
            github_topics = parsed if isinstance(parsed, list) else []
        except Exception:
            github_topics = [t.strip() for t in topics_str.split(",") if t.strip()]

    # Generate deep summary via LLM
    from app.services.explanation import generate_deep_summary
    analysis = generate_deep_summary(
        owner=owner,
        repo_name=name,
        description=description,
        language=primary_language,
        topics=topics_str,
        github_topics=github_topics,
        languages=languages,
        readme=readme_text,
    )

    return DeepSummaryResponse(
        repo_id=repo_id,
        owner=owner,
        name=name,
        what=analysis.get("what", ""),
        why=analysis.get("why", ""),
        how=analysis.get("how", ""),
        tech_stack=analysis.get("tech_stack", []),
        use_cases=analysis.get("use_cases", []),
        contributors=contributors,
        languages=languages,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ─── Repo Detail (must be last — uses :path which matches anything) ───────────

@router.get("/{repo_id:path}", response_model=RepoDetail)
async def get_repo(repo_id: str, db: Session = Depends(get_db)):
    """Get full repo detail. Checks DB first; falls back to live GitHub API for untracked repos."""
    repo = db.query(Repository).filter_by(id=repo_id).first()

    if repo:
        latest_cm = (
            db.query(ComputedMetric)
            .filter_by(repo_id=repo_id)
            .order_by(ComputedMetric.date.desc())
            .first()
        )
        return RepoDetail(
            id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            description=repo.description,
            github_url=repo.github_url,
            primary_language=repo.primary_language,
            age_days=repo.age_days,
            trend_score=latest_cm.trend_score if latest_cm else None,
            sustainability_score=latest_cm.sustainability_score if latest_cm else None,
            sustainability_label=latest_cm.sustainability_label if latest_cm else None,
            star_velocity_7d=latest_cm.star_velocity_7d if latest_cm else None,
            star_velocity_30d=latest_cm.star_velocity_30d if latest_cm else None,
            acceleration=latest_cm.acceleration if latest_cm else None,
            contributor_growth_rate=latest_cm.contributor_growth_rate if latest_cm else None,
            fork_to_star_ratio=latest_cm.fork_to_star_ratio if latest_cm else None,
            issue_close_rate=latest_cm.issue_close_rate if latest_cm else None,
            explanation=latest_cm.explanation if latest_cm else None,
            repo_summary=repo.repo_summary,
            repo_summary_generated_at=repo.repo_summary_generated_at.isoformat() if repo.repo_summary_generated_at else None,
        )

    # Not in DB — try fetching live from GitHub (for repos found via search but not yet tracked)
    if "/" not in repo_id:
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://api.github.com/repos/{repo_id}",
                headers=_GH_HEADERS,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=404, detail="Repository not found")
                gh = await resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")

    owner, name = repo_id.split("/", 1)
    try:
        age = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(gh["created_at"].replace("Z", "+00:00"))
        ).days
    except Exception:
        age = 0

    return RepoDetail(
        id=repo_id,
        owner=owner,
        name=name,
        category="untracked",
        description=gh.get("description"),
        github_url=gh.get("html_url", f"https://github.com/{repo_id}"),
        primary_language=gh.get("language"),
        age_days=age,
        trend_score=None,
        sustainability_score=None,
        sustainability_label=None,
        star_velocity_7d=None,
        star_velocity_30d=None,
        acceleration=None,
        contributor_growth_rate=None,
        fork_to_star_ratio=None,
        issue_close_rate=None,
        explanation=None,
        repo_summary=None,
        repo_summary_generated_at=None,
    )
