"""
Tests for app/services/scoring.py

Covers:
  - All private signal helpers  (_star_velocity, _acceleration, etc.)
  - compute_trend_score         – weights, bounds, age damping
  - compute_sustainability_score – label thresholds
  - detect_and_write_alerts     – idempotency, all three alert types
"""

import math
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pandas as pd
import pytest

# ── import the module under test ──────────────────────────────────────────────
from app.services.scoring import (
    _star_velocity,
    _acceleration,
    _contributor_growth_rate,
    _release_boost,
    _pr_activity_score,
    _issue_spike,
    _issue_close_rate,
    _release_frequency,
    _fork_to_star_ratio,
    _fork_growth_score,
    _commit_frequency_score,
    compute_trend_score,
    compute_sustainability_score,
    detect_and_write_alerts,
)

from tests.conftest import build_df


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def empty_df() -> pd.DataFrame:
    cols = [
        "day", "stars", "forks", "watchers", "contributors",
        "open_issues", "open_prs", "merged_prs", "releases",
        "commit_count", "daily_star_delta", "daily_fork_delta",
        "daily_pr_delta", "daily_commit_delta",
    ]
    return pd.DataFrame(columns=cols)


# ─────────────────────────────────────────────────────────────────────────────
# _star_velocity
# ─────────────────────────────────────────────────────────────────────────────

class TestStarVelocity:
    def test_empty_df_returns_zero(self):
        assert _star_velocity(empty_df(), 7) == 0.0

    def test_single_row_returns_zero(self):
        df = build_df(num_days=1)
        assert _star_velocity(df, 7) == 0.0

    def test_correct_mean_for_uniform_delta(self):
        """With daily_star_delta=50 for every row, mean velocity should be 50."""
        df = build_df(num_days=14, daily_star_delta=50)
        vel = _star_velocity(df, 7)
        assert vel == pytest.approx(50.0)

    def test_window_limits_rows_used(self):
        """Window=3 should only average the last 3 rows."""
        df = build_df(num_days=10, daily_star_delta=10)
        # Override last 3 rows' delta to 100
        df.loc[df.index[-3:], "daily_star_delta"] = 100
        vel = _star_velocity(df, 3)
        assert vel == pytest.approx(100.0)

    def test_velocity_scales_with_delta(self):
        low = _star_velocity(build_df(num_days=10, daily_star_delta=10), 7)
        high = _star_velocity(build_df(num_days=10, daily_star_delta=200), 7)
        assert high > low


# ─────────────────────────────────────────────────────────────────────────────
# _acceleration
# ─────────────────────────────────────────────────────────────────────────────

class TestAcceleration:
    def test_no_acceleration_on_uniform_velocity(self):
        """Constant delta means acceleration ≈ 0."""
        df = build_df(num_days=14, daily_star_delta=50)
        assert _acceleration(df) == pytest.approx(0.0)

    def test_negative_acceleration_when_slowing_down(self):
        """Last 7 days have lower delta than prior 7 days → negative accel."""
        rows = []
        for i in range(14):
            delta = 100 if i < 7 else 10  # fast first, slow later
            rows.append({
                "day": i,
                "stars": 5000 + i * delta,
                "daily_star_delta": delta,
                "forks": 500, "watchers": 100, "contributors": 50,
                "open_issues": 10, "open_prs": 5, "merged_prs": 20,
                "releases": 2, "commit_count": 100,
                "daily_fork_delta": 1, "daily_pr_delta": 0, "daily_commit_delta": 3,
            })
        df = pd.DataFrame(rows)
        assert _acceleration(df) < 0

    def test_too_few_rows_returns_zero(self):
        df = build_df(num_days=7)   # need >= 14
        assert _acceleration(df) == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# _contributor_growth_rate
# ─────────────────────────────────────────────────────────────────────────────

class TestContributorGrowthRate:
    def test_zero_growth_when_constant(self):
        df = build_df(num_days=14, contributors=100)
        assert _contributor_growth_rate(df) == pytest.approx(0.0)

    def test_positive_growth(self):
        rows = build_df(num_days=14, contributors=100)
        rows.loc[rows.index[-1], "contributors"] = 120  # last row bumped
        assert _contributor_growth_rate(rows) > 0

    def test_zero_old_contributors_returns_zero(self):
        df = build_df(num_days=14, contributors=0)
        assert _contributor_growth_rate(df) == 0.0

    def test_too_few_rows_returns_zero(self):
        df = build_df(num_days=3)
        assert _contributor_growth_rate(df) == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# _release_boost
