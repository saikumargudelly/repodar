"""
Recommendations Engine — deterministic, cosine similarity.

Phase 1: Topic-vector cosine similarity over user watchlist.
Phase 2: Collaborative filtering placeholder (additive, not breaking).

No external ML libs required — pure Python + standard library.
All functions are pure (no DB session) for testability.
"""

from __future__ import annotations

import json
import math
import logging
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ─── Types ─────────────────────────────────────────────────────────────────────

class RepoVector(BaseModel):
    """Minimal repo representation used for similarity computation."""
    repo_id:          str
    full_name:        str
    description:      Optional[str]
    primary_language: Optional[str]
    topics:           list[str]
    stars:            int
    category:         str


class RecommendedRepo(BaseModel):
    repo_id:          str
    full_name:        str
    description:      Optional[str]
    primary_language: Optional[str]
    topics:           list[str]
    stars:            int
    category:         str
    score:            float   # similarity score 0–1
    reason:           str     # human-readable explanation


# ─── Pure helper functions ─────────────────────────────────────────────────────

def _build_topic_set(rv: RepoVector) -> set[str]:
    """Combined feature set: topics + language + category."""
    features: set[str] = set()
    features.update(t.lower() for t in rv.topics)
    if rv.primary_language:
        features.add(f"lang:{rv.primary_language.lower()}")
    features.add(f"cat:{rv.category.lower()}")
    return features


def _cosine_similarity(a: set[str], b: set[str]) -> float:
    """Jaccard similarity as a proxy for cosine (no TF-IDF needed at this scale)."""
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union > 0 else 0.0


def _build_user_profile(watchlist: list[RepoVector]) -> set[str]:
    """Aggregate all features from user's watchlist into a single profile set."""
    profile: set[str] = set()
    for rv in watchlist:
        profile.update(_build_topic_set(rv))
    return profile


def _explain(candidate: RepoVector, profile: set[str]) -> str:
    """Generate a one-line explanation for why a repo was recommended."""
    candidate_feats = _build_topic_set(candidate)
    matched = profile & candidate_feats
    topics = [f for f in matched if not f.startswith("lang:") and not f.startswith("cat:")]
    lang = next((f.split(":")[1] for f in matched if f.startswith("lang:")), None)
    parts = []
    if topics:
        parts.append(f"similar topics: {', '.join(sorted(topics)[:3])}")
    if lang:
        parts.append(f"same language ({lang})")
    return "; ".join(parts) if parts else "related to your interests"


# ─── Main recommendation function (pure) ─────────────────────────────────────

def compute_recommendations(
    watchlist: list[RepoVector],
    candidates: list[RepoVector],
    top_n: int = 10,
    min_score: float = 0.05,
) -> list[RecommendedRepo]:
    """
    Return top_n RecommendedRepo objects not already in the watchlist.

    Args:
        watchlist:  repos the user has already saved/watched
        candidates: all repos to score against (usually all active repos)
        top_n:      max results to return
        min_score:  minimum similarity score threshold
    """
    if not watchlist or not candidates:
        return []

    watchlist_ids = {rv.repo_id for rv in watchlist}
    user_profile  = _build_user_profile(watchlist)

    scored = []
    for candidate in candidates:
        if candidate.repo_id in watchlist_ids:
            continue
        feats = _build_topic_set(candidate)
        score = _cosine_similarity(user_profile, feats)
        if score < min_score:
            continue
        scored.append((score, candidate))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        RecommendedRepo(
            repo_id=rv.repo_id,
            full_name=rv.full_name,
            description=rv.description,
            primary_language=rv.primary_language,
            topics=rv.topics,
            stars=rv.stars,
            category=rv.category,
            score=round(score, 4),
            reason=_explain(rv, user_profile),
        )
        for score, rv in scored[:top_n]
    ]


# ─── DB → RepoVector adapter ──────────────────────────────────────────────────

def repo_to_vector(repo) -> RepoVector:
    """Convert a SQLAlchemy Repository ORM object to a RepoVector."""
    topics = []
    if repo.topics:
        try:
            topics = json.loads(repo.topics)
        except Exception:
            pass
    return RepoVector(
        repo_id=repo.id,
        full_name=f"{repo.owner}/{repo.name}",
        description=repo.description,
        primary_language=repo.primary_language,
        topics=topics,
        stars=repo.stars_snapshot or 0,
        category=repo.category,
    )
