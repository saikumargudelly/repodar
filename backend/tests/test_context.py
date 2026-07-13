import pytest
import json
from app.services.context import (
    extract_semantic_markdown,
    summarize_commit_activity,
    compress_ecosystem_relationships,
    summarize_languages,
    build_repository_context,
    RepositoryContext
)

def test_extract_semantic_markdown_headings():
    readme = """# Project Title
Welcome to the project.

## Description
This is a high-performance framework.

## Installation
Run `pip install framework`.

## License
MIT License.

## Contributing
Please send PRs.
"""
    result = extract_semantic_markdown(readme, max_chars=1000)
    assert "## Project Title" in result
    assert "## Description" in result
    assert "## Installation" in result
    assert "License" not in result
    assert "Contributing" not in result


def test_extract_semantic_markdown_fallback():
    readme = "No headings here, just raw text explaining the project."
    result = extract_semantic_markdown(readme, max_chars=20)
    assert result == "No headings here, ju"


def test_summarize_commit_activity():
    # 52 weeks = 364 days. Let's make first week have 5 commits, others 0.
    points = [{"date": f"2026-01-{i:02d}", "count": 1 if i <= 5 else 0} for i in range(1, 365)]
    commit_json = json.dumps(points)
    
    metrics = summarize_commit_activity(commit_json)
    assert metrics["total_commits"] == 5
    assert metrics["active_weeks"] == 1
    assert metrics["average_commits_per_week"] == round(5 / 52.0, 2)
    assert metrics["latest_commit"] == "2026-01-05"


def test_compress_ecosystem_relationships():
    eco_json = {
        "relationships": [
            {
                "related_repo": "owner1/repo1",
                "relationship": "alternative",
                "stars": 1500,
                "primary_language": "Rust"
            },
            {
                "related_repo": "owner2/repo2",
                "relationship": "companion",
                "stars": 50,
                "primary_language": "TypeScript"
            }
        ]
    }
    result = compress_ecosystem_relationships(eco_json)
    assert "alt:owner1/repo1(1500*,Rust)" in result
    assert "comp:owner2/repo2(50*,TypeScript)" in result


def test_summarize_languages():
    languages = {"Python": 8000, "Rust": 2000}
    summary = summarize_languages(languages)
    assert summary == "Python (80.0%), Rust (20.0%)"


def test_build_repository_context():
    context = build_repository_context(
        repo_id="test/repo",
        owner="test",
        name="repo",
        description="A test repo",
        primary_language="Python",
        languages={"Python": 100},
        readme="# Repo\n## Description\nThis is test.",
        commit_activity_json="[]",
        ecosystem_context={},
        stars=10,
        forks=2,
        contributors_count=1
    )
    assert isinstance(context, RepositoryContext)
    assert context.name == "repo"
    assert context.commit_metrics["total_commits"] == 0
    assert context.languages_summary == "Python (100.0%)"