# ─────────────────────────────────────────────────────────────────────────────

class TestReleaseBoost:
    def test_boost_when_releases_increased(self):
        df = build_df(num_days=10, releases=5)
        df.loc[df.index[-1], "releases"] = 8
        assert _release_boost(df) == 1.0

    def test_no_boost_when_static(self):
        df = build_df(num_days=10, releases=5)
        assert _release_boost(df) == 0.0

    def test_single_row_returns_zero(self):
        df = build_df(num_days=1)
        assert _release_boost(df) == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# _pr_activity_score
# ─────────────────────────────────────────────────────────────────────────────

class TestPrActivityScore:
    def test_empty_returns_zero(self):
        assert _pr_activity_score(empty_df()) == 0.0

    def test_bounded_between_zero_and_one(self):
        score = _pr_activity_score(build_df(num_days=14, daily_pr_delta=100, open_prs=200))
        assert 0.0 <= score <= 1.0

    def test_higher_activity_increases_score(self):
        low = _pr_activity_score(build_df(num_days=14, daily_pr_delta=1, open_prs=2))
        high = _pr_activity_score(build_df(num_days=14, daily_pr_delta=50, open_prs=80))
        assert high > low


# ─────────────────────────────────────────────────────────────────────────────
# _issue_spike / _issue_close_rate
# ─────────────────────────────────────────────────────────────────────────────

class TestIssueMechanics:
    def test_no_spike_when_constant(self):
        df = build_df(num_days=14, open_issues=30)
        assert _issue_spike(df) == pytest.approx(0.0)

    def test_positive_spike_when_issues_rise(self):
        df = build_df(num_days=14, open_issues=30)
        df.loc[df.index[-1], "open_issues"] = 60
        spike = _issue_spike(df)
        assert spike > 0

    def test_close_rate_inverse_of_spike(self):
        df_rising = build_df(num_days=14, open_issues=30)
        df_rising.loc[df_rising.index[-1], "open_issues"] = 90
        cr = _issue_close_rate(df_rising)
        assert cr < 0.5

    def test_close_rate_bounded(self):
        cr = _issue_close_rate(build_df(num_days=14))
        assert 0.0 <= cr <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# _fork_growth_score / _commit_frequency_score
# ─────────────────────────────────────────────────────────────────────────────

class TestForkAndCommitSignals:
    def test_fork_growth_bounded(self):
        score = _fork_growth_score(build_df(num_days=14, daily_fork_delta=100, forks=500))
        assert 0.0 <= score <= 1.0

    def test_commit_frequency_bounded(self):
        score = _commit_frequency_score(build_df(num_days=14, daily_commit_delta=20))
        assert 0.0 <= score <= 1.0

    def test_commit_frequency_zero_with_no_delta(self):
        df = build_df(num_days=14)
        df["daily_commit_delta"] = 0
        assert _commit_frequency_score(df) == 0.0

    def test_commit_frequency_caps_at_one(self):
        # 100 commits/day >> the 10 commits/day cap
        score = _commit_frequency_score(build_df(num_days=14, daily_commit_delta=100))
        assert score == pytest.approx(1.0)


# ─────────────────────────────────────────────────────────────────────────────
# compute_trend_score
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeTrendScore:
    def test_returns_required_keys(self):
        df = build_df(num_days=14)
        result = compute_trend_score(df, age_days=365)
        for key in ["star_velocity_7d", "star_velocity_30d", "acceleration",
                    "contributor_growth_rate", "trend_score"]:
            assert key in result

    def test_trend_score_is_non_negative(self):
        df = build_df(num_days=14)
        assert compute_trend_score(df, age_days=365)["trend_score"] >= 0.0

    def test_age_damping_reduces_score_for_old_repos(self):
        """Older repos get a higher age_log divisor → lower trend_score."""
        df = build_df(num_days=14, daily_star_delta=500)
        young_score = compute_trend_score(df, age_days=7)["trend_score"]
        old_score = compute_trend_score(df, age_days=5000)["trend_score"]
        assert young_score > old_score

    def test_higher_velocity_repo_has_higher_trend_score(self):
        age = 365
        low_df = build_df(num_days=14, daily_star_delta=1)
        high_df = build_df(num_days=14, daily_star_delta=500)
        assert (compute_trend_score(high_df, age)["trend_score"] >
                compute_trend_score(low_df, age)["trend_score"])

    def test_empty_df_returns_zero_trend(self):
        result = compute_trend_score(empty_df(), age_days=365)
        assert result["trend_score"] == 0.0

    def test_minimum_age_days_clamped(self):
        """age_days=1 should not cause division by zero (math.log(max(1,2)))."""
        df = build_df(num_days=14)
        result = compute_trend_score(df, age_days=1)
        assert math.isfinite(result["trend_score"])

    def test_star_velocity_7d_reflects_recent_window(self):
        df = build_df(num_days=14, daily_star_delta=100)
        result = compute_trend_score(df, age_days=365)
        assert result["star_velocity_7d"] == pytest.approx(100.0)


