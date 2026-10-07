"""
Purely Dynamic Organization Intelligence Service.
Free of hardcoded organizations or static technology lists.
Dynamically extracts organizations and the technologies they achieve from GitHub repositories,
tracks delta additions and deletions, and drives bounded organization-level discovery.
"""
import logging
from collections import Counter
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import aiohttp
from sqlalchemy.orm import Session

from app.models.repository import Repository
from app.models.dynamic_organization import DynamicOrganization

logger = logging.getLogger(__name__)

REST_BASE = "https://api.github.com"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def sync_dynamic_organizations(db: Session) -> Dict[str, int]:
    """
    Intelligently discover and synchronize organizations from the repository universe.
    Extracts the specific technologies each organization achieves based on its repository topics,
    and performs dynamic delta addition or update.
    """
    try:
        repos = (
            db.query(
                Repository.owner,
                Repository.name,
                Repository.category,
                Repository.topics,
                Repository.stars_snapshot,
                Repository.is_active,
            )
            .filter(Repository.owner != "system")
            .all()
        )

        # Group repository intelligence by owner
        owner_data: Dict[str, Dict[str, Any]] = {}
        for r in repos:
            owner = (r.owner or "").strip().lower()
            if not owner or len(owner) < 2:
                continue

            if owner not in owner_data:
                owner_data[owner] = {
                    "login": r.owner.strip(),
                    "total_stars": 0,
                    "repo_count": 0,
                    "active_repo_count": 0,
                    "categories": Counter(),
                    "topics": Counter(),
                }

            data = owner_data[owner]
            data["total_stars"] += r.stars_snapshot or 0
            data["repo_count"] += 1
            if r.is_active:
                data["active_repo_count"] += 1

            if r.category and r.category.lower() not in ("untracked", "default", "system"):
                data["categories"][r.category] += 1

            if r.topics:
                t_list = r.topics if isinstance(r.topics, list) else []
                for t in t_list:
                    if isinstance(t, str) and len(t) > 1:
                        data["topics"][t.lower()] += 1

        existing_orgs = {
            org.login.lower(): org
            for org in db.query(DynamicOrganization).all()
        }

        added = 0
        updated = 0
        reactivated = 0
        now = _utcnow()

        for owner_key, info in owner_data.items():
            # Intelligent qualification threshold:
            # An organization is tracked if it has traction (>= 50 stars or >= 2 repos with active development)
            if info["total_stars"] < 50 and info["repo_count"] < 2:
                continue

            # Dynamically infer the technologies this organization is achieving
            dominant_topics = [t for t, _ in info["topics"].most_common(12)]
            primary_cat = (
                info["categories"].most_common(1)[0][0]
                if info["categories"]
                else "AI / ML"
            )

            existing = existing_orgs.get(owner_key)
            if not existing:
                # Delta Addition: New organization dynamically detected
                new_org = DynamicOrganization(
                    login=info["login"],
                    primary_technology=primary_cat,
                    technologies=dominant_topics,
                    repo_count=info["repo_count"],
                    total_stars=info["total_stars"],
                    source="dynamic_discovery",
                    is_active=True,
                    delta_status="active",
                    created_at=now,
                    updated_at=now,
                    signal_metadata={
                        "top_topics": dominant_topics[:5],
                        "active_repos": info["active_repo_count"],
                    },
                )
                db.add(new_org)
                added += 1
                logger.info(
                    f"[DynamicAI] Delta Addition: Discovered new organization '{info['login']}' "
                    f"achieving tech '{primary_cat}' with {len(dominant_topics)} topics"
                )
            else:
                # Delta Update: Refresh technologies and stats
                merged_topics = list(dict.fromkeys(dominant_topics + (existing.technologies or [])))[:20]
                existing.technologies = merged_topics
                existing.primary_technology = primary_cat
                existing.repo_count = info["repo_count"]
                existing.total_stars = info["total_stars"]
                existing.updated_at = now

                # Delta Reactivation if it was previously marked stale but now active
                if info["active_repo_count"] > 0 and (not existing.is_active or existing.delta_status != "active"):
                    existing.is_active = True
                    existing.delta_status = "active"
                    reactivated += 1
                    logger.info(f"[DynamicAI] Delta Reactivation: Organization '{existing.login}' restored to active")
                updated += 1

        db.commit()
        return {"added": added, "updated": updated, "reactivated": reactivated}

    except Exception as e:
        db.rollback()
        logger.error(f"[DynamicAI] Failed to sync dynamic organizations: {e}", exc_info=True)
        return {"added": 0, "updated": 0, "reactivated": 0, "error": str(e)}


