"""
Reporting endpoints — generates weekly and monthly analyst reports.
The Strategic Insight Summary section is LLM-generated via Groq.
Reports are persisted in ecosystem_reports for historical access.
"""

import json
import os
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Repository, ComputedMetric, DailyMetric
from app.models.ecosystem_report import EcosystemReport

router = APIRouter(prefix="/reports", tags=["Reports"])

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class BreakoutEntry(BaseModel):
    rank: int
    owner: str
    name: str
    category: str
    trend_score: float
    star_velocity_7d: float
    acceleration: float
    sustainability_label: str
    explanation: Optional[str]


class CategoryShift(BaseModel):
    category: str
    weekly_velocity: float
    mom_growth_pct: float
    signal: str  # "Accelerating" | "Stable" | "Decelerating"


class SustainabilityWatch(BaseModel):
    owner: str
    name: str
    category: str
    sustainability_label: str
    sustainability_score: float
    trend_score: float
    note: str


class WeeklyReport(BaseModel):
    week_ending: str
    generated_at: str
    top_breakout_repos: List[BreakoutEntry]
    category_momentum: List[CategoryShift]
    tech_stack_trends: List[dict]
    sustainability_watchlist: List[SustainabilityWatch]
    strategic_insight: str


class MonthlyReport(BaseModel):
    month: str
    generated_at: str
    macro_summary: str
    category_dominance: List[dict]
    adoption_patterns: str
    infra_layer_shifts: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _generate_strategic_insight(
    top_repos: list,
    category_shifts: list,
) -> str:
    """
    Uses Groq to generate a 3–5 sentence strategic insight summary.
    Falls back to a rule-based template if Groq is unavailable.
    """
    from app.services.explanation import client as groq_client

    if not groq_client:
        return "Strategic insight unavailable: Groq API key not configured."

    top_str = "\n".join(
        f"- {r['owner']}/{r['name']} ({r['category']}): trend_score={r['trend_score']:.4f}, "
        f"velocity={r['star_velocity_7d']:.1f}/day, sustainability={r['sustainability_label']}"
        for r in top_repos[:5]
    )
    cat_str = "\n".join(
        f"- {c['category']}: {c['weekly_velocity']:.0f} weekly stars, MoM {c['mom_growth_pct']:.1f}% ({c['signal']})"
        for c in category_shifts[:5]
    )

    prompt = f"""You are an AI infrastructure analyst. Write a 4-5 sentence strategic insight summary 
for this week's AI ecosystem intelligence report. Be direct and analytical.

Top trending repos this week:
{top_str}

Category momentum:
{cat_str}

Provide a strategic summary covering: which signals are most significant, 
what ecosystem shifts are emerging, and what analysts should watch next week."""

    try:
        from groq import Groq
        import os
        client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a senior AI infrastructure analyst. Be concise, analytical, and signal-focused."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=350,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        return f"Strategic insight generation unavailable: {e}"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/weekly", response_model=WeeklyReport)
