"""
Shared pytest fixtures for scoring and ingestion tests.

Uses an **in-memory SQLite** database so tests are fast, isolated and leave no
side-effects on the real `repodar.db`.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── In-memory DB setup ────────────────────────────────────────────────────────

# Override the connection URL before any app modules are imported.
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.database import Base  # noqa: E402 (must be after env override)
from app.models import Repository, DailyMetric  # noqa: E402


TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def engine():
    e = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(e)
    yield e
    Base.metadata.drop_all(e)
    e.dispose()


@pytest.fixture(scope="function")
def db_session(engine):
    """Plain session used in tests that don't need ingestion patching."""
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


# ── Helper: patch SessionLocal so ingestion/scoring use the in-memory DB ─────

@pytest.fixture(scope="function")
def patch_session(engine, monkeypatch):
    """
    Patches SessionLocal in both app.database and app.services.ingestion to
    create sessions from the in-memory test engine.

    The fixture  returns a factory callable — use `patch_session()` to open a
    new session for data-setup or post-assertion queries.  Each call creates
    an independent session so `db.close()` inside the code under test doesn't
    invalidate the test's own session.
    """
    import app.database as db_module
    import app.services.ingestion as ingestion_module

    TestSession = sessionmaker(bind=engine)

    monkeypatch.setattr(db_module, "SessionLocal", TestSession)
    monkeypatch.setattr(ingestion_module, "SessionLocal", TestSession)
    return TestSession   # tests call patch_session() to get a fresh session


# ── Factory helpers ───────────────────────────────────────────────────────────

def make_repo(
    session,
    owner: str = "testowner",
    name: str = "testrepo",
    source: str = "seed",
    is_active: bool = True,
    category: str = "ai_ml",
    age_days: int = 180,
    last_seen_trending: datetime | None = None,
) -> Repository:
    repo = Repository(
        id=str(uuid.uuid4()),
        owner=owner,
        name=name,
        category=category,
        description="A test repo",
        github_url=f"https://github.com/{owner}/{name}",
        primary_language="Python",
        source=source,
        is_active=is_active,
        age_days=age_days,
        discovered_at=datetime.now(timezone.utc).replace(tzinfo=None) if source == "auto_discovered" else None,
        last_seen_trending=last_seen_trending,
    )
    session.add(repo)
    session.commit()
    return repo


def make_daily_metrics(
    session,
    repo_id: str,
    num_days: int = 14,
    base_stars: int = 5_000,
    daily_star_delta: int = 50,
    contributors: int = 120,
    forks: int = 800,
    open_issues: int = 30,
    releases: int = 10,
    merged_prs: int = 200,
    open_prs: int = 15,
    daily_commit_delta: int = 8,
) -> list[DailyMetric]:
    """Insert `num_days` rows of synthetic daily metrics for a repo."""
    rows = []
    for i in range(num_days):
        day_offset = num_days - 1 - i
        captured = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=day_offset)
        row = DailyMetric(
            id=str(uuid.uuid4()),
            repo_id=repo_id,
            captured_at=captured,
            stars=base_stars + i * daily_star_delta,
            forks=forks + i * 2,
            watchers=base_stars // 10,
            contributors=contributors,
            open_issues=open_issues,
            open_prs=open_prs,
            merged_prs=merged_prs + i,
            releases=releases,
            commit_count=1000 + i * daily_commit_delta,
            daily_star_delta=daily_star_delta,
            daily_fork_delta=2,
            daily_pr_delta=1,
            daily_commit_delta=daily_commit_delta,
            language_breakdown='{"Python": 95, "Shell": 5}',
        )
        session.add(row)
        rows.append(row)
    session.commit()
    return rows


def build_df(
    num_days: int = 14,
    base_stars: int = 5_000,
    daily_star_delta: int = 50,
    contributors: int = 120,
    forks: int = 800,
    open_issues: int = 30,
    releases: int = 10,
    merged_prs: int = 200,
    open_prs: int = 15,
    daily_fork_delta: int = 2,
    daily_commit_delta: int = 8,
    daily_pr_delta: int = 1,
) -> pd.DataFrame:
    """Build a pandas DataFrame matching the shape produced by _load_window_df."""
    from datetime import date
    rows = []
    for i in range(num_days):
        rows.append({
            "day": (datetime.now(timezone.utc).date() - timedelta(days=num_days - 1 - i)).isoformat(),
            "stars": base_stars + i * daily_star_delta,
            "forks": forks + i * daily_fork_delta,
            "watchers": base_stars // 10,
            "contributors": contributors,
            "open_issues": open_issues,
            "open_prs": open_prs,
            "merged_prs": merged_prs + i,
            "releases": releases,
            "commit_count": 1000 + i * daily_commit_delta,
            "daily_star_delta": daily_star_delta,
            "daily_fork_delta": daily_fork_delta,
            "daily_pr_delta": daily_pr_delta,
            "daily_commit_delta": daily_commit_delta,
        })
    return pd.DataFrame(rows)
