from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import ComputedMetric, DailyMetric


def get_latest_metric_subquery(db: Session):
    """
    Returns the single most-recent ComputedMetric row per repo.
    Uses a window function (row_number partitioned by repo_id, ordered by computed_at DESC)
    to always return each repo's most recent scored row.
    """
    ranked = (
        db.query(
            ComputedMetric.repo_id.label("repo_id"),
            ComputedMetric.trend_score.label("trend_score"),
            ComputedMetric.acceleration.label("acceleration"),
            ComputedMetric.star_velocity_7d.label("star_velocity_7d"),
            ComputedMetric.star_velocity_30d.label("star_velocity_30d"),
            ComputedMetric.contributor_growth_rate.label("contributor_growth_rate"),
            ComputedMetric.sustainability_score.label("sustainability_score"),
            ComputedMetric.sustainability_label.label("sustainability_label"),
            func.row_number().over(
                partition_by=ComputedMetric.repo_id,
                order_by=ComputedMetric.computed_at.desc(),
            ).label("rn"),
        )
        .subquery()
    )

    return (
        db.query(
            ranked.c.repo_id,
            ranked.c.trend_score,
            ranked.c.acceleration,
            ranked.c.star_velocity_7d,
            ranked.c.star_velocity_30d,
            ranked.c.contributor_growth_rate,
            ranked.c.sustainability_score,
            ranked.c.sustainability_label,
        )
        .filter(ranked.c.rn == 1)
        .subquery()
    )


def get_latest_daily_metric_subquery(db: Session):
    """
    Returns the single most-recent DailyMetric row per repo.
    Primarily used for extracting the latest 'stars' snapshot without N+1 queries.
    """
    ranked = (
        db.query(
            DailyMetric.repo_id.label("repo_id"),
            DailyMetric.stars.label("stars"),
            func.row_number().over(
                partition_by=DailyMetric.repo_id,
                order_by=DailyMetric.date.desc(),
            ).label("rn"),
        )
        .subquery()
    )

    return (
        db.query(
            ranked.c.repo_id,
            ranked.c.stars,
        )
        .filter(ranked.c.rn == 1)
        .subquery()
    )
