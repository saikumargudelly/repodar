"""
Research Mode Agent — real-time GitHub intelligence.

Architecture:
  Stage 1: fast_route()      — deterministic, no LLM, < 1ms
  Stage 2: parse_intent()    — LLM (Groq), strict JSON output, confidence score
  execute_intent()           — dispatches to the right handler
  _synthesize_response()     — LLM narrative on top of REAL data only
  generate_report()          — structured analyst report (strict guardrails)

Guardrails enforced here:
  1. Confidence threshold  (< 0.60 → clarify)
  2. Zero hallucination    (synthesizer only sees fetched repos)
  3. Empty-result honesty  (0 results → honest message, no padding)
  4. Context capping       (last 3 turns, 6 messages)
  5. Rate limiting         (per-tier API call budgets)
  6. No invented filters   (query parser prompt + confidence gate)
  7. Report data-only      (mandatory methodology, no superlatives)
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator

import aiohttp

logger = logging.getLogger(__name__)

GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GITHUB_TOKEN  = os.getenv("GITHUB_TOKEN", "")

_GH_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# ─── Rate-limit budgets (per user per hour) ───────────────────────────────────
RATE_LIMITS: dict[str, dict[str, int]] = {
    "free": {"messages": 20, "github_calls": 2},
    "pro":  {"messages": 100, "github_calls": 5},
    "team": {"messages": 500, "github_calls": 10},
}

# ─── Off-topic fast-reject patterns (Stage 1) ─────────────────────────────────
# Replaced by LLM `out_of_scope` intent to avoid false positives (e.g. blocking "stock trading repo")

_REPO_NAME_RE = re.compile(r"(?:^|[\s(,])([a-zA-Z0-9][\w.-]{0,38})/([a-zA-Z0-9][\w.-]{0,99})(?:\s|$|[),])")


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class FastRouteResult:
    action: str           # llm | reject | clarify | repo_lookup
    reason: str = ""
    owner: str = ""
    name: str = ""


@dataclass
class ParsedIntent:
    intent: str           # search|compare|landscape|temporal|report|repo_detail|out_of_scope|clarify
    confidence: float = 1.0
    entities: dict = field(default_factory=dict)
    github_queries: list[str] = field(default_factory=list)
    query_explanation: str = ""
    needs_clarification: bool = False
    clarification_prompt: str = ""
    rejection_reason: str = ""


@dataclass
class AgentMessage:
    role: str             # 'agent'
    content: str          # markdown text
    intent: str = ""
    github_query: str = "" # Used as the primary or successful query for DB storage
    query_explanation: str = ""
    repos: list[dict] = field(default_factory=list)
    confidence: float = 1.0
    suggested_follow_ups: list[str] = field(default_factory=list)
    error: bool = False


# ─── Stage 1: Deterministic fast router ───────────────────────────────────────

def fast_route(message: str) -> FastRouteResult:
    """No LLM. < 1ms. Handles obvious empty/clarify/repo-lookup cases."""
    stripped = message.strip()

    # Empty / too short
    if len(stripped) < 3:
        return FastRouteResult(
            action="clarify",
            reason="Please describe what you'd like to research (e.g. 'trending Python AI tools')."
        )

    # Exact owner/repo mention → fast-path
    m = _REPO_NAME_RE.search(f" {stripped} ")
    if m:
        return FastRouteResult(action="repo_lookup", owner=m.group(1), name=m.group(2))

    return FastRouteResult(action="llm")


# ─── Stage 2: LLM intent parser ───────────────────────────────────────────────

_INTENT_SYSTEM = """\
You are a strict query parser for a GitHub OSS research tool.
Your ONLY job: parse the user message into structured JSON.
Do NOT answer the question. Do NOT add prose. Output JSON only.

SCOPE: GitHub repositories and open-source software ONLY.
Set intent=out_of_scope for anything else.

INTENT VALUES:
  search       -> find repos matching criteria
  compare      -> compare 2+ specific repos side-by-side
  landscape    -> map an ecosystem / technology space
  temporal     -> what changed over time (needs period mention)
  report       -> generate a structured research brief
  repo_detail  -> details about one specific repo (owner/name)
  out_of_scope -> not about GitHub/OSS
  clarify      -> too ambiguous to parse without more info

OUTPUT SCHEMA (strict, no extra keys):
{{
  "intent": "<value>",
  "confidence": <0.0-1.0>,
  "entities": {{
    "repos": ["owner/name"],
    "topics": ["llm", "vector-db"],
    "languages": ["Python"],
    "verticals": ["ai_ml"],
    "time_period": "7d|30d|90d|365d|null",
    "min_stars": null,
    "exclude_forks": null,
    "exclude_archived": null
  }},
  "github_queries": [
    "<optimized github search string 1>",
    "<broad fallback or alternative query 2 (if helpful)>"
  ],
  "query_explanation": "<one plain-English sentence describing what will be searched>",
  "needs_clarification": false,
  "clarification_prompt": null,
  "rejection_reason": null
}}