def get_weekly_report(db: Session = Depends(get_db)):
    """
    Auto-generates the weekly AI Infra Intelligence Report.
    Sections: Top Breakout, Category Momentum, Tech Stack Trends,
    Sustainability Watchlist, Strategic Insight (Groq-generated).
    """
    from datetime import datetime, timezone
    from sqlalchemy import func
    from app.services.scoring import compute_category_growth

    today = date.today()
    latest_date = db.query(func.max(ComputedMetric.date)).scalar() or today
    week_start = latest_date - timedelta(days=7)

    # ── Section 1: Top Breakout Repos ──
    latest_scores = (
        db.query(ComputedMetric, Repository)
        .join(Repository, Repository.id == ComputedMetric.repo_id)
        .filter(ComputedMetric.date == latest_date)
        .order_by(ComputedMetric.trend_score.desc())
        .limit(10)
        .all()
    )

    top_breakout = []
    for i, (cm, repo) in enumerate(latest_scores):
        top_breakout.append(BreakoutEntry(
            rank=i + 1,
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            trend_score=cm.trend_score or 0,
            star_velocity_7d=cm.star_velocity_7d or 0,
            acceleration=cm.acceleration or 0,
            sustainability_label=cm.sustainability_label or "YELLOW",
            explanation=cm.explanation,
        ))

    # ── Section 2: Category Momentum ──
    cat_data = compute_category_growth()
    category_momentum = []
    for c in cat_data:
        if c["mom_growth_pct"] > 5:
            signal = "Accelerating"
        elif c["mom_growth_pct"] < -5:
            signal = "Decelerating"
        else:
            signal = "Stable"
        category_momentum.append(CategoryShift(
            category=c["category"],
            weekly_velocity=c["weekly_velocity"],
            mom_growth_pct=c["mom_growth_pct"],
            signal=signal,
        ))

    # ── Section 3: Tech Stack Trends ──
    from sqlalchemy import func
    lang_counts = (
        db.query(Repository.primary_language, func.count(Repository.id).label("count"))
        .filter(Repository.primary_language.isnot(None))
        .group_by(Repository.primary_language)
        .order_by(func.count(Repository.id).desc())
        .limit(8)
        .all()
    )
    tech_stack_trends = [{"language": lg, "repo_count": cnt} for lg, cnt in lang_counts]

    # ── Section 4: Sustainability Watchlist ──
    red_repos = (
        db.query(ComputedMetric, Repository)
        .join(Repository, Repository.id == ComputedMetric.repo_id)
        .filter(ComputedMetric.date == latest_date, ComputedMetric.sustainability_label == "RED")
        .order_by(ComputedMetric.trend_score.desc())
        .limit(10)
        .all()
    )

    watchlist = []
    for cm, repo in red_repos:
        note = "High trend score but low sustainability — potential hype cycle. Monitor contributor retention."
        if cm.trend_score and cm.trend_score < 0.001:
            note = "Low trend + low sustainability — stagnation risk."
        watchlist.append(SustainabilityWatch(
            owner=repo.owner,
            name=repo.name,
            category=repo.category,
            sustainability_label=cm.sustainability_label or "RED",
            sustainability_score=cm.sustainability_score or 0,
            trend_score=cm.trend_score or 0,
            note=note,
        ))

    # ── Section 5: Strategic Insight (Groq) ──
    top_dicts = [
        {
            "owner": e.owner, "name": e.name, "category": e.category,
            "trend_score": e.trend_score, "star_velocity_7d": e.star_velocity_7d,
            "sustainability_label": e.sustainability_label,
        }
        for e in top_breakout
    ]
    cat_dicts = [
        {"category": c.category, "weekly_velocity": c.weekly_velocity,
         "mom_growth_pct": c.mom_growth_pct, "signal": c.signal}
        for c in category_momentum
    ]
    strategic_insight = _generate_strategic_insight(top_dicts, cat_dicts)

    report = WeeklyReport(
        week_ending=latest_date.isoformat(),
        generated_at=datetime.now(timezone.utc).isoformat(),
        top_breakout_repos=top_breakout,
        category_momentum=category_momentum,
        tech_stack_trends=tech_stack_trends,
        sustainability_watchlist=watchlist,
        strategic_insight=strategic_insight,
    )

    # Persist to ecosystem_reports; upsert by (period_type, period_label)
    week_label = latest_date.strftime("%Y-W%W")
    try:
        existing = db.query(EcosystemReport).filter_by(
            period_type="weekly", period_label=week_label
        ).first()
        if existing:
            existing.report_json = report.model_dump_json()
            existing.generated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        else:
            db.add(EcosystemReport(
                period_type="weekly",
                period_label=week_label,
                report_json=report.model_dump_json(),
            ))
        db.commit()
    except Exception:
        db.rollback()  # non-fatal

    return report


