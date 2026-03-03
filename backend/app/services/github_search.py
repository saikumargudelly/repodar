"""
GitHub Search Service — surface the genuinely most-starred / most-trending
repos on GitHub for a given time window.

Strategy by period
──────────────────
1d / 7d / 30d  → Scrape **github.com/trending** (since=daily/weekly/monthly).
                 GitHub Trending shows exactly which repos gained the most
                 stars TODAY, THIS WEEK, or THIS MONTH — no approximation.
                 Each scraped repo is then enriched via the REST API for
                 full metadata (topics, forks, description, language, etc.).

90d / 365d     → GitHub Search API  pushed:>=START  sort:stars
                 Repos actively worked on in the window, ranked by star count.

3y / 5y        → GitHub Search API  stars:>=THRESHOLD  sort:stars
                 (No date filter — surfaces all-time top AI repos.)
"""

import os
import re
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import aiohttp
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
REST_BASE = "https://api.github.com"
API_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}
# Browser-like UA so GitHub doesn't block the Trending page scrape
SCRAPE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Periods that map directly to GitHub Trending since= values
TRENDING_SINCE: dict[str, str] = {
    "1d":  "daily",
    "7d":  "weekly",
    "30d": "monthly",
}

# Topics for Search API fallback (run in parallel to avoid 422)
AI_TOPIC_QUERIES = [
    "topic:llm",
    "topic:machine-learning",
    "topic:deep-learning",
    "topic:large-language-model",
    "topic:generative-ai",
    "topic:ai-agent",
    "topic:llm-inference",
    "topic:transformers",
]

# Minimum star floor for Search API fallback
MIN_STARS_SEARCH: dict[str, int] = {
    "90d":  1_000,
    "365d": 5_000,
    "3y":   15_000,
    "5y":   30_000,
}

PERIOD_DAYS: dict[str, int] = {
    "1d":   1,
    "7d":   7,
    "30d":  30,
    "90d":  90,
    "365d": 365,
    "3y":   365 * 3,
    "5y":   365 * 5,
}


def _start_date(period: str) -> str:
    days = PERIOD_DAYS.get(period, 90)
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")


# ─── Public entry point ───────────────────────────────────────────────────────

async def search_top_repos(
    period: str,
    limit: int = 30,
    category_filter: Optional[str] = None,
) -> list[dict]:
    """
    Return up to `limit` repos ranked by popularity for the given period.

    1d/7d/30d  → GitHub Trending page (actual star gains in that window).
    90d+       → GitHub Search API (most starred repos active in window).
    """
    if period in TRENDING_SINCE:
        results = await _fetch_trending(period, limit=limit)
    else:
        results = await _fetch_search(period, limit=limit)

    if category_filter:
        needed = _category_to_topics(category_filter)
        results = [r for r in results if _repo_matches_category(r, needed)]

    return results[:limit]


# ─── GitHub Trending scraper (1d / 7d / 30d) ─────────────────────────────────

