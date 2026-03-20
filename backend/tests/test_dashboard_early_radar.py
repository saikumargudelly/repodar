import uuid
import asyncio
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import ComputedMetric, DailyMetric, Repository
from app.routers import dashboard
from app.routers.dashboard import BreakoutSignal, MomentumStage, _W, _compute_breakout, get_early_radar


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _make_repo(session, *, owner: str, name: str, category: str, stars_snapshot: int, age_days: int = 30) -> Repository:
    repo = Repository(
        id=str(uuid.uuid4()),
        owner=owner,
        name=name,
        category=category,
        github_url=f"https://github.com/{owner}/{name}",
        description="test repo",
        primary_language="Python",
        age_days=age_days,
        is_active=True,
        source="seed",
        stars_snapshot=stars_snapshot,
    )
    session.add(repo)
    session.flush()
    return repo


def _add_computed_metric(
    session,
    *,
    repo_id: str,
    scored_date: date,
    trend_score: float,
    acceleration: float,
    vel7: float,
    vel30: float,
    contrib_growth: float = 0.2,
    sustainability_score: float = 0.7,
    sustainability_label: str = "GREEN",
) -> None:
    session.add(
        ComputedMetric(
            repo_id=repo_id,
            date=scored_date,
            trend_score=trend_score,
            acceleration=acceleration,
            star_velocity_7d=vel7,
            star_velocity_30d=vel30,
            contributor_growth_rate=contrib_growth,
            sustainability_score=sustainability_score,
            sustainability_label=sustainability_label,
        )
    )


def _add_daily_star_series(session, *, repo_id: str, stars: list[int]) -> None:
    start = _utcnow_naive() - timedelta(days=len(stars) - 1)
    for idx, star_count in enumerate(stars):
        session.add(
            DailyMetric(
                id=str(uuid.uuid4()),
                repo_id=repo_id,
                captured_at=start + timedelta(days=idx),
                stars=star_count,
            )
        )


def test_compute_breakout_dormant_stage_when_velocity_and_accel_zero():
    _, _, _, _, _, _, stage = _compute_breakout(
        accel=0.0,
        vel7=0.0,
        vel30=0.0,
        trend_score=0.0,
        contrib_growth=0.0,
        age_days=30,
        stars=100,
        max_age_days=90,
        max_stars=1000,
        consistency_score=0.0,
    )
    assert stage == MomentumStage.DORMANT


def test_compute_breakout_pre_viral_when_eta_within_14_days():
    _, _, _, _, eta, _, stage = _compute_breakout(
        accel=0.2,
        vel7=140.0,
        vel30=30.0,
        trend_score=1.0,
        contrib_growth=0.2,
        age_days=20,
        stars=4900,
        max_age_days=90,
        max_stars=1000,
        consistency_score=0.9,
    )
    assert eta is not None and eta <= 14
    assert stage == MomentumStage.PRE_VIRAL


def test_compute_breakout_contains_fork_momentum_signal_when_proxy_high():
    _, _, _, fork_proxy, _, signals, _ = _compute_breakout(
        accel=0.8,
        vel7=12.0,
        vel30=1.0,
        trend_score=0.6,
        contrib_growth=0.2,
        age_days=14,
        stars=1,
        max_age_days=90,
        max_stars=1000,
        consistency_score=0.8,
    )
    assert fork_proxy > 1.0
    assert BreakoutSignal.FORK_MOMENTUM in signals


def test_weight_sum_is_exactly_one():
    assert sum(_W.values()) == pytest.approx(1.0, abs=1e-12)


