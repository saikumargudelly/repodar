import json
import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class RepositoryContext(BaseModel):
    repo_id: str
    owner: str
    name: str
    description: Optional[str] = None
    primary_language: Optional[str] = None
    languages_summary: str
    readme_excerpt: str
    commit_metrics: Dict[str, Any]
    ecosystem_summary: str
    sustainability_metrics: Dict[str, Any]
    repo_stats: Dict[str, Any]


def extract_semantic_markdown(readme: str, max_chars: int = 1500) -> str:
    """
    Parses README markdown and extracts whitelisted sections.
    Falls back to simple truncation if no ATX headings are found.
    """
    if not readme or not readme.strip():
        return "Not available"
    
    # Match ATX headings: lines starting with 1-6 '#' followed by space and heading text
    heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    matches = list(heading_pattern.finditer(readme))
    
    if not matches:
        return readme[:max_chars].strip()
    
    sections = []
    for i, match in enumerate(matches):
        heading_text = match.group(2).strip()
        start_idx = match.end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(readme)
        content = readme[start_idx:end_idx].strip()
        
        sections.append({
            "heading": heading_text,
            "level": len(match.group(1)),
            "content": content
        })
    
    whitelisted_terms = [
        "description", "about", "features", "capabilities", "tech stack",
        "technologies", "installation", "quick start", "usage", "getting started"
    ]
    blacklisted_terms = [
        "license", "contribute", "contributing", "contributors", "badge",
        "badges", "changelog", "history", "donation", "donations", "support",
        "sponsor", "sponsors", "acknowledgements"
    ]
    
    keep_sections = []
    for sec in sections:
        h_lower = sec["heading"].lower()
        if any(term in h_lower for term in blacklisted_terms):
            continue
        
        is_whitelisted = any(term in h_lower for term in whitelisted_terms)
        is_first_header = (sec == sections[0])
        
        if is_whitelisted or is_first_header:
            # Strip markdown images and HTML comment blocks to save tokens
            content_cleaned = re.sub(r'!\[.*?\]\(.*?\)', '', sec["content"])
            content_cleaned = re.sub(r'<!--.*?-->', '', content_cleaned, flags=re.DOTALL)
            keep_sections.append(f"## {sec['heading']}\n{content_cleaned.strip()}")
            
    if not keep_sections:
        # Fallback to the first two sections if no whitelisted headings are matched
        for sec in sections[:2]:
            keep_sections.append(f"## {sec['heading']}\n{sec['content']}")
            
    merged = "\n\n".join(keep_sections).strip()
    if len(merged) > max_chars:
        return merged[:max_chars].strip() + "\n[Readme truncated...]"
    return merged


def summarize_commit_activity(commit_activity_json: Optional[str]) -> dict:
    """
    Summarizes 52 weeks of weekly/daily commits into aggregate metrics.
    """
    default_stats = {
        "total_commits": 0,
        "active_weeks": 0,
        "average_commits_per_week": 0.0,
        "latest_commit": "Not available"
    }
    if not commit_activity_json:
        return default_stats
        
    try:
        points = json.loads(commit_activity_json)
        if not isinstance(points, list) or not points:
            return default_stats
            
        total_commits = sum(p.get("count", 0) for p in points)
        
        # 52 weeks of daily points (364 days). Each block of 7 days is a week.
        active_weeks = 0
        chunk_size = 7
        for i in range(0, len(points), chunk_size):
            chunk = points[i:i+chunk_size]
            week_commits = sum(p.get("count", 0) for p in chunk)
            if week_commits > 0:
                active_weeks += 1
                
        latest_commit = "Not available"
        for p in reversed(points):
            if p.get("count", 0) > 0:
                latest_commit = p.get("date", "Unknown")
                break
                
        return {
            "total_commits": total_commits,
            "active_weeks": active_weeks,
            "average_commits_per_week": round(total_commits / 52.0, 2),
            "latest_commit": latest_commit
        }
    except Exception:
        return default_stats


def compress_ecosystem_relationships(ecosystem_data_json: Optional[dict]) -> str:
    """
    Compresses dense relationship mappings into a concise label notation.
    Format: alt:owner/repo(stars*,lang), comp:owner/repo(stars*,lang)
    """
    if not ecosystem_data_json or not isinstance(ecosystem_data_json, dict):
        return "Not available"
        
    rels = ecosystem_data_json.get("relationships", [])
    if not isinstance(rels, list) or not rels:
        return "Not available"
        
    compressed = []
    for r in rels:
        if not isinstance(r, dict):
            continue
        rel_repo = r.get("related_repo")
        rel_type = r.get("relationship", "")
        stars = r.get("stars", 0)
        lang = r.get("primary_language", "Unknown")
        
        if not rel_repo:
            continue
            
        short_type = "alt" if rel_type == "alternative" else "comp" if rel_type == "companion" else rel_type
        compressed.append(f"{short_type}:{rel_repo}({stars}*,{lang})")
        
    if not compressed:
        return "Not available"
    return ", ".join(compressed)


def summarize_languages(languages: dict) -> str:
    """
    Computes a percentage-based breakdown of top 5 repository languages.
    """
    if not languages or not isinstance(languages, dict):
        return "Not available"
    total_bytes = sum(languages.values())
    if total_bytes == 0:
        return "Not available"
    sorted_langs = sorted(languages.items(), key=lambda x: -x[1])[:5]
    return ", ".join(
        f"{lang} ({round(bytes_ / total_bytes * 100.0, 1)}%)"
        for lang, bytes_ in sorted_langs
    )


def build_repository_context(
    repo_id: str,
    owner: str,
    name: str,
    description: Optional[str],
    primary_language: Optional[str],
    languages: dict,
    readme: str,
    commit_activity_json: Optional[str],
    ecosystem_context: Optional[dict],
    trend_score: float = 0.0,
    star_velocity_7d: float = 0.0,
    acceleration: float = 0.0,
    sustainability_score: float = 0.0,
    sustainability_label: str = "YELLOW",
    stars: int = 0,
    forks: int = 0,
    contributors_count: int = 0
) -> RepositoryContext:
    """
    Builds a fully normalized RepositoryContext object.
    """
    languages_str = summarize_languages(languages)
    readme_excerpt = extract_semantic_markdown(readme)
    commit_metrics = summarize_commit_activity(commit_activity_json)
    ecosystem_summary = compress_ecosystem_relationships(ecosystem_context)
    
    return RepositoryContext(
        repo_id=repo_id,
        owner=owner,
        name=name,
        description=description,
        primary_language=primary_language,
        languages_summary=languages_str,
        readme_excerpt=readme_excerpt,
        commit_metrics=commit_metrics,
        ecosystem_summary=ecosystem_summary,
        sustainability_metrics={
            "trend_score": trend_score,
            "star_velocity_7d": star_velocity_7d,
            "acceleration": acceleration,
            "sustainability_score": sustainability_score,
            "sustainability_label": sustainability_label,
        },
        repo_stats={
            "stars": stars,
            "forks": forks,
            "contributors_count": contributors_count,
        }
    )
