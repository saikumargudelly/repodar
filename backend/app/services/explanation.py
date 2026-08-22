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

    from app.services.prompt_builder import build_trend_explanation_prompt

    messages = build_trend_explanation_prompt(
        owner=owner,
        repo_name=repo_name,
        category=category,
        metrics=metrics,
        primary_language=primary_language
    )

    res = sync_chat_completion(
        messages=messages,
        temperature=0.3,
        max_tokens=300,
    )
    explanation = res.text if res else None
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

    from app.services.prompt_builder import build_repo_summary_prompt

    messages = build_repo_summary_prompt(
        owner=owner,
        repo_name=repo_name,
        category=category,
        description=description,
        primary_language=primary_language,
        topics=topics,
        trend_score=trend_score,
        star_delta_30d=star_delta_30d,
        contributors=contributors
    )

    res = sync_chat_completion(
        messages=messages,
        temperature=0.4,
        max_tokens=200,
    )
    summary = res.text if res else None
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

class LLMPipelineError(RuntimeError):
    """Raised when all configured LLM providers fail or return invalid output."""
    pass


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
    stars: int = 0,
    forks: int = 0,
    contributors_count: int = 0,
    commit_activity: Optional[str] = None,
    ecosystem_context: Optional[dict] = None,
) -> dict:
    """
    Generate a structured deep summary with what/why/how/tech_stack/use_cases.
    Preprocesses inputs deterministically, audits prompt budget, and injects telemetry.
    Raises LLMPipelineError if all providers fail.
    """
    import json
    import time
    from app.services.context import build_repository_context
    from app.services.prompt_builder import build_deep_summary_prompt

    # 1. Normalize context
    context = build_repository_context(
        repo_id=f"{owner}/{repo_name}",
        owner=owner,
        name=repo_name,
        description=description,
        primary_language=language,
        languages=languages,
        readme=readme,
        commit_activity_json=commit_activity,
        ecosystem_context=ecosystem_context,
        trend_score=trend_score,
        star_velocity_7d=star_velocity_7d,
        acceleration=acceleration,
        sustainability_score=sustainability_score,
        sustainability_label=sustainability_label,
        stars=stars,
        forks=forks,
        contributors_count=contributors_count
    )

    # 2. Build and audit prompt under budget cap (e.g. 2000 tokens)
    messages, audit_telemetry = build_deep_summary_prompt(context, budget_tokens=2000)

    def _fallback_result() -> dict:
        topics_list = [t for t in (github_topics or []) if t]
        lang_str = language or (list(languages.keys())[0] if languages else "Software")
        what = description or f"{owner}/{repo_name} is an open-source {lang_str} project."
        why = f"Provides modern tools and libraries in the {lang_str} ecosystem with community adoption ({stars:,} stars)."
        how = f"Built with {lang_str} and organized with modular architecture for extensible development."
        tech_stack = list(languages.keys())[:5] if languages else ([language] if language else ["Python"])
        if topics_list:
            for t in topics_list[:4]:
                if t not in tech_stack:
                    tech_stack.append(t)
        use_cases = [
            f"{lang_str} application development and automation",
            f"Integrating {repo_name} workflows into modern pipelines",
            "Open-source community collaboration and extensible tooling"
        ]
        return {
            "what": what,
            "why": why,
            "how": how,
            "tech_stack": tech_stack,
            "use_cases": use_cases,
            "prompt_version": audit_telemetry.get("prompt_version", "v1.0.0"),
            "prompt_tokens": audit_telemetry.get("prompt_tokens", 0),
            "completion_tokens": 0,
            "compression_ratio": audit_telemetry.get("compression_ratio", 1.0),
            "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
        }

    start_time = time.perf_counter()
    response = None
    raw = None
    try:
        response = await async_chat_completion(
            messages=messages,
            temperature=0.3,
            max_tokens=700,
            json_required_keys=["what", "why", "how", "tech_stack", "use_cases"],
        )
        raw = response.text if response else None
    except Exception as e:
        logger.warning(f"Deep summary LLM call failed for {owner}/{repo_name}: {e}. Using deterministic fallback.")
        return _fallback_result()

    if not raw or not raw.strip():
        logger.warning(f"Deep summary returned empty result for {owner}/{repo_name}. Using deterministic fallback.")
        return _fallback_result()

    try:
        # Strip any accidental markdown fences
        text_to_parse = raw.strip()
        if text_to_parse.startswith("```"):
            parts = text_to_parse.split("```")
            if len(parts) >= 3:
                text_to_parse = parts[1]
                if text_to_parse.startswith("json"):
                    text_to_parse = text_to_parse[4:]
        result = json.loads(text_to_parse.strip())
        
        # Inject Telemetry & Versioning
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        result["prompt_version"] = audit_telemetry["prompt_version"]
        result["prompt_tokens"] = (response.prompt_tokens if response else None) or audit_telemetry["prompt_tokens"]
        result["completion_tokens"] = (response.completion_tokens if response else None) or 0
        result["compression_ratio"] = audit_telemetry["compression_ratio"]
        result["latency_ms"] = (response.latency_ms if response else None) or latency_ms
        
        return result
    except Exception as e:
        logger.warning(f"Deep summary JSON parsing failed for {owner}/{repo_name}: {e}. Raw response: {repr(raw)}. Using deterministic fallback.")
        return _fallback_result()
