import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import func

from app.database import SessionLocal
from app.models import AlertNotification, ComputedMetric, Repository, Subscriber, TrendAlert
from app.models.watchlist import WatchlistItem
from app.services.email_service import FRONTEND_URL, build_digest_email, build_watchlist_alert_email, send_email

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _detail_lines_for_alert(alert: TrendAlert) -> list[str]:
    lines = [
        f"Metric value: {alert.metric_value:.2f}",
        f"Threshold crossed: {alert.threshold:.2f}",
    ]
    if alert.z_score is not None:
        lines.append(f"Statistical spike: z-score {alert.z_score:.2f}, percentile {alert.percentile or 0:.1f}")
    if alert.baseline_mean is not None and alert.baseline_stddev is not None:
        lines.append(f"Baseline: {alert.baseline_mean:.2f} ± {alert.baseline_stddev:.2f}")
    if alert.is_sustained:
        lines.append("Momentum remained elevated across multiple snapshots")
    if alert.momentum_direction:
        lines.append(f"Direction: {alert.momentum_direction}")
    return lines


def send_watchlist_test_email(item_id: str) -> dict:
    db = SessionLocal()
    try:
        item = db.query(WatchlistItem).filter_by(id=item_id).first()
        if not item or not item.notify_email:
            return {"sent": False, "reason": "Watchlist item or notify_email missing"}

        repo = db.query(Repository).filter_by(id=item.repo_id).first()
        if not repo:
            return {"sent": False, "reason": "Repository not found"}

        html = build_watchlist_alert_email(
            repo.owner,
            repo.name,
            "test_alert",
            f"{repo.owner}/{repo.name} test notification from Repodar",
            ["This is a verification email for your watchlist notifications."],
        )
        sent, error = send_email(item.notify_email, f"Repodar test alert: {repo.owner}/{repo.name}", html)
        return {"sent": sent, "reason": error}
    finally:
        db.close()


def dispatch_pending_watchlist_alert_emails(lookback_hours: int = 48) -> dict:
    db = SessionLocal()
    sent_count = 0
    failed_count = 0
    skipped_count = 0
    try:
        cutoff = _utcnow() - timedelta(hours=lookback_hours)
        alerts = (
            db.query(TrendAlert, Repository)
            .join(Repository, Repository.id == TrendAlert.repo_id)
            .filter(TrendAlert.triggered_at >= cutoff)
            .order_by(TrendAlert.triggered_at.desc())
            .all()
        )

        for alert, repo in alerts:
            watchers = (
                db.query(WatchlistItem)
                .filter(
                    WatchlistItem.repo_id == alert.repo_id,
                    WatchlistItem.notify_email.isnot(None),
                    WatchlistItem.notify_email != "",
                )
                .all()
            )

            for watcher in watchers:
                exists = (
                    db.query(AlertNotification)
                    .filter_by(alert_id=alert.id, destination_email=watcher.notify_email, channel="email")
                    .first()
                )
                if exists:
                    skipped_count += 1
                    continue

                html = build_watchlist_alert_email(
                    repo.owner,
                    repo.name,
                    alert.alert_type,
                    alert.headline,
                    _detail_lines_for_alert(alert),
                )
                sent, error = send_email(
                    watcher.notify_email,
                    f"Repodar alert: {repo.owner}/{repo.name}",
                    html,
                )

                db.add(
                    AlertNotification(
                        alert_id=alert.id,
                        user_id=watcher.user_id,
                        destination_email=watcher.notify_email,
                        channel="email",
                        status="sent" if sent else "failed",
                        error_message=error,
                    )
                )
                if sent:
                    sent_count += 1
                else:
                    failed_count += 1

        db.commit()
        return {"sent": sent_count, "failed": failed_count, "skipped": skipped_count}
    except Exception:
        db.rollback()
        logger.exception("dispatch_pending_watchlist_alert_emails failed")
        return {"sent": sent_count, "failed": failed_count + 1, "skipped": skipped_count}
    finally:
        db.close()


def dispatch_digest_emails(frequency: Literal["daily", "weekly", "monthly"]) -> dict:
    db = SessionLocal()
    sent_count = 0
    skipped_count = 0
    try:
        now = _utcnow()
        window_days = 1 if frequency == "daily" else (7 if frequency == "weekly" else 30)
        window = timedelta(days=window_days)
        cutoff = now - window
        latest_date = db.query(func.max(ComputedMetric.date)).scalar()

        subscribers = (
            db.query(Subscriber)
            .filter(Subscriber.is_confirmed == True, Subscriber.email_frequency == frequency)  # noqa: E712
            .all()
        )

        top_breakouts: list[dict] = []
        if latest_date:
            top_rows = (
                db.query(ComputedMetric, Repository)
                .join(Repository, Repository.id == ComputedMetric.repo_id)
                .filter(ComputedMetric.date == latest_date)
                .order_by(ComputedMetric.trend_score.desc())
                .limit(5)
                .all()
            )
            top_breakouts = [
                {
                    "repo": f"{repo.owner}/{repo.name}",
                    "trend_score": cm.trend_score or 0.0,
                    "sustainability_label": cm.sustainability_label or "YELLOW",
                }
                for cm, repo in top_rows
            ]

        recent_alert_rows = (
            db.query(TrendAlert, Repository)
            .join(Repository, Repository.id == TrendAlert.repo_id)
            .filter(TrendAlert.triggered_at >= cutoff)
            .order_by(TrendAlert.triggered_at.desc())
            .limit(12)
            .all()
        )
        alerts = [
            {"repo": f"{repo.owner}/{repo.name}", "headline": alert.headline}
            for alert, repo in recent_alert_rows
        ]

        for subscriber in subscribers:
            if subscriber.last_digest_sent_at:
                if frequency == "daily" and subscriber.last_digest_sent_at.date() == now.date():
                    skipped_count += 1
                    continue
                if frequency == "weekly" and subscriber.last_digest_sent_at.isocalendar()[:2] == now.isocalendar()[:2]:
                    skipped_count += 1
                    continue
                if frequency == "monthly" and (
                    subscriber.last_digest_sent_at.year == now.year
                    and subscriber.last_digest_sent_at.month == now.month
                ):
                    skipped_count += 1
                    continue

            html = build_digest_email(
                frequency,
                alerts,
                top_breakouts,
                unsubscribe_url=f"{FRONTEND_URL}/unsubscribe?token={subscriber.unsubscribe_token}" if subscriber.unsubscribe_token else None,
            )
            sent, error = send_email(
                subscriber.email,
                f"Repodar {frequency.title()} digest",
                html,
            )
            if sent:
                subscriber.last_digest_sent_at = now
                sent_count += 1
            else:
                logger.warning("Digest send failed for %s: %s", subscriber.email, error)

        db.commit()
        return {"sent": sent_count, "skipped": skipped_count}
    except Exception:
        db.rollback()
        logger.exception("dispatch_digest_emails(%s) failed", frequency)
        return {"sent": sent_count, "skipped": skipped_count}
    finally:
        db.close()