"""
Widget endpoints — embeddable score cards and SVG badges.

Usage:
  JSON card: GET /widget/repo/{owner}/{name}
  SVG badge: GET /widget/badge/{owner}/{name}.svg

README embed example:
  ![Repodar](https://api.repodar.app/widget/badge/langchain-ai/langchain.svg)

iFrame embed:
  <iframe src="https://repodar.app/widget/repo/langchain-ai/langchain" width="380" height="120" />
"""
import os
import logging
from typing import Optional

import aiohttp
from fastapi import APIRouter, Path, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
API_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

router = APIRouter(prefix="/widget", tags=["Widgets"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class WidgetData(BaseModel):
    owner: str
    name: str
    full_name: str
    description: Optional[str]
    stars: int
    forks: int
    language: Optional[str]
    github_url: str
    open_issues: int = 0
    # Repodar scores — null if repo is not in the tracked set
    trend_score: Optional[float] = None
    trend_score_pct: Optional[int] = None   # 0-100 normalised display value
    sustainability_score: Optional[float] = None
    sustainability_label: Optional[str] = None
    star_velocity_7d: Optional[float] = None
    acceleration: Optional[float] = None
    contributor_growth_rate: Optional[float] = None
    is_tracked: bool = False


# ─── JSON card ───────────────────────────────────────────────────────────────

@router.get(
    "/repo/{owner}/{name}",
    response_model=WidgetData,
    summary="JSON data for embeddable score card",
)
async def widget_json(
    owner: str = Path(..., description="GitHub repo owner"),
    name: str = Path(..., description="GitHub repo name"),
):
    """
    Returns Repodar score data for a repo.
    Checks local DB first for Repodar-tracked repos (enriched with scores),
    falls back to live GitHub REST API for untracked repos.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric, DailyMetric
    import math

    db = SessionLocal()
    try:
        # Look up by owner + name (repo IDs are UUIDs, not owner/name)
        repo = db.query(Repository).filter_by(owner=owner, name=name).first()
        if repo:
            cm = (
                db.query(ComputedMetric)
                .filter_by(repo_id=repo.id)
                .order_by(ComputedMetric.date.desc())
                .first()
            )
            dm = (
                db.query(DailyMetric)
                .filter_by(repo_id=repo.id)
                .order_by(DailyMetric.captured_at.desc())
                .first()
            )
            # Normalise trend_score to 0–100 for display (log-scale, cap at 100)
            ts = cm.trend_score if cm else None
            ts_pct = None
            if ts is not None and ts > 0:
                # Empirical: trend_score ~0.5–5 for typical repos; map log to 0-100
                ts_pct = min(100, max(1, int(math.log1p(ts * 20) / math.log1p(100) * 100)))
            return WidgetData(
                owner=owner,
                name=name,
                full_name=f"{owner}/{name}",
                description=repo.description,
                stars=dm.stars if dm else 0,
                forks=dm.forks if dm else 0,
                open_issues=dm.open_issues if dm else 0,
                language=repo.primary_language,
                github_url=repo.github_url,
                trend_score=ts,
                trend_score_pct=ts_pct,
                sustainability_score=cm.sustainability_score if cm else None,
                sustainability_label=cm.sustainability_label if cm else None,
                star_velocity_7d=cm.star_velocity_7d if cm else None,
                acceleration=cm.acceleration if cm else None,
                contributor_growth_rate=cm.contributor_growth_rate if cm else None,
                is_tracked=True,
            )
    finally:
        db.close()

    # Untracked repo — live GitHub REST fallback
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"https://api.github.com/repos/{repo_id}",
            headers=API_HEADERS,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 404:
                raise HTTPException(status_code=404, detail=f"Repo {repo_id} not found on GitHub")
            if resp.status != 200:
                raise HTTPException(status_code=502, detail="GitHub API error")
            data = await resp.json()

    return WidgetData(
        owner=owner,
        name=name,
        full_name=data["full_name"],
        description=data.get("description") or "",
        stars=data.get("stargazers_count", 0),
        forks=data.get("forks_count", 0),
        open_issues=data.get("open_issues_count", 0),
        language=data.get("language"),
        github_url=data["html_url"],
        is_tracked=False,
    )


# ─── SVG badge ───────────────────────────────────────────────────────────────

_LABEL_STYLE: dict[str, tuple[str, str]] = {
    "GREEN":  ("#22c55e", "#16a34a"),
    "YELLOW": ("#f59e0b", "#d97706"),
    "RED":    ("#ef4444", "#dc2626"),
}


@router.get(
    "/badge/{owner}/{name}.svg",
    response_class=Response,
    summary="SVG badge for README / website embeds",
)
async def widget_badge(
    owner: str = Path(...),
    name: str = Path(...),
):
    """
    Returns a shields.io-style SVG badge showing Repodar sustainability score.

    Embed in README.md:
        ![Repodar](https://api.repodar.app/widget/badge/langchain-ai/langchain.svg)
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric

    label = "YELLOW"
    score_str = "not tracked"
    accel = 0.0

    db = SessionLocal()
    try:
        repo = db.query(Repository).filter_by(owner=owner, name=name).first()
        if repo:
            cm = (
                db.query(ComputedMetric)
                .filter_by(repo_id=repo.id)
                .order_by(ComputedMetric.date.desc())
                .first()
            )
            if cm:
                label = cm.sustainability_label or "YELLOW"
                score_str = f"{int((cm.sustainability_score or 0) * 100)}%"
                accel = cm.acceleration or 0
    finally:
        db.close()

    fill, dark = _LABEL_STYLE.get(label, ("f59e0b", "#d97706"))
    arrow = " ↑" if accel > 0 else (" ↓" if accel < 0 else "")
    left_text = "Repodar"
    right_text = f"{score_str} · {label}{arrow}"

    # Approximate char widths for badge sizing
    lw = max(60, len(left_text) * 7 + 16)
    rw = max(80, len(right_text) * 7 + 16)
    tw = lw + rw
    lm = lw // 2
    rm = lw + rw // 2

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{tw}" height="20" role="img" aria-label="Repodar: {score_str} {label}">
  <title>Repodar: {score_str} {label}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="{tw}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw}" height="20" fill="#555"/>
    <rect x="{lw}" width="{rw}" height="20" fill="{fill}"/>
    <rect width="{tw}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="{lm}" y="15" fill="#010101" fill-opacity=".3" aria-hidden="true">{left_text}</text>
    <text x="{lm}" y="14">{left_text}</text>
    <text x="{rm}" y="15" fill="#010101" fill-opacity=".3" aria-hidden="true">{right_text}</text>
    <text x="{rm}" y="14">{right_text}</text>
  </g>
</svg>"""

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "max-age=3600, s-maxage=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )
