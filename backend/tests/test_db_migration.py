import uuid
from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Repository, ComputedMetric, DailyMetric, RepoContributor
from app.database import get_db

client = TestClient(app)


def test_leaderboard_db_query(db_session):
    # Seed a repo with metrics in test DB
    repo_id = str(uuid.uuid4())
    repo = Repository(
        id=repo_id,
        owner="test-org",
        name="test-leaderboard-repo",
        category="AI / ML",
        github_url="https://github.com/test-org/test-leaderboard-repo",
        primary_language="Python",
        stars_snapshot=5000,
        age_days=100,
        is_active=True,
        source="seed",
    )
    db_session.add(repo)
    
    today = date.today()
    cm = ComputedMetric(
        repo_id=repo_id,
        date=today,
        star_velocity_7d=350.0,
        star_velocity_30d=1200.0,
        acceleration=50.0,
        trend_score=92.5,
        sustainability_score=0.88,
        sustainability_label="GREEN",
    )
    db_session.add(cm)

    dm = DailyMetric(
        repo_id=repo_id,
        captured_at=datetime.now(timezone.utc).replace(tzinfo=None),
        stars=5000,
        forks=600,
        open_issues=25,
    )
    db_session.add(dm)
    db_session.commit()

    # Override get_db dependency for TestClient
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        resp = client.get("/dashboard/leaderboard?period=7d&vertical=ai_ml")
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "db"
        assert len(data["entries"]) > 0
        top = [e for e in data["entries"] if e["name"] == "test-leaderboard-repo"]
        assert len(top) == 1
        assert top[0]["owner"] == "test-org"
        assert top[0]["current_stars"] == 5000
        assert top[0]["star_gain"] == 350
        assert top[0]["sustainability_label"] == "GREEN"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_compare_repos_db_lookup(db_session):
    repo_id = str(uuid.uuid4())
    repo = Repository(
        id=repo_id,
        owner="compare-org",
        name="compare-repo",
        category="LLM / Agent",
        github_url="https://github.com/compare-org/compare-repo",
        primary_language="TypeScript",
        stars_snapshot=3000,
        age_days=120,
        is_active=True,
    )
    db_session.add(repo)

    today = date.today()
    cm = ComputedMetric(
        repo_id=repo_id,
        date=today,
        trend_score=85.0,
        sustainability_score=0.75,
        sustainability_label="GREEN",
        star_velocity_7d=120.0,
    )
    db_session.add(cm)
    db_session.commit()

    app.dependency_overrides[get_db] = lambda: db_session
    try:
        resp = client.get("/repos/compare?ids=compare-org/compare-repo")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["is_tracked"] is True
        assert data[0]["trend_score"] == 85.0
        assert data[0]["sustainability_label"] == "GREEN"
    finally:
        app.dependency_overrides.pop(get_db, None)
