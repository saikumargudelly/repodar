"""
Ecosystem API Router.
Exposes endpoints for ecosystem mapping, alternatives, and companion technologies.
"""

import json
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.repository import Repository
from app.services.ecosystem import (
    EcosystemClassifier,
    RelationshipGraphEngine,
    EcosystemStrengthScorer,
    EcosystemReportGenerator
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="", tags=["Ecosystem"])


def _find_repo_by_ref(ref: str, db: Session) -> Repository:
    """Helper to locate a repository by full_name (owner/name) or name or ID."""
    if "/" in ref:
        parts = ref.split("/", 1)
        owner, name = parts[0], parts[1]
        r = db.query(Repository).filter_by(owner=owner, name=name).first()
    else:
        r = db.query(Repository).filter(
            (Repository.name == ref) | (Repository.id == ref)
        ).first()

    if not r:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{ref}' not found in Repodar database."
        )
    return r


async def _ensure_ecosystem_cached(repo: Repository, db: Session) -> Dict[str, Any]:
    """Ensures that classification and relationship maps are cached in the DB."""
    if not repo.categories or not repo.ecosystem_data_json:
        logger.info(f"Ecosystem cache miss for {repo.owner}/{repo.name} — classifying now...")
        
        # 1. Run classifier
        categories = EcosystemClassifier.classify_repo(repo)
        repo.categories = categories

        # 2. Build relationship graph
        graph = await RelationshipGraphEngine.build_relationships(repo, db)
        
        # Cache to database JSONB columns
        repo.ecosystem_data_json = {
            "relationships": graph["relationships"]
        }
        db.commit()
        db.refresh(repo)

    return {
        "categories": repo.categories,
        "relationships": repo.ecosystem_data_json.get("relationships") or []
    }


@router.get("/ecosystem/{repo:path}")
async def get_ecosystem_map(
    repo: str = Path(..., description="Repository full name (owner/name) or ID"),
    db: Session = Depends(get_db)
):
    """
    Get the technology classification, relationship links, and strength score.
    """
    r = _find_repo_by_ref(repo, db)
    cache_data = await _ensure_ecosystem_cached(r, db)

    primary_category = r.category or (cache_data["categories"][0] if cache_data["categories"] else "OSS Tools")
    strength = EcosystemStrengthScorer.calculate_category_strength(primary_category, db)

    return {
        "repo_id": r.id,
        "full_name": f"{r.owner}/{r.name}",
        "categories": cache_data["categories"],
        "primary_category": primary_category,
        "strength": strength,
        "relationships": cache_data["relationships"]
    }


@router.get("/alternatives/{repo:path}")
async def get_repo_alternatives(
    repo: str = Path(..., description="Repository full name (owner/name) or ID"),
    db: Session = Depends(get_db)
):
    """
    Find direct alternatives and emerging competitors ranked by Jaccard similarity and Confidence Score.
    """
    r = _find_repo_by_ref(repo, db)
    cache_data = await _ensure_ecosystem_cached(r, db)

    # Filter alternatives
    alternatives = [
        rel for rel in cache_data["relationships"]
        if rel["relationship"] == "alternative"
    ]

    return alternatives


@router.get("/related-technologies/{repo:path}")
async def get_related_technologies(
    repo: str = Path(..., description="Repository full name (owner/name) or ID"),
    db: Session = Depends(get_db)
):
    """
    Find companion technologies and popular stack combinations.
    """
    r = _find_repo_by_ref(repo, db)
    cache_data = await _ensure_ecosystem_cached(r, db)

    # Filter companions
    companions = [
        rel for rel in cache_data["relationships"]
        if rel["relationship"] == "companion"
    ]

    return companions


@router.post("/ecosystem/{repo:path}/report")
async def generate_ecosystem_brief(
    repo: str = Path(..., description="Repository full name or ID"),
    db: Session = Depends(get_db)
):
    """
    Generate an Ecosystem Research Brief.
    """
    r = _find_repo_by_ref(repo, db)
    await _ensure_ecosystem_cached(r, db)
    report_md = await EcosystemReportGenerator.generate_report(r, db)

    return {"content_md": report_md}
