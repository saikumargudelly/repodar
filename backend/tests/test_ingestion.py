"""
Tests for app/services/ingestion.py

Covers:
  - deactivate_stale_repos  — 60-day cutoff, seed repos untouched, reactivation
  - auto_discover_and_sync  — new repo inserted, existing repo refreshed,
                              inactive repo reactivated
  - run_daily_ingestion     — skip-if-done-today fast-path
"""

import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.services.ingestion import (
    deactivate_stale_repos,
    auto_discover_and_sync,
    STALE_DAYS,
)
from app.models import Repository, DailyMetric
from tests.conftest import make_repo, make_daily_metrics


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _past(days: int) -> datetime:
    """UTC datetime `days` ago, tz-naïve (matching DB storage)."""
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)


def _future(days: int) -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days)


# ─────────────────────────────────────────────────────────────────────────────
# deactivate_stale_repos
# ─────────────────────────────────────────────────────────────────────────────

class TestDeactivateStaleRepos:
    """
    Runs against the in-memory SQLite DB via patch_session factory.
    `patch_session` is a sessionmaker — call it to open a fresh session.
    """

    def test_stale_auto_discovered_repo_is_deactivated(self, patch_session):
        """auto_discovered repo last seen > STALE_DAYS ago → deactivated."""
        s = patch_session()
        repo = make_repo(
            s,
            owner="staleowner", name="stalerepo",
            source="auto_discovered",
            is_active=True,
            last_seen_trending=_past(STALE_DAYS + 5),
        )
        repo_id = repo.id
        s.close()

        count = deactivate_stale_repos()

        check = patch_session()
        updated = check.get(Repository, repo_id)
        assert count == 1
        assert updated.is_active is False
        check.close()

    def test_recently_seen_repo_not_deactivated(self, patch_session):
        """auto_discovered repo last seen recently → stays active."""
        s = patch_session()
        repo = make_repo(
            s,
            owner="freshowner", name="freshrepo",
            source="auto_discovered",
            is_active=True,
            last_seen_trending=_past(STALE_DAYS - 5),
        )
        repo_id = repo.id
        s.close()

        count = deactivate_stale_repos()

        check = patch_session()
        updated = check.get(Repository, repo_id)
        assert count == 0
        assert updated.is_active is True
        check.close()

    def test_seed_repo_never_deactivated(self, patch_session):
        """source='seed' repos MUST NOT be deactivated regardless of last_seen."""
        s = patch_session()
        repo = make_repo(
            s,
            owner="seedowner", name="seedrepo",
            source="seed",
            is_active=True,
            last_seen_trending=_past(STALE_DAYS + 100),   # very old
        )
        repo_id = repo.id
        s.close()

        count = deactivate_stale_repos()

        check = patch_session()
        updated = check.get(Repository, repo_id)
        assert count == 0, "Seed repos must never be deactivated"
        assert updated.is_active is True
        check.close()

    def test_already_inactive_repo_not_counted_again(self, patch_session):
        """is_active=False repos should not appear in stale count."""
        s = patch_session()
        make_repo(
            s,
            owner="alreadyoff", name="alreadyoff",
            source="auto_discovered",
            is_active=False,
            last_seen_trending=_past(STALE_DAYS + 30),
        )
        s.close()

        count = deactivate_stale_repos()
        assert count == 0

    def test_multiple_stale_repos_all_deactivated(self, patch_session):
        s = patch_session()
        repo_ids = []
        for i in range(3):
            r = make_repo(
                s,
                owner=f"stale{i}", name="repo",
                source="auto_discovered",
                is_active=True,
                last_seen_trending=_past(STALE_DAYS + 10 + i),
            )
            repo_ids.append(r.id)
        s.close()

        count = deactivate_stale_repos()
        assert count == 3

        check = patch_session()
        for rid in repo_ids:
            r = check.get(Repository, rid)
            assert r.is_active is False
        check.close()

    def test_no_last_seen_trending_means_not_stale_if_none(self, patch_session):
        """
        Repos with last_seen_trending=None are newly seeded and NOT stale
        (the filter requires last_seen_trending < cutoff, NULL fails the check).
        """
        s = patch_session()
        repo = make_repo(
            s,
            owner="newdisco", name="nodaterepo",
            source="auto_discovered",
            is_active=True,
            last_seen_trending=None,
        )
        repo_id = repo.id
        s.close()

        count = deactivate_stale_repos()

        check = patch_session()
        updated = check.get(Repository, repo_id)
        assert count == 0
        assert updated.is_active is True
        check.close()


# ─────────────────────────────────────────────────────────────────────────────
# auto_discover_and_sync
# ─────────────────────────────────────────────────────────────────────────────

FAKE_REPO_DATA = [
    {
        "full_name": "nlpgroup/fastrag",
        "name": "fastrag",
        "html_url": "https://github.com/nlpgroup/fastrag",
        "description": "Fast RAG pipeline",
        "language": "Python",
        "owner": {"login": "nlpgroup"},
        "topics": ["llm", "machine-learning"],
        "stargazers_count": 3200,
        "forks_count": 130,
    }
]


def _async(result):
    """Wrap a value as a coroutine so AsyncMock returns it."""
    async def _coro(*args, **kwargs):
        return result
    return _coro


