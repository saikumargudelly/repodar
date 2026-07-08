"""
Trend Explanation Engine — generates 3–5 sentence analyst summaries using Groq.
Only runs for the top-20 trending repos to conserve API tokens.
"""

import os
import logging
from typing import Optional

from dotenv import load_dotenv
from app.utils.llm import sync_chat_completion, async_chat_completion, GROQ_API_KEY

load_dotenv()

logger = logging.getLogger(__name__)


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
    if not GROQ_API_KEY:
        logger.warning("Groq API key not configured — skipping explanation generation")
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

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    explanation = sync_chat_completion(
        messages=messages,
        temperature=0.3,
        max_tokens=300,
    )
    if explanation:
        logger.info(f"Generated explanation for {owner}/{repo_name}")
    return explanation


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
    targets = []

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
            targets.append({
                "repo_id": repo.id,
                "owner": repo.owner,
                "name": repo.name,
                "category": repo.category,
                "primary_language": repo.primary_language,
                "metrics": {
                    "star_velocity_7d": cm.star_velocity_7d,
                    "star_velocity_30d": cm.star_velocity_30d,
                    "acceleration": cm.acceleration,
                    "contributor_growth_rate": cm.contributor_growth_rate,
                    "trend_score": cm.trend_score,
                    "sustainability_score": cm.sustainability_score,
                    "sustainability_label": cm.sustainability_label,
                }
            })
    except Exception as e:
        logger.error(f"Failed to query top repos for explanations: {e}")
        return 0
    finally:
        db.close()

    # Generate explanations without holding database connections during network I/O
    explanations = {}
    for target in targets:
        explanation = generate_explanation(
            owner=target["owner"],
            repo_name=target["name"],
            category=target["category"],
            metrics=target["metrics"],
            primary_language=target["primary_language"],
        )
        if explanation:
            explanations[target["repo_id"]] = explanation

    if not explanations:
        return 0

    # Save to database in a new short-lived session
    db = SessionLocal()
    written = 0
    try:
        for repo_id, explanation in explanations.items():
            cm = db.query(ComputedMetric).filter_by(repo_id=repo_id, date=today).first()
            if cm:
                cm.explanation = explanation
                cm.computed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                written += 1
        db.commit()
        logger.info(f"Explanations written: {written}/{len(targets)}")
        return written
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save explanations to DB: {e}")
        return 0
    finally:
        db.close()


# ─── Repo Summary ─────────────────────────────────────────────────────────────

SUMMARY_SYSTEM_PROMPT = """You are a senior developer writing a brief introduction for a technical audience.
Be concrete, informative, and jargon-free. Do not use hype. No bullet points. No headers.
Output exactly 3 sentences."""

SUMMARY_TEMPLATE = """Write a 3-sentence plain-English summary for the GitHub repository {owner}/{repo_name}.

GitHub description: {description}
Category: {category}
Primary language: {primary_language}
Topics/tags: {topics}
Current TrendScore: {trend_score}
Stars gained in last 30 days: {star_delta_30d}
Total contributors: {contributors}

Sentence 1: What this project does and who it is for.
Sentence 2: The primary use case or problem it solves.
Sentence 3: Why it is gaining momentum right now, based on the signals above."""