def test_build_category_velocity_map_uses_latest_metric_rows(db_session):
    scored_date = date.today()

    repo_a = _make_repo(
        db_session,
        owner="alpha",
        name="steady",
        category="model_training",
        stars_snapshot=200,
    )
    repo_b = _make_repo(
        db_session,
        owner="beta",
        name="fast",
        category="evaluation",
        stars_snapshot=300,
    )

    _add_computed_metric(
        db_session,
        repo_id=repo_a.id,
        scored_date=scored_date,
        trend_score=1.1,
        acceleration=0.8,
        vel7=14.0,
        vel30=7.0,
    )
    _add_computed_metric(
        db_session,
        repo_id=repo_b.id,
        scored_date=scored_date,
        trend_score=1.3,
        acceleration=1.0,
        vel7=28.0,
        vel30=12.0,
    )
    db_session.commit()

    cat_map = dashboard._build_category_velocity_map_uncached(db_session, scored_date)

    assert cat_map["model_training"] == pytest.approx(14.0)
    assert cat_map["evaluation"] == pytest.approx(28.0)


def test_early_radar_require_consistent_growth_filters_unsustained_repo(db_session, monkeypatch):
    scored_date = date.today()

    sustained_repo = _make_repo(
        db_session,
        owner="steady",
        name="winner",
        category="model_training",
        stars_snapshot=220,
    )
    unsustained_repo = _make_repo(
        db_session,
        owner="spiky",
        name="loser",
        category="model_training",
        stars_snapshot=220,
    )

    _add_computed_metric(
        db_session,
        repo_id=sustained_repo.id,
        scored_date=scored_date,
        trend_score=1.4,
        acceleration=1.2,
        vel7=32.0,
        vel30=18.0,
        contrib_growth=0.4,
    )
    _add_computed_metric(
        db_session,
        repo_id=unsustained_repo.id,
        scored_date=scored_date,
        trend_score=1.5,
        acceleration=1.3,
        vel7=35.0,
        vel30=20.0,
        contrib_growth=0.5,
    )

    # 7/7 gains (sustained)
    _add_daily_star_series(db_session, repo_id=sustained_repo.id, stars=[100, 110, 121, 133, 146, 160, 175, 191])
    # Only 2 positive gains in last 7 transitions (unsustained)
    _add_daily_star_series(db_session, repo_id=unsustained_repo.id, stars=[100, 130, 129, 128, 120, 119, 118, 117])
    db_session.commit()

    async def _fake_category_map(db, latest_date):
        return {}

    monkeypatch.setattr(dashboard, "_build_category_velocity_map", _fake_category_map)

    rows = asyncio.run(
        get_early_radar(
            require_consistent_growth=True,
            min_stars=10,
            max_stars=1000,
            max_age_days=90,
            limit=50,
            db=db_session,
        )
    )

    owners_and_names = {(row.owner, row.name) for row in rows}
    assert ("steady", "winner") in owners_and_names
    assert ("spiky", "loser") not in owners_and_names


def test_early_radar_supports_combined_filters(db_session, monkeypatch):
    scored_date = date.today()

    repo = _make_repo(
        db_session,
        owner="combo",
        name="previral",
        category="evaluation",
        stars_snapshot=4900,
    )
    _add_computed_metric(
        db_session,
        repo_id=repo.id,
        scored_date=scored_date,
        trend_score=2.0,
        acceleration=1.4,
        vel7=140.0,
        vel30=40.0,
        contrib_growth=0.5,
    )
    _add_daily_star_series(db_session, repo_id=repo.id, stars=[4500, 4560, 4625, 4695, 4765, 4835, 4900, 4965])
    db_session.commit()

    async def _fake_category_map(db, latest_date):
        return {"evaluation": 20.0}

    monkeypatch.setattr(dashboard, "_build_category_velocity_map", _fake_category_map)

    rows = asyncio.run(
        get_early_radar(
            category="evaluation",
            language="python",
            max_stars=6000,
            require_pre_viral=True,
            momentum_stage=MomentumStage.PRE_VIRAL,
            min_star_velocity_7d=50,
            limit=20,
            db=db_session,
        )
    )

    assert len(rows) == 1
    assert rows[0].owner == "combo"
    assert rows[0].name == "previral"
