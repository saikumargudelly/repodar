"""
Natural language repo search — LLM-powered query parsing → structured filters.

POST /search/parse  — returns parsed filter JSON
GET  /search        — full NL → filter → results pipeline
                      Searches BOTH internal DB (for metrics) + GitHub API (for freshness)
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/search", tags=["Search"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

_GITHUB_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# Map vertical names → DB category substrings
VERTICAL_CATEGORY_MAP: dict[str, list[str]] = {
    "ai_ml":            ["AI / ML", "Agent Framework", "Inference Engine", "LLM Model",
                         "Fine-tuning", "Evaluation Framework", "Vector Database"],
    "devtools":         ["DevTools", "Model Serving", "Runtime"],
    "web_frameworks":   ["Web Framework"],
    "security":         ["Security"],
    "data_engineering": ["Data Engineering", "Vector Database", "Data Pipeline"],
    "blockchain":       ["Blockchain"],
}

TIME_WINDOW_DAYS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}

# Stop-words to skip when extracting keywords for fallback
_STOP = frozenset({
    "with", "from", "that", "this", "high", "fast", "good", "last", "days",
    "week", "show", "find", "repos", "repository", "repositories", "list",
    "some", "best", "most", "more", "very", "highly", "have", "having",
    "been", "gain", "gaining", "about", "using", "built", "written", "the",
    "and", "for", "are", "all", "new", "old", "under", "over", "top",
})


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ParsedFilters(BaseModel):
    vertical:            Optional[str]   = None   # ai_ml | devtools | web_frameworks | security | data_engineering | blockchain
    min_trend_score:     Optional[float] = None
    max_age_days:        Optional[int]   = None
    min_stars:           Optional[int]   = None
    sort_by:             Optional[str]   = None   # trend_score | star_velocity_7d | acceleration | sustainability_score | age_days
    time_window:         Optional[str]   = None   # 7d | 30d | 90d | 365d
    language:            Optional[str]   = None
    min_sustainability:  Optional[float] = None
    keywords:            List[str]       = []     # key technical terms extracted from query
    github_search_query: Optional[str]   = None   # optimised GitHub search string
    query_understood:    str             = ""
    raw_query:           str             = ""


class SearchResult(BaseModel):
    filters: ParsedFilters
    repos:   List[dict]
    total:   int


# ─── LLM system prompt ───────────────────────────────────────────────────────

_TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")
_30D   = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
_7D    = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
_180D  = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y-%m-%d")

_PARSE_SYSTEM = f"""You parse natural language queries about GitHub repositories into a JSON filter object.

ONLY output valid JSON — no prose, no markdown code fences.

Schema (use JSON null for unknown/unspecified fields):
{{
  "vertical": "ai_ml" | "devtools" | "web_frameworks" | "security" | "data_engineering" | "blockchain" | null,
  "min_trend_score": <number 0-1> | null,
  "max_age_days": <integer> | null,
  "min_stars": <integer> | null,
  "sort_by": "trend_score" | "star_velocity_7d" | "acceleration" | "sustainability_score" | "age_days" | null,
  "time_window": "7d" | "30d" | "90d" | "365d" | null,
  "language": "Python" | "JavaScript" | "TypeScript" | "Go" | "Rust" | "C++" | "Java" | "Ruby" | null,
  "min_sustainability": <number 0-1> | null,
  "keywords": ["2-5 important technical nouns extracted from the query"],
  "github_search_query": "<optimised GitHub repository search string>",
  "query_understood": "<one sentence paraphrase of what the user wants>"
}}

Guidelines for `github_search_query`:
- Include the most important technical terms (e.g. "llm inference", "vector database", "agent framework")
- Add language:X qualifier when specified (e.g. "language:Python")
- Add topic:X for well-known GitHub topics (e.g. "topic:llm", "topic:machine-learning", "topic:vector-database")
- Add stars:>N to filter noise (use >50 for niche, >500 for popular)
- Add pushed:>=YYYY-MM-DD only when a time window is implied (today is {_TODAY})
- Keep the query focused: 4-10 tokens max

