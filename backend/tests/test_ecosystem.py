import pytest
from app.models.repository import Repository
from app.services.ecosystem import EcosystemClassifier, RelationshipGraphEngine, EcosystemStrengthScorer

def test_ecosystem_classifier():
    # Test topic mapping
    repo1 = Repository(
        owner="google",
        name="langgraph-test",
        category="default",
        description="A tool for building agentic applications.",
        topics=["mcp", "agent", "python"],
        github_url="https://github.com/google/langgraph-test"
    )
    categories = EcosystemClassifier.classify_repo(repo1)
    assert "Model Context Protocol" in categories
    assert "Agent Frameworks" in categories

    # Test fallback to OSS Tools if no match
    repo2 = Repository(
        owner="random",
        name="something-else",
        category="default",
        description="No matching terms here.",
        topics=[],
        github_url="https://github.com/random/something-else"
    )
    categories2 = EcosystemClassifier.classify_repo(repo2)
    assert categories2 == ["OSS Tools"]

@pytest.mark.asyncio
async def test_relationship_graph_engine(db_session):
    # Setup candidate repositories
    repo_pivot = Repository(
        id="pivot-id",
        owner="langchain-ai",
        name="langgraph",
        category="Agent Frameworks",
        description="Build stateful multi-agent systems.",
        topics=["agent", "multi-agent", "orchestration"],
        is_active=True,
        stars_snapshot=15000,
        age_days=300,
        github_url="https://github.com/langchain-ai/langgraph"
    )
    repo_alt = Repository(
        id="alt-id",
        owner="crewai",
        name="crewai",
        category="Agent Frameworks",
        description="Framework for orchestrating role-playing collaborative agents.",
        topics=["agent", "orchestration"],
        is_active=True,
        stars_snapshot=12000,
        age_days=200,
        github_url="https://github.com/crewai/crewai"
    )
    repo_comp = Repository(
        id="comp-id",
        owner="qdrant",
        name="qdrant",
        category="Vector Databases",
        description="Vector search engine for LLMs.",
        topics=["vector-db", "vector-search"],
        is_active=True,
        stars_snapshot=18000,
        age_days=400,
        github_url="https://github.com/qdrant/qdrant"
    )

    db_session.add_all([repo_pivot, repo_alt, repo_comp])
    db_session.commit()

    # Trigger relationship building
    result = RelationshipGraphEngine.build_relationships(repo_pivot, db_session)
    assert "categories" in result
    assert "relationships" in result

    # Check alternatives and companions
    rels = result["relationships"]
    assert len(rels) > 0

    alts = [r for r in rels if r["relationship"] == "alternative"]
    comps = [r for r in rels if r["relationship"] == "companion"]

    assert any(a["related_repo"] == "crewai/crewai" for a in alts)
    assert any(c["related_repo"] == "qdrant/qdrant" for c in comps)

    # Verify explainable structure fields are populated
    for r in rels:
        assert "confidence" in r
        assert "source" in r
        assert "explanation" in r
        assert r["confidence"] >= 0.0 and r["confidence"] <= 1.0

def test_ecosystem_strength_scorer(db_session):
    # Setup some repos in a category
    repo1 = Repository(
        id="repo1",
        owner="owner1",
        name="repo1",
        category="Inference Engines",
        is_active=True,
        stars_snapshot=5000,
        age_days=100,
        github_url="https://github.com/owner1/repo1"
    )
    repo2 = Repository(
        id="repo2",
        owner="owner2",
        name="repo2",
        category="Inference Engines",
        is_active=True,
        stars_snapshot=20000,
        age_days=200,
        github_url="https://github.com/owner2/repo2"
    )
    db_session.add_all([repo1, repo2])
    db_session.commit()

    strength = EcosystemStrengthScorer.calculate_category_strength("Inference Engines", db_session)
    assert "score" in strength
    assert "status" in strength
    assert "details" in strength
    assert strength["score"] >= 0 and strength["score"] <= 100
    assert strength["metrics"]["active_projects"] == 2
    assert strength["metrics"]["total_stars"] == 25000
