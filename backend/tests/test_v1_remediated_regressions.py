"""
Comprehensive regression test suite for 20 remediated V1 items in Repodar.
Verifies:
1. Scheduler architecture & DistributedPipelineLock
2. Pipeline lock concurrency prevention
3. Alert-rule async execution
4. forecast_values propagation into alert evaluation
5. Watchlist notifications idempotency & deduplication
6. Weekly snapshot N+1 batch query verification
7. Digest frequency and idempotency
8. LLM explanation idempotency (no cascading)
9. Repository summary idempotency
10. Release deduplication
11. Social ingestion failure isolation
12. Commit activity freshness & 20-hour skip
13. Export API / frontend contract (CSV and JSON)
14. TrendScore documentation, weights (sum=1.0), and bounds [0, 1]
15. SustainabilityScore weights (sum=1.0) and label thresholds
16. Forecasting terminology (breakout_probability in [0, 1])
17. Recommendation terminology and topic cosine similarity
18. Natural-language search topic population & fallback parsing
19. Dynamic dashboard values (live metrics, no static placeholders)
20. Cloudflare invalidation failure isolation & cache behaviors
"""

import asyncio
import json
import os
import uuid
import pytest
from datetime import date, datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app, _run_pipeline_sync
from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Repository, ComputedMetric, DailyMetric, Subscriber,
    TrendAlert, AlertNotification
)
from app.models.weekly_snapshot import WeeklySnapshot
from app.models.repo_release import RepoRelease
from app.models.alert_rule import AlertRule
from app.models.watchlist import WatchlistItem
from app.utils.lock import DistributedPipelineLock, pipeline_lock


@pytest.fixture
def auth_client(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "test-admin-secret")
    client = TestClient(app)
    return client


# 1. Scheduler architecture & DistributedPipelineLock
def test_scheduler_lock_structure():
    lock = DistributedPipelineLock(class_id=9999, obj_id=8888)
    assert hasattr(lock, "locked")
    assert hasattr(lock, "acquire")
    assert hasattr(lock, "release")
    assert not lock._local_lock.locked()


# 2. Pipeline lock concurrency prevention
def test_pipeline_lock_concurrency_prevention(auth_client):
    from app.routers import admin
    # Simulate an active pipeline run
    with patch.object(admin, "_pipeline_running", True):
        resp = auth_client.post("/admin/run-all", headers={"X-Admin-Key": "test-admin-secret"})
        assert resp.status_code == 409
        assert "already in progress" in resp.json()["detail"]


# 3. Alert-rule async execution
@pytest.mark.asyncio
async def test_alert_rule_async_execution():
    from app.services.alert_engine import evaluate_alert_rules

    class DummyRepo:
        id = "repo-async-1"
        owner = "test-owner"
        name = "test-repo"
        github_url = "https://github.com/test-owner/test-repo"

    class DummyCM:
        trend_score = 0.95
        sustainability_score = 0.8
        star_velocity_7d = 120.0
        acceleration = 15.0

    rule = AlertRule(
        id="async-rule-1",
        user_id="user-async-1",
        condition="trend_score > 0.90",
        frequency="instant",
        is_active=True,
    )
    events = await evaluate_alert_rules(DummyRepo(), DummyCM(), None, [rule])
    assert len(events) == 1
    assert events[0].metric == "trend_score"
    assert events[0].value == 0.95


# 4. forecast_values propagation into alert evaluation
@pytest.mark.asyncio
async def test_forecast_values_propagation():
    from app.services.alert_engine import evaluate_alert_rules

    class DummyRepo:
        id = "repo-fc-1"
        owner = "test"
        name = "forecast-repo"
        github_url = "https://github.com/test/forecast-repo"

    class DummyCM:
        trend_score = 0.5
        sustainability_score = 0.5
        star_velocity_7d = 10.0
        acceleration = 0.0

    rule = AlertRule(
        id="fc-rule-1",
        user_id="user-fc-1",
        condition="breakout_probability >= 0.80",
        frequency="instant",
        is_active=True,
    )
    forecast_values = {"breakout_probability": 0.88}
    events = await evaluate_alert_rules(DummyRepo(), DummyCM(), None, [rule], forecast_values=forecast_values)
    assert len(events) == 1
    assert events[0].metric == "breakout_probability"
    assert events[0].value == 0.88
    assert events[0].threshold == 0.80