GUARDRAIL -- query building rules:
- Write ONE to THREE highly-effective GitHub Search API queries sequentially in `github_queries`.
- First query is your most accurate. The next ones should strip date constraints or use broader keywords to act as progressive fallbacks!
- NEVER literalize concepts: e.g. for "AI", don't just use `topic:AI` as GitHub slugs are lowercase (`topic:machine-learning OR topic:llm`). For specific domains like "twitter scrapers", use descriptive keywords e.g., `twitter scraper`.
- DO NOT invent static date/star thresholds unless the user explicitly implies them. Instead, output the most relevant broad search. If the user mentions "this week" or "recent", calculate the exact ISO timestamp dynamically below to use in `pushed:>=YYYY-MM-DD`.
- For `temporal` intent, output TWO distinct queries: the first with recent date filters, the second without date filters (established).
- For `landscape` intent, output 2-3 queries mapping different subsets of the domain.
- If confidence < 0.7, set needs_clarification=true

CURRENT DATE: {current_date}

CONTEXT (last 3 turns for pronoun resolution):
{context}

USER MESSAGE: {message}
"""

_QUERY_EXPLANATION_FALLBACK = "GitHub repositories matching your query"


async def parse_intent(message: str, context_turns: list[dict]) -> ParsedIntent:
    """Call Groq to parse user intent. Returns ParsedIntent."""
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — using keyword fallback")
        return _keyword_fallback_intent(message)

    # Build context string (last 3 turns = 6 messages max)
    ctx_lines = []
    for t in context_turns[-6:]:
        if isinstance(t, dict) and "role" in t and "content" in t:
            ctx_lines.append(f"{t['role'].upper()}: {t['content'][:300]}")
        elif isinstance(t, str):
            ctx_lines.append(f"USER: {t[:300]}")
    ctx = "\n".join(ctx_lines)

    current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prompt = _INTENT_SYSTEM.format(
        current_date=current_date, 
        context=ctx or "(none)", 
        message=message
    )

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "Output only valid JSON, no markdown fences."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 500,
        "response_format": {"type": "json_object"},
    }

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json=payload,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                data = await resp.json()
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw)
        
        queries = parsed.get("github_queries", [])
            
        return ParsedIntent(
            intent=parsed.get("intent", "search"),
            confidence=float(parsed.get("confidence", 0.5)),
            entities=parsed.get("entities", {}),
            github_queries=queries,
            query_explanation=parsed.get("query_explanation", _QUERY_EXPLANATION_FALLBACK),
            needs_clarification=parsed.get("needs_clarification", False),
            clarification_prompt=parsed.get("clarification_prompt") or "",
            rejection_reason=parsed.get("rejection_reason") or "",
        )
    except Exception as exc:
        logger.warning(f"Intent parse failed ({exc}), using keyword fallback")
        return _keyword_fallback_intent(message)


def _keyword_fallback_intent(message: str) -> ParsedIntent:
    """Simple keyword heuristic when Groq is unavailable."""
    msg = message.lower()
    if any(w in msg for w in ["compare", "vs", "versus", "difference between"]):
        intent = "compare"
    elif any(w in msg for w in ["map", "landscape", "ecosystem", "overview of", "survey"]):
        intent = "landscape"
    elif any(w in msg for w in ["changed", "since", "last month", "last week", "trending now"]):
        intent = "temporal"
    elif any(w in msg for w in ["report", "brief", "summary", "write", "generate"]):
        intent = "report"
    else:
        intent = "search"

    # Build a naive GitHub query
    clean = re.sub(r"[^\w\s]", " ", msg)
    tokens = [t for t in clean.split() if len(t) > 3 and t not in {
        "show", "find", "some", "repos", "best", "most", "that", "with",
        "from", "this", "have", "been", "what", "about", "using", "built",
    }]
    gh_q = " ".join(tokens[:4]) if tokens else message[:60]

    return ParsedIntent(
        intent=intent,
        confidence=0.55,
        entities={},
        github_queries=[gh_q] if gh_q else [],
        query_explanation=f"GitHub repositories related to: {gh_q}",
    )


async def _github_search(query: str, per_page: int = 20) -> list[dict]:
    """Call GitHub Search API. Returns raw items list."""
    if not query.strip():
        return []
    params = {"q": query, "sort": "stars", "order": "desc", "per_page": str(per_page)}
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.get(
                "https://api.github.com/search/repositories",
                headers=_GH_HEADERS,
                params=params,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 422:
                    logger.warning(f"GitHub 422 for query: {query!r}")
                    return []
                if resp.status != 200:
                    logger.warning(f"GitHub search HTTP {resp.status} for: {query!r}")
                    return []
                data = await resp.json()
                items = data.get("items", [])
                logger.info(f"GitHub search '{query[:80]}' → {len(items)} results")
                return items
    except Exception as exc:
        logger.warning(f"GitHub search failed: {exc}")
        return []


async def _github_repo(owner: str, name: str) -> dict | None:
    """Fetch a single repo by owner/name."""
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.get(
                f"https://api.github.com/repos/{owner}/{name}",
                headers=_GH_HEADERS,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status != 200:
                    return None
                return await resp.json()
    except Exception as exc:
        logger.warning(f"GitHub repo fetch failed ({owner}/{name}): {exc}")
        return None


def _compute_efficiency_score(stars: int, forks: int, open_issues: int,
                               watchers: int, age_days: int, days_since_push: int) -> float:
    """
    Composite efficiency + scalability score (0.0 – 1.0).

    Weights:
      35%  Star velocity       — stars per day (growth efficiency)
      25%  Maintenance health  — low open_issues relative to stars (team responsiveness)
      20%  Community traction  — fork:star ratio (people building on top of it)
      15%  Recency             — pushed_at freshness (still actively maintained)
      5%   Watcher signal      — passive followers (awareness)

    All individual signals are normalised 0-1 before weighting.
    """
    # 1. Star velocity: stars/day, cap at 50 stars/day being ~1.0
    velocity = stars / max(age_days, 1)
    v_norm = min(1.0, velocity / 50.0)

    # 2. Maintenance health: ideal = 0 open issues per 100 stars
    #    ratio = open_issues / max(stars, 1); invert so lower = better
    issue_ratio = open_issues / max(stars, 1)
    health_norm = max(0.0, 1.0 - min(issue_ratio, 1.0))

    # 3. Community traction: fork:star ratio
    #    Good open-source projects: 5-20% fork rate
    #    Cap at 0.30 = 1.0 (very high adoption)
    fork_ratio = forks / max(stars, 1)
    community_norm = min(1.0, fork_ratio / 0.30)

    # 4. Recency: decay over 180 days (longer window than before)
    recency_norm = max(0.0, 1.0 - days_since_push / 180.0)

    # 5. Watcher signal: normalise at 10k = 1.0
    watcher_norm = min(1.0, watchers / 10_000.0)

    score = (
        0.35 * v_norm
        + 0.20 * health_norm
        + 0.20 * community_norm
        + 0.20 * recency_norm
        + 0.05 * watcher_norm
    )
    return round(min(1.0, score), 4)


def _normalize_repo(raw: dict) -> dict:
    """Convert GitHub API item -> clean Repodar schema with efficiency scoring."""
    pushed      = raw.get("pushed_at") or ""
    created_at  = raw.get("created_at") or ""
    age_days    = 0
    days_since_push = 999  # assume stale if unknown

    now = datetime.now(timezone.utc)
    if created_at:
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            age_days = max((now - created).days, 1)
        except Exception:
            pass

    if pushed:
        try:
            pushed_dt = datetime.fromisoformat(pushed.replace("Z", "+00:00"))
            days_since_push = max((now - pushed_dt).days, 0)
        except Exception:
            pass

    stars       = raw.get("stargazers_count", 0)
    forks       = raw.get("forks_count", 0)
    open_issues = raw.get("open_issues_count", 0)
    watchers    = raw.get("watchers_count", 0)

    # Legacy velocity proxy kept for backward compat with synthesiser prompts
    velocity_proxy = round(stars / max(age_days, 1), 4)

    efficiency = _compute_efficiency_score(
        stars=stars,
        forks=forks,
        open_issues=open_issues,
        watchers=watchers,
        age_days=age_days,
        days_since_push=days_since_push,
    )

    # Trend label derived from efficiency score
    if efficiency >= 0.55:
        trend_label = "HIGH"
    elif efficiency >= 0.25:
        trend_label = "MID"
    else:
        trend_label = "LOW"

    return {
        "repo_id":          raw.get("id"),
        "owner":            (raw.get("owner") or {}).get("login", ""),
        "name":             raw.get("name", ""),
        "full_name":        raw.get("full_name", ""),
        "description":      raw.get("description") or "",
        "github_url":       raw.get("html_url", ""),
        "homepage":         raw.get("homepage") or "",
        "primary_language": raw.get("language") or "",
        "stars":            stars,
        "forks":            forks,
        "open_issues":      open_issues,
        "watchers":         watchers,
        "topics":           raw.get("topics", []),
        "license":          (raw.get("license") or {}).get("spdx_id") or "",
        "is_fork":          raw.get("fork", False),
        "archived":         raw.get("archived", False),
        "age_days":         age_days,
        "pushed_at":        pushed,
        "created_at":       created_at,
        "velocity_proxy":   velocity_proxy,
        "efficiency":       efficiency,       # primary composite sort key
        "momentum":         efficiency,       # alias — keeps frontend field name working
        "trend_label":      trend_label,
        "days_since_push":  days_since_push,
    }


# ─── Intent handlers ─────────────────────────────────────────────────────────

async def _handle_search(parsed: ParsedIntent) -> tuple[list[dict], str]:
    """
    Search by executing ALL queries in github_queries and accumulating unique results.
    Tries all queries rather than stopping at the first success, to handle cases where
    the most specific query has strict filters that return 0 results.
    Adds a broad safety-net fallback if everything returns empty.
    """
    import asyncio as _aio

    queries = [q.strip() for q in parsed.github_queries if q.strip()]
    if not queries:
        return [], "No valid search queries generated."

    # Run ALL queries in parallel, then accumulate
    results_batches = await _aio.gather(
        *[_github_search(q, per_page=30) for q in queries],
        return_exceptions=True,
    )

    seen: dict[int, dict] = {}
    for batch in results_batches:
        if not isinstance(batch, list):
            continue
        for r in batch:
            rid = r.get("id")
            if rid and not r.get("archived"):
                # Keep the entry with the most stars if seen before
                if rid not in seen or r.get("stargazers_count", 0) > seen[rid].get("stargazers_count", 0):
                    seen[rid] = r

    # --- Safety-net fallback: if ALL queries returned 0, broaden the search ---
    if not seen:
        logger.info("All LLM-generated queries returned 0 results — running broad fallback")
        # Extract keywords from the first query (strip qualifiers like pushed:>= stars:>=)
        import re as _re
        first_q = queries[0] if queries else ""
        broad = _re.sub(r'\S+:>=?\S+', '', first_q).strip()  # remove field:value qualifiers
        if not broad:
            # Build from entities topics
            topics = parsed.entities.get("topics", [])
            broad = " OR ".join(topics[:3]) if topics else "machine-learning"
        # Try a completely unconstrained search
        fallback_results = await _github_search(
            f"{broad} stars:>=100",
            per_page=30,
        )
        for r in fallback_results:
            rid = r.get("id")
            if rid and not r.get("archived"):
                seen[rid] = r

    repos = [_normalize_repo(r) for r in seen.values()]
    repos.sort(key=lambda r: (r["efficiency"], r["stars"]), reverse=True)
    repos = repos[:30]  # cap at 30
    return repos, f"Found {len(repos)} repositories matching your query."


async def _handle_compare(parsed: ParsedIntent) -> tuple[list[dict], str]:
    """Fetch each named repo individually."""
    repo_names = parsed.entities.get("repos", [])
    if not repo_names:
        # Fall back to a normal search
        return await _handle_search(parsed)

    import asyncio as _aio
    results = await _aio.gather(*[
        _github_repo(r.split("/")[0], r.split("/")[1])
        for r in repo_names if "/" in r
    ])
    repos = [_normalize_repo(r) for r in results if r]
    return repos, f"Comparing {len(repos)} repositories."


async def _handle_landscape(parsed: ParsedIntent) -> tuple[list[dict], str]:
    """Run parallel queries provided dynamically by the LLM."""
    import asyncio as _aio

    queries = [q for q in parsed.github_queries if q.strip()][:4]
    if not queries:
        return [], "No valid queries generated."

    all_items = await _aio.gather(*[_github_search(q, per_page=20) for q in queries])
    seen: set[int] = set()
    repos = []
    for items in all_items:
        for raw in items:
            rid = raw.get("id")
            if rid not in seen and not raw.get("archived"):
                seen.add(rid)
                repos.append(_normalize_repo(raw))

    repos.sort(key=lambda r: (r["efficiency"], r["stars"]), reverse=True)
    repos = repos[:30]
    return repos, f"Mapped {len(repos)} repositories across the ecosystem."


async def _handle_temporal(parsed: ParsedIntent) -> tuple[list[dict], str]:
    """
    Surface what's trending/new vs established.
    For 'this week' / 'today' queries — tries the GitHub Trending scraper first
    (same source the leaderboard uses) then falls back to Search API.
    """
    import asyncio as _aio

    time_period = (parsed.entities.get("time_period") or "").lower()
    is_short_window = time_period in {"1d", "7d", ""} or any(
        kw in " ".join(parsed.github_queries).lower()
        for kw in ["pushed:>=", "week", "today", "daily"]
    )

    # --- Fast path: GitHub Trending scraper for short windows ---
    if is_short_window:
        try:
            from app.services.github_search import _fetch_trending, normalize_search_result
            period = "weekly" if "week" in str(parsed.entities).lower() else "daily"
            since_key = "7d" if period == "weekly" else "1d"
            raw_trending = await _fetch_trending(since_key, limit=30)
            if raw_trending:
                repos = []
                for i, r in enumerate(raw_trending):
                    norm = _normalize_repo(r)
                    repos.append(norm)
                repos.sort(key=lambda r: (r["efficiency"], r["stars"]), reverse=True)
                return repos, f"Fetched {len(repos)} trending repos from GitHub Trending ({period})."
        except Exception as exc:
            logger.warning(f"GitHub Trending scrape fallback error: {exc}")

    # --- Fallback: Search API with LLM-generated queries ---
    queries = [q for q in parsed.github_queries if q.strip()]
    if not queries:
        return [], "No valid queries generated."

    q_recent = queries[0]
    q_older = queries[1] if len(queries) > 1 else queries[0]

    recent_items, older_items = await _aio.gather(
        _github_search(q_recent, per_page=20),
        _github_search(q_older, per_page=20),
    )

    # If the date-constrained query returned nothing, broaden it
    if not recent_items:
        import re as _re
        broad = _re.sub(r'pushed:>=\S+', '', q_recent).strip()
        if broad:
            recent_items = await _github_search(broad + " stars:>=50", per_page=20)

    if not recent_items and not older_items:
        return [], "Found 0 repositories matching the temporal queries."

    seen: set[int] = set()
    new_repos: list[dict] = []
    for r in recent_items:
        if not r.get("archived"):
            seen.add(r["id"])
            new_repos.append(_normalize_repo(r))

    established: list[dict] = []
    for r in older_items:
        if r.get("id") not in seen and not r.get("archived"):
            seen.add(r.get("id"))
            established.append(_normalize_repo(r))

    new_repos.sort(key=lambda r: (r["efficiency"], r["stars"]), reverse=True)
    established.sort(key=lambda r: (r["efficiency"], r["stars"]), reverse=True)
    repos = (new_repos + established)[:30]
    return repos, (
        f"Found {len(new_repos)} recently active repos "
        f"and {len(established)} established repos — all ranked by efficiency."
    )


async def _handle_repo_detail(parsed: ParsedIntent, owner: str = "", name: str = "") -> tuple[list[dict], str]:
    """Fetch a single repo and return as a 1-item list."""
    if not owner and parsed.entities.get("repos"):
        ref = parsed.entities["repos"][0]
        if "/" in ref:
            owner, name = ref.split("/", 1)
    if not owner or not name:
        return [], "Could not identify a repository name. Please use format `owner/name`."
    raw = await _github_repo(owner, name)
    if not raw:
        return [], f"Repository `{owner}/{name}` not found on GitHub."
    return [_normalize_repo(raw)], f"Fetched live data for `{owner}/{name}`."


# ─── Response synthesizer (Guardrail 2 + 3) ──────────────────────────────────

_SYNTH_SYSTEM = """\
You synthesize GitHub research results into a clear, honest response.

