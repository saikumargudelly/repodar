"""
Tests for dynamic organization intelligence and delta addition/pruning.
Verifies purely dynamic database-driven organization discovery without static hardcoding.
"""
import pytest
from app.database import Base, SessionLocal, engine
from app.models.repository import Repository
from app.models.dynamic_organization import DynamicOrganization
from app.services.organization_intelligence import (
    sync_dynamic_organizations,
    prune_dynamic_organizations,
    get_rotational_organizations,
)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Clear test dynamic orgs
        db.query(DynamicOrganization).delete()
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(DynamicOrganization).delete()
        db.commit()
    finally:
        db.close()


def test_dynamic_organization_delta_addition_from_repo_signals():
    """Verify that organizations are dynamically extracted and added from repository signals without hardcoding."""
    db = SessionLocal()
    try:
        # Create test repository with technology topics and high stars
        test_repo = Repository(
            id="test-vllm-repo",
            owner="vllm-project",
            name="vllm",
            category="Inference Engines",
            topics=["vllm", "inference", "llm-serving", "paged-attention"],
            stars_snapshot=45000,
            github_url="https://github.com/vllm-project/vllm",
            is_active=True,
            source="auto_discovered",
        )
        db.add(test_repo)
        db.commit()

        # Run dynamic intelligence synchronization
        res = sync_dynamic_organizations(db)
        assert res["added"] >= 1

        # Check database
        org = db.query(DynamicOrganization).filter_by(login="vllm-project").first()
        assert org is not None
        assert org.delta_status == "active"
        assert org.is_active is True
        assert org.total_stars >= 45000
        assert "vllm" in org.technologies
        assert org.primary_technology == "Inference Engines"

    finally:
        # Cleanup
        db.query(Repository).filter_by(id="test-vllm-repo").delete()
        db.commit()
        db.close()


def test_dynamic_organization_delta_pruning():
    """Verify that organizations with no active repositories transition to stale state (delta pruning)."""
    db = SessionLocal()
    try:
        # Create a test organization with an inactive repo
        test_repo = Repository(
            id="test-stale-repo",
            owner="abandoned-ai-lab",
            name="old-tool",
            category="AI / ML",
            topics=["ai"],
            stars_snapshot=200,
            github_url="https://github.com/abandoned-ai-lab/old-tool",
            is_active=False,  # Inactive!
            source="auto_discovered",
        )
        test_org = DynamicOrganization(
            id="org-abandoned",
            login="abandoned-ai-lab",
            primary_technology="AI / ML",
            technologies=["ai"],
            repo_count=1,
            total_stars=200,
            is_active=True,
            delta_status="active",
        )
        db.add(test_repo)
        db.add(test_org)
        db.commit()

        # Run pruning
        res = prune_dynamic_organizations(db)
        assert res["pruned"] >= 1

        # Verify state transition
        org = db.query(DynamicOrganization).filter_by(login="abandoned-ai-lab").first()
        assert org is not None
        assert org.is_active is False
        assert org.delta_status == "stale"

    finally:
        db.query(Repository).filter_by(id="test-stale-repo").delete()
        db.commit()
        db.close()


def test_rotational_organization_selection():
    """Verify that dynamic organizations are selected in round-robin fashion by last_synced_at."""
    db = SessionLocal()
    try:
        org1 = DynamicOrganization(
            id="org-1", login="org-one", is_active=True, delta_status="active", last_synced_at=None
        )
        org2 = DynamicOrganization(
            id="org-2", login="org-two", is_active=True, delta_status="active", last_synced_at=None
        )
        db.add_all([org1, org2])
        db.commit()

        selected = get_rotational_organizations(db, batch_size=2)
        assert len(selected) == 2
        assert {o.login for o in selected} == {"org-one", "org-two"}

    finally:
        db.close()