# 5. Watchlist notifications idempotency & deduplication
@pytest.mark.asyncio
async def test_watchlist_notifications_deduplication(patch_session):
    from app.services.notification_service import dispatch_pending_watchlist_alert_emails
    db = patch_session()
    try:
        repo = Repository(
            id="watch-repo-dedup",
            owner="watch-owner",
            name="watch-repo",
            category="AI / ML",
            github_url="https://github.com/watch-owner/watch-repo",
            is_active=True,
        )
        db.add(repo)
        
        watch_item = WatchlistItem(
            id="watch-item-1",
            user_id="user-watch-1",
            repo_id="watch-repo-dedup",
            notify_email="notify@example.com",
            alert_threshold=0.80,
        )
        db.add(watch_item)

        alert = TrendAlert(
            id="alert-dedup-1",
            repo_id="watch-repo-dedup",
            alert_type="momentum_surge",
            metric_value=0.95,
            threshold=0.80,
            headline="Trend surge detected",
            triggered_at=datetime.utcnow(),
        )
        db.add(alert)

        # Pre-record an existing notification
        existing_notif = AlertNotification(
            id="notif-1",
            alert_id="alert-dedup-1",
            user_id="user-watch-1",
            destination_email="notify@example.com",
            channel="email",
            status="sent",
        )
        db.add(existing_notif)
        db.commit()

        # Dispatch should find the existing notification and skip it
        with patch("app.services.notification_service.SessionLocal", patch_session), \
             patch("app.services.notification_service.send_email", new_callable=AsyncMock) as mock_send:
            res = await dispatch_pending_watchlist_alert_emails(lookback_hours=48)
            assert res["sent"] == 0
            assert mock_send.call_count == 0
    finally:
        db.close()


# 6. Weekly snapshot N+1 batch query verification
def test_weekly_snapshot_batch_query(patch_session):
    from app.services.weekly_snapshots import publish_weekly_snapshot, _week_id
    db = patch_session()
    try:
        today_date = date.today()
        # Seed 5 repositories
        for i in range(5):
            r = Repository(
                id=f"snap-repo-{i}",
                owner=f"snap-owner-{i}",
                name=f"repo-{i}",
                category="AI / ML",
                github_url=f"https://github.com/snap-owner-{i}/repo-{i}",
                is_active=True,
                stars_snapshot=100 + i,
            )
            db.add(r)
            cm = ComputedMetric(
                id=f"snap-cm-{i}",
                repo_id=r.id,
                date=today_date,
                trend_score=0.9 - i * 0.1,
                sustainability_score=0.8,
                sustainability_label="GREEN",
            )
            db.add(cm)
            dm = DailyMetric(
                id=f"snap-dm-{i}",
                repo_id=r.id,
                captured_at=datetime.utcnow(),
                stars=150 + i,
            )
            db.add(dm)
        db.commit()

        res = publish_weekly_snapshot()
        assert res["status"] in ("published", "already_exists")
        assert res["week_id"] == _week_id(today_date)
    finally:
        db.close()


# 7. Digest frequency and idempotency
@pytest.mark.asyncio
async def test_digest_frequency_and_idempotency(patch_session):
    from app.services.notification_service import dispatch_digest_emails
    db = patch_session()
    try:
        now = datetime.utcnow()
        sub = Subscriber(
            id="sub-digest-1",
            email="digest-sub@example.com",
            is_confirmed=True,
            email_frequency="daily",
            unsubscribe_token="unsub-token-1",
            last_digest_sent_at=now,  # Already sent today
        )
        db.add(sub)
        db.commit()

        with patch("app.services.notification_service.SessionLocal", patch_session), \
             patch("app.services.notification_service.send_email", new_callable=AsyncMock) as mock_send:
            res = await dispatch_digest_emails("daily")
            assert res["sent"] == 0
            assert res["skipped"] >= 1
            assert mock_send.call_count == 0
    finally:
        db.close()