class TestAutoDiscoverAndSync:
    def test_new_repo_is_inserted(self, patch_session):
        """A brand-new repo that doesn't exist in the DB should be inserted."""
        with patch(
            "app.services.ingestion.search_top_repos",
            side_effect=_async(FAKE_REPO_DATA),
        ), patch(
            "app.services.ingestion.search_by_star_threshold",
            side_effect=_async([]),
        ):
            result = asyncio.run(
                auto_discover_and_sync()
            )

        assert result["discovered"] == 1
        assert result["reactivated"] == 0

        check = patch_session()
        inserted = check.query(Repository).filter_by(owner="nlpgroup", name="fastrag").first()
        assert inserted is not None
        assert inserted.source == "auto_discovered"
        assert inserted.is_active is True
        check.close()

    def test_existing_active_repo_is_refreshed(self, patch_session):
        """Active repo already in DB → only last_seen_trending updated."""
        s = patch_session()
        make_repo(
            s,
            owner="nlpgroup", name="fastrag",
            source="auto_discovered",
            is_active=True,
            last_seen_trending=_past(10),
        )
        s.close()

        with patch(
            "app.services.ingestion.search_top_repos",
            side_effect=_async(FAKE_REPO_DATA),
        ), patch(
            "app.services.ingestion.search_by_star_threshold",
            side_effect=_async([]),
        ):
            result = asyncio.run(
                auto_discover_and_sync()
            )

        assert result["discovered"] == 0
        assert result["reactivated"] == 0
        assert result["refreshed"] == 1

    def test_inactive_repo_is_reactivated(self, patch_session):
        """Repo in DB but is_active=False → reactivated when seen in search."""
        s = patch_session()
        repo = make_repo(
            s,
            owner="nlpgroup", name="fastrag",
            source="auto_discovered",
            is_active=False,
            last_seen_trending=_past(70),
        )
        repo_id = repo.id
        s.close()

        with patch(
            "app.services.ingestion.search_top_repos",
            side_effect=_async(FAKE_REPO_DATA),
        ), patch(
            "app.services.ingestion.search_by_star_threshold",
            side_effect=_async([]),
        ):
            result = asyncio.run(
                auto_discover_and_sync()
            )

        assert result["reactivated"] == 1
        assert result["discovered"] == 0

        check = patch_session()
        updated = check.get(Repository, repo_id)
        assert updated.is_active is True
        check.close()

    def test_failed_search_does_not_crash_pipeline(self, patch_session):
        """Even if search_top_repos raises an exception, the function completes."""
        async def _raise(*args, **kwargs):
            raise RuntimeError("GitHub API down")

        with patch("app.services.ingestion.search_top_repos", side_effect=_raise), \
             patch("app.services.ingestion.search_by_star_threshold", side_effect=_raise):
            result = asyncio.run(
                auto_discover_and_sync()
            )

        assert result["discovered"] == 0
        assert result["reactivated"] == 0

    def test_duplicates_within_run_are_deduplicated(self, patch_session):
        """Same repo returned by multiple search tasks should appear only once."""
        # Return the same repo twice (as if two searches returned it)
        duplicate_result = FAKE_REPO_DATA + FAKE_REPO_DATA

        with patch(
            "app.services.ingestion.search_top_repos",
            side_effect=_async(duplicate_result),
        ), patch(
            "app.services.ingestion.search_by_star_threshold",
            side_effect=_async([]),
        ):
            result = asyncio.run(
                auto_discover_and_sync()
            )

        # Deduplication means only 1 insert, not 2
        assert result["discovered"] == 1

        check = patch_session()
        count = check.query(Repository).filter_by(owner="nlpgroup", name="fastrag").count()
        assert count == 1
        check.close()

    def test_seed_repo_not_overwritten_to_auto_discovered(self, patch_session):
        """A seed repo that shows up in search must keep source='seed'."""
        s = patch_session()
        repo = make_repo(
            s,
            owner="nlpgroup", name="fastrag",
            source="seed",
            is_active=True,
        )
        repo_id = repo.id
        s.close()

        with patch(
            "app.services.ingestion.search_top_repos",
            side_effect=_async(FAKE_REPO_DATA),
        ), patch(
            "app.services.ingestion.search_by_star_threshold",
            side_effect=_async([]),
        ):
            asyncio.run(auto_discover_and_sync())

        check = patch_session()
        updated = check.get(Repository, repo_id)
        assert updated.source == "seed", "Seed repos must never have their source changed"
        check.close()


# ─────────────────────────────────────────────────────────────────────────────
# _calc_age_days helper (exposed via import)
# ─────────────────────────────────────────────────────────────────────────────

class TestCalcAgeDays:
    def test_recent_repo_is_young(self):
        from app.services.ingestion import _calc_age_days
        ts = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        assert _calc_age_days(ts) == pytest.approx(10, abs=1)

    def test_old_repo_has_large_age(self):
        from app.services.ingestion import _calc_age_days
        ts = (datetime.now(timezone.utc) - timedelta(days=1000)).isoformat()
        assert _calc_age_days(ts) == pytest.approx(1000, abs=1)

    def test_empty_string_returns_zero(self):
        from app.services.ingestion import _calc_age_days
        assert _calc_age_days("") == 0

    def test_invalid_string_returns_zero(self):
        from app.services.ingestion import _calc_age_days
        assert _calc_age_days("not-a-date") == 0
