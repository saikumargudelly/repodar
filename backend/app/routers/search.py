"""
Natural language repo search — LLM-powered query parsing → structured filters.

POST /search/parse  — returns parsed filter JSON
GET  /search        — full NL → filter → results pipeline
"""
import json
import logging
import os
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/search", tags=["Search"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ParsedFilters(BaseModel):
    vertical: Optional[str] = None          # ai_ml | devtools | web_frameworks | security | data_engineering | blockchain
    min_trend_score: Optional[float] = None
    max_age_days: Optional[int] = None
    min_stars: Optional[int] = None
    sort_by: Optional[str] = None           # trend_score | star_velocity_7d | acceleration | sustainability_score | age_days
    time_window: Optional[str] = None       # 7d | 30d | 90d | 365d
    language: Optional[str] = None
    min_sustainability: Optional[float] = None
    query_understood: str = ""
    raw_query: str = ""


class SearchResult(BaseModel):
    filters: ParsedFilters
    repos: List[dict]
    total: int


_PARSE_SYSTEM = """You parse natural language queries about GitHub repositories into a JSON filter object.

ONLY output valid JSON. No prose, no code fences. Return exactly this schema:
{
  "vertical": "ai_ml|devtools|web_frameworks|security|data_engineering|blockchain|null",
  "min_trend_score": number_or_null,
  "max_age_days": number_or_null,
  "min_stars": number_or_null,
  "sort_by": "trend_score|star_velocity_7d|acceleration|sustainability_score|age_days|null",
  "time_window": "7d|30d|90d|365d|null",
  "language": "Python|JavaScript|TypeScript|Go|Rust|C++|null",
  "min_sustainability": number_between_0_and_1_or_null,
  "query_understood": "one sentence paraphrase of what the user wants"
}

Examples:
- "Python inference engines gaining traction in the last 30 days"
  → {"vertical":"ai_ml","min_trend_score":null,"max_age_days":null,"min_stars":null,"sort_by":"trend_score","time_window":"30d","language":"Python","min_sustainability":null,"query_understood":"Python AI inference repos gaining momentum recently"}
- "agent frameworks under 1 year old with high sustainability"
  → {"vertical":"ai_ml","min_trend_score":null,"max_age_days":365,"min_stars":null,"sort_by":"sustainability_score","time_window":null,"language":null,"min_sustainability":0.6,"query_understood":"New agent framework repos with strong sustainability scores"}
- "vector databases with growing contributor counts"
  → {"vertical":"ai_ml","min_trend_score":null,"max_age_days":null,"min_stars":null,"sort_by":"trend_score","time_window":null,"language":null,"min_sustainability":null,"query_understood":"Vector database repos with growing contributor activity"}
"""


def _parse_query(query: str) -> Optional[dict]:
    """Use Groq to parse a natural language query into structured filters."""
    if not GROQ_API_KEY:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _PARSE_SYSTEM},
                {"role": "user", "content": query},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        raw = (resp.choices[0].message.content or "").strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        logger.error(f"NL search parse failed: {e}")
        return None


@router.post("/parse", response_model=ParsedFilters)
def parse_query(query: str = Query(..., description="Natural language query")):
    """Parse a natural language query into structured filters (does NOT run search)."""
    parsed = _parse_query(query)
    if not parsed:
        raise HTTPException(status_code=503, detail="Query parsing unavailable — check GROQ_API_KEY.")
    parsed["raw_query"] = query
    return ParsedFilters(**{k: v for k, v in parsed.items() if k in ParsedFilters.model_fields})


@router.get("", response_model=SearchResult)
def natural_language_search(
    query: str = Query(..., description="Natural language query"),
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
):
    """
    Full pipeline: parse natural language → apply filters → return matching repos.
    Falls back to returning top repos by trend_score if parsing fails.
    """
    from app.models import Repository, ComputedMetric, DailyMetric
    from sqlalchemy import func

    parsed = _parse_query(query) or {}
    parsed["raw_query"] = query

    filters = ParsedFilters(**{k: v for k, v in parsed.items() if k in ParsedFilters.model_fields})

    # Build repo query
    repo_q = db.query(Repository).filter(Repository.is_active == True)

    if filters.vertical:
        repo_q = repo_q.filter(Repository.category.ilike(f"%{filters.vertical.replace('_', '%')}%"))
    if filters.language:
        repo_q = repo_q.filter(Repository.primary_language.ilike(filters.language))
    if filters.max_age_days:
        repo_q = repo_q.filter(Repository.age_days <= filters.max_age_days)

    repos = repo_q.all()

    # Enrich with latest computed scores
    results = []
    for repo in repos:
        cm = (
            db.query(ComputedMetric)
            .filter_by(repo_id=repo.id)
            .order_by(ComputedMetric.date.desc())
            .first()
        )
        if not cm:
            continue
        if filters.min_trend_score and cm.trend_score < filters.min_trend_score:
            continue
        if filters.min_sustainability and cm.sustainability_score < filters.min_sustainability:
            continue

        # Get star count
        dm = (
            db.query(DailyMetric)
            .filter_by(repo_id=repo.id)
            .order_by(DailyMetric.date.desc())
            .first()
        )
        stars = dm.stars if dm else 0
        if filters.min_stars and stars < filters.min_stars:
            continue

        results.append({
            "repo_id": repo.id,
            "owner": repo.owner,
            "name": repo.name,
            "category": repo.category,
            "github_url": repo.github_url,
            "primary_language": repo.primary_language,
            "age_days": repo.age_days,
            "stars": stars,
            "trend_score": cm.trend_score,
            "sustainability_score": cm.sustainability_score,
            "sustainability_label": cm.sustainability_label,
            "star_velocity_7d": cm.star_velocity_7d,
            "acceleration": cm.acceleration,
            "description": repo.description,
        })

    # Sort
    sort_key = filters.sort_by or "trend_score"
    reverse = sort_key != "age_days"
    results.sort(key=lambda x: x.get(sort_key) or 0, reverse=reverse)

    return SearchResult(filters=filters, repos=results[:limit], total=len(results))
