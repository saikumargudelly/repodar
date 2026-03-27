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
from app.utils.db import get_latest_metric_subquery

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

    cm_subq = get_latest_metric_subquery(db)

    # 1. Identify high-value contributors directly in SQL
    # Group by login, count distinct active repos they've contributed to.
    top_logins_q = (
        db.query(
            RepoContributor.login,
            func.max(RepoContributor.avatar_url).label("avatar_url"),
            func.count(func.distinct(RepoContributor.repo_id)).label("repo_count"),
            func.sum(RepoContributor.contributions).label("total_contributions"),
        )
        .join(Repository, RepoContributor.repo_id == Repository.id)
        .filter(Repository.is_active == True)  # noqa: E712
        .group_by(RepoContributor.login)
        .having(func.count(func.distinct(RepoContributor.repo_id)) >= min_repos)
        .order_by(
            func.count(func.distinct(RepoContributor.repo_id)).desc(),
            func.sum(RepoContributor.contributions).desc()
        )
        .limit(limit)
    )

    top_contributors = top_logins_q.all()
    if not top_contributors:
        return []

    # 2. Fetch the repo details *only* for the identified top contributors
    logins = [c.login for c in top_contributors]

    repo_details_q = (
        db.query(
            RepoContributor.login,
            RepoContributor.contributions,
            Repository.owner,
            Repository.name,
            cm_subq.c.trend_score,
        )
        .join(Repository, RepoContributor.repo_id == Repository.id)
        .outerjoin(cm_subq, Repository.id == cm_subq.c.repo_id)
        .filter(
            RepoContributor.login.in_(logins),
            Repository.is_active == True  # noqa: E712
        )
    )

    repo_details = repo_details_q.all()

    # Bucket them into the final response shape
    repos_by_login = defaultdict(list)
    for row in repo_details:
        repos_by_login[row.login].append({
            "owner": row.owner,
            "name": row.name,
            "contributions": row.contributions,
            "trend_score": float(row.trend_score) if row.trend_score is not None else 0.0,
        })

    results = []
    for c in top_contributors:
        repos = repos_by_login[c.login]
        repos.sort(key=lambda x: x["trend_score"], reverse=True)
        results.append(CrossRepoContributor(
            login=c.login,
            avatar_url=c.avatar_url,
            repo_count=c.repo_count,
            repos=repos,
            total_contributions=c.total_contributions,
        ))

    return results


@router.get("/repos-by-contributor/{login}", response_model=List[ContributorRepo])
def get_repos_by_contributor(
    login: str = Path(..., description="GitHub username"),
    db: Session = Depends(get_db),
):
    """Return all tracked repos a given contributor is active in, sorted by TrendScore."""
    cm_subq = get_latest_metric_subquery(db)

    rows = (
        db.query(
            RepoContributor.contributions,
            Repository.owner,
            Repository.name,
            Repository.category,
            Repository.github_url,
            cm_subq.c.trend_score,
        )
        .join(Repository, RepoContributor.repo_id == Repository.id)
        .outerjoin(cm_subq, Repository.id == cm_subq.c.repo_id)
        .filter(
            RepoContributor.login == login,
            Repository.is_active == True  # noqa: E712
        )
        .all()
    )

    results = [
        ContributorRepo(
            owner=row.owner,
            name=row.name,
            category=row.category,
            github_url=row.github_url,
            trend_score=round(float(row.trend_score), 2) if row.trend_score is not None else 0.0,
            contributions=row.contributions,
        )
        for row in rows
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

    cm_subq = get_latest_metric_subquery(db)

    # 1. Fetch top active repos ranked directly via the subquery
    top_repos_q = (
        db.query(
            Repository.id,
            Repository.owner,
            Repository.name,
            Repository.category,
            cm_subq.c.trend_score
        )
        .outerjoin(cm_subq, Repository.id == cm_subq.c.repo_id)
        .filter(Repository.is_active == True)  # noqa: E712
        .order_by(cm_subq.c.trend_score.desc().nullslast())
        .limit(limit)
    )

    top_repos = top_repos_q.all()
    if not top_repos:
        return []

    repo_ids = [r.id for r in top_repos]

    # 2. Fetch the top 10 contributors using a window function partitioned by repo id
    # (or simply fetch all contributors for these few repos and slice in Python)
    repo_contributors = (
        db.query(RepoContributor)
        .filter(RepoContributor.repo_id.in_(repo_ids))
        .all()
    )

    contribs_by_repo = defaultdict(list)
    for c in repo_contributors:
        contribs_by_repo[c.repo_id].append(c)

    results = []
    for r in top_repos:
        # Sort and take top 10 for this repo
        repo_contribs = sorted(contribs_by_repo[r.id], key=lambda x: x.contributions, reverse=True)[:10]

        results.append(RepoWithContributors(
            repo_id=r.id,
            owner=r.owner,
            name=r.name,
            category=r.category,
            trend_score=round(float(r.trend_score), 2) if r.trend_score is not None else 0.0,
            contributor_count=len(contribs_by_repo[r.id]),  # Total un-sliced count
            top_contributors=[
                {"login": c.login, "contributions": c.contributions, "avatar_url": c.avatar_url}
                for c in repo_contribs
            ],
        ))

    return results
