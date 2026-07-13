import pytest
from app.services.context import RepositoryContext
from app.services.prompt_builder import (
    estimate_tokens,
    build_deep_summary_prompt,
    PROMPT_VERSION
)

@pytest.fixture
def dummy_context():
    return RepositoryContext(
        repo_id="test/repo",
        owner="test",
        name="repo",
        description="A simple description.",
        primary_language="Python",
        languages_summary="Python (100.0%)",
        readme_excerpt="## Description\nThis is a short readme text.",
        commit_metrics={
            "total_commits": 10,
            "active_weeks": 2,
            "average_commits_per_week": 0.19,
            "latest_commit": "2026-01-01"
        },
        ecosystem_summary="alt:owner/other(100*,Rust)",
        sustainability_metrics={
            "trend_score": 1.5,
            "star_velocity_7d": 2.0,
            "acceleration": 0.5,
            "sustainability_score": 0.8,
            "sustainability_label": "GREEN",
        },
        repo_stats={
            "stars": 100,
            "forks": 10,
            "contributors_count": 5
        }
    )

def test_estimate_tokens():
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("abcd" * 10) == 10


def test_build_deep_summary_prompt_under_budget(dummy_context):
    messages, telemetry = build_deep_summary_prompt(dummy_context, budget_tokens=2000)
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert telemetry["prompt_version"] == PROMPT_VERSION
    assert telemetry["prompt_tokens"] < 2000
    assert "compression_ratio" in telemetry


def test_build_deep_summary_prompt_budget_enforcement(dummy_context):
    # Set a huge readme excerpt so it exceeds budget
    dummy_context.readme_excerpt = "## Description\n" + ("very long text " * 1000)
    
    # Run with a very tight budget (e.g. 500 tokens)
    messages, telemetry = build_deep_summary_prompt(dummy_context, budget_tokens=500)
    assert telemetry["prompt_tokens"] <= 500
    assert "[Readme truncated...]" in messages[1]["content"] or "[Truncated to fit budget...]" in messages[1]["content"]