Examples:
Query: "Python inference engines gaining traction in the last 30 days"
→ {{"vertical":"ai_ml","min_stars":null,"sort_by":"trend_score","time_window":"30d","language":"Python","min_sustainability":null,"keywords":["inference","engine","llm"],"github_search_query":"llm inference engine language:Python topic:llm-inference pushed:>={_30D} stars:>50","query_understood":"Python LLM inference repos gaining momentum in the last 30 days"}}

Query: "agent frameworks under 1 year old with high sustainability"
→ {{"vertical":"ai_ml","max_age_days":365,"sort_by":"sustainability_score","min_sustainability":0.6,"keywords":["agent","framework","autonomous"],"github_search_query":"ai agent framework autonomous topic:ai-agent stars:>100","query_understood":"New AI agent framework repos with strong long-term health"}}

Query: "vector databases with growing contributor counts"
→ {{"vertical":"data_engineering","keywords":["vector","database","embeddings","similarity"],"github_search_query":"vector database embeddings topic:vector-database stars:>200","query_understood":"Vector database repos with growing community activity"}}

Query: "fast inference engines with high momentum this week"
→ {{"vertical":"ai_ml","time_window":"7d","sort_by":"trend_score","keywords":["inference","engine","llm","fast"],"github_search_query":"llm inference engine fast topic:llm-inference pushed:>={_7D} stars:>50","query_understood":"High-momentum LLM inference engine repos trending this week"}}

Query: "security tools in Go under 6 months old"
→ {{"vertical":"security","language":"Go","max_age_days":180,"keywords":["security","scanner","vulnerability"],"github_search_query":"security scanner vulnerability language:Go pushed:>={_180D} stars:>10","query_understood":"New Go security tool repos created in the last 6 months"}}

