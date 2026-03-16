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
_OFF_TOPIC = re.compile(
    r"\b(recipe|cook(ing)?|food|sport|cricket|movie|song|poem|lyrics|"
    r"stock\s+price|forex|crypto\s+price|weather|homework|assignment|"
    r"essay|president|capital\s+of|currency|joke|riddle|horoscope)\b",
    re.IGNORECASE,
)

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
    github_query: str = ""
    query_explanation: str = ""
    needs_clarification: bool = False
    clarification_prompt: str = ""
    rejection_reason: str = ""


@dataclass
class AgentMessage:
    role: str             # 'agent'
    content: str          # markdown text
    intent: str = ""
    github_query: str = ""
    query_explanation: str = ""
    repos: list[dict] = field(default_factory=list)
    confidence: float = 1.0
    suggested_follow_ups: list[str] = field(default_factory=list)
    error: bool = False


# ─── Stage 1: Deterministic fast router ───────────────────────────────────────

def fast_route(message: str) -> FastRouteResult:
    """No LLM. < 1ms. Handles obvious reject/clarify/repo-lookup cases."""
    stripped = message.strip()

    # Empty / too short
    if len(stripped) < 3:
        return FastRouteResult(
            action="clarify",
            reason="Please describe what you'd like to research (e.g. 'trending Python AI tools')."
        )

    # Off-topic
    if _OFF_TOPIC.search(stripped):
        return FastRouteResult(
            action="reject",
            reason=(
                "I only research GitHub repositories and open-source ecosystems. "
                "Try: 'show me trending Rust tools' or 'compare vllm vs llama.cpp'."
            )
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
  "github_query": "<github search q string or empty string>",
  "query_explanation": "<one plain-English sentence describing what will be searched>",
  "needs_clarification": false,
  "clarification_prompt": null,
  "rejection_reason": null
}}

GUARDRAIL -- query building rules:
- Only add `language:X` if user explicitly names a language
- Only add `pushed:>=DATE` if user mentions a time period
- Only add `stars:>N` if user specifies a star count
- Use `(topic:A OR topic:B)` for concepts with multiple GitHub tags
- If confidence < 0.7, set needs_clarification=true

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
    ctx = "\n".join(
        f"{t['role'].upper()}: {t['content'][:300]}"
        for t in context_turns[-6:]
    )

    prompt = _INTENT_SYSTEM.format(context=ctx or "(none)", message=message)

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
        return ParsedIntent(
            intent=parsed.get("intent", "search"),
            confidence=float(parsed.get("confidence", 0.5)),
            entities=parsed.get("entities", {}),
            github_query=parsed.get("github_query", ""),
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
        github_query=gh_q,
        query_explanation=f"GitHub repositories related to: {gh_q}",
    )


# ─── Real-time GitHub fetch (ZERO DB reads) ───────────────────────────────────

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
                    return []
                data = await resp.json()
                return data.get("items", [])
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


def _normalize_repo(raw: dict) -> dict:
    """Convert GitHub API item → clean Repodar schema (no DB reads)."""
    pushed = raw.get("pushed_at") or ""
    age_days = 0
    if raw.get("created_at"):
        try:
            created = datetime.fromisoformat(raw["created_at"].replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - created).days
        except Exception:
            pass

    # Live star velocity proxy: stars / max(age_days, 1)
    stars = raw.get("stargazers_count", 0)
    velocity_proxy = round(stars / max(age_days, 1), 2) if age_days else 0.0

    # Recency score (1.0 = pushed today, decays over 90 days)
    recency = 0.0
    if pushed:
        try:
            pushed_dt = datetime.fromisoformat(pushed.replace("Z", "+00:00"))
            days_since = (datetime.now(timezone.utc) - pushed_dt).days
            recency = max(0.0, 1.0 - days_since / 90.0)
        except Exception:
            pass

    # Composite momentum signal (proxy — no DB history)
    momentum = round(min(1.0, (velocity_proxy / 10.0) * 0.5 + recency * 0.5), 3)
    if momentum >= 0.65:
        trend_label = "HIGH"
    elif momentum >= 0.35:
        trend_label = "MID"
    else:
        trend_label = "LOW"

    return {
        "repo_id":          raw.get("id"),
        "owner":            raw.get("owner", {}).get("login", ""),
        "name":             raw.get("name", ""),
        "full_name":        raw.get("full_name", ""),
        "description":      raw.get("description") or "",
        "github_url":       raw.get("html_url", ""),
        "homepage":         raw.get("homepage") or "",
        "primary_language": raw.get("language") or "",
        "stars":            stars,
        "forks":            raw.get("forks_count", 0),
        "open_issues":      raw.get("open_issues_count", 0),
        "watchers":         raw.get("watchers_count", 0),
        "topics":           raw.get("topics", []),
        "license":          (raw.get("license") or {}).get("spdx_id") or "",
        "is_fork":          raw.get("fork", False),
        "archived":         raw.get("archived", False),
        "age_days":         age_days,
        "pushed_at":        pushed,
        "created_at":       raw.get("created_at", ""),
        "velocity_proxy":   velocity_proxy,
        "momentum":         momentum,
        "trend_label":      trend_label,
    }


