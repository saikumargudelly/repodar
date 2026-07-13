import logging
from typing import List, Dict, Tuple, Any, Optional
from app.services.context import RepositoryContext

logger = logging.getLogger(__name__)

PROMPT_VERSION = "2.0.0"

DEEP_SUMMARY_SYSTEM = """You are a Principal Software Architect conducting a rigorous, highly-detailed technical audit and architectural breakdown of GitHub repositories.
Your analysis must be:
1. Extremely precise, concrete, and technical. Avoid high-level abstractions or generic summaries.
2. Rooted in codebase details: mention specific architectural patterns, libraries, protocols, database paradigms, runtime requirements, and configuration strategies.
3. Formatted strictly as valid, parser-safe JSON with no wrapping markdown block quotes or trailing annotations.
4. Objective and free of marketing fluff or buzzwords."""

DEEP_SUMMARY_TEMPLATE = """Analyze the provided GitHub repository details and README excerpt to generate a dense, accurate architectural summary.

Repository: {owner}/{repo_name}
Description: {description}
Primary language: {language}
Topics/tags: {topics}
Languages used: {languages}
README excerpt: {readme}

Quantitative momentum and sustainability metrics:
- Trend Score: {trend_score}
- 7d Star Velocity: {star_velocity_7d} stars/day
- Star Acceleration: {acceleration}
- Sustainability Score: {sustainability_score}/1.0
- Sustainability Label: {sustainability_label}

Repository stats:
- Stars: {stars}
- Forks: {forks}
- Contributors: {contributors_count}
- Commit Activity (last year): Total: {total_commits}, Active weeks: {active_weeks}/52, Avg/week: {avg_commits}, Latest: {latest_commit}
- Ecosystem Context: {ecosystem_context}

Return exactly this JSON structure:
{{
  "what": "2-3 sentence technical description (type of software, core capabilities, value proposition, audience).",
  "why": "2-3 sentence explanation of the gap/problem solved compared to existing alternatives.",
  "how": "2-3 sentence technical breakdown of runtime flow, execution model, architecture, and core modules.",
  "tech_stack": ["List of major technologies, frameworks, runtimes, protocols, and dependencies found"],
  "use_cases": [
    "Specific developer/deployment/user scenario 1.",
    "Specific developer/deployment/user scenario 2.",
    "Specific developer/deployment/user scenario 3."
  ]
}}

Derive the tech stack from languages used, tags, description, and dependency lists/instructions in the README. Include system-level requirements or deployment environments where visible.
Output ONLY the JSON object. Do not include markdown code fences (```json ... ```)."""


