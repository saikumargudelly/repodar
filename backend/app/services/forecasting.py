"""
Forecasting Engine — pure, stateless, testable.

Algorithm: linear regression (numpy.polyfit) over daily star deltas.
No DB writes. Pure functions over time-series data.

Contract:
  Input:  list of DailyMetricPoint (date, stars, daily_star_delta)
  Output: ForecastResult
"""

from __future__ import annotations

import math
import logging
from datetime import date, timedelta
from typing import Optional

import numpy as np
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ─── Result schema ─────────────────────────────────────────────────────────────

class ForecastResult(BaseModel):
    repo_id:              str
    current_stars:        int
    predicted_stars_7d:   int
    predicted_stars_30d:  int
    predicted_stars_90d:  int
    breakout_probability: float   # 0–1, probability of rapid growth
    growth_label:         str     # "explosive" | "accelerating" | "steady" | "flat" | "declining"
    slope_7d:             float   # avg stars/day over last 7 days
    slope_30d:            float   # avg stars/day over last 30 days
    r_squared:            float   # goodness-of-fit for the 30d regression
    confidence:           float   # model confidence 0–1 (based on data density)
    data_points:          int
    notice:               Optional[str] = None  # "insufficient_data" etc.


# ─── Core math functions (pure, no DB) ────────────────────────────────────────

def _linear_fit(y: np.ndarray) -> tuple[float, float, float]:
    """
    Fit y = slope * x + intercept over the given series.
    Returns (slope, intercept, r_squared).
    """
    n = len(y)
    if n < 2:
        return 0.0, float(y[0]) if n == 1 else 0.0, 0.0
    x = np.arange(n, dtype=float)
    coeffs = np.polyfit(x, y, 1)
    slope, intercept = float(coeffs[0]), float(coeffs[1])
    y_pred = slope * x + intercept
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r_sq = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return slope, intercept, max(0.0, min(1.0, r_sq))


def _breakout_probability(
    slope_7d: float,
    slope_30d: float,
    current_stars: int,
    r_squared: float,
) -> float:
    """
    Heuristic breakout probability combining:
    - acceleration (7d slope > 30d slope signals momentum shift)
    - absolute velocity relative to star base
    - regression fit quality
    """
    if slope_7d <= 0 or current_stars <= 0:
        return 0.0

    # Velocity ratio: stars/day relative to current base
    vel_ratio = slope_7d / max(current_stars * 0.01, 1.0)

    # Acceleration signal: 7d slope vs 30d slope
    accel = (slope_7d - slope_30d) / max(abs(slope_30d), 1.0)
    accel_norm = max(0.0, min(1.0, accel / 2.0))

    # Base probability from velocity
    vel_score = min(1.0, vel_ratio / 0.10)

    # Fit quality weight
    confidence_multiplier = 0.4 + 0.6 * r_squared

    raw = (0.5 * vel_score + 0.5 * accel_norm) * confidence_multiplier
    return round(min(1.0, max(0.0, raw)), 4)


def _growth_label(
    slope_7d: float,
    slope_30d: float,
    current_stars: int,
) -> str:
    """Classify growth into human-readable label."""
    if slope_7d <= 0 and slope_30d <= 0:
        return "declining"
    if slope_7d <= 0:
        return "flat"
    ratio = slope_7d / max(current_stars * 0.01, 1.0)
    accel = slope_7d / max(slope_30d, 0.001)
    if ratio > 0.20 and accel > 1.5:
        return "explosive"
    if accel > 1.2 or ratio > 0.10:
        return "accelerating"
    if ratio > 0.01:
        return "steady"
    return "flat"


# ─── Main forecast function ───────────────────────────────────────────────────

def compute_forecast(
    repo_id: str,
    daily_stars: list[int],    # absolute star counts, sorted ascending by date
    daily_deltas: list[int],   # daily_star_delta values, parallel to daily_stars
) -> ForecastResult:
    """
    Compute a star growth forecast from raw time-series data.

    Args:
        repo_id:      repo identifier string
        daily_stars:  sorted list of absolute star counts per day
        daily_deltas: sorted list of daily star additions per day
    """
    n = len(daily_stars)
    current_stars = daily_stars[-1] if daily_stars else 0

    if n < 3:
        # Insufficient data — return conservative estimate
        return ForecastResult(
            repo_id=repo_id,
            current_stars=current_stars,
            predicted_stars_7d=current_stars,
            predicted_stars_30d=current_stars,
            predicted_stars_90d=current_stars,
            breakout_probability=0.0,
            growth_label="flat",
            slope_7d=0.0,
            slope_30d=0.0,
            r_squared=0.0,
            confidence=0.0,
            data_points=n,
            notice="insufficient_data",
        )

    arr = np.array(daily_stars, dtype=float)
    delta_arr = np.array(daily_deltas, dtype=float)

    # 7-day slope
    tail7 = arr[-min(7, n):]
    slope_7d, _, _ = _linear_fit(tail7)

    # 30-day slope + R²
    tail30 = arr[-min(30, n):]
    slope_30d, intercept_30d, r_sq = _linear_fit(tail30)

    # Predictions: project slope_30d for longer horizons
    predicted_7d  = max(0, int(current_stars + slope_7d * 7))
    predicted_30d = max(0, int(current_stars + slope_30d * 30))
    predicted_90d = max(0, int(current_stars + slope_30d * 90))

    # Confidence: based on data density and fit quality
    density = min(1.0, n / 30.0)
    confidence = round(0.4 * density + 0.6 * r_sq, 4)

    bp = _breakout_probability(slope_7d, slope_30d, current_stars, r_sq)
    label = _growth_label(slope_7d, slope_30d, current_stars)

    return ForecastResult(
        repo_id=repo_id,
        current_stars=current_stars,
        predicted_stars_7d=predicted_7d,
        predicted_stars_30d=predicted_30d,
        predicted_stars_90d=predicted_90d,
        breakout_probability=bp,
        growth_label=label,
        slope_7d=round(float(slope_7d), 4),
        slope_30d=round(float(slope_30d), 4),
        r_squared=round(r_sq, 4),
        confidence=confidence,
        data_points=n,
    )
