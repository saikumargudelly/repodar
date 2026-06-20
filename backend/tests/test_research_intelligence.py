import pytest
import asyncio
from app.services.research_intelligence import ResearchScorer, QueryExpansionEngine
from app.services.research_agent import _rank_repos_by_profile

# Mock repo fixtures
@pytest.fixture
def stable_repo():
    return {
        "stars": 10000,
        "forks": 1500,
        "open_issues": 50,
        "velocity_proxy": 5.0,
        "star_velocity_30d": 4.5,
        "days_since_push": 2,
        "has_ci_cd": True,
        "has_tests": True,
        "license_category": "permissive",
        "license": "MIT",
        "readme_len": 12000,
        "contributors": 25,
        "full_name": "stable/repo",
        "efficiency": 0.8,
        "trend_label": "HIGH",
    }

@pytest.fixture
def risky_repo():
    return {
        "stars": 20000,
        "forks": 500,
        "open_issues": 4000,  # high backlog (> 200 and ratio > 0.15)
        "velocity_proxy": 20.0,  # fast growth
        "star_velocity_30d": 1.0,  # sudden spike (ratio > 4.0)
        "days_since_push": 200,  # stale push
        "has_ci_cd": False,
        "has_tests": False,
        "license_category": "copyleft",
        "license": "GPL-3.0",
        "readme_len": 500,
        "contributors": 1,  # single maintainer
        "full_name": "risky/repo",
        "efficiency": 0.9,
        "trend_label": "HIGH",
    }

@pytest.fixture
def small_repo():
    return {
        "stars": 800,
        "forks": 80,
        "open_issues": 10,
        "velocity_proxy": 1.0,
        "star_velocity_30d": 0.9,
        "days_since_push": 5,
        "has_ci_cd": True,
        "has_tests": True,
        "license_category": "permissive",
        "license": "Apache-2.0",
        "readme_len": 6000,
        "contributors": 5,
        "full_name": "small/repo",
        "efficiency": 0.5,
        "trend_label": "MID",
    }


def test_confidence_scoring(stable_repo, risky_repo):
    # Stable repo should have high confidence
    stable_conf = ResearchScorer.calculate_confidence_score(stable_repo)
    assert 0 <= stable_conf["score"] <= 100
    assert stable_conf["level"] == "High"

    # Risky repo should have lower confidence (due to stability spike, low docs)
    risky_conf = ResearchScorer.calculate_confidence_score(risky_repo)
    assert 0 <= risky_conf["score"] <= 100
    assert risky_conf["level"] in ("Medium", "Low")


def test_risk_scoring(stable_repo, risky_repo):
    stable_risk = ResearchScorer.calculate_risk_score(stable_repo)
    assert stable_risk["score"] == 0
    assert not stable_risk["factors"]

    risky_risk = ResearchScorer.calculate_risk_score(risky_repo)
    assert risky_risk["score"] > 0
    # Factors checked: stale push, single maintainer, high backlog, no tests, no CI/CD
    assert "No repository updates in the last 6 months" in risky_risk["factors"]
    assert "Single maintainer dependency detected" in risky_risk["factors"]
    assert "High open issue backlog (>200 issues)" in risky_risk["factors"]
    assert "Missing test suite indicators in codebase" in risky_risk["factors"]
    assert "No active CI/CD automation detected" in risky_risk["factors"]


def test_evidence_citations(stable_repo):
    citations = ResearchScorer.generate_evidence_citations(stable_repo)
    assert len(citations) >= 4
    assert any("Last code commit pushed" in c for c in citations)
    assert any("QA: Automated test folders" in c for c in citations)
    assert any("COMPLIANCE" in c for c in citations)


@pytest.mark.asyncio
async def test_query_expansion_engine(monkeypatch):
    # Test static query expansion (concept framework)
    exp = await QueryExpansionEngine.expand_query("agent framework")
    assert "agent orchestration" in exp
    assert "multi-agent" in exp

    # Mock async_chat_completion to fail (return None) to test fallback
    import app.services.research_intelligence as ri
    async def mock_async_chat_completion(*args, **kwargs):
        return None
    monkeypatch.setattr(ri, "async_chat_completion", mock_async_chat_completion)

    # Test unknown query without LLM API key
    exp_fallback = await QueryExpansionEngine.expand_query("completelyunknownkeywordtest123")
    assert "completelyunknownkeywordtest123" in exp_fallback


def test_intent_profile_ranking(stable_repo, risky_repo, small_repo):
    # Populate the score dicts just like _normalize_repo would do
    for r in [stable_repo, risky_repo, small_repo]:
        conf = ResearchScorer.calculate_confidence_score(r)
        risk = ResearchScorer.calculate_risk_score(r)
        r["confidence_score"] = conf["score"]
        r["risk_score"] = risk["score"]

    repos = [stable_repo, risky_repo, small_repo]

    # Enterprise Architect: wants high readiness, permissive license, low risk.
    # stable_repo has risk 0, permissive license, CI/CD, tests -> should be ranked 1st
    ranked_ea = _rank_repos_by_profile(repos, "enterprise_architect")
    assert ranked_ea[0]["full_name"] == "stable/repo"

    # Startup Founder: wants fast growth/velocity and efficiency
    # risky_repo has velocity_proxy=20.0, efficiency=0.9 -> should be ranked 1st
    ranked_sf = _rank_repos_by_profile(repos, "startup_founder")
    assert ranked_sf[0]["full_name"] == "risky/repo"

    # Researcher: wants emerging/low-star count (stars between 500 and 15000 preferred)
    # small_repo has 800 stars (emerging), stable has 10000 stars (emerging), risky has 20000 stars
    # both small and stable are preferred over risky. Let's verify stable or small are ranked higher than risky.
    ranked_res = _rank_repos_by_profile(repos, "researcher")
    # Risky has 20k stars, so emerging score is low. stable has 10k stars (pref range) and high confidence.
    # Let's check that stable_repo is ranked higher than risky_repo.
    assert ranked_res[0]["full_name"] in ("stable/repo", "small/repo")
