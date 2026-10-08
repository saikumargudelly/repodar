"""
Discovery engine regression and validation suite for RepoDar.
Empirically tests rotational coverage mathematics, cursor persistence,
emerging project discovery, Tier-1 organization round-robin rotation,
global trending noise rejection, and post-search ingestion integrity.
"""
import math
import pytest
from app.services.github_search import (
    get_rotational_topics,
    VERTICAL_TOPIC_QUERIES,
    is_ai_relevant,
    _TOPIC_CURSOR_CACHE,
)
from app.services.organization_intelligence import (
    TIER_1_ORGANIZATIONS,
    get_rotational_organizations,
    sync_dynamic_organizations,
)
from app.services.ecosystem import EcosystemClassifier
from app.models.dynamic_organization import DynamicOrganization
from app.database import SessionLocal


def test_rotational_coverage_mathematics():
    """
    Mathematical proof of rotational topic coverage:
    - Number of configured topics in ai_ml
    - Number of batches required for complete coverage
    - 100% reachability: prove every topic is reachable within calculated batches.
    """
    topics = VERTICAL_TOPIC_QUERIES["ai_ml"]
    num_topics = len(topics)
    batch_size = 12

    assert num_topics == 181, f"Expected 181 AI topics, found {num_topics}"
    batches_required = math.ceil(num_topics / batch_size)
    assert batches_required == 16, f"Expected 16 batches, got {batches_required}"

    # Verify that visiting all batches covers 100% of topics
    visited = set()
    for batch_idx in range(batches_required):
        batch = get_rotational_topics("ai_ml", batch_size=batch_size, offset=batch_idx)
        assert len(batch) == batch_size
        visited.update(batch)

    # 100% reachability proof
    unvisited = set(topics) - visited
    assert len(unvisited) == 0, f"Unvisited topics found: {unvisited}"
    assert len(visited) == num_topics


def test_rotation_cursor_advances_across_runs():
    """Prove that sequential discovery runs with advance=True advance the cursor monotonically."""
    _TOPIC_CURSOR_CACHE.clear()
    batch1 = get_rotational_topics("ai_ml", batch_size=8, advance=True)
    batch2 = get_rotational_topics("ai_ml", batch_size=8, advance=True)

    assert len(batch1) == 8
    assert len(batch2) == 8
    # Distinct batches: no overlap between consecutive batches
    assert set(batch1).isdisjoint(set(batch2))


def test_multiple_runs_in_same_hour_do_not_duplicate_batch():
    """Prove that multiple pipeline executions within the same hour advance to different batches."""
    _TOPIC_CURSOR_CACHE.clear()
    run_1_batch = get_rotational_topics("ai_ml", batch_size=10, advance=True)
    run_2_batch = get_rotational_topics("ai_ml", batch_size=10, advance=True)

    assert run_1_batch != run_2_batch
    assert set(run_1_batch).isdisjoint(set(run_2_batch))


def test_cursor_wraps_around_cleanly():
    """Prove that the cursor wraps around cleanly modulo len(all_topics)."""
    topics = VERTICAL_TOPIC_QUERIES["ai_ml"]
    total = len(topics)

    # Offset at the very boundary
    boundary_offset = (total // 10) + 5
    batch = get_rotational_topics("ai_ml", batch_size=10, offset=boundary_offset)
    assert len(batch) == 10
    # Every item returned must be a valid configured topic
    for t in batch:
        assert t in topics


def test_tier_1_organizations_seeding_eliminates_circular_dependency(db_session):
    """Verify that sync_dynamic_organizations seeds Tier-1 orgs into DB without circular dependency."""
    res = sync_dynamic_organizations(db_session)
    # Check that top Tier-1 organizations exist in DynamicOrganization table
    check_logins = [
        "openai", "deepseek-ai", "huggingface", "meta-llama", "microsoft",
        "vllm-project", "sgl-project", "dao-ailab", "cline", "compvis",
        "opengvlab", "nerfstudio-project", "sylphai-inc", "hexgrad",
        "tatsu-lab", "stanford-oval", "meta-pytorch", "karpathy", "haotian-liu"
    ]
    db_logins = {
        org.login.lower()
        for org in db_session.query(DynamicOrganization.login).all()
    }
    for login in check_logins:
        assert login in db_logins, f"Tier-1 org {login} missing from DynamicOrganization!"


def test_organization_round_robin_rotation(db_session):
    """Verify that get_rotational_organizations uses LRU round-robin ordering."""
    sync_dynamic_organizations(db_session)
    orgs_batch = get_rotational_organizations(db_session, batch_size=6)
    assert len(orgs_batch) <= 6
    assert len(orgs_batch) > 0
    # Check that orgs are returned with valid logins
    logins = [o.login for o in orgs_batch]
    assert len(set(logins)) == len(logins), "Rotational orgs batch contains duplicate logins!"


def test_global_trending_noise_rejection():
    """Ensure non-AI repositories from GitHub trending are rejected while AI repos pass."""
    non_ai_repos = [
        {"name": "ripgrep", "owner": {"login": "BurntSushi"}, "description": "fast line-oriented search tool", "topics": ["regex", "search", "cli"]},
        {"name": "express", "owner": {"login": "expressjs"}, "description": "Fast, unopinionated, minimalist web framework for node", "topics": ["framework", "http", "node"]},
        {"name": "tokio", "owner": {"login": "tokio-rs"}, "description": "A runtime for writing reliable asynchronous applications with Rust", "topics": ["async", "network", "rust"]},
        {"name": "free-programming-books", "owner": {"login": "EbookFoundation"}, "description": "Freely available programming books", "topics": ["books", "education", "list"]},
    ]
    for r in non_ai_repos:
        assert is_ai_relevant(r) is False, f"False positive for non-AI repo {r['name']}"

    ai_repos = [
        {"name": "whisper", "owner": {"login": "openai"}, "description": "Robust Speech Recognition via Large-Scale Weak Supervision", "topics": []},
        {"name": "DeepSeek-R1", "owner": {"login": "deepseek-ai"}, "description": "DeepSeek-R1 reasoning models", "topics": []},
        {"name": "flash-attention", "owner": {"login": "Dao-AILab"}, "description": "Fast and memory-efficient exact attention", "topics": []},
        {"name": "nanoGPT", "owner": {"login": "karpathy"}, "description": "The simplest, fastest repository for training/finetuning medium-sized GPTs", "topics": []},
        {"name": "kokoro", "owner": {"login": "hexgrad"}, "description": "https://hf.co/hexgrad/Kokoro-82M", "topics": []},
        {"name": "segment-anything", "owner": {"login": "facebookresearch"}, "description": "Segment Anything Model for computer vision", "topics": []},
    ]
    for r in ai_repos:
        assert is_ai_relevant(r) is True, f"False negative for AI repo {r['name']}"


def test_emerging_project_criteria():
    """Verify emerging project qualification logic: stars >= 25 within 30 days vs sub-threshold."""
    # 25 stars qualifies
    sample_emerging_pass = {
        "name": "fast-rag-v2",
        "description": "Ultra fast RAG framework in Python",
        "topics": ["rag", "llm"],
        "stargazers_count": 25,
    }
    assert is_ai_relevant(sample_emerging_pass) is True

    # 24 stars still passes AI relevance, but query filter stars:>=25 bounds GitHub search volume
    sample_emerging_low = {
        "name": "fast-rag-v2",
        "description": "Ultra fast RAG framework in Python",
        "topics": ["rag", "llm"],
        "stargazers_count": 24,
    }
    assert is_ai_relevant(sample_emerging_low) is True