HARD RULES — violating any is disqualifying:
1. NEVER mention a repository not present in REPOS DATA below.
2. NEVER invent star counts, dates, contributor numbers, or any metric.
3. If REPOS DATA is empty, output exactly: "No repositories found for this query."
4. If a signal is ambiguous, say so explicitly. Never fill uncertainty with guess.
5. Do NOT use: "rapidly growing", "dominant", "best-in-class", "game-changing",
   "revolutionary", "exciting", "amazing" — unless momentum=HIGH AND supported by data.
6. Do NOT speculate on future trajectory. Describe only what the data shows NOW.
7. If the question cannot be answered from REPOS DATA, say so directly.

TONE: Factual. Concise. Analyst-grade. No filler. No exclamation marks.

FORMAT:
- Start with 1-sentence factual summary (e.g. "Found 6 active Rust web frameworks.")
- List repos as: `owner/name` — Xk ⭐ · TREND_LABEL · one-line description
- End with ≤2 follow-up suggestions prefixed with > 💡

--- REPOS DATA (ground truth — use ONLY these) ---
{repos_json}

--- USER MESSAGE ---
{message}

--- CONTEXT (last 3 turns) ---
{context}
"""


async def _synthesize(
    repos: list[dict],
    message: str,
    context_turns: list[dict],
    intent: str,
    summary_line: str,
) -> str:
    """Call Groq to write a factual narrative. ONLY uses repos from real API data."""
    # Guardrail 3: empty result honesty — skip LLM entirely
    if not repos:
        return (
            "**No repositories found** for this query.\n\n"
            "This could mean:\n"
            "- The topic is very niche — try broader terms\n"
            "- Filters are too restrictive — remove star/date constraints\n"
            "- The technology is too new to have indexed repositories\n\n"
            "> 💡 Try rephrasing or ask me to broaden the search."
        )

    if not GROQ_API_KEY:
        # Minimal fallback — no hallucination, just structured list
        lines = [summary_line, ""]
        for r in repos[:10]:
            stars_k = f"{r['stars'] / 1000:.1f}k" if r["stars"] >= 1000 else str(r["stars"])
            desc = r["description"][:80] if r["description"] else "No description"
            lines.append(f"- **{r['full_name']}** — {stars_k} ⭐ · {r['trend_label']} · {desc}")
        return "\n".join(lines)

    # Context for pronoun resolution
    ctx_lines = []
    for t in context_turns[-6:]:
        if isinstance(t, dict) and "role" in t and "content" in t:
            ctx_lines.append(f"{t['role'].upper()}: {t['content'][:200]}")
        elif isinstance(t, str):
            ctx_lines.append(f"USER: {t[:200]}")
    ctx = "\n".join(ctx_lines)

    # Guardrail 2: only send real repo data
    safe_repos = [
        {k: v for k, v in r.items()
         if k in {"full_name","owner","name","stars","forks","open_issues",
                  "watchers","primary_language","description","topics","license",
                  "age_days","pushed_at","trend_label","momentum","velocity_proxy",
                  "is_fork","archived","github_url"}}
        for r in repos[:20]
    ]

    prompt = _SYNTH_SYSTEM.format(
        repos_json=json.dumps(safe_repos, indent=2),
        message=message,
        context=ctx or "(none)",
    )

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": 800,
                },
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                data = await resp.json()
                return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Synthesis LLM failed ({exc}), using fallback")
        lines = [summary_line, ""]
        for r in repos[:10]:
            stars_k = f"{r['stars'] / 1000:.1f}k" if r["stars"] >= 1000 else str(r["stars"])
            desc = r["description"][:80] if r["description"] else "No description"
            lines.append(f"- **{r['full_name']}** — {stars_k} ⭐ · {r['trend_label']} · {desc}")
        return "\n".join(lines)


# ─── Report generator (Guardrail 7) ──────────────────────────────────────────

_REPORT_SYSTEM = """\
You are a senior OSS intelligence analyst writing a structured research brief.
Your output will be read by engineers and investors. Accuracy is non-negotiable.