Query: "LLM fine-tuning repos gaining stars fast in last 30 days"
→ {{"vertical":"ai_ml","time_window":"30d","sort_by":"star_velocity_7d","keywords":["fine-tuning","lora","rlhf","llm"],"github_search_query":"llm fine-tuning lora rlhf topic:fine-tuning language:Python pushed:>={_30D} stars:>30","query_understood":"LLM fine-tuning repos that are rapidly gaining stars"}}
"""


# ─── LLM query parser ────────────────────────────────────────────────────────

def _parse_query(query: str) -> Optional[dict]:
    """Use Groq LLM to parse a natural language query into structured filters."""
    if not GROQ_API_KEY:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _PARSE_SYSTEM},
                {"role": "user",   "content": query},
            ],
            temperature=0.1,
            max_tokens=400,
        )
        raw = (resp.choices[0].message.content or "").strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return json.loads(raw)
    except Exception as e:
        logger.error(f"NL search parse failed: {e}")
        return None


def _keyword_fallback_parse(query: str) -> dict:
    """
    Lightweight fallback parser used when Groq is unavailable.
    Uses keyword matching to extract basic filters and build a GitHub search query.
    """
    q_lower = query.lower()
    parsed: dict = {
        "raw_query": query,
        "query_understood": query,
        "keywords": [w for w in query.split() if len(w) > 3 and w.lower() not in _STOP][:5],
    }

    # Language
    for lang in ["python", "javascript", "typescript", "go", "rust", "c++"]:
        if lang in q_lower:
            parsed["language"] = lang.title() if lang != "c++" else "C++"
            break

    # Vertical
    if any(w in q_lower for w in ["inference", "agent", "llm", "fine-tun", "vector", "embedding",
                                    "transformer", "gpt", "rag", "mlops", "model"]):
        parsed["vertical"] = "ai_ml"
    elif any(w in q_lower for w in [" ai ", " ml ", "machine learning", "deep learning"]):
        parsed["vertical"] = "ai_ml"
    elif any(w in q_lower for w in ["security", "vulnerability", "pentest", "exploit", "cve"]):
        parsed["vertical"] = "security"
    elif any(w in q_lower for w in ["devtool", "developer tool", "cli tool", "terminal"]):
        parsed["vertical"] = "devtools"
    elif any(w in q_lower for w in ["data engineer", "pipeline", "etl", "airflow", "spark"]):
        parsed["vertical"] = "data_engineering"
    elif any(w in q_lower for w in ["blockchain", "ethereum", "web3", "defi", "solidity"]):
        parsed["vertical"] = "blockchain"
    elif any(w in q_lower for w in ["web framework", " react ", " nextjs ", "fastapi", "django"]):
        parsed["vertical"] = "web_frameworks"

    # Time window
    if "this week" in q_lower or "7 day" in q_lower:
        parsed["time_window"] = "7d"
    elif "30 day" in q_lower or "this month" in q_lower or "last month" in q_lower:
        parsed["time_window"] = "30d"
    elif "90 day" in q_lower or "3 month" in q_lower:
        parsed["time_window"] = "90d"
    elif "year" in q_lower or "365" in q_lower or "12 month" in q_lower:
        parsed["time_window"] = "365d"

    # Max age
    if "under 6 month" in q_lower or "6 month" in q_lower:
        parsed["max_age_days"] = 180
    elif "under 1 year" in q_lower or "under a year" in q_lower:
        parsed["max_age_days"] = 365
    elif "under 3 month" in q_lower or "3 month" in q_lower:
        parsed["max_age_days"] = 90
    elif "under 30 day" in q_lower or "under a month" in q_lower:
        parsed["max_age_days"] = 30

    # Sort
    if any(w in q_lower for w in ["momentum", "trending", "gaining", "gaining star", "star velocity", "fast"]):
        parsed["sort_by"] = "star_velocity_7d"
    elif any(w in q_lower for w in ["sustainability", "health", "maintained", "active"]):
        parsed["sort_by"] = "sustainability_score"
    elif "acceleration" in q_lower:
        parsed["sort_by"] = "acceleration"
    elif "new" in q_lower or "recent" in q_lower or "youngest" in q_lower or "newest" in q_lower:
        parsed["sort_by"] = "age_days"

    # Build GitHub search query from keywords + lang
    kws = parsed.get("keywords", [])
    lang_part = f" language:{parsed['language']}" if parsed.get("language") else ""
    stars_part = " stars:>10"
    if parsed.get("time_window"):
        days = TIME_WINDOW_DAYS[parsed["time_window"]]
        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        time_part = f" pushed:>={since}"
    else:
        time_part = ""
    parsed["github_search_query"] = " ".join(kws[:4]) + lang_part + time_part + stars_part

    return parsed


# ─── GitHub direct search ────────────────────────────────────────────────────

async def _search_github_api(filters: ParsedFilters) -> List[dict]:
    """Search GitHub REST API using the extracted filters; returns raw GitHub repo items."""
    if not GITHUB_TOKEN:
        logger.warning("GITHUB_TOKEN not set — skipping GitHub API search")
        return []

    q = (filters.github_search_query or "").strip()

    # Ensure a minimum star filter to eliminate noise
    if q and "stars:" not in q:
        q += " stars:>10"

    if not q:
        # Last-resort generic query from keywords
        parts = (filters.keywords or [])[:4]
        if filters.language:
            parts.append(f"language:{filters.language}")
        parts.append("stars:>50")
        q = " ".join(parts) if parts else "stars:>500"

    # Prefer "updated" sort for momentum queries, else "stars"
    sort_param = "updated" if filters.sort_by in ("star_velocity_7d", "acceleration") else "stars"

    logger.info(f"GitHub Search query: {q!r}")

    try:
        async with aiohttp.ClientSession() as session:
            items = await _do_github_search(session, q, sort=sort_param, per_page=30)
            if not items and filters.keywords:
                # Retry with a simpler query on failure
                simple_q = " ".join(filters.keywords[:3])
                if filters.language:
                    simple_q += f" language:{filters.language}"
                simple_q += " stars:>50"
                items = await _do_github_search(session, simple_q, sort="stars", per_page=30)
            return items
    except Exception as e:
        logger.error(f"GitHub Search failed: {e}")
        return []


async def _do_github_search(
    session: aiohttp.ClientSession,
    q: str,
    sort: str = "stars",
    per_page: int = 30,
) -> List[dict]:
    params = {"q": q, "sort": sort, "order": "desc", "per_page": per_page}
    try:
        async with session.get(
            "https://api.github.com/search/repositories",
            headers=_GITHUB_HEADERS,
            params=params,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 422:
                logger.warning(f"GitHub Search 422 (bad query): {q!r}")
                return []
            if resp.status == 403:
                logger.warning("GitHub Search 403 — rate limited")
                return []
            if resp.status != 200:
                logger.warning(f"GitHub Search HTTP {resp.status}")
                return []
            data = await resp.json()
            items = data.get("items", [])
            logger.info(f"GitHub Search returned {len(items)} results for q={q!r}")
            return items
    except asyncio.TimeoutError:
        logger.warning("GitHub Search timed out")
        return []
    except Exception as e:
        logger.error(f"GitHub Search request error: {e}")
        return []


def _normalize_github_item(item: dict) -> dict:
    """Convert a raw GitHub API repo item to our result shape."""
    full_name = item.get("full_name", "")
    owner, _, name = full_name.partition("/")
    created_at = item.get("created_at", "")
    age_days: Optional[int] = None
    if created_at:
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - created).days
        except Exception:
            pass
    topics: List[str] = item.get("topics") or []
    return {
        "repo_id":              item.get("id", 0),
        "owner":                owner,
        "name":                 name,
        "category":             _infer_category(topics, item.get("language")),
        "github_url":           item.get("html_url", f"https://github.com/{full_name}"),
        "primary_language":     item.get("language"),
        "age_days":             age_days,
        "stars":                item.get("stargazers_count", 0),
        "forks":                item.get("forks_count", 0),
        "open_issues":          item.get("open_issues_count", 0),
        "watchers":             item.get("watchers_count", 0),
        "topics":               topics,
        "description":          item.get("description") or "",
        "trend_score":          None,
        "sustainability_score": None,
        "sustainability_label": None,
        "star_velocity_7d":     None,
        "acceleration":         None,
        "source":               "github",
    }


def _infer_category(topics: List[str], language: Optional[str]) -> str:
    t = set(topics or [])
    if t & {"llm", "large-language-model", "gpt", "llama", "generative-ai", "gpt4"}:
        return "LLM Models"
    if t & {"ai-agent", "autonomous-agents", "langchain", "autogpt", "agent-framework"}:
        return "Agent Frameworks"
    if t & {"llm-inference", "inference", "llama-cpp", "gguf", "vllm", "onnx"}:
        return "Inference Engines"
    if t & {"vector-database", "vector-search", "embeddings", "faiss", "hnswlib", "chromadb"}:
        return "Vector Databases"
    if t & {"fine-tuning", "lora", "rlhf", "peft", "sft"}:
        return "Fine-tuning Toolkits"
    if t & {"llm-evaluation", "benchmarks", "evals", "evaluation"}:
        return "Evaluation Frameworks"
    if t & {"machine-learning", "deep-learning", "pytorch", "tensorflow", "ai"}:
        return "AI / ML"
    if t & {"security", "cybersecurity", "vulnerability-scanner", "penetration-testing"}:
        return "Security"
    if t & {"data-engineering", "etl", "data-pipeline", "apache-airflow"}:
        return "Data Engineering"
    if t & {"blockchain", "ethereum", "web3", "defi", "smart-contracts"}:
        return "Blockchain"
    if t & {"developer-tools", "cli", "terminal", "devtools", "productivity"}:
        return "DevTools"
    if t & {"web-framework", "rest-api", "nodejs", "react", "fastapi", "django"}:
        return "Web Frameworks"
    return "Other"


# ─── Sanitize LLM output ─────────────────────────────────────────────────────

def _sanitize(parsed: dict) -> dict:
    """Convert string 'null'/'None' to actual None; trim strings."""
    for key in list(parsed.keys()):
        v = parsed[key]
        if v in ("null", "None", ""):
            parsed[key] = None if key != "keywords" else []
    return parsed


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/parse", response_model=ParsedFilters)
def parse_query(query: str = Query(..., description="Natural language query")):
    """Parse a natural language query into structured filters (does NOT run search)."""
    parsed = _parse_query(query)
    if not parsed:
        parsed = _keyword_fallback_parse(query)
    else:
        _sanitize(parsed)

    parsed["raw_query"] = query
    return ParsedFilters(**{k: v for k, v in parsed.items() if k in ParsedFilters.model_fields})


@router.get("", response_model=SearchResult)
async def natural_language_search(
    query: str = Query(..., description="Natural language query"),
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
):
    """
    Full pipeline: parse NL query → search internal DB + GitHub API in parallel
    → merge and rank results.

    Internal DB repos come with full trend/sustainability metrics.
    GitHub API repos supplement with fresh real-time data from GitHub.
    """
    from app.models import Repository, ComputedMetric, DailyMetric

    # ── 1. Parse query ────────────────────────────────────────────────────────
    parsed = _parse_query(query)
    if parsed:
        _sanitize(parsed)
    else:
        parsed = _keyword_fallback_parse(query)

    parsed["raw_query"] = query
    valid_fields = set(ParsedFilters.model_fields.keys())
    filters = ParsedFilters(**{k: v for k, v in parsed.items() if k in valid_fields})

    # ── 2. Run DB query + GitHub search concurrently ──────────────────────────
    github_task = asyncio.create_task(_search_github_api(filters))

    db_results: List[dict] = []
    try:
        repo_q = db.query(Repository).filter(Repository.is_active == True)  # noqa: E712

        # ── Vertical filter via category substrings ───────────────────────────
        if filters.vertical and filters.vertical in VERTICAL_CATEGORY_MAP:
            cats = VERTICAL_CATEGORY_MAP[filters.vertical]
            cat_conds = [Repository.category.ilike(f"%{c}%") for c in cats]
            repo_q = repo_q.filter(or_(*cat_conds))

        # ── Language filter ────────────────────────────────────────────────────
        if filters.language:
            repo_q = repo_q.filter(Repository.primary_language.ilike(filters.language))

        # ── Age filter ─────────────────────────────────────────────────────────
        if filters.max_age_days:
            repo_q = repo_q.filter(Repository.age_days <= filters.max_age_days)

        # ── Fetch repos (keyword text search + optional vertical filter) ─────────
        if filters.keywords and not filters.vertical:
            # Keywords-only: filter by occurrence in name or description
            kw_conds: list = []
            for kw in filters.keywords[:5]:
                kw_conds.append(Repository.name.ilike(f"%{kw}%"))
                kw_conds.append(Repository.description.ilike(f"%{kw}%"))
            repos = repo_q.filter(or_(*kw_conds)).all()
        elif filters.keywords and filters.vertical:
            # Both set: union of (vertical-filtered) + (keyword-matched) repos
            kw_conds_boost: list = []
            for kw in filters.keywords[:4]:
                kw_conds_boost.append(Repository.name.ilike(f"%{kw}%"))
                kw_conds_boost.append(Repository.description.ilike(f"%{kw}%"))
            kw_extra_q = (
                db.query(Repository)
                .filter(Repository.is_active == True)  # noqa: E712
                .filter(or_(*kw_conds_boost))
            )
            if filters.language:
                kw_extra_q = kw_extra_q.filter(
                    Repository.primary_language.ilike(filters.language)
                )
            if filters.max_age_days:
                kw_extra_q = kw_extra_q.filter(
                    Repository.age_days <= filters.max_age_days
                )
            combined = repo_q.all() + kw_extra_q.all()
            seen_ids: set = set()
            repos = []
            for r in combined:
                if r.id not in seen_ids:
                    seen_ids.add(r.id)
                    repos.append(r)
        else:
            repos = repo_q.all()

        for repo in repos:
            cm = (
                db.query(ComputedMetric)
                .filter_by(repo_id=repo.id)
                .order_by(ComputedMetric.date.desc())
                .first()
            )
            dm = (
                db.query(DailyMetric)
                .filter_by(repo_id=repo.id)
                .order_by(DailyMetric.date.desc())
                .first()
            )
            stars = dm.stars if dm else 0

            if cm:
                if filters.min_trend_score and (cm.trend_score or 0) < filters.min_trend_score:
                    continue
                if filters.min_sustainability and (cm.sustainability_score or 0) < filters.min_sustainability:
                    continue
            if filters.min_stars and stars < filters.min_stars:
                continue

            db_results.append({
                "repo_id":              repo.id,
                "owner":                repo.owner,
                "name":                 repo.name,
                "category":             repo.category,
                "github_url":           repo.github_url,
                "primary_language":     repo.primary_language,
                "age_days":             repo.age_days,
                "stars":                stars,
                "trend_score":          cm.trend_score      if cm else None,
                "sustainability_score": cm.sustainability_score if cm else None,
                "sustainability_label": cm.sustainability_label if cm else None,
                "star_velocity_7d":     cm.star_velocity_7d if cm else None,
                "acceleration":         cm.acceleration     if cm else None,
                "description":          repo.description or "",
                "topics":               [],
                "source":               "internal",
            })

    except Exception as e:
        logger.error(f"DB query failed: {e}")

    # ── 3. Collect GitHub results ─────────────────────────────────────────────
    github_raw   = await github_task
    github_items = [_normalize_github_item(item) for item in github_raw]

    # ── 4. Merge: DB first, then non-duplicate GitHub results ─────────────────
    db_slugs = {(r["owner"].lower(), r["name"].lower()) for r in db_results}
    merged   = list(db_results)
    for gr in github_items:
        slug = (gr["owner"].lower(), gr["name"].lower())
        if slug not in db_slugs:
            merged.append(gr)
            db_slugs.add(slug)

    # ── 5. Post-filter merged set on explicit constraints ─────────────────────
    if filters.min_stars:
        merged = [r for r in merged if (r.get("stars") or 0) >= filters.min_stars]
    if filters.language:
        merged = [r for r in merged
                  if r.get("primary_language")
                  and r["primary_language"].lower() == filters.language.lower()]
    if filters.max_age_days:
        merged = [r for r in merged
                  if r.get("age_days") is None or r["age_days"] <= filters.max_age_days]

    # ── 6. Sort ────────────────────────────────────────────────────────────────
    sort_key = filters.sort_by or "trend_score"
    reverse  = sort_key != "age_days"

    # Partition: DB with metric | GitHub results | DB without metric
    def _has_metric(r: dict) -> bool:
        return r.get("source") == "internal" and r.get(sort_key) is not None

    if sort_key == "stars":
        # Mix everything; sort purely by star count
        merged.sort(key=lambda r: r.get("stars") or 0, reverse=True)
        final = merged
    else:
        db_scored   = sorted([r for r in merged if _has_metric(r)],
                              key=lambda r: r.get(sort_key) or 0, reverse=reverse)
        gh_results  = sorted([r for r in merged if r.get("source") == "github"],
                              key=lambda r: r.get("stars") or 0, reverse=True)
        db_unscored = [r for r in merged if r.get("source") == "internal"
                       and not _has_metric(r)]
        final = db_scored + gh_results + db_unscored

    return SearchResult(filters=filters, repos=final[:limit], total=len(final))