@router.get("/monthly", response_model=MonthlyReport)
def get_monthly_report(db: Session = Depends(get_db)):
    """Macro monthly ecosystem analysis (v1 — structure with available data)."""
    from datetime import datetime, timezone
    from app.services.scoring import compute_category_growth

    today = date.today()
    month_label = today.strftime("%B %Y")

    cat_data = compute_category_growth()
    category_dominance = sorted(cat_data, key=lambda x: x["total_stars"], reverse=True)

    top_cat = category_dominance[0]["category"] if category_dominance else "AI Infrastructure"
    fastest_growing = max(cat_data, key=lambda x: x["mom_growth_pct"], default={}).get("category", "Unknown") if cat_data else "Unknown"

    macro_summary = (
        f"In {month_label}, the AI infrastructure ecosystem continued rapid expansion. "
        f"{top_cat} leads in total stars, while {fastest_growing} showed the strongest MoM growth. "
        f"The monitored universe spans {db.query(Repository).count()} repositories across 8 categories."
    )

    # Adoption patterns: top languages and fastest-growing categories from real data
    from sqlalchemy import func
    lang_rows = (
        db.query(Repository.primary_language, func.count(Repository.id).label("cnt"))
        .filter(Repository.primary_language.isnot(None))
        .group_by(Repository.primary_language)
        .order_by(func.count(Repository.id).desc())
        .limit(3)
        .all()
    )
    top_langs = ", ".join(lg for lg, _ in lang_rows) if lang_rows else "N/A"

    top_adoption_cats = sorted(cat_data, key=lambda x: x["repo_count"], reverse=True)[:2]
    adoption_cat_names = " and ".join(c["category"] for c in top_adoption_cats) if top_adoption_cats else "N/A"
    adoption_patterns = (
        f"{adoption_cat_names} lead in monitored repository count. "
        f"Top primary languages across tracked repos: {top_langs}."
    )

    # Infra layer shifts: categories with highest MoM growth from real data
    accel_cats = sorted(cat_data, key=lambda x: x["mom_growth_pct"], reverse=True)[:2]
    accel_names = " and ".join(
        f"{c['category']} (+{c['mom_growth_pct']:.1f}% MoM)" for c in accel_cats
    ) if accel_cats else "Insufficient data for MoM comparison"
    infra_layer_shifts = (
        f"Strongest month-over-month growth detected in: {accel_names}."
    )

    report = MonthlyReport(
        month=month_label,
        generated_at=datetime.now(timezone.utc).isoformat(),
        macro_summary=macro_summary,
        category_dominance=[{"category": c["category"], "total_stars": c["total_stars"], "repo_count": c["repo_count"]} for c in category_dominance],
        adoption_patterns=adoption_patterns,
        infra_layer_shifts=infra_layer_shifts,
    )

    # Persist
    month_key = today.strftime("%Y-%m")
    try:
        existing = db.query(EcosystemReport).filter_by(
            period_type="monthly", period_label=month_key
        ).first()
        if existing:
            existing.report_json = report.model_dump_json()
            existing.generated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        else:
            db.add(EcosystemReport(
                period_type="monthly",
                period_label=month_key,
                report_json=report.model_dump_json(),
            ))
        db.commit()
    except Exception:
        db.rollback()

    return report


# ─── Report history ───────────────────────────────────────────────────────────

class ReportSummary(BaseModel):
    id: str
    period_type: str
    period_label: str
    generated_at: str


@router.get("/history", response_model=List[ReportSummary])
def get_report_history(
    period_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all persisted reports (newest first), optionally filtered by type."""
    q = db.query(EcosystemReport).order_by(EcosystemReport.generated_at.desc())
    if period_type:
        q = q.filter(EcosystemReport.period_type == period_type)
    return [
        ReportSummary(
            id=r.id,
            period_type=r.period_type,
            period_label=r.period_label,
            generated_at=r.generated_at.isoformat() if r.generated_at else "",
        )
        for r in q.limit(50).all()
    ]


@router.get("/history/{report_id}")
def get_archived_report(report_id: str, db: Session = Depends(get_db)):
    """Retrieve a specific archived report by ID."""
    from fastapi import HTTPException
    r = db.query(EcosystemReport).filter_by(id=report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    return json.loads(r.report_json)