HARD RULES:
1. ONLY reference repos in REPOS DATA. Never mention any other repository.
2. NEVER invent metrics. Every number must come from REPOS DATA.
3. If data is insufficient for a claim, write: "Insufficient data to assess X."
4. For declining signals: state them honestly.
   e.g. "repo X shows LOW momentum (0.28) suggesting slowing activity."
5. Do NOT use: "explosive", "game-changing", "leading", "dominant", "best"
   unless momentum >= 0.7 AND it is the top-ranked repo by that metric.
6. Do NOT speculate on future performance.
7. METHODOLOGY section is MANDATORY at the end.

MANDATORY REPORT STRUCTURE (markdown):
# {title}

## Executive Summary
(2-3 sentences, data-grounded only)

## Rising Stars
(repos with trend_label=HIGH, ranked by momentum, with real metric citations)

## Sector Analysis
(group repos by primary_language or topics, only factual patterns)

## Underperformers / Watch Items
(repos with trend_label=LOW -- report honestly, do not soften)

## Key Observations
(5 or fewer bullet points, each backed by specific data from REPOS DATA)

## Methodology
- Data source: GitHub Search API (real-time)
- Fetched at: {timestamp}
- Queries used: {queries}
- Repos analyzed: {repo_count}
- Trend scoring: star velocity proxy, pushed_at recency, watcher momentum
- This report is a snapshot; data changes continuously.