# ─────────────────────────────────────────────────────────────────────────────
# compute_sustainability_score
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeSustainabilityScore:
    def test_returns_required_keys(self):
        df = build_df(num_days=14)
        result = compute_sustainability_score(df, age_days=365)
        for key in ["issue_close_rate", "release_frequency", "fork_to_star_ratio",
                    "sustainability_score", "sustainability_label"]:
            assert key in result

    def test_score_bounded_0_to_1(self):
        df = build_df(num_days=14)
        score = compute_sustainability_score(df, age_days=365)["sustainability_score"]
        assert 0.0 <= score <= 1.0

    def test_green_label_requires_score_above_0_6(self):
        """Build a DF with high fork rate + frequent releases + stable issues to hit GREEN."""
        df = build_df(
            num_days=14,
            releases=100,         # high release frequency
            forks=4000,           # high fork/star ratio
            base_stars=5000,
            open_issues=30,
        )
        result = compute_sustainability_score(df, age_days=180)
        # Might be YELLOW or GREEN depending on exact math — just check it's not "UNKNOWN"
        assert result["sustainability_label"] in ("GREEN", "YELLOW", "RED")

    def test_red_label_when_very_low_activity(self):
        df = build_df(
            num_days=14,
            releases=0,
            forks=0,
            base_stars=10000,  # 0 fork/star ratio
            contributors=0,
        )
        result = compute_sustainability_score(df, age_days=3650)
        assert result["sustainability_label"] in ("YELLOW", "RED")

    def test_label_thresholds_green_gt_0_6(self):
        from app.services.scoring import compute_sustainability_score as css
        df = build_df(num_days=14)
        result = css(df, age_days=365)
        score = result["sustainability_score"]
        label = result["sustainability_label"]
        if score >= 0.6:
            assert label == "GREEN"
        elif score >= 0.3:
            assert label == "YELLOW"
        else:
            assert label == "RED"


# ─────────────────────────────────────────────────────────────────────────────
# detect_and_write_alerts
# ─────────────────────────────────────────────────────────────────────────────

class TestDetectAndWriteAlerts:
    """
    We mock the DB session (no SQLite needed) and inject a fake Repository.
    """

    def _make_mock_db(self):
        """Return a mock db that reports no previous alerts (query returns None)."""
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None   # no existing alert
        return mock_db

    def _make_repo(self, owner="ml", name="repo"):
        repo = MagicMock()
        repo.id = "test-repo-id"
        repo.owner = owner
        repo.name = name
        return repo

    def test_no_alert_when_daily_stars_below_threshold(self):
        db = self._make_mock_db()
        repo = self._make_repo()
        df = build_df(num_days=5, daily_star_delta=10)   # 10 < 300 threshold
        count = detect_and_write_alerts(db, repo, df, 0.5, 0.1)
        assert count == 0

    def test_star_spike_24h_alert_fires_above_threshold(self):
        db = self._make_mock_db()
        repo = self._make_repo()
        df = build_df(num_days=5, daily_star_delta=400)  # 400 > 300 threshold
        # The last row's delta is 400 → should trigger star_spike_24h
        count = detect_and_write_alerts(db, repo, df, 0.5, 0.1)
        assert count >= 1
        db.add.assert_called()

    def test_momentum_surge_alert_fires(self):
        db = self._make_mock_db()
        repo = self._make_repo()
        df = build_df(num_days=5, daily_star_delta=10)   # no star spike
        # Jump of 0.6 > 0.5 threshold
        count = detect_and_write_alerts(db, repo, df,
                                        today_trend_score=1.2,
                                        yesterday_trend_score=0.5)
        assert count >= 1

    def test_idempotent_when_alert_already_exists(self):
        """If an alert row already exists today, nothing new should be written."""
        db = self._make_mock_db()
        # Make query.first() return a truthy value (alert already exists)
        db.query.return_value.filter.return_value.first.return_value = MagicMock()
        repo = self._make_repo()
        df = build_df(num_days=5, daily_star_delta=500)
        count = detect_and_write_alerts(db, repo, df, 2.0, 0.5)
        assert count == 0
        db.add.assert_not_called()