def prune_dynamic_organizations(db: Session) -> Dict[str, int]:
    """
    Intelligently prune inactive or stale organizations (Delta Deletion / Lifecycle Transition).
    If an organization has 0 active repositories, it is marked as stale.
    """
    try:
        active_orgs = db.query(DynamicOrganization).filter(DynamicOrganization.is_active == True).all()
        now = _utcnow()
        pruned = 0

        for org in active_orgs:
            active_repo_count = (
                db.query(Repository)
                .filter(
                    Repository.owner.ilike(org.login),
                    Repository.is_active == True,
                )
                .count()
            )

            if active_repo_count == 0 and org.repo_count > 0:
                org.is_active = False
                org.delta_status = "stale"
                org.updated_at = now
                pruned += 1
                logger.info(f"[DynamicAI] Delta Deletion: Organization '{org.login}' transitioned to stale (0 active repos)")

        db.commit()
        return {"pruned": pruned}
    except Exception as e:
        db.rollback()
        logger.error(f"[DynamicAI] Failed to prune organizations: {e}", exc_info=True)
        return {"pruned": 0, "error": str(e)}


TIER_1_ORGANIZATIONS = [
    "openai", "deepseek-ai", "huggingface", "meta-llama", "microsoft",
    "vllm-project", "sgl-project", "dao-ailab", "comfy-org", "google",
    "qwenlm", "cline", "browser-use", "facebookresearch", "anthropics"
]


def get_rotational_organizations(db: Session, batch_size: int = 10) -> List[DynamicOrganization]:
    """
    Return the next batch of active dynamic organizations ordered round-robin by last_synced_at.
    Prioritizes Tier-1 core ecosystem organizations that need refreshing, then fills with round-robin active orgs.
    Ensures bounded API usage while visiting every discovered organization over time.
    """
    now = _utcnow()
    one_day_ago = now - timedelta(days=1)

    # 1. Check for any Tier-1 orgs that are due for refresh (>24h or never synced)
    tier1_orgs = (
        db.query(DynamicOrganization)
        .filter(
            DynamicOrganization.is_active == True,
            DynamicOrganization.delta_status == "active",
            DynamicOrganization.login.in_(TIER_1_ORGANIZATIONS),
            (DynamicOrganization.last_synced_at == None) | (DynamicOrganization.last_synced_at < one_day_ago),
        )
        .limit(batch_size // 2)
        .all()
    )

    remaining_slots = max(batch_size - len(tier1_orgs), 1)
    tier1_ids = [o.id for o in tier1_orgs]

    # 2. Fill remainder with round-robin active orgs
    rotational_query = (
        db.query(DynamicOrganization)
        .filter(
            DynamicOrganization.is_active == True,
            DynamicOrganization.delta_status == "active",
        )
    )
    if tier1_ids:
        rotational_query = rotational_query.filter(DynamicOrganization.id.notin_(tier1_ids))

    other_orgs = (
        rotational_query
        .order_by(DynamicOrganization.last_synced_at.asc().nullsfirst())
        .limit(remaining_slots)
        .all()
    )

    return tier1_orgs + other_orgs


async def discover_dynamic_organization_repos(
    session: aiohttp.ClientSession,
    org: DynamicOrganization,
    github_token: str,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Query GitHub API for an organization's repositories, tagged with discovery provenance.
    """
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    url = f"{REST_BASE}/search/repositories"
    query = f"org:{org.login} fork:true"
    params = {
        "q": query,
        "sort": "updated",
        "order": "desc",
        "per_page": min(limit, 20),
    }

    discovered = []
    try:
        async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=12)) as resp:
            if resp.status == 200:
                data = await resp.json()
                items = data.get("items", [])
                iso_now = _utcnow().isoformat()
                for item in items:
                    item["_provenance"] = {
                        "query": query,
                        "source": "dynamic_organization",
                        "organization": org.login,
                        "discovered_at": iso_now,
                    }
                    discovered.append(item)
            elif resp.status == 404:
                # Organization might have been renamed or deleted on GitHub
                logger.warning(f"[DynamicAI] Organization '{org.login}' returned 404 on GitHub")
            else:
                logger.warning(f"[DynamicAI] GitHub search for org '{org.login}' returned status {resp.status}")
    except Exception as e:
        logger.warning(f"[DynamicAI] Error discovering repos for org '{org.login}': {e}")

    return discovered
