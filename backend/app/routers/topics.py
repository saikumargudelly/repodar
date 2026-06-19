"""
Topic Intelligence endpoints — which GitHub topics are gaining momentum.
Aggregates topic tags from repositories with their latest TrendScores to
surface which techniques/frameworks are actually accelerating right now.
"""

import json
import logging
from collections import defaultdict
from typing import List, Optional
import asyncio

from fastapi import APIRouter, Depends, Query
from fastapi_cache.decorator import cache
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
@cache(expire=300, namespace="topic")
async def get_topic_momentum(
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
    def _fetch_data():
        latest_date = db.query(func.max(ComputedMetric.date)).scalar()

        # Build score map: repo_id → (trend_score, star_velocity_7d, acceleration)
        score_map: dict[str, tuple] = {}
        if latest_date:
            for repo_id, trend_score, star_velocity_7d, acceleration in (
                db.query(
                    ComputedMetric.repo_id,
                    ComputedMetric.trend_score,
                    ComputedMetric.star_velocity_7d,
                    ComputedMetric.acceleration
                )
                .filter_by(date=latest_date)
                .all()
            ):
                score_map[repo_id] = (
                    trend_score or 0,
                    star_velocity_7d or 0,
                    acceleration or 0,
                )

        q = db.query(
            Repository.id,
            Repository.topics,
            Repository.owner,
            Repository.name,
            Repository.stars_snapshot
        ).filter(
            Repository.is_active == True,  # noqa: E712
            Repository.topics.isnot(None),
        )
        if category:
            q = q.filter(Repository.category == category)
            
        return score_map, q.all()

    score_map, repos_rows = await asyncio.to_thread(_fetch_data)

    # Aggregate by topic
    topic_buckets: dict[str, list] = defaultdict(list)

    for repo_id, topics_raw, owner, name, stars_snapshot in repos_rows:
        try:
            topics = json.loads(topics_raw or "[]")
        except Exception:
            continue
        ts, vel, accel = score_map.get(repo_id, (0, 0, 0))
        for topic in topics:
            topic_buckets[topic].append({
                "owner": owner,
                "name": name,
                "trend_score": ts,
                "star_velocity_7d": vel,
                "acceleration": accel,
                "stars": stars_snapshot or 0,
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
@cache(expire=300, namespace="topic")
async def get_repos_by_topic(
    topic: str,
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
):
    """Return all repos that carry a specific GitHub topic tag, sorted by TrendScore."""
    def _fetch_data():
        latest_date = db.query(func.max(ComputedMetric.date)).scalar()

        score_map: dict[str, tuple] = {}
        if latest_date:
            for repo_id, trend_score, star_velocity_7d, acceleration, sustainability_label in (
                db.query(
                    ComputedMetric.repo_id,
                    ComputedMetric.trend_score,
                    ComputedMetric.star_velocity_7d,
                    ComputedMetric.acceleration,
                    ComputedMetric.sustainability_label
                )
                .filter_by(date=latest_date)
                .all()
            ):
                score_map[repo_id] = (
                    trend_score or 0,
                    star_velocity_7d or 0,
                    acceleration or 0,
                    sustainability_label or "YELLOW",
                )

        # Filter in SQL first, and select only needed columns
        q = (
            db.query(
                Repository.id,
                Repository.owner,
                Repository.name,
                Repository.category,
                Repository.github_url,
                Repository.primary_language,
                Repository.age_days,
                Repository.stars_snapshot,
                Repository.topics,
            )
            .filter(
                Repository.is_active == True,  # noqa: E712
                Repository.topics.isnot(None),
                func.lower(Repository.topics).like(f'%"{topic.lower()}"%'),
            )
        )
        return score_map, q.all()

    score_map, repos_rows = await asyncio.to_thread(_fetch_data)

    results = []
    for repo_id, owner, name, category, github_url, primary_language, age_days, stars_snapshot, topics_raw in repos_rows:
        try:
            topics = json.loads(topics_raw or "[]")
        except Exception:
            continue
        # Double check topic to ensure exact match
        if topic.lower() not in [t.lower() for t in topics]:
            continue

        ts, vel, accel, sl = score_map.get(repo_id, (0, 0, 0, "YELLOW"))
        results.append(TopicRepo(
            repo_id=repo_id,
            owner=owner,
            name=name,
            category=category,
            github_url=github_url,
            primary_language=primary_language,
            age_days=age_days or 0,
            stars=stars_snapshot or 0,
            trend_score=ts,
            acceleration=accel,
            sustainability_label=sl,
            topics=topics,
        ))

    results.sort(key=lambda x: x.trend_score, reverse=True)
    return results[:limit]