--- REPOS DATA (use ONLY these) ---
{repos_json}

--- SESSION QUERIES ---
{queries}
"""


async def generate_report(
    session_title: str,
    pins: list[dict],
    queries_used: list[str],
) -> str:
    """Generate a full research report. Guardrail 7 enforced via prompt."""
    # Guardrail 7: refuse if too few repos
    if len(pins) < 3:
        return (
            "**Cannot generate report:** Please pin at least 3 repositories first.\n\n"
            "In the chat, ask me to search for repos, then click **Pin** on ones you want to include."
        )

    if not GROQ_API_KEY:
        return _report_fallback(session_title, pins, queries_used)

    safe_pins = [
        {k: v for k, v in p.items()
         if k in {"full_name","owner","name","stars","forks","open_issues",
                  "primary_language","description","topics","license",
                  "age_days","pushed_at","trend_label","momentum","velocity_proxy"}}
        for p in pins[:50]
    ]

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    queries_str = "\n".join(f"- {q}" for q in queries_used) if queries_used else "- (direct repo pins)"

    prompt = _REPORT_SYSTEM.format(
        title=session_title,
        timestamp=timestamp,
        queries=queries_str,
        repo_count=len(safe_pins),
        repos_json=json.dumps(safe_pins, indent=2),
    )

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.15,
                    "max_tokens": 2000,
                },
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                data = await resp.json()
                return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Report generation LLM failed ({exc}): using fallback")
        return _report_fallback(session_title, pins, queries_used)


def _report_fallback(title: str, pins: list[dict], queries: list[str]) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"# {title}", "", "## Rising Stars", ""]
    for p in sorted(pins, key=lambda x: x.get("momentum", 0), reverse=True)[:10]:
        stars_k = f"{p['stars']/1000:.1f}k" if p.get("stars", 0) >= 1000 else str(p.get("stars", 0))
        lines.append(
            f"- **{p.get('full_name','?')}** — {stars_k} ⭐ · "
            f"{p.get('trend_label','?')} · {p.get('description','')[:80]}"
        )
    lines += [
        "", "## Methodology",
        f"- Data source: GitHub Search API (real-time)",
        f"- Fetched at: {timestamp}",
        f"- Queries used: {', '.join(queries) or '(direct pins)'}",
        f"- Repos analyzed: {len(pins)}",
    ]
    return "\n".join(lines)


# ─── Main entry point ─────────────────────────────────────────────────────────

async def process_message(
    message: str,
    context_turns: list[dict],   # last N {role, content} dicts
    user_tier: str = "free",
    fast_owner: str = "",         # pre-filled if fast_route found owner/name
    fast_name: str = "",
) -> AgentMessage:
    """
    Full pipeline: fast-route → intent parse → GitHub fetch → synthesize.
    Returns an AgentMessage (no streaming — used for REST endpoint version).
    SSE streaming builds on top of this by yielding intermediate events.
    """
    # ── Guardrail 1: confidence gate + out_of_scope ───────────────────────────
    fast = fast_route(message)

    if fast.action == "reject":
        return AgentMessage(
            role="agent", content=fast.reason, intent="out_of_scope",
            error=False,
        )
    if fast.action == "clarify":
        return AgentMessage(
            role="agent", content=fast.reason, intent="clarify",
        )

    if fast.action == "repo_lookup":
        fast_owner, fast_name = fast.owner, fast.name

    # ── Stage 2: LLM parse ───────────────────────────────────────────────────
    parsed = await parse_intent(message, context_turns)

    # Guardrail 1 cont: low confidence → clarify
    if parsed.needs_clarification or parsed.confidence < 0.60:
        clarify_msg = (
            parsed.clarification_prompt
            or "I'm not fully sure what you're looking for. Could you rephrase or add more detail?"
        )
        return AgentMessage(
            role="agent", content=clarify_msg, intent="clarify", confidence=parsed.confidence,
        )

    if parsed.intent == "out_of_scope":
        msg = (
            f"This is outside my scope: {parsed.rejection_reason or 'not a GitHub/OSS topic'}.\n\n"
            "I research GitHub repositories and open-source ecosystems only.\n\n"
            "> 💡 Try: _'show me trending Python AI tools'_ or _'compare vllm vs ollama'_"
        )
        return AgentMessage(role="agent", content=msg, intent="out_of_scope")

    # ── Intent dispatch ───────────────────────────────────────────────────────
    repos: list[dict] = []
    summary_line = ""

    if fast.action == "repo_lookup" or parsed.intent == "repo_detail":
        repos, summary_line = await _handle_repo_detail(parsed, fast_owner, fast_name)
    elif parsed.intent == "compare":
        repos, summary_line = await _handle_compare(parsed)
    elif parsed.intent == "landscape":
        repos, summary_line = await _handle_landscape(parsed)
    elif parsed.intent == "temporal":
        repos, summary_line = await _handle_temporal(parsed)
    else:  # search | report | fallback
        repos, summary_line = await _handle_search(parsed)

    # ── Synthesize response ───────────────────────────────────────────────────
    narrative = await _synthesize(repos, message, context_turns, parsed.intent, summary_line)

    follow_ups: list[str] = []
    if repos and parsed.intent == "search":
        lang = repos[0].get("primary_language", "")
        follow_ups = [
            f"Compare the top 3 results",
            f"Filter by {lang}" if lang else "Filter by language",
        ]
    elif parsed.intent == "landscape":
        follow_ups = ["Generate a research report on these", "Show me the top performers only"]

    return AgentMessage(
        role="agent",
        content=narrative,
        intent=parsed.intent,
        github_queries=parsed.github_queries,
        query_explanation=parsed.query_explanation,
        repos=repos,
        confidence=parsed.confidence,
        suggested_follow_ups=follow_ups,
    )


# ─── SSE streaming wrapper ────────────────────────────────────────────────────

async def stream_process_message(
    message: str,
    context_turns: list[dict],
    user_tier: str = "free",
    fast_owner: str = "",
    fast_name: str = "",
) -> AsyncIterator[str]:
    """
    Yields SSE-formatted strings.
    Events: status | query_explanation | repos | token | done | error
    """

    def _sse(event: str, data: Any) -> str:
        return f"data: {json.dumps({'type': event, **({'text': data} if isinstance(data, str) else {'data': data})}  )}\n\n"

    try:
        # Stage 1
        fast = fast_route(message)
        if fast.action == "reject":
            yield _sse("done", fast.reason)
            return
        if fast.action == "clarify":
            yield _sse("done", fast.reason)
            return
        if fast.action == "repo_lookup":
            fast_owner, fast_name = fast.owner, fast.name

        yield _sse("status", "Analysing your question…")

        # Stage 2
        parsed = await parse_intent(message, context_turns)

        if parsed.needs_clarification or parsed.confidence < 0.60:
            msg = parsed.clarification_prompt or "Could you rephrase or add more detail?"
            yield _sse("done", msg)
            return

        if parsed.intent == "out_of_scope":
            yield _sse("done", (
                f"Outside my scope: {parsed.rejection_reason or 'not a GitHub/OSS topic'}.\n"
                "I research GitHub repositories only."
            ))
            return

        # Show query explanation before fetching
        if parsed.query_explanation:
            yield _sse("query_explanation", parsed.query_explanation)

        yield _sse("status", "Searching GitHub live…")

        # Fetch
        repos: list[dict] = []
        summary_line = ""
        if fast.action == "repo_lookup" or parsed.intent == "repo_detail":
            repos, summary_line = await _handle_repo_detail(parsed, fast_owner, fast_name)
        elif parsed.intent == "compare":
            repos, summary_line = await _handle_compare(parsed)
        elif parsed.intent == "landscape":
            repos, summary_line = await _handle_landscape(parsed)
        elif parsed.intent == "temporal":
            repos, summary_line = await _handle_temporal(parsed)
        else:
            repos, summary_line = await _handle_search(parsed)

        # Send repos to frontend immediately (cards render before narrative)
        yield _sse("repos", repos)

        yield _sse("status", "Synthesising findings…")

        # Synthesise
        narrative = await _synthesize(repos, message, context_turns, parsed.intent, summary_line)

        # Stream narrative token-by-token (word-level, Groq doesn't stream here but we chunk it)
        words = narrative.split(" ")
        chunk = []
        for w in words:
            chunk.append(w)
            if len(chunk) >= 8:
                yield _sse("token", " ".join(chunk) + " ")
                chunk = []
        if chunk:
            yield _sse("token", " ".join(chunk))

        follow_ups: list[str] = []
        if repos and parsed.intent == "search":
            lang = repos[0].get("primary_language", "")
            follow_ups = [
                "Compare the top 3 results",
                f"Filter by {lang}" if lang else "Filter by language",
            ]
        elif parsed.intent == "landscape":
            follow_ups = ["Generate a research report", "Show top performers only"]

        yield _sse("done", {"follow_ups": follow_ups, "intent": parsed.intent,
                             "github_query": parsed.github_queries[0] if parsed.github_queries else "",
                             "query_explanation": parsed.query_explanation,
                             "confidence": parsed.confidence})

    except Exception as exc:
        logger.error(f"stream_process_message error: {exc}", exc_info=True)
        yield _sse("error", f"An error occurred: {str(exc)[:120]}")


# ─── Social Post / Blog Generator ────────────────────────────────────────────

_SOCIAL_PROMPTS: dict[str, str] = {
    "reddit": """\