async def _fetch_trending(period: str, limit: int) -> list[dict]:
    """
    Scrape github.com/trending?since=<daily|weekly|monthly> to get repos sorted
    by star gains in the period, then enrich each via REST API for full metadata.
    """
    since = TRENDING_SINCE[period]
    url = f"https://github.com/trending?since={since}"

    async with aiohttp.ClientSession() as session:
        # Step 1 — fetch trending HTML
        try:
            async with session.get(
                url, headers=SCRAPE_HEADERS,
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                if resp.status != 200:
                    logger.warning(f"GitHub Trending HTTP {resp.status} for {url}")
                    return []
                html = await resp.text()
        except Exception as e:
            logger.error(f"GitHub Trending scrape failed: {e}")
            return []

        slugs = _parse_trending_html(html, max_repos=limit)
        if not slugs:
            logger.warning("GitHub Trending: no repos found in HTML")
            return []

        # Step 2 — enrich each slug with full REST metadata (parallel)
        enriched = await asyncio.gather(*[
            _enrich_repo(session, slug, gain_str)
            for slug, gain_str in slugs
        ])

    return [r for r in enriched if r is not None]


def _parse_trending_html(html: str, max_repos: int) -> list[tuple[str, str]]:
    """
    Parse GitHub Trending HTML → list of ("owner/repo", "N stars today").
    """
    soup = BeautifulSoup(html, "lxml")
    out: list[tuple[str, str]] = []

    for article in soup.select("article.Box-row"):
        link = article.select_one("h2 a, h1 a")
        if not link:
            continue
        href = link.get("href") or ""
        slug = str(href).strip("/")
        if not slug or slug.count("/") != 1:
            continue

        gain_tag = article.select_one("span.d-inline-block.float-sm-right")
        gain_str = gain_tag.get_text(strip=True) if gain_tag else ""

        out.append((slug, gain_str))
        if len(out) >= max_repos:
            break

    return out


async def _enrich_repo(
    session: aiohttp.ClientSession,
    slug: str,
    gain_str: str,
) -> Optional[dict]:
    """Fetch full REST metadata for a trending repo and attach the gain info."""
    try:
        async with session.get(
            f"{REST_BASE}/repos/{slug}",
            headers=API_HEADERS,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()
    except Exception:
        return None

    data["_star_gain"]     = _parse_gain_int(gain_str)
    data["_star_gain_str"] = gain_str          # e.g. "1,234 stars today"
    return data


def _parse_gain_int(text: str) -> int:
    m = re.search(r"[\d,]+", text)
    if not m:
        return 0
    try:
        return int(re.sub(r"[,\s]", "", m.group()))
    except ValueError:
        return 0


# ─── GitHub Search API fallback (90d / 365d / 3y / 5y) ───────────────────────

async def _fetch_search(period: str, limit: int) -> list[dict]:
    """
    For longer periods: find most starred AI repos that were actively pushed
    within the window.  For 3y/5y skip the date filter and use a high star floor.
    """
    min_stars = MIN_STARS_SEARCH.get(period, 1_000)
    no_date   = period in {"3y", "5y"}
    start     = _start_date(period)

    def _q(topic: str) -> str:
        if no_date:
            return f"{topic} stars:>={min_stars}"
        return f"{topic} pushed:>={start} stars:>={min_stars}"

    async with aiohttp.ClientSession() as session:
        batches = await asyncio.gather(*[
            _search_api(session, _q(t), per_page=30)
            for t in AI_TOPIC_QUERIES
        ])

    seen: dict[str, dict] = {}
    for batch in batches:
        for repo in batch:
            fn = repo["full_name"]
            if fn not in seen or repo["stargazers_count"] > seen[fn]["stargazers_count"]:
                seen[fn] = repo

    return sorted(seen.values(), key=lambda r: r["stargazers_count"], reverse=True)[:limit]


async def _search_api(
    session: aiohttp.ClientSession,
    query: str,
    per_page: int = 30,
) -> list[dict]:
    url = f"{REST_BASE}/search/repositories"
    params = {"q": query, "sort": "stars", "order": "desc", "per_page": per_page}
    try:
        async with session.get(
            url, headers=API_HEADERS, params=params,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status in (422, 403):
                logger.warning(f"GitHub Search {resp.status}: {query[:80]}")
                return []
            if resp.status != 200:
                logger.warning(f"GitHub Search HTTP {resp.status}")
                return []
            return (await resp.json()).get("items", [])
    except Exception as e:
        logger.error(f"GitHub Search error: {e}")
        return []


def _category_to_topics(category: str) -> list[str]:
    """Map our internal category names to GitHub topic keywords."""
    mapping = {
        "LLM Models":                  ["llm", "large-language-model", "language-model"],
        "Agent Frameworks":             ["ai-agent", "autonomous-agents", "langchain", "autogpt"],
        "Inference Engines":            ["llm-inference", "inference", "llama-cpp"],
        "Vector Databases":             ["vector-database", "vector-search", "embeddings"],
        "Model Serving / Runtimes":     ["model-serving", "mlops", "triton"],
        "Distributed Compute / Infra":  ["distributed-training", "mlops", "ray"],
        "Evaluation Frameworks":        ["llm-evaluation", "benchmarks", "evals"],
        "Fine-tuning Toolkits":         ["fine-tuning", "lora", "rlhf"],
    }
    return mapping.get(category, [])


def _repo_matches_category(repo: dict, topics: list[str]) -> bool:
    """Return True if repo has any of the given topics."""
    if not topics:
        return True
    repo_topics = set(repo.get("topics", []))
    return bool(repo_topics & set(topics))


# ─── Normaliser ───────────────────────────────────────────────────────────────

def normalize_search_result(repo: dict, rank: int, period: str) -> dict:
    """
    Convert a raw repo dict (from Trending+REST enrich OR from Search API)
    into the LeaderboardEntry shape expected by the router.
    """
    # full_name present on Search results; name+owner on REST-enriched trending
    if "full_name" in repo:
        owner, name = repo["full_name"].split("/", 1)
    else:
        owner = (repo.get("owner") or {}).get("login", "unknown")
        name  = repo.get("name", "unknown")

    total_stars = repo.get("stargazers_count", 0)
    # _star_gain is set by _enrich_repo for trending; fall back to total for Search
    star_gain   = repo.get("_star_gain", total_stars)

    return {
        "rank":                  rank,
        "repo_id":               f"{owner}/{name}",
        "owner":                 owner,
        "name":                  name,
        "category":              _infer_category(repo),
        "github_url":            repo.get("html_url", f"https://github.com/{owner}/{name}"),
        "primary_language":      repo.get("language"),
        "age_days":              _age_days(repo.get("created_at", "")),
        "current_stars":         total_stars,
        "star_gain":             star_gain,
        "star_gain_pct":         round(
            (star_gain / max(total_stars - star_gain, 1)) * 100, 2
        ) if 0 < star_gain < total_stars else 0.0,
        "current_forks":         repo.get("forks_count", 0),
        "sustainability_label":  "YELLOW",
        "sustainability_score":  0.0,
        "trend_score":           0.0,
        "description":           repo.get("description") or "",
        "open_issues":           repo.get("open_issues_count", 0),
        "watchers":              repo.get("watchers_count", 0),
        "topics":                repo.get("topics", []),
        "created_at":            repo.get("created_at", ""),
        "pushed_at":             repo.get("pushed_at", ""),
        # Trending-only: raw gain label e.g. "1,234 stars today"
        "star_gain_label":       repo.get("_star_gain_str", ""),
    }


def _age_days(created_at: str) -> int:
    if not created_at:
        return 0
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days
    except Exception:
        return 0


def _infer_category(repo: dict) -> str:
    """Best-effort category inference from topics and language."""
    topics = set(repo.get("topics", []))
    name = (repo.get("name") or "").lower()
    desc = (repo.get("description") or "").lower()

    if topics & {"vector-database", "vector-search", "faiss", "weaviate", "pinecone", "chroma"}:
        return "Vector Databases"
    if topics & {"ai-agent", "autonomous-agents", "autogpt", "langchain", "llm-agent"}:
        return "Agent Frameworks"
    if topics & {"llm-inference", "inference", "llama-cpp", "vllm", "tensorrt"}:
        return "Inference Engines"
    if topics & {"fine-tuning", "lora", "rlhf", "instruction-tuning", "peft"}:
        return "Fine-tuning Toolkits"
    if topics & {"model-serving", "triton", "mlops", "kubeflow", "bentoml"}:
        return "Model Serving / Runtimes"
    if topics & {"distributed-training", "ray", "deepspeed", "horovod"}:
        return "Distributed Compute / Infra"
    if topics & {"llm-evaluation", "benchmarks", "evals", "evaluation"}:
        return "Evaluation Frameworks"
    if topics & {"llm", "large-language-model", "language-model", "gpt", "llama"}:
        return "LLM Models"

    # Fallback: keyword scan on name+description
    if any(w in name + desc for w in ["vector", "embed", "retriev"]):
        return "Vector Databases"
    if any(w in name + desc for w in ["agent", "autogpt", "langchain"]):
        return "Agent Frameworks"
    if any(w in name + desc for w in ["inference", "serving", "runtime"]):
        return "Inference Engines"
    if any(w in name + desc for w in ["finetun", "fine-tun", "lora", "rlhf"]):
        return "Fine-tuning Toolkits"
    if any(w in name + desc for w in ["eval", "benchmark", "leaderboard"]):
        return "Evaluation Frameworks"

    return "AI / ML"
