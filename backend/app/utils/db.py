from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import ComputedMetric, DailyMetric


def get_latest_metric_subquery(db: Session):
    """
    Returns the single most-recent ComputedMetric row per repo.
    Pre-fetches the latest date from the database to perform a direct, highly indexed join.
    """
    latest_date = db.query(func.max(ComputedMetric.date)).scalar()
    return (
        db.query(
            ComputedMetric.repo_id.label("repo_id"),
            ComputedMetric.trend_score.label("trend_score"),
            ComputedMetric.acceleration.label("acceleration"),
            ComputedMetric.star_velocity_7d.label("star_velocity_7d"),
            ComputedMetric.star_velocity_30d.label("star_velocity_30d"),
            ComputedMetric.contributor_growth_rate.label("contributor_growth_rate"),
            ComputedMetric.sustainability_score.label("sustainability_score"),
            ComputedMetric.sustainability_label.label("sustainability_label"),
        )
        .filter(ComputedMetric.date == latest_date)
        .subquery()
    )


def get_latest_daily_metric_subquery(db: Session):
    """
    Returns the single most-recent DailyMetric row per repo.
    Pre-fetches the latest daily metric date to perform a direct indexed join.
    """
    latest_date = db.query(func.max(DailyMetric.date)).scalar()
    return (
        db.query(
            DailyMetric.repo_id.label("repo_id"),
            DailyMetric.stars.label("stars"),
        )
        .filter(DailyMetric.date == latest_date)
        .subquery()
    )