You are an expert OSS community writer. Write a Reddit post about this GitHub repository.

RULES:
- Pick the most relevant subreddit (e.g. r/programming, r/MachineLearning, r/artificial, r/opensource).
- Format: Title + body (markdown). Body should be engaging, informative, NOT spammy.
- Include: what it is, why it's interesting, 2-3 real metrics from the data, honest community value.
- Max 450 words. End with a genuine question to spark discussion.
- NEVER invent metrics not in REPO DATA.

REPO DATA:
{repo_json}

Output format (strict):
**Subreddit:** r/...
**Title:** ...
---
[body markdown]
""",
    "twitter": """\
You are a senior engineer writing a Twitter/X thread about a GitHub repository.

RULES:
- Tweet 1: hook with the single most impressive real metric from data (stars, growth, etc.)
- Tweets 2-4: what it does, why it matters, who should care
- Tweet 5: link + call-to-action
- Each tweet ≤ 280 chars. Keep threads 4-5 tweets.
- Use 1-2 emojis per tweet max. No marketing buzzwords.
- NEVER invent metrics not in REPO DATA.

REPO DATA:
{repo_json}

Output format:
🧵 1/ [tweet]

2/ [tweet]

... etc
""",
    "linkedin": """\
You are a senior software engineer writing a LinkedIn post about a GitHub project.

