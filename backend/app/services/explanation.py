"""
Trend Explanation Engine — generates 3–5 sentence analyst summaries using Groq.
Only runs for the top-20 trending repos to conserve API tokens.
"""

import os
import logging
from typing import Optional

from groq import Groq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

SYSTEM_PROMPT = """You are an AI infrastructure analyst writing for a technical analyst audience.
Your tone is direct, precise, and data-driven — similar to a Bloomberg Intelligence brief.
Never use hype words. State facts and infer signal from the data provided.
Output exactly 3-5 sentences. No bullet points. No headers."""

EXPLANATION_TEMPLATE = """Explain why the GitHub repo {owner}/{repo_name} is currently trending based on the following data:

Category: {category}
7-day star velocity: {star_velocity_7d} stars/day (avg)
30-day star velocity: {star_velocity_30d} stars/day (avg)
Star acceleration: {acceleration} (positive = accelerating)
Contributor growth rate (7d): {contributor_growth_rate}
Release boost detected: {release_boost}
Sustainability label: {sustainability_label}
Sustainability score: {sustainability_score}/1.0
Primary language: {primary_language}

Provide a 3-5 sentence analyst-grade explanation of what is driving this momentum,
what the sustainability outlook is, and what it signals for the broader ecosystem category."""


def generate_explanation(
    owner: str,
    repo_name: str,
    category: str,
    metrics: dict,
    primary_language: Optional[str] = None,
) -> Optional[str]:
    """
    Calls Groq to generate an analyst explanation for a trending repo.
    Returns the explanation string, or None if Groq is unavailable.
    """
    if not client:
        logger.warning("Groq client not configured — skipping explanation generation")
        return None

    release_boost = "Yes" if metrics.get("trend_score", 0) > 0 and metrics.get("acceleration", 0) > 0 else "No"

    prompt = EXPLANATION_TEMPLATE.format(
        owner=owner,
        repo_name=repo_name,
        category=category,
        star_velocity_7d=round(metrics.get("star_velocity_7d", 0), 2),
        star_velocity_30d=round(metrics.get("star_velocity_30d", 0), 2),
        acceleration=round(metrics.get("acceleration", 0), 4),
        contributor_growth_rate=round(metrics.get("contributor_growth_rate", 0), 4),
        release_boost=release_boost,
        sustainability_label=metrics.get("sustainability_label", "YELLOW"),
        sustainability_score=round(metrics.get("sustainability_score", 0), 2),
        primary_language=primary_language or "Unknown",
    )

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=300,
        )
        explanation = (response.choices[0].message.content or "").strip()
        logger.info(f"Generated explanation for {owner}/{repo_name}")
        return explanation
    except Exception as e:
        logger.error(f"Groq explanation failed for {owner}/{repo_name}: {e}")
        return None


def enrich_top_repos_with_explanations(top_n: int = 20) -> int:
    """
    Finds the top-N trending repos without explanations and generates them.
    Called after daily scoring. Returns count of explanations written.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric
    from datetime import date, datetime, timezone

    db = SessionLocal()
    today = date.today()
    written = 0

    try:
        top_repos = (
            db.query(ComputedMetric, Repository)
            .join(Repository, Repository.id == ComputedMetric.repo_id)
            .filter(
                ComputedMetric.date == today,
                ComputedMetric.explanation.is_(None),
            )
            .order_by(ComputedMetric.trend_score.desc())
            .limit(top_n)
            .all()
        )

        for cm, repo in top_repos:
            explanation = generate_explanation(
                owner=repo.owner,
                repo_name=repo.name,
                category=repo.category,
                metrics={
                    "star_velocity_7d": cm.star_velocity_7d,
                    "star_velocity_30d": cm.star_velocity_30d,
                    "acceleration": cm.acceleration,
                    "contributor_growth_rate": cm.contributor_growth_rate,
                    "trend_score": cm.trend_score,
                    "sustainability_score": cm.sustainability_score,
                    "sustainability_label": cm.sustainability_label,
                },
                primary_language=repo.primary_language,
            )
            if explanation:
                cm.explanation = explanation
                cm.computed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                written += 1

        db.commit()
        logger.info(f"Explanations written: {written}/{len(top_repos)}")
        return written

    except Exception as e:
        db.rollback()
        logger.error(f"Explanation enrichment failed: {e}")
        return 0
    finally:
        db.close()
