"""
RSS 2.0 feed for Repodar breakout alerts.

Routes:
  GET /feed.xml              — last 50 alerts, all categories
  GET /feed/{vertical}.xml   — filtered by vertical/category
"""
import os
from datetime import timezone
from email.utils import format_datetime
from typing import Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TrendAlert, Repository

router = APIRouter(tags=["Feed"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://repodar.vercel.app")


def _build_rss(items: list[dict], title: str, description: str) -> str:
    """Render an RSS 2.0 document from a list of item dicts."""

    def _escape(s: str) -> str:
        return (s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;"))

    item_xml = ""
    for it in items:
        item_xml += f"""
    <item>
      <title>{_escape(it['title'])}</title>
      <link>{_escape(it['link'])}</link>
      <description>{_escape(it['description'])}</description>
      <pubDate>{it['pub_date']}</pubDate>
      <guid isPermaLink="false">{_escape(it['guid'])}</guid>
    </item>"""

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{_escape(title)}</title>
    <link>{FRONTEND_URL}</link>
    <description>{_escape(description)}</description>
    <language>en-us</language>
    <ttl>240</ttl>
    <atom:link href="{FRONTEND_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    {item_xml}
  </channel>
</rss>"""


def _build_items(alerts: list, repos: dict) -> list[dict]:
    items = []
    for alert in alerts:
        repo = repos.get(alert.repo_id)
        if not repo:
            continue
        owner, name = repo.owner, repo.name
        link = f"{FRONTEND_URL}/repo/{owner}/{name}"
        trend_delta = f"+{alert.metric_value:.1f}" if alert.metric_value >= 0 else f"{alert.metric_value:.1f}"
        title = f"{owner}/{name} — {alert.headline}"
        description = (
            f"{owner}/{name} ({repo.category}) triggered a {alert.alert_type} alert. "
            f"Metric: {trend_delta} (threshold: {alert.threshold:.1f}). "
            f"See the full deep-dive: {link}"
        )
        # RFC 2822 date
        dt = alert.triggered_at
        if dt.tzinfo is None:
            from datetime import datetime
            dt = dt.replace(tzinfo=timezone.utc)
        pub_date = format_datetime(dt)
        items.append({
            "title": title,
            "link": link,
            "description": description,
            "pub_date": pub_date,
            "guid": f"repodar-alert-{alert.id}",
        })
    return items


@router.get("/feed.xml", include_in_schema=False)
def rss_feed_all(limit: int = 50, db: Session = Depends(get_db)):
    """RSS 2.0 feed of all recent breakout alerts."""
    alerts = (
        db.query(TrendAlert)
        .order_by(TrendAlert.triggered_at.desc())
        .limit(limit)
        .all()
    )
    repo_ids = {a.repo_id for a in alerts}
    repos = {r.id: r for r in db.query(Repository).filter(Repository.id.in_(repo_ids)).all()}
    items = _build_items(alerts, repos)
    xml = _build_rss(items,
                     title="Repodar — AI/ML Breakout Alerts",
                     description="Real-time GitHub momentum alerts for AI/ML repositories.")
    return Response(content=xml, media_type="application/rss+xml")


@router.get("/feed/{vertical}.xml", include_in_schema=False)
def rss_feed_vertical(vertical: str, limit: int = 50, db: Session = Depends(get_db)):
    """RSS 2.0 feed filtered by ecosystem vertical/category."""
    # Map common vertical slugs to category strings stored in the DB
    vertical_lower = vertical.lower().replace("-", "_").replace(" ", "_")
    
    # 1. Subquery to find matching repository IDs purely in SQL
    repo_subq = (
        db.query(Repository.id)
        .filter(Repository.category.ilike(f"%{vertical_lower.replace('_', '%')}%"))
    )
    
    # Check if subquery yields anything, else try exact match
    if not db.query(repo_subq.exists()).scalar():
        repo_subq = db.query(Repository.id).filter(Repository.category == vertical)

    # 2. Fetch Alerts AND their matching Repository in one efficient JOIN
    results = (
        db.query(TrendAlert, Repository)
        .join(Repository, TrendAlert.repo_id == Repository.id)
        .filter(TrendAlert.repo_id.in_(repo_subq))
        .order_by(TrendAlert.triggered_at.desc())
        .limit(limit)
        .all()
    )

    alerts = []
    repos = {}
    for alert, repo in results:
        alerts.append(alert)
        repos[repo.id] = repo

    items = _build_items(alerts, repos)
    xml = _build_rss(items,
                     title=f"Repodar — {vertical} Breakout Alerts",
                     description=f"GitHub momentum alerts for {vertical} AI/ML repositories.")
    return Response(content=xml, media_type="application/rss+xml")