RULES:
- Professional, genuinely insightful. No buzzwords ("game-changer", "thrilled to share", "exciting journey").
- Structure: brief hook → what it is → why engineers/teams should care → 2-3 real data points → your honest take → link
- Max 300 words. Use line breaks (LinkedIn rewards readability).
- NEVER invent metrics not in REPO DATA.

REPO DATA:
{repo_json}

Output the post text directly (no metadata headers).
""",
}


async def generate_social_post(
    repo: dict,
    platform: str,     # "reddit" | "twitter" | "linkedin"
    niche: str = "",   # optional extra context e.g. "AI agents framework"
) -> str:
    """
    Generate a platform-specific social/blog post for a repository.
    Only uses real repo data — no hallucination.
    """
    if platform not in _SOCIAL_PROMPTS:
        return f"Unsupported platform '{platform}'. Choose: reddit, twitter, linkedin."

    if not GROQ_API_KEY:
        starsK = f"{repo.get('stars', 0) / 1000:.1f}k" if repo.get("stars", 0) >= 1000 else str(repo.get("stars", 0))
        return (
            f"**{repo.get('full_name', 'Unknown')}** — {starsK} ⭐\n\n"
            f"{repo.get('description', 'No description available.')}\n\n"
            f"🔗 {repo.get('github_url', '')}"
        )

    safe_repo = {k: v for k, v in repo.items()
                 if k in {"full_name", "owner", "name", "stars", "forks", "open_issues",
                           "primary_language", "description", "topics", "license",
                           "age_days", "pushed_at", "trend_label", "momentum", "github_url"}}
    if niche:
        safe_repo["niche_context"] = niche

    prompt = _SOCIAL_PROMPTS[platform].format(repo_json=json.dumps(safe_repo, indent=2))

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.55,
                    "max_tokens": 700,
                },
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                data = await resp.json()
                return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Social post generation failed ({platform}): {exc}")
        return f"Failed to generate {platform} post. Please try again."

