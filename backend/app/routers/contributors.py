"""
Contributor Network endpoints — cross-repo contributor intelligence.
Surfaces which people are simultaneously active across multiple hot repos,
and which repos share the most contributors.
"""

from typing import List, Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, ComputedMetric
from app.models.repo_contributor import RepoContributor

router = APIRouter(prefix="/contributors", tags=["Contributor Network"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CrossRepoContributor(BaseModel):
    login: str
    avatar_url: Optional[str]
    repo_count: int           # how many tracked repos this person is active in
    repos: List[dict]         # [{owner, name, contributions, trend_score}]
    total_contributions: int


class RepoWithContributors(BaseModel):
    repo_id: str
    owner: str
    name: str
    category: str
    trend_score: float
    contributor_count: int
    top_contributors: List[dict]   # [{login, contributions, avatar_url}]


class ContributorRepo(BaseModel):
    owner: str
    name: str
    category: str
    github_url: str
    trend_score: float
    contributions: int


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/network", response_model=List[CrossRepoContributor])
def get_contributor_network(
    min_repos: int = Query(2, description="Min repos a contributor must appear in to be listed"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns contributors who are active across multiple high-momentum repos.
    If the same engineers are committing to 3+ breakout projects simultaneously,
    that's a strong signal worth knowing.
    """
    from sqlalchemy import func

    latest_date = db.query(func.max(ComputedMetric.date)).scalar()
    score_map: dict[str, float] = {}
    if latest_date:
        for cm in db.query(ComputedMetric).filter_by(date=latest_date).all():
            score_map[cm.repo_id] = cm.trend_score or 0

    # Bucket: login → [{repo_id, owner, name, contributions}]
    contributor_repos: dict[str, list] = defaultdict(list)
    contributor_avatars: dict[str, str] = {}

    all_contributors = db.query(RepoContributor).all()
    repo_map = {r.id: r for r in db.query(Repository).filter(Repository.is_active == True).all()}  # noqa: E712

    for rc in all_contributors:
        repo = repo_map.get(rc.repo_id)
        if not repo:
            continue
        contributor_repos[rc.login].append({
            "repo_id": rc.repo_id,
            "owner": repo.owner,
            "name": repo.name,
            "contributions": rc.contributions,
            "trend_score": round(score_map.get(rc.repo_id, 0), 2),
        })
        if rc.avatar_url and rc.login not in contributor_avatars:
            contributor_avatars[rc.login] = rc.avatar_url

    results = []
    for login, repos in contributor_repos.items():
        if len(repos) < min_repos:
            continue
        repos_sorted = sorted(repos, key=lambda x: x["trend_score"], reverse=True)
        results.append(CrossRepoContributor(
            login=login,
            avatar_url=contributor_avatars.get(login),
            repo_count=len(repos),
            repos=[
                {"owner": r["owner"], "name": r["name"],
                 "contributions": r["contributions"], "trend_score": r["trend_score"]}
                for r in repos_sorted
            ],
            total_contributions=sum(r["contributions"] for r in repos),
        ))

    results.sort(key=lambda x: (x.repo_count, x.total_contributions), reverse=True)
    return results[:limit]


@router.get("/repos-by-contributor/{login}", response_model=List[ContributorRepo])
def get_repos_by_contributor(
    login: str = Path(..., description="GitHub username"),
    db: Session = Depends(get_db),
):
    """Return all tracked repos a given contributor is active in, sorted by TrendScore."""
    from sqlalchemy import func

    latest_date = db.query(func.max(ComputedMetric.date)).scalar()
    score_map: dict[str, float] = {}
    if latest_date:
        for cm in db.query(ComputedMetric).filter_by(date=latest_date).all():
            score_map[cm.repo_id] = cm.trend_score or 0

    rows = (
        db.query(RepoContributor, Repository)
        .join(Repository, RepoContributor.repo_id == Repository.id)
        .filter(RepoContributor.login == login)
        .all()
    )

    results = [
        ContributorRepo(
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            trend_score=round(score_map.get(rc.repo_id, 0), 2),
            contributions=rc.contributions,
        )
        for rc, repo in rows
    ]
    results.sort(key=lambda x: x.trend_score, reverse=True)
    return results


@router.get("/top-repos", response_model=List[RepoWithContributors])
def get_repos_with_top_contributors(
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
):
    """
    Returns top repos enriched with their contributor list.
    Useful to see who the key engineers are in each hot project.
    """
    from sqlalchemy import func

    latest_date = db.query(func.max(ComputedMetric.date)).scalar()
    score_map: dict[str, float] = {}
    if latest_date:
        for cm in db.query(ComputedMetric).filter_by(date=latest_date).all():
            score_map[cm.repo_id] = cm.trend_score or 0

    # Get repos that have contributor data
    repos_with_data = (
        db.query(Repository)
        .filter(Repository.is_active == True)  # noqa: E712
        .all()
    )

    results = []
    for repo in repos_with_data:
        contributors = (
            db.query(RepoContributor)
            .filter_by(repo_id=repo.id)
            .order_by(RepoContributor.contributions.desc())
            .limit(10)
            .all()
        )
        if not contributors:
            continue
        results.append(RepoWithContributors(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            trend_score=round(score_map.get(repo.id, 0), 2),
            contributor_count=len(contributors),
            top_contributors=[
                {"login": c.login, "contributions": c.contributions, "avatar_url": c.avatar_url}
                for c in contributors
            ],
        ))

    results.sort(key=lambda x: x.trend_score, reverse=True)
    return results[:limit]