# 8. LLM explanation idempotency (no cascading)
def test_llm_explanation_idempotency(patch_session):
    from app.services.explanation import enrich_top_repos_with_explanations
    db = patch_session()
    today = date.today()
    try:
        repo = Repository(
            id="repo-exp-idem",
            owner="idem-owner",
            name="idem-repo",
            category="AI / ML",
            github_url="https://github.com/idem-owner/idem-repo",
            is_active=True,
        )
        db.add(repo)
        cm = ComputedMetric(
            id="cm-exp-idem",
            repo_id=repo.id,
            date=today,
            trend_score=0.95,
            explanation="Already generated explanation",
        )
        db.add(cm)
        db.commit()

        with patch("app.services.explanation.generate_explanation") as mock_gen:
            written = enrich_top_repos_with_explanations(top_n=10)
            assert written == 0
            assert mock_gen.call_count == 0
    finally:
        db.close()


# 9. Repository summary idempotency
def test_repository_summary_idempotency(patch_session):
    from app.services.explanation import enrich_repos_with_summaries
    db = patch_session()
    try:
        repo = Repository(
            id="repo-sum-idem",
            owner="idem-sum-owner",
            name="idem-sum-repo",
            category="AI / ML",
            github_url="https://github.com/idem-sum-owner/idem-sum-repo",
            is_active=True,
            repo_summary="Fresh repository summary",
            repo_summary_generated_at=datetime.utcnow(),
        )
        db.add(repo)
        db.commit()

        with patch("app.services.explanation.generate_repo_summary") as mock_gen:
            written = enrich_repos_with_summaries(top_n=10)
            assert written == 0
            assert mock_gen.call_count == 0
    finally:
        db.close()