def estimate_tokens(text: str) -> int:
    """
    Heuristic-based token count estimator (1 token ≈ 4 characters).
    """
    return max(len(text) // 4, 1)


def build_deep_summary_prompt(
    context: RepositoryContext,
    budget_tokens: int = 2000
) -> Tuple[List[Dict[str, str]], Dict[str, Any]]:
    """
    Constructs the Deep Summary prompt, auditing and enforcing the budget_tokens limit.
    Trims the readme excerpt first, then ecosystem summary if needed.
    Returns: (list of messages, audit_telemetry_dict)
    """
    # 1. Base formatting values (copying to allow mutability)
    description = context.description or "Not provided"
    language = context.primary_language or "Unknown"
    languages_str = context.languages_summary
    readme_excerpt = context.readme_excerpt
    ecosystem_summary = context.ecosystem_summary
    
    # Extract commit metrics
    total_commits = context.commit_metrics.get("total_commits", 0)
    active_weeks = context.commit_metrics.get("active_weeks", 0)
    avg_commits = context.commit_metrics.get("average_commits_per_week", 0.0)
    latest_commit = context.commit_metrics.get("latest_commit", "Not available")
    
    # Extract sustainability metrics
    trend_score = context.sustainability_metrics.get("trend_score", 0.0)
    star_velocity_7d = context.sustainability_metrics.get("star_velocity_7d", 0.0)
    acceleration = context.sustainability_metrics.get("acceleration", 0.0)
    sustainability_score = context.sustainability_metrics.get("sustainability_score", 0.0)
    sustainability_label = context.sustainability_metrics.get("sustainability_label", "YELLOW")
    
    # Extract repo stats
    stars = context.repo_stats.get("stars", 0)
    forks = context.repo_stats.get("forks", 0)
    contribs = context.repo_stats.get("contributors_count", 0)

    # 2. Estimate system tokens and calculate character budget for user prompt
    system_tokens = estimate_tokens(DEEP_SUMMARY_SYSTEM)
    target_user_chars = (budget_tokens - system_tokens) * 4
    
    # Format a base user prompt with placeholder readme to see how much space we have
    base_user_prompt = DEEP_SUMMARY_TEMPLATE.format(
        owner=context.owner,
        repo_name=context.name,
        description=description,
        language=language,
        topics=context.primary_language or "None",
        languages=languages_str,
        readme="",
        trend_score=round(trend_score, 4),
        star_velocity_7d=round(star_velocity_7d, 2),
        acceleration=round(acceleration, 4),
        sustainability_score=round(sustainability_score, 2),
        sustainability_label=sustainability_label,
        stars=stars,
        forks=forks,
        contributors_count=contribs,
        total_commits=total_commits,
        active_weeks=active_weeks,
        avg_commits=avg_commits,
        latest_commit=latest_commit,
        ecosystem_context=ecosystem_summary
    )
    
    base_chars = len(base_user_prompt)
    available_readme_chars = target_user_chars - base_chars
    
    if available_readme_chars < 200:
        # If very little space is left, first clear ecosystem summary to reclaim space
        ecosystem_summary = "Not available"
        base_user_prompt_no_eco = DEEP_SUMMARY_TEMPLATE.format(
            owner=context.owner,
            repo_name=context.name,
            description=description,
            language=language,
            topics=context.primary_language or "None",
            languages=languages_str,
            readme="",
            trend_score=round(trend_score, 4),
            star_velocity_7d=round(star_velocity_7d, 2),
            acceleration=round(acceleration, 4),
            sustainability_score=round(sustainability_score, 2),
            sustainability_label=sustainability_label,
            stars=stars,
            forks=forks,
            contributors_count=contribs,
            total_commits=total_commits,
            active_weeks=active_weeks,
            avg_commits=avg_commits,
            latest_commit=latest_commit,
            ecosystem_context=ecosystem_summary
        )
        base_chars = len(base_user_prompt_no_eco)
        available_readme_chars = target_user_chars - base_chars
        
    if len(readme_excerpt) > max(available_readme_chars, 0):
        if available_readme_chars > 50:
            readme_excerpt = readme_excerpt[:available_readme_chars - 30] + "\n[Readme truncated...]"
        else:
            readme_excerpt = "Not available"
            
    # Format the final user prompt
    user_prompt = DEEP_SUMMARY_TEMPLATE.format(
        owner=context.owner,
        repo_name=context.name,
        description=description,
        language=language,
        topics=context.primary_language or "None",
        languages=languages_str,
        readme=readme_excerpt,
        trend_score=round(trend_score, 4),
        star_velocity_7d=round(star_velocity_7d, 2),
        acceleration=round(acceleration, 4),
        sustainability_score=round(sustainability_score, 2),
        sustainability_label=sustainability_label,
        stars=stars,
        forks=forks,
        contributors_count=contribs,
        total_commits=total_commits,
        active_weeks=active_weeks,
        avg_commits=avg_commits,
        latest_commit=latest_commit,
        ecosystem_context=ecosystem_summary
    )
    
    # Absolute emergency hard truncate if still over budget (due to other metadata)
    total_tokens = system_tokens + estimate_tokens(user_prompt)
    if total_tokens > budget_tokens:
        char_budget = (budget_tokens - system_tokens) * 4
        if char_budget > 200:
            user_prompt = user_prompt[:char_budget - 30] + "\n[Truncated to fit budget...]"
        else:
            user_prompt = user_prompt[:200]
        total_tokens = system_tokens + estimate_tokens(user_prompt)

    messages = [
        {"role": "system", "content": DEEP_SUMMARY_SYSTEM},
        {"role": "user", "content": user_prompt}
    ]
    
    # 3. Calculate Telemetry Metadata
    # Raw characters size calculation (unpreprocessed/raw inputs estimation)
    raw_chars = (
        len(context.description or "") +
        len(context.readme_excerpt) * 2 + # estimate raw readme as double the excerpt
        5000 + # estimate raw weekly commit logs as ~5000 chars
        3000   # estimate raw ecosystem relationships as ~3000 chars
    )
    
    prompt_chars = len(DEEP_SUMMARY_SYSTEM) + len(user_prompt)
    compression_ratio = round(raw_chars / max(prompt_chars, 1), 2)
    
    telemetry = {
        "prompt_version": PROMPT_VERSION,
        "prompt_tokens": total_tokens,
        "compression_ratio": compression_ratio,
        "prompt_chars": prompt_chars,
        "raw_chars": raw_chars
    }
    
    return messages, telemetry


# ─── Trend Explanation Prompt Builder ──────────────────────────────────────────

TREND_EXPLANATION_SYSTEM = """You are an AI infrastructure analyst writing for a technical analyst audience.
Your tone is direct, precise, and data-driven — similar to a Bloomberg Intelligence brief.
Never use hype words. State facts and infer signal from the data provided.
Output exactly 3-5 sentences. No bullet points. No headers."""

TREND_EXPLANATION_TEMPLATE = """Explain why the GitHub repo {owner}/{repo_name} is currently trending based on the following data:

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


def build_trend_explanation_prompt(
    owner: str,
    repo_name: str,
    category: str,
    metrics: dict,
    primary_language: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Builds the messages payload for generating trend explanations.
    """
    release_boost = "Yes" if metrics.get("trend_score", 0) > 0 and metrics.get("acceleration", 0) > 0 else "No"
    
    prompt = TREND_EXPLANATION_TEMPLATE.format(
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
    
    return [
        {"role": "system", "content": TREND_EXPLANATION_SYSTEM},
        {"role": "user", "content": prompt}
    ]


# ─── Repo Summary Prompt Builder ───────────────────────────────────────────────

REPO_SUMMARY_SYSTEM = """You are a senior developer writing a brief introduction for a technical audience.
Be concrete, informative, and jargon-free. Do not use hype. No bullet points. No headers.
Output exactly 3 sentences."""

REPO_SUMMARY_TEMPLATE = """Write a 3-sentence plain-English summary for the GitHub repository {owner}/{repo_name}.

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


def build_repo_summary_prompt(
    owner: str,
    repo_name: str,
    category: str,
    description: Optional[str],
    primary_language: Optional[str],
    topics: Optional[str],
    trend_score: float,
    star_delta_30d: float,
    contributors: int
) -> List[Dict[str, str]]:
    """
    Builds the messages payload for generating a 3-sentence repo summary.
    """
    prompt = REPO_SUMMARY_TEMPLATE.format(
        owner=owner,
        repo_name=repo_name,
        description=description or "Not provided",
        category=category,
        primary_language=primary_language or "Unknown",
        topics=topics or "None",
        trend_score=round(trend_score, 4),
        star_delta_30d=round(star_delta_30d, 0),
        contributors=contributors
    )
    
    return [
        {"role": "system", "content": REPO_SUMMARY_SYSTEM},
        {"role": "user", "content": prompt}
    ]