def generate_repo_summary(
    owner: str,
    repo_name: str,
    category: str,
    description: Optional[str],
    primary_language: Optional[str],
    topics: Optional[str],
    trend_score: float,
    star_delta_30d: float,
    contributors: int,
) -> Optional[str]:
    """Generate a 3-sentence plain-English summary for a repo. Cached weekly."""
    if not GROQ_API_KEY:
        return None

    prompt = SUMMARY_TEMPLATE.format(
        owner=owner,
        repo_name=repo_name,
        description=description or "Not provided",
        category=category,
        primary_language=primary_language or "Unknown",
        topics=topics or "None",
        trend_score=round(trend_score, 4),
        star_delta_30d=round(star_delta_30d, 0),
        contributors=contributors,
    )

    messages = [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    summary = sync_chat_completion(
        messages=messages,
        temperature=0.4,
        max_tokens=200,
    )
    if summary:
        logger.info(f"Generated summary for {owner}/{repo_name}")
    return summary


def enrich_repos_with_summaries(top_n: int = 30, score_delta_threshold: float = 10.0) -> int:
    """
    Generate or refresh repo summaries.

    Regenerates a summary when:
    - The repo has no existing summary, OR
    - The repo's TrendScore changed by > score_delta_threshold since last generation.

    Returns count of summaries written.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric, DailyMetric
    from datetime import date, datetime, timezone, timedelta

    db = SessionLocal()
    targets = []
    today = date.today()

    try:
        week_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)

        # Get top repos by trend score
        top_cms = (
            db.query(ComputedMetric, Repository)
            .join(Repository, Repository.id == ComputedMetric.repo_id)
            .filter(
                ComputedMetric.date == today,
                Repository.is_active == True,
            )
            .order_by(ComputedMetric.trend_score.desc())
            .limit(top_n)
            .all()
        )

        for cm, repo in top_cms:
            # Skip if recently generated and score hasn't changed significantly
            if repo.repo_summary and repo.repo_summary_generated_at:
                if repo.repo_summary_generated_at > week_ago:
                    # Only regenerate if score jumped significantly
                    # Find the ComputedMetric from around that time to compare scores
                    skip = True
                    # Search for older score to compare
                    older_cm = (
                        db.query(ComputedMetric)
                        .filter(
                            ComputedMetric.repo_id == repo.id,
                            ComputedMetric.date < today,
                        )
                        .order_by(ComputedMetric.date.desc())
                        .first()
                    )
                    if older_cm and abs(cm.trend_score - older_cm.trend_score) > score_delta_threshold:
                        skip = False
                    if skip:
                        continue

            # Get 30-day star delta from daily metrics
            thirty_days_ago = today - timedelta(days=30)
            oldest_dm = (
                db.query(DailyMetric)
                .filter(
                    DailyMetric.repo_id == repo.id,
                    DailyMetric.captured_at >= thirty_days_ago,
                )
                .order_by(DailyMetric.captured_at.asc())
                .first()
            )
            latest_dm = (
                db.query(DailyMetric)
                .filter_by(repo_id=repo.id)
                .order_by(DailyMetric.captured_at.desc())
                .first()
            )
            star_delta_30d = 0.0
            contributors = 0
            if oldest_dm and latest_dm:
                star_delta_30d = float(latest_dm.stars - oldest_dm.stars)
                contributors = latest_dm.contributors or 0

            targets.append({
                "repo_id": repo.id,
                "owner": repo.owner,
                "name": repo.name,
                "category": repo.category,
                "description": repo.description,
                "primary_language": repo.primary_language,
                "topics": repo.topics,
                "trend_score": cm.trend_score,
                "star_delta_30d": star_delta_30d,
                "contributors": contributors,
            })
    except Exception as e:
        logger.error(f"Failed to query top repos for summaries: {e}")
        return 0
    finally:
        db.close()

    # Generate summaries without holding database connections during network I/O
    summaries = {}
    for target in targets:
        summary = generate_repo_summary(
            owner=target["owner"],
            repo_name=target["name"],
            category=target["category"],
            description=target["description"],
            primary_language=target["primary_language"],
            topics=target["topics"],
            trend_score=target["trend_score"],
            star_delta_30d=target["star_delta_30d"],
            contributors=target["contributors"],
        )
        if summary:
            summaries[target["repo_id"]] = summary

    if not summaries:
        return 0

    # Save to database in a new short-lived session
    db = SessionLocal()
    written = 0
    try:
        for repo_id, summary in summaries.items():
            repo = db.query(Repository).filter_by(id=repo_id).first()
            if repo:
                repo.repo_summary = summary
                repo.repo_summary_generated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                written += 1
        db.commit()
        logger.info(f"Repo summaries written: {written}/{len(targets)}")
        return written
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save repo summaries to DB: {e}")
        return 0
    finally:
        db.close()


# ─── Deep Repo Summary ────────────────────────────────────────────────────────

DEEP_SUMMARY_SYSTEM = """You are a Principal Software Architect conducting a rigorous, highly-detailed technical audit and architectural breakdown of GitHub repositories.
Your analysis must be:
1. Extremely precise, concrete, and technical. Avoid high-level abstractions or generic summaries.
2. Rooted in codebase details: mention specific architectural patterns, libraries, protocols, database paradigms, runtime requirements, and configuration strategies.
3. Formatted strictly as valid, parser-safe JSON with no wrapping markdown block quotes or trailing annotations.
4. Objective and free of marketing fluff or buzzwords."""

class LLMPipelineError(RuntimeError):
    """Raised when all configured LLM providers fail or return invalid output."""
    pass

DEEP_SUMMARY_TEMPLATE = """Analyze the provided GitHub repository details and README excerpt to generate a dense, accurate architectural summary.

Repository: {owner}/{repo_name}
Description: {description}
Primary language: {language}
Topics/tags: {topics}
GitHub topics: {github_topics}
Languages used (bytes): {languages}
README excerpt (first 3000 chars): {readme}

Quantitative momentum and sustainability metrics:
- Trend Score: {trend_score}
- 7d Star Velocity: {star_velocity_7d} stars/day
- Star Acceleration: {acceleration}
- Sustainability Score: {sustainability_score}/1.0
- Sustainability Label: {sustainability_label}

Return exactly this JSON structure:
{{
  "what": "A comprehensive, 2-3 sentence technical description of the project. State the exact type of software (e.g., CLI tool, library, microservice, framework, application client/server), its primary value proposition, core functional capabilities, and intended audience (e.g., developers, DevOps engineers, systems admins).",
  "why": "A 2-3 sentence explanation of the specific technological gap or problem solved. Highlight the inefficiencies, limitations, or design constraints of existing alternatives (e.g., performance issues, synchronization overhead, complexity, lack of standard compliance) that led to this project's creation.",
  "how": "A 2-3 sentence technical and architectural breakdown of its runtime flow, execution model, and core pipeline. Discuss how data flows through the application, specific APIs, protocols, concurrency models, or key modules that drive the logic.",
  "tech_stack": ["List", "of", "all", "major", "technologies", "frameworks", "runtimes", "compilers", "databases", "transpilers", "message brokers", "protocols", "and", "key libraries/dependencies", "found"],
  "use_cases": [
    "A highly specific developer, deployment, or user-centric scenario 1.",
    "A highly specific developer, deployment, or user-centric scenario 2.",
    "A highly specific developer, deployment, or user-centric scenario 3."
  ]
}}

Derive the tech stack from languages used, tags, description, and dependency lists/instructions in the README. Include system-level requirements or deployment environments where visible.
Output ONLY the JSON object. Do not include markdown code fences (```json ... ```)."""


async def generate_deep_summary(
    owner: str,
    repo_name: str,
    description: Optional[str],
    language: Optional[str],
    topics: Optional[str],
    github_topics: list,
    languages: dict,
    readme: str,
    trend_score: float = 0.0,
    star_velocity_7d: float = 0.0,
    acceleration: float = 0.0,
    sustainability_score: float = 0.0,
    sustainability_label: str = "YELLOW",
) -> dict:
    """
    Generate a structured deep summary with what/why/how/tech_stack/use_cases.
    Raises LLMPipelineError if all providers fail.
    """
    import json

    languages_str = ", ".join(
        f"{lang}: {round(bytes_ / 1024, 1)}KB"
        for lang, bytes_ in sorted(languages.items(), key=lambda x: -x[1])[:8]
    ) or "Not available"

    prompt = DEEP_SUMMARY_TEMPLATE.format(
        owner=owner,
        repo_name=repo_name,
        description=description or "Not provided",
        language=language or "Unknown",
        topics=topics or "None",
        github_topics=", ".join(github_topics) if github_topics else "None",
        languages=languages_str,
        readme=readme[:3000] if readme else "Not available",
        trend_score=round(trend_score, 4),
        star_velocity_7d=round(star_velocity_7d, 2),
        acceleration=round(acceleration, 4),
        sustainability_score=round(sustainability_score, 2),
        sustainability_label=sustainability_label,
    )

    messages = [
        {"role": "system", "content": DEEP_SUMMARY_SYSTEM},
        {"role": "user", "content": prompt},
    ]
    try:
        raw = await async_chat_completion(
            messages=messages,
            temperature=0.3,
            max_tokens=700,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        logger.error(f"Deep summary LLM call failed for {owner}/{repo_name}: {e}")
        raise LLMPipelineError(f"LLM call failed: {e}") from e

    if not raw:
        logger.error(f"Deep summary returned empty result for {owner}/{repo_name}")
        raise LLMPipelineError("LLM returned an empty response")

    try:
        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        # Ensure all keys present
        for key in ("what", "why", "how", "tech_stack", "use_cases"):
            if key not in result:
                raise LLMPipelineError(f"LLM response missing key: {key}")
        return result
    except Exception as e:
        logger.error(f"Deep summary JSON parsing failed for {owner}/{repo_name}: {e}. Raw response: {repr(raw)}")
        raise LLMPipelineError(f"JSON validation failed: {e}") from e
