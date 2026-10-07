import asyncio
import os
import pytest
from datetime import datetime, timezone, timedelta, date
from unittest.mock import MagicMock, AsyncMock, patch

from fastapi.testclient import TestClient
from app.main import app, _run_pipeline_sync
from app.auth import get_current_user
from app.database import get_db
from app.models import Repository, ComputedMetric, DailyMetric, Subscriber
from app.models.weekly_snapshot import WeeklySnapshot
from app.models.social_mention import SocialMention
from app.models.repo_release import RepoRelease
from app.models.alert_rule import AlertRule


@pytest.fixture
def auth_client(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "test-admin-secret")
    client = TestClient(app)
    return client


def test_admin_run_all_unauthorized():
    client = TestClient(app)
    resp = client.post("/admin/run-all")
    assert resp.status_code == 403


def test_admin_run_all_authorized(auth_client):
    with patch("app.main._run_pipeline_sync", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {"status": "complete", "ingested": 10, "scored": 10}
        resp = auth_client.post("/admin/run-all", headers={"X-Admin-Key": "test-admin-secret"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "started"


def test_admin_pipeline_status_endpoint(auth_client):
    resp = auth_client.get("/admin/pipeline-status", headers={"X-Admin-Key": "test-admin-secret"})
    assert resp.status_code == 200
    data = resp.json()
    assert "running" in data
    assert "last_result" in data


def test_admin_run_all_sync_delegation(auth_client):
    with patch("app.main._run_pipeline_sync", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {"status": "complete", "ingested": 42, "scored": 42}
        resp = auth_client.post("/admin/run-all-sync", headers={"X-Admin-Key": "test-admin-secret"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        assert data["ingested"] == 42
        mock_sync.assert_called_once_with(force_discovery=False, include_explanations=True)


@pytest.mark.asyncio
async def test_canonical_pipeline_sync_execution():
    with patch("app.services.ingestion.run_daily_ingestion", new_callable=AsyncMock) as m_ingest, \
         patch("app.services.scoring.run_daily_scoring") as m_score, \
         patch("app.services.explanation.enrich_top_repos_with_explanations") as m_explain, \
         patch("app.services.explanation.enrich_repos_with_summaries") as m_summary, \
         patch("app.services.releases.run_releases_pipeline", new_callable=AsyncMock) as m_releases, \
         patch("app.services.social_mentions.run_social_mentions_pipeline", new_callable=AsyncMock) as m_social, \
         patch("app.services.commit_activity.run_commit_activity_pipeline", new_callable=AsyncMock) as m_commit, \
         patch("app.services.notification_service.dispatch_pending_watchlist_alert_emails", new_callable=AsyncMock) as m_notif, \
         patch("app.services.weekly_snapshots.publish_weekly_snapshot") as m_snap, \
         patch("app.services.notification_service.dispatch_digest_emails", new_callable=AsyncMock) as m_digest:

        m_ingest.return_value = {"discovered": 1, "ingested": 5, "inserted": 1, "updated": 4}
        m_score.return_value = {"scored": 5, "failed": 0, "alerts": 1, "date": "2026-10-07"}
        m_explain.return_value = 2
        m_summary.return_value = 3
        m_releases.return_value = {"written": 10}
        m_social.return_value = {"written": 7}
        m_commit.return_value = {"updated": 5}
        m_notif.return_value = {"sent": 1, "failed": 0, "skipped": 0}
        m_snap.return_value = {"week_id": "2026-W41", "status": "already_exists"}
        m_digest.return_value = {"sent": 0, "skipped": 2}

        result = await _run_pipeline_sync(force_discovery=False, include_explanations=True)

        assert result["status"] == "complete"
        assert result["ingested"] == 5
        assert result["scored"] == 5
        assert result["explanations"] == 2
        assert result["summaries"] == 3
        assert result["releases_written"] == 10
        assert result["social_mentions_written"] == 7
        assert result["commit_activity_updated"] == 5
        assert result["alert_emails_sent"] == 1
        assert result["weekly_snapshot"] == "already_exists"


def test_export_repos_endpoint_contract(patch_session):
    app.dependency_overrides[get_current_user] = lambda: {"sub": "test-user-id"}
    app.dependency_overrides[get_db] = lambda: patch_session()
    try:
        client = TestClient(app)
        resp_csv = client.get("/export/repos?format=csv")
        assert resp_csv.status_code == 200
        assert "text/csv" in resp_csv.headers.get("content-type", "")

        resp_json = client.get("/export/repos?format=json")
        assert resp_json.status_code == 200
        assert "application/json" in resp_json.headers.get("content-type", "")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


def test_weekly_snapshot_idempotency(patch_session):
    from app.services.weekly_snapshots import publish_weekly_snapshot, _week_id
    db = patch_session()
    try:
        today_date = date.today()
        week_id = _week_id(today_date)

        repo = Repository(
            id="test-repo-snapshot",
            owner="test",
            name="repo",
            category="ai_infra",
            github_url="https://github.com/test/repo",
            is_active=True,
        )
        db.add(repo)
        
        cm = ComputedMetric(
            id="test-cm-snapshot",
            repo_id="test-repo-snapshot",
            date=today_date,
            trend_score=0.9,
            sustainability_score=0.8,
            sustainability_label="GREEN",
        )
        db.add(cm)

        snap = WeeklySnapshot(id="test-snap-id", week_id=week_id, published_at=datetime.utcnow(), data_json="[]")
        db.add(snap)
        db.commit()

        # Calling publish_weekly_snapshot must detect existing snapshot and skip
        result = publish_weekly_snapshot()
        assert result.get("status") == "already_exists"
        assert result.get("week_id") == week_id
    finally:
        db.close()


def test_breakout_probability_alert_rule_evaluation():
    from app.services.alert_engine import evaluate_alert_rules
    from app.models.alert_rule import AlertRule

    class DummyRepo:
        id = "repo-1"
        owner = "foo"
        name = "bar"
        github_url = "https://github.com/foo/bar"

    class DummyCM:
        trend_score = 0.8
        sustainability_score = 0.7
        star_velocity_7d = 10.0
        acceleration = 1.0

    rule = AlertRule(
        id="test-rule-1",
        user_id="user-1",
        condition="breakout_probability > 0.75",
        frequency="instant",
        is_active=True,
    )
    repo = DummyRepo()
    cm = DummyCM()
    forecast_values = {"breakout_probability": 0.85}

    events = asyncio.run(evaluate_alert_rules(repo, cm, None, [rule], forecast_values=forecast_values))

    assert len(events) == 1
    assert events[0].metric == "breakout_probability"
    assert events[0].value == 0.85
    assert events[0].threshold == 0.75


def test_enrich_top_repos_with_explanations_efficiency(patch_session):
    from app.services.explanation import enrich_top_repos_with_explanations
    from app.models import Repository, ComputedMetric
    from datetime import date
    from unittest.mock import patch

    db = patch_session()
    today = date.today()
    try:
        # Create 25 repositories with descending trend scores
        repos = []
        for i in range(25):
            repo = Repository(
                id=f"repo-{i:02d}",
                name=f"repo-{i:02d}",
                owner="test-owner",
                category="AI",
                github_url=f"https://github.com/test-owner/repo-{i:02d}",
                is_active=True,
            )
            db.add(repo)
            repos.append(repo)
            cm = ComputedMetric(
                id=f"cm-{i:02d}",
                repo_id=repo.id,
                date=today,
                trend_score=100.0 - i,
                sustainability_score=0.8,
                explanation=None,
            )
            db.add(cm)
        db.commit()

        # Run 1: Should generate explanations for top 20 repos only
        with patch("app.services.explanation.generate_explanation") as mock_gen:
            mock_gen.side_effect = lambda **kwargs: f"Explanation for {kwargs['repo_name']}"
            written = enrich_top_repos_with_explanations(top_n=20)
            assert written == 20
            assert mock_gen.call_count == 20

        # Verify ranks 1-20 have explanations, but ranks 21-25 do not
        for i in range(20):
            cm = db.query(ComputedMetric).filter_by(repo_id=f"repo-{i:02d}", date=today).first()
            assert cm.explanation is not None
        for i in range(20, 25):
            cm = db.query(ComputedMetric).filter_by(repo_id=f"repo-{i:02d}", date=today).first()
            assert cm.explanation is None

        # Run 2 (subsequent 2-hour scheduled run): Must make 0 LLM calls and NOT cascade to ranks 21-25
        with patch("app.services.explanation.generate_explanation") as mock_gen_2:
            written_2 = enrich_top_repos_with_explanations(top_n=20)
            assert written_2 == 0
            assert mock_gen_2.call_count == 0

        # Verify ranks 21-25 STILL do not have explanations (no cascade)
        for i in range(20, 25):
            cm = db.query(ComputedMetric).filter_by(repo_id=f"repo-{i:02d}", date=today).first()
            assert cm.explanation is None
    finally:
        db.close()


def test_enrich_repos_with_summaries_efficiency(patch_session):
    from app.services.explanation import enrich_repos_with_summaries
    from app.models import Repository, ComputedMetric
    from datetime import date, datetime, timezone
    from unittest.mock import patch

    db = patch_session()
    today = date.today()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        # Create 5 repos that already have recent summaries
        for i in range(5):
            repo = Repository(
                id=f"summary-repo-{i}",
                name=f"summary-repo-{i}",
                owner="test-owner",
                category="AI",
                github_url=f"https://github.com/test-owner/summary-repo-{i}",
                is_active=True,
                repo_summary=f"Existing summary for repo {i}",
                repo_summary_generated_at=now,
            )
            db.add(repo)
            cm = ComputedMetric(
                id=f"summary-cm-{i}",
                repo_id=repo.id,
                date=today,
                trend_score=90.0,
            )
            db.add(cm)
        db.commit()

        # Calling enrich_repos_with_summaries must skip all 5 repos with 0 LLM calls
        with patch("app.services.explanation.generate_repo_summary") as mock_gen:
            written = enrich_repos_with_summaries(top_n=5)
            assert written == 0
            assert mock_gen.call_count == 0
    finally:
        db.close()

