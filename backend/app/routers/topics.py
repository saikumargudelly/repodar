"""
Topic Intelligence endpoints — which GitHub topics are gaining momentum.
Aggregates topic tags from repositories with their latest TrendScores to
surface which techniques/frameworks are actually accelerating right now.
"""

import json
import logging
from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, ComputedMetric

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/topics", tags=["Topic Intelligence"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class TopicMomentum(BaseModel):
    topic: str
    repo_count: int
    avg_trend_score: float
    total_star_velocity: float
    avg_acceleration: float
    top_repos: List[dict]          # [{owner, name, trend_score, stars}]


class TopicRepo(BaseModel):
    repo_id: str
    owner: str
    name: str
    category: str
    github_url: str
    primary_language: Optional[str]
    age_days: int
    stars: int
    trend_score: float
    acceleration: float
    sustainability_label: str
    topics: List[str]


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/momentum", response_model=List[TopicMomentum])
def get_topic_momentum(
    min_repos: int = Query(2, description="Minimum repos per topic to be shown"),
    limit: int = Query(30, le=100),
    category: Optional[str] = Query(None, description="Filter by ecosystem category"),
    db: Session = Depends(get_db),
):
    """
    Returns topics ranked by composite momentum score.
    Each topic shows how many repos carry it, their combined star velocity,
    average TrendScore, and average acceleration.
    """
    latest_date = db.query(func.max(ComputedMetric.date)).scalar()

    # Build score map: repo_id → (trend_score, star_velocity_7d, acceleration)
    score_map: dict[str, tuple] = {}
    if latest_date:
        for cm in db.query(ComputedMetric).filter_by(date=latest_date).all():
            score_map[cm.repo_id] = (
                cm.trend_score or 0,
                cm.star_velocity_7d or 0,
                cm.acceleration or 0,
            )

    # Aggregate by topic
    topic_buckets: dict[str, list] = defaultdict(list)

    q = db.query(Repository).filter(
        Repository.is_active == True,  # noqa: E712
        Repository.topics.isnot(None),
    )
    if category:
        q = q.filter(Repository.category == category)

    for repo in q.all():
        try:
            topics = json.loads(repo.topics or "[]")
        except Exception:
            continue
        ts, vel, accel = score_map.get(repo.id, (0, 0, 0))
        for topic in topics:
            topic_buckets[topic].append({
                "owner": repo.owner,
                "name": repo.name,
                "trend_score": ts,
                "star_velocity_7d": vel,
                "acceleration": accel,
                "stars": repo.stars_snapshot or 0,
            })

    results = []
    for topic, repos in topic_buckets.items():
        if len(repos) < min_repos:
            continue
        avg_ts = sum(r["trend_score"] for r in repos) / len(repos)
        total_vel = sum(r["star_velocity_7d"] for r in repos)
        avg_accel = sum(r["acceleration"] for r in repos) / len(repos)

        top = sorted(repos, key=lambda x: x["trend_score"], reverse=True)[:5]

        results.append(TopicMomentum(
            topic=topic,
            repo_count=len(repos),
            avg_trend_score=round(avg_ts, 2),
            total_star_velocity=round(total_vel, 2),
            avg_acceleration=round(avg_accel, 4),
            top_repos=[
                {"owner": r["owner"], "name": r["name"],
                 "trend_score": round(r["trend_score"], 2),
                 "stars": r["stars"]}
                for r in top
            ],
        ))

    # Sort by composite: weighed sum of trend score + acceleration signal
    results.sort(key=lambda x: x.avg_trend_score * 0.6 + x.avg_acceleration * 40, reverse=True)
    return results[:limit]


@router.get("/{topic}/repos", response_model=List[TopicRepo])
def get_repos_by_topic(
    topic: str,
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
):
    """Return all repos that carry a specific GitHub topic tag, sorted by TrendScore."""
    latest_date = db.query(func.max(ComputedMetric.date)).scalar()

    score_map: dict[str, tuple] = {}
    if latest_date:
        for cm in db.query(ComputedMetric).filter_by(date=latest_date).all():
            score_map[cm.repo_id] = (
                cm.trend_score or 0,
                cm.star_velocity_7d or 0,
                cm.acceleration or 0,
                cm.sustainability_label or "YELLOW",
            )

    results = []
    for repo in db.query(Repository).filter(
        Repository.is_active == True,  # noqa: E712
        Repository.topics.isnot(None),
    ).all():
        try:
            topics = json.loads(repo.topics or "[]")
        except Exception:
            continue
        if topic.lower() not in [t.lower() for t in topics]:
            continue

        ts, vel, accel, sl = score_map.get(repo.id, (0, 0, 0, "YELLOW"))
        results.append(TopicRepo(
            repo_id=repo.id,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            github_url=repo.github_url,
            primary_language=repo.primary_language,
            age_days=repo.age_days,
            stars=repo.stars_snapshot or 0,
            trend_score=ts,
            acceleration=accel,
            sustainability_label=sl,
            topics=topics,
        ))

    results.sort(key=lambda x: x.trend_score, reverse=True)
    return results[:limit]