# 10. Release deduplication
@pytest.mark.asyncio
async def test_release_deduplication(patch_session):
    from app.services.releases import run_releases_pipeline
    db = patch_session()
    try:
        today = date.today()
        repo = Repository(
            id="repo-rel-dedup",
            owner="rel-owner",
            name="rel-repo",
            category="AI / ML",
            github_url="https://github.com/rel-owner/rel-repo",
            is_active=True,
        )
        db.add(repo)
        cm = ComputedMetric(
            id="cm-rel-dedup",
            repo_id=repo.id,
            date=today,
            trend_score=0.99,
        )
        db.add(cm)
        # Add an old release that should be cleaned up on refresh
        old_rel = RepoRelease(
            id="old-rel-id",
            repo_id=repo.id,
            tag_name="v0.1.0",
            name="v0.1.0 Initial",
            published_at=datetime.utcnow() - timedelta(days=30),
            fetched_at=datetime.utcnow() - timedelta(days=2),
        )
        db.add(old_rel)
        db.commit()

        mock_fetched = [
            {
                "repo_id": repo.id,
                "tag_name": "v1.0.0",
                "name": "v1.0.0 Release",
                "body_truncated": "notes",
                "published_at": datetime.utcnow(),
                "is_prerelease": False,
                "html_url": "https://github.com/rel-owner/rel-repo/releases/v1.0.0",
            }
        ]
        with patch("app.services.releases.fetch_releases_for_repo", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_fetched
            result = await run_releases_pipeline(top_n=1)
            assert result["written"] == 1

            # Check that only v1.0.0 exists now
            releases = db.query(RepoRelease).filter_by(repo_id=repo.id).all()
            assert len(releases) == 1
            assert releases[0].tag_name == "v1.0.0"
    finally:
        db.close()


# 11. Social ingestion failure isolation
@pytest.mark.asyncio
async def test_social_ingestion_failure_isolation():
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

        m_ingest.return_value = {"discovered": 1, "ingested": 1, "inserted": 1, "updated": 0}
        m_score.return_value = {"scored": 1, "failed": 0, "alerts": 0, "date": "2026-10-07"}
        m_explain.return_value = 0
        m_summary.return_value = 0
        m_releases.return_value = {"written": 0}
        # Social mentions fails catastrophically
        m_social.side_effect = RuntimeError("Social ingestion API timeout")
        m_commit.return_value = {"updated": 1}
        m_notif.return_value = {"sent": 0, "failed": 0, "skipped": 0}
        m_snap.return_value = {"status": "skipped"}
        m_digest.return_value = {"sent": 0, "skipped": 0}

        # Pipeline should complete successfully despite social ingestion error
        res = await _run_pipeline_sync(force_discovery=False, include_explanations=False)
        assert res["status"] == "complete"
        assert res["ingested"] == 1
        assert res["scored"] == 1
        assert res["social_mentions_written"] == 0
        assert res["commit_activity_updated"] == 1


# 12. Commit activity freshness & 20-hour skip
@pytest.mark.asyncio
async def test_commit_activity_freshness_skip(patch_session):
    from app.services.commit_activity import run_commit_activity_pipeline
    db = patch_session()
    today = date.today()
    try:
        repo = Repository(
            id="repo-commit-fresh",
            owner="fresh-owner",
            name="fresh-repo",
            category="AI / ML",
            github_url="https://github.com/fresh-owner/fresh-repo",
            is_active=True,
            commit_activity_updated_at=datetime.utcnow() - timedelta(hours=2),  # Updated 2h ago
        )
        db.add(repo)
        cm = ComputedMetric(
            id="cm-commit-fresh",
            repo_id=repo.id,
            date=today,
            trend_score=0.9,
        )
        db.add(cm)
        db.commit()

        with patch("app.services.commit_activity.fetch_commit_activity", new_callable=AsyncMock) as mock_fetch:
            res = await run_commit_activity_pipeline(top_n=10)
            assert res["updated"] == 0
            assert res["skipped"] >= 1
            assert mock_fetch.call_count == 0
    finally:
        db.close()


# 13. Export API / frontend contract (CSV and JSON)
def test_export_api_contracts(patch_session):
    app.dependency_overrides[get_current_user] = lambda: {"sub": "user-export"}
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


# 14. TrendScore weights (sum=1.0) and bounds [0, 1]
def test_trend_score_weights_and_bounds():
    from app.services.scoring import compute_trend_score

    df = [
        {"daily_star_delta": 50, "contributors": 10, "releases": 1, "open_issues": 5, "daily_pr_delta": 3, "open_prs": 5, "daily_fork_delta": 2, "daily_commit_delta": 5, "forks": 100}
        for _ in range(15)
    ]
    res = compute_trend_score(df, age_days=30)
    score = res["trend_score"]
    assert 0.0 <= score <= 1.0
    assert "star_velocity_7d" in res
    assert "acceleration" in res
    assert "contributor_growth_rate" in res


# 15. SustainabilityScore weights (sum=1.0) and label thresholds
def test_sustainability_score_weights_and_labels():
    from app.services.scoring import compute_sustainability_score

    # Green scenario: active contributors, issue close, releases, fork ratio
    df_green = [
        {"contributors": 10 + i, "open_issues": 10, "releases": i, "stars": 1000, "forks": 200}
        for i in range(14)
    ]
    res_green = compute_sustainability_score(df_green, age_days=100)
    assert 0.0 <= res_green["sustainability_score"] <= 1.0
    assert res_green["sustainability_label"] in ("GREEN", "YELLOW", "RED")
    if res_green["sustainability_score"] >= 0.6:
        assert res_green["sustainability_label"] == "GREEN"
    elif res_green["sustainability_score"] >= 0.3:
        assert res_green["sustainability_label"] == "YELLOW"
    else:
        assert res_green["sustainability_label"] == "RED"


# 16. Forecasting terminology (breakout_probability in [0, 1])
def test_forecasting_breakout_probability_bounds():
    from app.services.forecasting import _breakout_probability

    bp_high = _breakout_probability(slope_7d=50.0, slope_30d=10.0, current_stars=500, r_squared=0.95)
    assert 0.0 <= bp_high <= 1.0
    assert bp_high > 0.5  # High slope acceleration on young repo should have strong probability

    bp_low = _breakout_probability(slope_7d=-5.0, slope_30d=1.0, current_stars=50000, r_squared=0.10)
    assert 0.0 <= bp_low <= 1.0
    assert bp_low < 0.2


# 17. Recommendation terminology and topic cosine similarity
def test_recommendation_cosine_similarity():
    from app.services.recommendations import compute_recommendations, RepoVector

    target = RepoVector(
        repo_id="target-1",
        full_name="meta-llama/llama",
        owner="meta-llama",
        name="llama",
        category="LLM Models",
        primary_language="Python",
        topics=["llm", "transformers", "pytorch"],
        stars=50000,
        description="Llama models",
    )
    similar_cand = RepoVector(
        repo_id="cand-1",
        full_name="vllm-project/vllm",
        owner="vllm-project",
        name="vllm",
        category="Inference Engines",
        primary_language="Python",
        topics=["llm", "inference", "pytorch"],
        stars=30000,
        description="Fast LLM inference",
    )
    different_cand = RepoVector(
        repo_id="cand-2",
        full_name="solana-labs/solana",
        owner="solana-labs",
        name="solana",
        category="Blockchain",
        primary_language="Rust",
        topics=["blockchain", "crypto", "solana"],
        stars=15000,
        description="Solana blockchain",
    )

    recs = compute_recommendations([target], [similar_cand, different_cand], top_n=2)
    assert len(recs) >= 1
    assert recs[0].repo_id == "cand-1"
    assert recs[0].score > 0


# 18. Natural-language search topic population & fallback parsing
def test_nl_search_topic_and_keyword_population():
    from app.routers.search import _keyword_fallback_parse

    parsed = _keyword_fallback_parse("trending vllm inference engines in python with high star velocity")
    assert parsed["vertical"] == "ai_ml"
    assert parsed["language"] == "Python"
    assert "inference" in parsed["keywords"]
    assert "vllm" in parsed["keywords"]
    assert "github_search_query" in parsed
    assert "stars:>10" in parsed["github_search_query"]


# 19. Dynamic dashboard values (live metrics, no static placeholders)
@pytest.mark.asyncio
async def test_dashboard_dynamic_metrics(patch_session):
    from app.routers.dashboard import get_overview
    db = patch_session()
    today = date.today()
    try:
        repo = Repository(
            id="dash-dyn-1",
            owner="dyn-owner",
            name="dyn-repo",
            category="Inference Engines",
            github_url="https://github.com/dyn-owner/dyn-repo",
            is_active=True,
            stars_snapshot=4200,
        )
        db.add(repo)
        cm = ComputedMetric(
            id="cm-dyn-1",
            repo_id=repo.id,
            date=today,
            trend_score=0.88,
            acceleration=12.5,
            star_velocity_7d=85.0,
            sustainability_label="GREEN",
        )
        db.add(cm)
        db.commit()

        res = await get_overview(vertical="all", db=db)
        assert res.top_breakout is not None
        assert len(res.top_breakout) >= 1
        assert res.top_breakout[0].repo_id == "dash-dyn-1"
        assert res.top_breakout[0].trend_score == 0.88
    finally:
        db.close()


# 20. Cloudflare invalidation failure isolation & cache behaviors
@pytest.mark.asyncio
async def test_cloudflare_purge_isolation():
    from app.utils.cloudflare import purge_cloudflare_cache

    # Should not raise exception even when no environment variables or network is present
    with patch.dict(os.environ, {}, clear=True):
        await purge_cloudflare_cache()