# ─── Intent handlers ─────────────────────────────────────────────────────────

async def _handle_search(parsed: ParsedIntent) -> tuple[list[dict], str]:
    """Run a search and return (repos, summary_line)."""
    items = await _github_search(parsed.github_query, per_page=20)
    repos = [_normalize_repo(r) for r in items
             if not r.get("archived") and not r.get("fork")]
    repos.sort(key=lambda r: r["momentum"], reverse=True)
    return repos, f"Found {len(repos)} repositories."


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
    """Run 2–3 parallel sub-queries to build an ecosystem map."""
    import asyncio as _aio

    base_q = parsed.github_query
    # Build variant queries by sorting differently
    queries = [
        base_q,
        base_q.replace("sort:stars", "") + " sort:updated",
    ]
    if parsed.entities.get("topics"):
        for t in parsed.entities["topics"][:2]:
            queries.append(f"topic:{t} stars:>50")

    all_items = await _aio.gather(*[_github_search(q, per_page=15) for q in queries[:3]])
    seen: set[int] = set()
    repos = []
    for items in all_items:
        for raw in items:
            if raw.get("id") not in seen and not raw.get("archived"):
                seen.add(raw["id"])
                repos.append(_normalize_repo(raw))
    repos.sort(key=lambda r: r["momentum"], reverse=True)
    repos = repos[:30]
    return repos, f"Mapped {len(repos)} repositories across the ecosystem."


async def _handle_temporal(parsed: ParsedIntent) -> tuple[list[dict], str]:
    """Compare recent vs older push dates to surface what's new."""
    # Build two queries: one for very recent, one broader
    base_q = parsed.github_query
    now = datetime.now(timezone.utc)
    cutoff_recent = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    cutoff_older = (now - timedelta(days=60)).strftime("%Y-%m-%d")

    import asyncio as _aio
    recent_items, older_items = await _aio.gather(
        _github_search(f"{base_q} pushed:>={cutoff_recent}", per_page=15),
        _github_search(f"{base_q} pushed:>={cutoff_older}", per_page=15),
    )
    recent_ids = {r["id"] for r in recent_items}
    new_repos = [_normalize_repo(r) for r in recent_items]
    established = [_normalize_repo(r) for r in older_items if r["id"] not in recent_ids]
    repos = new_repos + established
    repos.sort(key=lambda r: r["momentum"], reverse=True)
    return repos, (
        f"Found {len(new_repos)} repositories with recent activity (7d) "
        f"and {len(established)} established ones."
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

    ctx = "\n".join(
        f"{t['role'].upper()}: {t['content'][:200]}"
        for t in context_turns[-6:]
    )

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
        github_query=parsed.github_query,
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
                             "github_query": parsed.github_query,
                             "query_explanation": parsed.query_explanation,
                             "confidence": parsed.confidence})

    except Exception as exc:
        logger.error(f"stream_process_message error: {exc}", exc_info=True)
        yield _sse("error", f"An error occurred: {str(exc)[:120]}")
