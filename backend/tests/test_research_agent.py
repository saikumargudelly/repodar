"""
Regression tests for app/services/research_agent.py

Focus:
  - valid short topical prompts should not get stuck in clarify loops
  - fallback parser confidence should allow normal search execution
"""

import asyncio

from app.services import research_agent
from app.services.research_agent import ParsedIntent


def _fake_repo(full_name: str = "example/repo") -> dict:
    return {
        "repo_id": 1,
        "owner": full_name.split("/")[0],
        "name": full_name.split("/")[1],
        "full_name": full_name,
        "description": "Sample repository",
        "github_url": f"https://github.com/{full_name}",
        "homepage": "",
        "primary_language": "Python",
        "stars": 1000,
        "forks": 100,
        "open_issues": 5,
        "watchers": 100,
        "topics": ["sample"],
        "license": "MIT",
        "is_fork": False,
        "archived": False,
        "age_days": 100,
        "pushed_at": "2026-03-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "velocity_proxy": 10.0,
        "efficiency": 0.7,
        "momentum": 0.7,
        "trend_label": "HIGH",
        "days_since_push": 5,
    }


def test_keyword_fallback_confidence_allows_search_path():
    parsed = research_agent._keyword_fallback_intent("home automation repos")
    assert parsed.intent == "search"
    assert parsed.confidence >= 0.60
    assert parsed.github_queries


def test_process_message_does_not_clarify_when_queries_exist(monkeypatch):
    async def _fake_parse_intent(message, context_turns):
        return ParsedIntent(
            intent="search",
            confidence=0.58,
            github_queries=["home automation"],
            query_explanation="Search home automation repos",
            needs_clarification=True,
            clarification_prompt="Could you rephrase or add more detail?",
        )

    async def _fake_handle_search(parsed):
        return [_fake_repo("ha/core")], "Found 1 repository."

    async def _fake_synth(repos, message, context_turns, intent, summary_line):
        return "Search executed"

    monkeypatch.setattr(research_agent, "parse_intent", _fake_parse_intent)
    monkeypatch.setattr(research_agent, "_handle_search", _fake_handle_search)
    monkeypatch.setattr(research_agent, "_synthesize", _fake_synth)

    result = asyncio.run(research_agent.process_message("home automation repos", []))

    assert result.intent == "search"
    assert result.content == "Search executed"
    assert result.repos


def test_process_message_rescues_ai_ml_clarify_prompt(monkeypatch):
    async def _fake_parse_intent(message, context_turns):
        return ParsedIntent(
            intent="clarify",
            confidence=0.52,
            github_queries=[],
            query_explanation="",
            needs_clarification=True,
            clarification_prompt="Could you rephrase or add more detail?",
        )

    captured_queries = {}

    async def _fake_handle_search(parsed):
        captured_queries["queries"] = parsed.github_queries
        return [_fake_repo("ml/lab")], "Found 1 repository."

    async def _fake_synth(repos, message, context_turns, intent, summary_line):
        return "AI/ML search executed"

    monkeypatch.setattr(research_agent, "parse_intent", _fake_parse_intent)
    monkeypatch.setattr(research_agent, "_handle_search", _fake_handle_search)
    monkeypatch.setattr(research_agent, "_synthesize", _fake_synth)

    result = asyncio.run(research_agent.process_message("ai ml repos", []))

    assert result.intent == "search"
    assert result.content == "AI/ML search executed"
    assert captured_queries["queries"]
    assert "topic:machine-learning" in captured_queries["queries"][0]
