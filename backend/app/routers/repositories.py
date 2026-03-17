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

from typing import TypeVar, Generic

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    per_page: int
    total_pages: int

from fastapi_cache.decorator import cache

@router.get("", response_model=PaginatedResponse[RepoSummary])
@cache(expire=300)
def list_repos(
    category: Optional[str] = Query(None, description="Filter by ecosystem category"),
    sort_by: str = Query("trend_score", description="trend_score | sustainability_score | stars"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    """List all repos with their latest computed scores."""
    from datetime import date
    today = date.today()

    from sqlalchemy import func, and_

    count_query = db.query(Repository)
    if category:
        count_query = count_query.filter(Repository.category == category)
    total_count = count_query.count()

    latest_cm_subq = (
        db.query(
            Repository.id.label('repo_id'),
            func.max(ComputedMetric.date).label('max_date')
        )
        .outerjoin(ComputedMetric, Repository.id == ComputedMetric.repo_id)
        .group_by(Repository.id)
        .subquery()
    )

    query = (
        db.query(Repository, ComputedMetric)
        .outerjoin(latest_cm_subq, Repository.id == latest_cm_subq.c.repo_id)
        .outerjoin(ComputedMetric, and_(
            Repository.id == ComputedMetric.repo_id,
            ComputedMetric.date == latest_cm_subq.c.max_date
        ))
    )

    if category:
        query = query.filter(Repository.category == category)

    if sort_by == "trend_score":
        query = query.order_by(ComputedMetric.trend_score.desc().nullslast())
    elif sort_by == "sustainability_score":
        query = query.order_by(ComputedMetric.sustainability_score.desc().nullslast())

    offset = (page - 1) * per_page
    db_results = query.offset(offset).limit(per_page).all()

    results = []
    for repo, latest_cm in db_results:
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

    total_pages = (total_count + per_page - 1) // per_page
    return PaginatedResponse(
        items=results,
        total=total_count,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


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


from fastapi import Path

@router.get("/{owner}/{name}/deep-summary", response_model=DeepSummaryResponse)
async def get_deep_summary(
    owner: str = Path(..., pattern=r"^[A-Za-z0-9_.-]+$"),
    name: str = Path(..., pattern=r"^[A-Za-z0-9_.-]+$"),
    db: Session = Depends(get_db)
):
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
    # Try by UUID id first
    repo = db.query(Repository).filter_by(id=repo_id).first()

    # Try by owner/name (frontend navigates via /repo/owner/name, but DB id is a UUID)
    if not repo and "/" in repo_id:
        parts = repo_id.split("/", 1)
        repo = db.query(Repository).filter_by(owner=parts[0], name=parts[1]).first()

    if repo:
        latest_cm = (
            db.query(ComputedMetric)
            .filter_by(repo_id=repo.id)
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


# ─── Delta-run: on-demand full fetch + score for an untracked repo ────────────

@router.post("/{owner}/{name}/delta-run", response_model=RepoDetail)
async def delta_run_repo(
    owner: str,
    name: str,
    db: Session = Depends(get_db),
):
    """
    On-demand delta fetch for a repo not yet tracked in the DB.
    1. Upserts the repo into repositories table (source='on_demand').
    2. Fetches live metrics from GitHub (GraphQL + REST).
    3. Writes a DailyMetric row.
    4. Computes and writes a ComputedMetric row with inline scoring.
    5. Returns full RepoDetail with all scores populated.

    Safe to call multiple times — always upserts, never duplicates today's metric.
    """
    import json as _json
    import uuid as _uuid
    from app.models import DailyMetric, ComputedMetric as CM
    from app.services.github_client import fetch_repo_metrics

    repo_id = f"{owner}/{name}"
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end   = datetime.combine(today, datetime.max.time())

    # ── 1. Upsert repo record ─────────────────────────────────────────────────
    repo = db.query(Repository).filter_by(owner=owner, name=name).first()

    # Fetch basic repo info from GitHub to fill metadata
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.get(
                f"https://api.github.com/repos/{repo_id}",
                headers=_GH_HEADERS,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=404, detail=f"GitHub repo {repo_id} not found")
                gh_data = await resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")

    created_at_str = gh_data.get("created_at", "")
    try:
        age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))).days
    except Exception:
        age_days = 0

    # Infer category from topics/description
    topics_list = gh_data.get("topics", [])
    inferred_category = "general"
    topic_set = set(t.lower() for t in topics_list)
    desc_lower = (gh_data.get("description") or "").lower()
    # Simple heuristic — same logic as _infer_category in github_search.py
    if any(t in topic_set for t in ["machine-learning", "llm", "deep-learning", "ai", "nlp", "computer-vision"]) or any(w in desc_lower for w in ["llm", "ai ", "ml ", "machine learning"]):
        inferred_category = "ai_ml"
    elif any(t in topic_set for t in ["javascript", "typescript", "react", "vue", "angular", "nextjs"]) or any(w in desc_lower for w in ["web", "frontend", "mobile", "react", "vue"]):
        inferred_category = "web_mobile"
    elif any(t in topic_set for t in ["kubernetes", "docker", "terraform", "database", "kafka"]) or any(w in desc_lower for w in ["infrastructure", "database", "devops", "kubernetes"]):
        inferred_category = "data_infra"
    elif any(t in topic_set for t in ["security", "cryptography", "pentest"]) or "security" in desc_lower:
        inferred_category = "security"
    elif any(t in topic_set for t in ["blockchain", "ethereum", "solidity", "web3"]) or "blockchain" in desc_lower:
        inferred_category = "blockchain"

    if not repo:
        repo = Repository(
            id=str(_uuid.uuid4()),
            owner=owner,
            name=name,
            category=inferred_category,
            description=(gh_data.get("description") or "")[:500],
            github_url=gh_data.get("html_url", f"https://github.com/{repo_id}"),
            primary_language=gh_data.get("language"),
            source="on_demand",
            is_active=True,
            age_days=age_days,
            discovered_at=now,
            last_seen_trending=now,
        )
        if topics_list:
            repo.topics = _json.dumps(topics_list)
        db.add(repo)
        db.flush()  # get repo.id assigned
    else:
        # Update stale metadata
        repo.age_days = age_days
        repo.is_active = True
        repo.last_seen_trending = now
        if gh_data.get("language") and not repo.primary_language:
            repo.primary_language = gh_data["language"]

    # ── 2. Fetch live GitHub metrics ─────────────────────────────────────────
    metrics_list = await fetch_repo_metrics([{"id": repo.id, "owner": owner, "name": name}])
    if not metrics_list:
        db.rollback()
        raise HTTPException(status_code=502, detail="GitHub metric fetch returned no data")
    m = metrics_list[0]

    stars = m.get("stars", 0)
    forks = m.get("forks", 0)
    watchers = m.get("watchers", 0)
    open_issues = m.get("open_issues", 0)
    contributors = m.get("contributors", 0)
    merged_prs = m.get("merged_prs", 0)
    releases = m.get("releases", 0)
    commit_count = m.get("commit_count", 0)
    lang_breakdown = m.get("language_breakdown", {})
    if m.get("primary_language"):
        repo.primary_language = m["primary_language"]
    if m.get("topics"):
        repo.topics = _json.dumps(m["topics"])
    repo.stars_snapshot = stars
    repo.last_fetched_at = now

    # ── 3. Upsert DailyMetric ─────────────────────────────────────────────────
    existing_dm = db.query(DailyMetric).filter(
        DailyMetric.repo_id == repo.id,
        DailyMetric.captured_at >= today_start,
        DailyMetric.captured_at < today_end,
    ).first()

    # Delta vs previous day
    prev_dm = (
        db.query(DailyMetric)
        .filter(DailyMetric.repo_id == repo.id, DailyMetric.captured_at < today_start)
        .order_by(DailyMetric.captured_at.desc())
        .first()
    )
    daily_star_delta = max(stars - (prev_dm.stars if prev_dm else stars), 0)

    if existing_dm:
        existing_dm.captured_at = now
        existing_dm.stars = stars
        existing_dm.forks = forks
        existing_dm.watchers = watchers
        existing_dm.contributors = contributors
        existing_dm.open_issues = open_issues
        existing_dm.merged_prs = merged_prs
        existing_dm.releases = releases
        existing_dm.commit_count = commit_count
        existing_dm.daily_star_delta = daily_star_delta
        existing_dm.language_breakdown = _json.dumps(lang_breakdown)
    else:
        new_dm = DailyMetric(
            repo_id=repo.id,
            captured_at=now,
            stars=stars,
            forks=forks,
            watchers=watchers,
            contributors=contributors,
            open_issues=open_issues,
            open_prs=m.get("open_prs", 0),
            merged_prs=merged_prs,
            releases=releases,
            commit_count=commit_count,
            daily_star_delta=daily_star_delta,
            daily_fork_delta=0,
            daily_pr_delta=0,
            daily_commit_delta=0,
            language_breakdown=_json.dumps(lang_breakdown),
        )
        db.add(new_dm)

    # ── 4. Compute and upsert basic ComputedMetric ────────────────────────────
    # For brand-new repos with only one data point, we compute what we can.
    star_velocity_7d = float(daily_star_delta)  # best single-day proxy
    fork_to_star_ratio = round(forks / max(stars, 1), 4)
    issue_ratio = open_issues / max(stars, 1)
    # Sustainability heuristic (simplified version of the full scorer)
    fork_norm    = min(1.0, fork_to_star_ratio / 0.20)
    issue_norm   = max(0.0, 1.0 - min(issue_ratio, 1.0))
    age_norm     = min(1.0, age_days / 730.0)
    release_norm = min(1.0, releases / 20.0)
    contrib_norm = min(1.0, contributors / 100.0)
    sustain_score = (
        0.30 * fork_norm + 0.20 * issue_norm +
        0.20 * age_norm + 0.15 * release_norm + 0.15 * contrib_norm
    )
    sustain_label = (
        "HIGH" if sustain_score >= 0.60 else
        "MEDIUM" if sustain_score >= 0.30 else
        "LOW"
    )
    # Trend score: star velocity / age (normalised)
    vel_daily = max(stars / max(age_days, 1), 0.0)
    trend_score = round(min(1.0, vel_daily / 50.0), 6)

    existing_cm = (
        db.query(CM)
        .filter_by(repo_id=repo.id, date=today)
        .first()
    )
    if existing_cm:
        existing_cm.trend_score = trend_score
        existing_cm.sustainability_score = round(sustain_score, 4)
        existing_cm.sustainability_label = sustain_label
        existing_cm.star_velocity_7d = star_velocity_7d
        existing_cm.star_velocity_30d = star_velocity_7d
        existing_cm.acceleration = 0.0
        existing_cm.fork_to_star_ratio = fork_to_star_ratio
        existing_cm.contributor_growth_rate = 0.0
        existing_cm.issue_close_rate = 0.0
    else:
        db.add(CM(
            repo_id=repo.id,
            date=today,
            trend_score=trend_score,
            sustainability_score=round(sustain_score, 4),
            sustainability_label=sustain_label,
            star_velocity_7d=star_velocity_7d,
            star_velocity_30d=star_velocity_7d,
            acceleration=0.0,
            fork_to_star_ratio=fork_to_star_ratio,
            contributor_growth_rate=0.0,
            issue_close_rate=0.0,
        ))

    db.commit()

    return RepoDetail(
        id=repo.id,
        owner=owner,
        name=name,
        category=repo.category,
        description=repo.description,
        github_url=repo.github_url,
        primary_language=repo.primary_language,
        age_days=age_days,
        trend_score=trend_score,
        sustainability_score=round(sustain_score, 4),
        sustainability_label=sustain_label,
        star_velocity_7d=star_velocity_7d,
        star_velocity_30d=star_velocity_7d,
        acceleration=0.0,
        contributor_growth_rate=0.0,
        fork_to_star_ratio=fork_to_star_ratio,
        issue_close_rate=0.0,
        explanation=None,
        repo_summary=repo.repo_summary,
        repo_summary_generated_at=repo.repo_summary_generated_at.isoformat() if repo.repo_summary_generated_at else None,
    )

