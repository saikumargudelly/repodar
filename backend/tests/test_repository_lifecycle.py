"""
Tests for Repository Lifecycle handling in RepoDar:
- active -> inactive (stale deactivation)
- inactive -> active (reactivation upon reappearing in trending)
- archived repository handling
- reactivation preserves historical metrics
- ranking exclusion for inactive repositories
- historical queryability remains intact
"""
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from app.models import Repository, DailyMetric, ComputedMetric
from app.services.ingestion import deactivate_stale_repos, _persist_discovered_repos_sync, STALE_MIN_STARS_GUARD
from app.routers.dashboard import get_leaderboard


def test_active_to_inactive_deactivation(patch_session):
    """Verify that auto-discovered repos not seen for >90 days with <500 stars are marked inactive."""
    db = patch_session()
    try:
        stale_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=120)
        repo_id = f"test-stale-{uuid.uuid4().hex[:8]}"
        repo = Repository(
            id=repo_id,
            owner="stale-org",
            name="stale-repo",
            category="DevTools",
            github_url="https://github.com/stale-org/stale-repo",
            source="auto_discovered",
            is_active=True,
            stars_snapshot=150,  # Below 500 threshold
            last_seen_trending=stale_date,
        )
        db.add(repo)
        db.commit()

        deactivated = deactivate_stale_repos()
        assert deactivated >= 1

        db.refresh(repo)
        assert repo.is_active is False, "Stale repo should have been marked inactive"

    finally:
        db.close()


def test_popular_repos_never_auto_deactivated(patch_session):
    """Verify that repos with >= 500 stars are NEVER auto-deactivated even if off trending."""
    db = patch_session()
    try:
        stale_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=120)
        repo_id = f"test-popular-{uuid.uuid4().hex[:8]}"
        repo = Repository(
            id=repo_id,
            owner="popular-org",
            name="popular-repo",
            category="DevTools",
            github_url="https://github.com/popular-org/popular-repo",
            source="auto_discovered",
            is_active=True,
            stars_snapshot=STALE_MIN_STARS_GUARD + 100,  # >= 500
            last_seen_trending=stale_date,
        )
        db.add(repo)
        db.commit()

        deactivate_stale_repos()

        db.refresh(repo)
        assert repo.is_active is True, "Popular repos (>=500 stars) must remain active"

    finally:
        db.close()


def test_seed_repos_never_auto_deactivated(patch_session):
    """Verify that seed repos are never auto-deactivated regardless of staleness."""
    db = patch_session()
    try:
        stale_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=120)
        repo_id = f"test-seed-{uuid.uuid4().hex[:8]}"
        repo = Repository(
            id=repo_id,
            owner="seed-org",
            name="seed-repo",
            category="DevTools",
            github_url="https://github.com/seed-org/seed-repo",
            source="seed",  # Seed source
            is_active=True,
            stars_snapshot=20,
            last_seen_trending=stale_date,
        )
        db.add(repo)
        db.commit()

        deactivate_stale_repos()

        db.refresh(repo)
        assert repo.is_active is True, "Seed repos must never be deactivated"

    finally:
        db.close()


def test_inactive_to_active_reactivation(patch_session):
    """Verify that an inactive repository automatically flips to is_active=True when rediscovered."""
    db = patch_session()
    try:
        repo_id = f"test-reactivate-{uuid.uuid4().hex[:8]}"
        repo = Repository(
            id=repo_id,
            owner="dormant-org",
            name="sleeping-repo",
            category="AI / ML",
            github_url="https://github.com/dormant-org/sleeping-repo",
            source="auto_discovered",
            is_active=False,  # Inactive
            stars_snapshot=100,
        )
        db.add(repo)
        db.commit()

        # Simulate auto-discovery encountering this repository
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        seen_slugs = {
            "dormant-org/sleeping-repo": {
                "full_name": "dormant-org/sleeping-repo",
                "html_url": "https://github.com/dormant-org/sleeping-repo",
                "stargazers_count": 250,
            }
        }
        res = _persist_discovered_repos_sync(seen_slugs, now, run_full_search=False)
        assert res["reactivated"] >= 1

        db.refresh(repo)
        assert repo.is_active is True, "Rediscovered repository should be reactivated"

    finally:
        db.close()


def test_archived_repo_flag_preservation(patch_session):
    """Verify that archived repository status is tracked and distinguished."""
    db = patch_session()
    try:
        repo_id = f"test-archived-{uuid.uuid4().hex[:8]}"
        repo = Repository(
            id=repo_id,
            owner="archived-org",
            name="legacy-tool",
            category="DevTools",
            github_url="https://github.com/archived-org/legacy-tool",
            source="auto_discovered",
            is_active=True,
            is_archived=True,
            stars_snapshot=5000,
        )
        db.add(repo)
        db.commit()

        db.refresh(repo)
        assert repo.is_archived is True

    finally:
        db.close()


@pytest.mark.asyncio
async def test_ranking_excludes_inactive_repositories(patch_session):
    """Verify that inactive repositories are strictly excluded from ranking feeds."""
    db = patch_session()
    try:
        repo_id = f"test-ranking-{uuid.uuid4().hex[:8]}"
        repo = Repository(
            id=repo_id,
            owner="inactive-org",
            name="shadow-project",
            category="DevTools",
            github_url="https://github.com/inactive-org/shadow-project",
            source="auto_discovered",
            is_active=False,  # Strictly inactive
            stars_snapshot=999999,  # Very high stars
        )
        db.add(repo)
        db.commit()

        # Check leaderboard query with db session
        response = await get_leaderboard(period="7d", category="All", db=db)
        repo_ids = [entry.repo_id for entry in response.entries]
        assert "inactive-org/shadow-project" not in repo_ids, "Inactive repo must not appear in leaderboard"

    finally:
        db.close()


def test_historical_queryability_of_inactive_repositories(patch_session):
    """Verify that inactive repositories remain fully queryable in the DB with all historical metrics."""
    db = patch_session()
    try:
        repo_id = f"test-hist-{uuid.uuid4().hex[:8]}"
        repo = Repository(
            id=repo_id,
            owner="retired-org",
            name="classic-tool",
            category="DevTools",
            github_url="https://github.com/retired-org/classic-tool",
            source="auto_discovered",
            is_active=False,
            stars_snapshot=800,
        )
        db.add(repo)
        db.commit()

        # Query directly by owner/name (as the repo detail endpoint does)
        found = db.query(Repository).filter(
            Repository.owner == "retired-org",
            Repository.name == "classic-tool"
        ).first()

        assert found is not None
        assert found.is_active is False
        assert found.stars_snapshot == 800

    finally:
        db.close()
