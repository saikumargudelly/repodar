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
    "topic:ai-agents",
    "topic:llm-inference",
    "topic:transformers",
    "topic:computer-vision",
    "topic:nlp",
    "topic:multimodal",
    "topic:diffusion-model",
    "topic:rag",
    "topic:embeddings",
    "topic:huggingface",
    "topic:pytorch",
    "topic:browser-automation",
    "topic:ui-automation",
    "topic:web-agent",
    "topic:gui-agent",
    "topic:computer-use",
    "topic:rpa",
    # MCP & agentic tooling (2025-2026 wave)
    "topic:mcp",
    "topic:model-context-protocol",
    "topic:coding-assistant",
    "topic:ai-coding",
    "topic:copilot",
    # Modality-specific AI
    "topic:text-to-speech",
    "topic:tts",
    "topic:speech-recognition",
    "topic:text-to-image",
    "topic:stable-diffusion",
    "topic:vision-language-model",
    "topic:vlm",
    # Data & training
    "topic:synthetic-data",
    "topic:dataset",
    # Local / on-device AI
    "topic:ollama",
    "topic:local-llm",
    "topic:chatbot",
    # Structured outputs & tool use
    "topic:function-calling",
    "topic:structured-output",
    "topic:prompt-engineering",
    # Agent-to-agent
    "topic:a2a",
]

# Topic queries per vertical — each is queried in parallel via _fetch_search.
# Richer topic sets capture more of the true ecosystem surface area while
# the semaphore in _search_api prevents rate-limit spikes.
VERTICAL_TOPIC_QUERIES: dict[str, list[str]] = {
    "ai_ml": AI_TOPIC_QUERIES,
    "devtools": [
        "topic:developer-tools",
        "topic:cli",
        "topic:terminal",
        "topic:code-editor",
        "topic:productivity",
        "topic:devtools",
        "topic:linter",
        "topic:formatter",
        "topic:language-server",
        "topic:vscode-extension",
        "topic:debugging",
        "topic:profiler",
        "topic:neovim",
        "topic:shell",
        "topic:git",
        # Headless browsers & automation infra
        "topic:headless-browser",
        "topic:playwright",
        "topic:puppeteer",
        "topic:cdp",
        # Modern runtimes & tools
        "topic:bun",
        "topic:deno",
        "topic:wasm",
        "topic:webassembly",
        # API & backend platforms
        "topic:supabase",
        "topic:appwrite",
    ],
    "web_frameworks": [
        "topic:web-framework",
        "topic:rest-api",
        "topic:nodejs",
        "topic:react",
        "topic:vuejs",
        "topic:fastapi",
        "topic:graphql",
        "topic:grpc",
        "topic:typescript",
        "topic:svelte",
        "topic:nextjs",
        "topic:django",
        "topic:flask",
        "topic:microservices",
        "topic:websocket",
        # Trending 2025-2026 frameworks
        "topic:astro",
        "topic:htmx",
        "topic:hono",
        "topic:elysia",
        "topic:remix",
        "topic:sveltekit",
        "topic:solid-js",
        "topic:bun",
        "topic:deno",
        "topic:edge-runtime",
        "topic:spring-boot",
        "topic:rails",
    ],
    "security": [
        "topic:security",
        "topic:cybersecurity",
        "topic:vulnerability-scanner",
        "topic:penetration-testing",
        "topic:devsecops",
        "topic:cryptography",
        "topic:authentication",
        "topic:zero-trust",
        "topic:fuzzing",
        "topic:reverse-engineering",
        "topic:malware-analysis",
        "topic:osint",
        "topic:network-security",
        "topic:supply-chain-security",
        "topic:red-team",
        # 2025-2026 supply-chain & cloud security
        "topic:sbom",
        "topic:sast",
        "topic:dast",
        "topic:api-security",
        "topic:container-security",
        "topic:cloud-security",
        "topic:secrets-management",
        "topic:sca",
        "topic:vulnerability-management",
    ],
    "data_engineering": [
        "topic:data-engineering",
        "topic:etl",
        "topic:data-pipeline",
        "topic:workflow-orchestration",
        "topic:apache-airflow",
        "topic:streaming",
        "topic:kafka",
        "topic:spark",
        "topic:data-lake",
        "topic:dbt",
        "topic:data-warehouse",
        "topic:analytics",
        "topic:flink",
        "topic:delta-lake",
        "topic:trino",
        # 2025-2026 lakehouse & modern data stack
        "topic:apache-iceberg",
        "topic:iceberg",
        "topic:dagster",
        "topic:data-quality",
        "topic:great-expectations",
        "topic:polars",
        "topic:duckdb",
        "topic:data-lakehouse",
        "topic:cdc",
        "topic:debezium",
        "topic:data-catalog",
        "topic:parquet",
        "topic:arrow",
    ],
    "blockchain": [
        "topic:blockchain",
        "topic:ethereum",
        "topic:smart-contracts",
        "topic:web3",
        "topic:defi",
        "topic:solidity",
        "topic:nft",
        "topic:layer2",
        "topic:zero-knowledge",
        "topic:dao",
        "topic:bitcoin",
        "topic:solana",
        "topic:cosmos",
        "topic:cross-chain",
        "topic:evm",
        # 2025-2026 blockchain trends
        "topic:account-abstraction",
        "topic:restaking",
        "topic:rollup",
        "topic:modular-blockchain",
        "topic:ton",
        "topic:sui",
        "topic:move-language",
        "topic:zk-rollup",
        "topic:zk-snark",
        "topic:depin",
    ],
    "oss_tools": [
        "topic:build-tool",
        "topic:bundler",
        "topic:package-manager",
        "topic:testing",
        "topic:infrastructure",
        "topic:observability",
        "topic:ci-cd",
        "topic:automation",
        "topic:api-client",
        "topic:orm",
        "topic:linting",
        "topic:code-generation",
        "topic:documentation",
        "topic:monorepo",
        "topic:containerization",
        "topic:kubernetes",
        "topic:terraform",
        "topic:ansible",
        "topic:opentelemetry",
        # 2025-2026 infra & runtime trends
        "topic:wasm",
        "topic:wasi",
        "topic:serverless",
        "topic:edge-computing",
        "topic:nix",
        "topic:bazel",
        "topic:vitest",
        "topic:playwright",
        "topic:pnpm",
        "topic:turborepo",
        "topic:docker",
        "topic:podman",
        "topic:github-actions",
    ],
}

# Minimum star floor per period for the Search API fallback.
# Short windows use low floors so newly-viral repos aren't filtered out;
# long windows demand proven traction to keep result sets manageable.
MIN_STARS_SEARCH: dict[str, int] = {
    "7d":   50,       # catch anything gaining momentum this week
    "30d":  100,      # monthly: some traction required
    "90d":  200,      # quarterly: genuine real-world use
    "365d": 2_000,    # annual: must be widely adopted
    "3y":   10_000,
    "5y":   25_000,
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
    vertical: str = "ai_ml",
) -> list[dict]:
    """
    Return up to `limit` repos ranked by popularity for the given period.

    For AI/ML vertical:
      1d/7d/30d  → GitHub Trending page (actual star gains in that window).
      90d+       → GitHub Search API (most starred AI repos in window).

    For non-AI verticals (DevTools, Security, etc.):
      All periods → GitHub Search API with vertical-specific topic queries.
      GitHub Trending is a general feed; topic-filtered Search is more relevant.
    """
    topics = VERTICAL_TOPIC_QUERIES.get(vertical, AI_TOPIC_QUERIES)

    # Only use GitHub Trending for the AI/ML vertical on short periods
    if period in TRENDING_SINCE and vertical == "ai_ml":
        results = await _fetch_trending(period, limit=limit)
    else:
        results = await _fetch_search(period, limit=limit, topics=topics)

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


# ─── GitHub Search API fallback (all non-trending paths) ─────────────────────
# Semaphore caps concurrent search requests at 8 to respect GitHub's 30 req/min
# Search API rate limit without needing artificial sleep() delays.
_SEARCH_SEMAPHORE = asyncio.Semaphore(8)


async def _fetch_search(
    period: str,
    limit: int,
    topics: list[str] | None = None,
) -> list[dict]:
    """
    Find the most relevant repos for a period + topic set.

    Strategy
    ────────
    • Short periods (7d / 30d): dual-sort — for each topic run BOTH
        sort=stars  (established leaders with recent activity)
        sort=updated  (newly-active breakout repos with a lower star floor)
      This captures repos gaining fast momentum that haven't yet accumulated
      massive total stars.

    • Medium/long periods (90d / 365d): sort=stars with pushed-date filter and
      a modest star floor to exclude noise.

    • Very long (3y / 5y): no pushed-date filter, sort=stars, high floor —
      surfaces all-time established repos regardless of recent activity.

    All calls share _SEARCH_SEMAPHORE to avoid rate-limit 429s.
    """
    if topics is None:
        topics = AI_TOPIC_QUERIES

    no_date   = period in {"3y", "5y"}
    short     = period in {"7d", "30d"}
    start     = _start_date(period)
    min_stars = MIN_STARS_SEARCH.get(period, 50)

    queries: list[tuple[str, str]] = []   # (query_string, sort_key)
    for topic in topics:
        if no_date:
            queries.append((f"{topic} stars:>={min_stars}", "stars"))
        else:
            queries.append((f"{topic} pushed:>={start} stars:>={min_stars}", "stars"))
            if short:
                # Lower floor catches breakout repos not yet widely starred
                floor = max(10, min_stars // 5)
                queries.append((f"{topic} pushed:>={start} stars:>={floor}", "updated"))

    async with aiohttp.ClientSession() as session:
        batches = await asyncio.gather(*[
            _search_api(session, q, sort=sort_key, per_page=50)
            for q, sort_key in queries
        ], return_exceptions=True)

    seen: dict[str, dict] = {}
    for batch in batches:
        if not isinstance(batch, list):
            logger.warning(f"_fetch_search batch error: {batch}")
            continue
        for repo in batch:
            fn = repo.get("full_name", "")
            if not fn:
                continue
            if fn not in seen or repo.get("stargazers_count", 0) > seen[fn].get("stargazers_count", 0):
                seen[fn] = repo

    return sorted(seen.values(), key=lambda r: r.get("stargazers_count", 0), reverse=True)[:limit]


async def _search_api(
    session: aiohttp.ClientSession,
    query: str,
    sort: str = "stars",
    per_page: int = 50,
) -> list[dict]:
    url = f"{REST_BASE}/search/repositories"
    params = {"q": query, "sort": sort, "order": "desc", "per_page": per_page}
    try:
        async with _SEARCH_SEMAPHORE:
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
    """Map internal category names → GitHub topic keywords used for filtering."""
    mapping: dict[str, list[str]] = {
        # ── AI/ML sub-categories ──────────────────────────────────────────────
        "LLM Models": [
            "llm", "large-language-model", "language-model", "generative-ai",
            "gpt", "llama", "mistral", "gemini", "claude", "foundation-model",
            "causal-lm", "ollama", "local-llm",
        ],
        "Agent Frameworks": [
            "ai-agent", "ai-agents", "autonomous-agents", "langchain", "autogpt",
            "llm-agent", "agent-framework", "multi-agent", "crewai",
            "llamaindex", "agentic", "browser-automation", "ui-automation",
            "web-agent", "gui-agent", "computer-use", "a2a",
        ],
        "MCP Tools": [
            "mcp", "model-context-protocol",
        ],
        "Coding Assistants": [
            "coding-assistant", "ai-coding", "copilot", "code-generation",
        ],
        "Inference Engines": [
            "llm-inference", "inference", "llama-cpp", "vllm", "gguf",
            "tensorrt", "onnxruntime", "triton-inference", "tgi", "tensorrt-llm",
        ],
        "Vector Databases": [
            "vector-database", "vector-search", "embeddings", "faiss",
            "weaviate", "pinecone", "chroma", "chromadb", "hnswlib",
            "milvus", "qdrant", "annoy",
        ],
        "Model Serving / Runtimes": [
            "model-serving", "mlops", "triton", "bentoml", "kubeflow",
            "seldon", "kfserving", "mlflow", "model-registry",
        ],
        "Distributed Compute / Infra": [
            "distributed-training", "mlops", "ray", "deepspeed",
            "horovod", "megatron", "pytorch-lightning", "ray-train",
        ],
        "Evaluation Frameworks": [
            "llm-evaluation", "benchmarks", "evals", "evaluation",
            "llm-benchmark", "lm-eval", "helm", "mmlu",
        ],
        "Fine-tuning Toolkits": [
            "fine-tuning", "lora", "rlhf", "instruction-tuning",
            "peft", "sft", "dpo", "qlora", "adapter",
        ],
        "Speech & Audio": [
            "text-to-speech", "tts", "speech-recognition", "asr",
            "voice-cloning", "audio-processing",
        ],
        "Image Generation": [
            "text-to-image", "stable-diffusion", "diffusion-model",
            "image-generation", "sdxl", "comfyui",
        ],
        # ── Other verticals ───────────────────────────────────────────────────
        "DevTools": [
            "developer-tools", "cli", "terminal", "code-editor", "productivity",
            "devtools", "linter", "formatter", "language-server",
            "vscode-extension", "debugging", "profiler", "neovim",
            "shell", "git", "intellij-plugin",
            "headless-browser", "playwright", "puppeteer", "cdp",
            "bun", "deno", "wasm", "webassembly",
            "supabase", "appwrite",
        ],
        "Web Frameworks": [
            "web-framework", "rest-api", "nodejs", "react", "vuejs", "svelte",
            "fastapi", "nextjs", "django", "flask", "graphql", "grpc",
            "microservices", "websocket", "typescript", "angular", "nuxt",
            "spring-boot",
            "astro", "htmx", "hono", "elysia", "remix", "sveltekit",
            "solid-js", "bun", "deno", "edge-runtime", "rails",
        ],
        "Security": [
            "security", "cybersecurity", "vulnerability-scanner",
            "penetration-testing", "devsecops", "cryptography",
            "authentication", "zero-trust", "fuzzing", "reverse-engineering",
            "malware-analysis", "osint", "network-security",
            "supply-chain-security", "red-team",
            "sbom", "sast", "dast", "api-security",
            "container-security", "cloud-security", "secrets-management",
            "sca", "vulnerability-management",
        ],
        "Data Engineering": [
            "data-engineering", "etl", "data-pipeline", "workflow-orchestration",
            "apache-airflow", "streaming", "kafka", "spark", "data-lake",
            "dbt", "data-warehouse", "flink", "delta-lake", "trino", "analytics",
            "apache-iceberg", "iceberg", "dagster", "data-quality",
            "great-expectations", "polars", "duckdb", "data-lakehouse",
            "cdc", "debezium", "data-catalog", "parquet", "arrow",
        ],
        "Blockchain": [
            "blockchain", "ethereum", "smart-contracts", "web3", "defi",
            "solidity", "nft", "layer2", "zero-knowledge", "dao",
            "bitcoin", "solana", "cosmos", "cross-chain", "evm",
            "account-abstraction", "restaking", "rollup",
            "modular-blockchain", "ton", "sui", "move-language",
            "zk-rollup", "zk-snark", "depin",
        ],
        "OSS Tools": [
            "build-tool", "bundler", "package-manager", "testing",
            "infrastructure", "observability", "ci-cd", "automation",
            "orm", "api-client", "linting", "code-generation",
            "documentation", "monorepo", "containerization",
            "kubernetes", "terraform", "ansible", "opentelemetry",
            "prometheus", "grafana", "helm",
            "wasm", "wasi", "serverless", "edge-computing",
            "nix", "bazel", "vitest", "playwright", "pnpm",
            "turborepo", "docker", "podman", "github-actions",
        ],
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


# ─── Star-threshold broad discovery ─────────────────────────────────────────
# These queries catch popular repos that may never appear on GitHub Trending
# (older, stable libraries) but are widely used in the ecosystem.

STAR_THRESHOLD_TOPICS: dict[str, list[tuple[str, int]]] = {
    # (topic_query, min_stars).  Floors are intentionally modest so well-established
    # but niche tools aren't excluded.  Raise them as the DB grows.
    "ai_ml": [
        ("topic:machine-learning",  300),
        ("topic:deep-learning",     300),
        ("topic:llm",               200),
        ("topic:generative-ai",     200),
        ("topic:transformers",      300),
        ("topic:diffusion-model",   200),
        ("topic:computer-vision",   300),
        ("topic:nlp",               300),
        ("topic:rag",               100),
        ("topic:embeddings",        200),
        ("topic:ai-agent",          100),
        ("topic:ai-agents",         100),
        ("topic:browser-automation", 100),
        ("topic:ui-automation",      100),
        ("topic:web-agent",          100),
        ("topic:gui-agent",          100),
        ("topic:computer-use",       100),
        ("topic:huggingface",       200),
        # MCP, coding assistants, local AI, modality-specific
        ("topic:mcp",               100),
        ("topic:model-context-protocol", 100),
        ("topic:coding-assistant",  100),
        ("topic:ai-coding",         100),
        ("topic:ollama",            200),
        ("topic:local-llm",         100),
        ("topic:text-to-speech",    200),
        ("topic:tts",               200),
        ("topic:speech-recognition", 200),
        ("topic:text-to-image",     200),
        ("topic:stable-diffusion",  200),
        ("topic:vision-language-model", 100),
        ("topic:synthetic-data",    100),
        ("topic:chatbot",           200),
        ("topic:function-calling",  100),
        ("topic:prompt-engineering", 100),
    ],
    "devtools": [
        ("topic:developer-tools",   300),
        ("topic:cli",               300),
        ("topic:code-editor",       200),
        ("topic:devtools",          200),
        ("topic:linter",            200),
        ("topic:formatter",         200),
        ("topic:language-server",   100),
        ("topic:vscode-extension",  100),
        ("topic:debugging",         200),
        ("topic:neovim",            100),
        ("topic:shell",             200),
        # Headless browsers & modern runtimes
        ("topic:headless-browser",  100),
        ("topic:playwright",        200),
        ("topic:puppeteer",         200),
        ("topic:cdp",               100),
        ("topic:bun",               200),
        ("topic:deno",              200),
        ("topic:wasm",              200),
        ("topic:supabase",          200),
    ],
    "data_engineering": [
        ("topic:data-engineering",  200),
        ("topic:etl",               200),
        ("topic:data-pipeline",     200),
        ("topic:kafka",             300),
        ("topic:spark",             300),
        ("topic:dbt",               200),
        ("topic:data-warehouse",    200),
        ("topic:streaming",         200),
        ("topic:flink",             300),
        ("topic:trino",             200),
        # Lakehouse & modern data stack
        ("topic:apache-iceberg",    200),
        ("topic:iceberg",           200),
        ("topic:dagster",           200),
        ("topic:polars",            200),
        ("topic:duckdb",            200),
        ("topic:data-quality",      100),
        ("topic:data-lakehouse",    100),
        ("topic:cdc",               100),
        ("topic:debezium",          100),
        ("topic:parquet",           200),
        ("topic:arrow",             200),
    ],
    "security": [
        ("topic:security",                200),
        ("topic:penetration-testing",     200),
        ("topic:vulnerability-scanner",   100),
        ("topic:cryptography",            200),
        ("topic:fuzzing",                 100),
        ("topic:osint",                   100),
        ("topic:malware-analysis",        100),
        ("topic:network-security",        200),
        # Supply-chain & cloud security
        ("topic:sbom",                    100),
        ("topic:sast",                    100),
        ("topic:dast",                    100),
        ("topic:container-security",      100),
        ("topic:cloud-security",          100),
        ("topic:api-security",            100),
        ("topic:secrets-management",      100),
    ],
    "web_frameworks": [
        ("topic:web-framework",   300),
        ("topic:rest-api",        300),
        ("topic:graphql",         200),
        ("topic:grpc",            200),
        ("topic:typescript",      300),
        ("topic:microservices",   200),
        ("topic:websocket",       200),
        # 2025-2026 rising frameworks
        ("topic:astro",           200),
        ("topic:htmx",            100),
        ("topic:hono",            100),
        ("topic:elysia",          100),
        ("topic:remix",           200),
        ("topic:sveltekit",       100),
        ("topic:solid-js",        100),
        ("topic:edge-runtime",    100),
    ],
    "blockchain": [
        ("topic:blockchain",        200),
        ("topic:ethereum",          200),
        ("topic:smart-contracts",   200),
        ("topic:web3",              200),
        ("topic:defi",              200),
        ("topic:solidity",          100),
        ("topic:layer2",            100),
        ("topic:zero-knowledge",    100),
        ("topic:dao",               100),
        ("topic:solana",            200),
        # 2025-2026 blockchain trends
        ("topic:account-abstraction", 100),
        ("topic:restaking",         100),
        ("topic:rollup",            100),
        ("topic:zk-rollup",         100),
        ("topic:ton",               100),
        ("topic:sui",               100),
        ("topic:depin",             100),
    ],
    "oss_tools": [
        ("topic:build-tool",        200),
        ("topic:bundler",           200),
        ("topic:package-manager",   200),
        ("topic:testing",           300),
        ("topic:observability",     200),
        ("topic:ci-cd",             200),
        ("topic:infrastructure",    300),
        ("topic:automation",        200),
        ("topic:orm",               200),
        ("topic:api-client",        100),
        ("topic:monorepo",          100),
        ("topic:kubernetes",        300),
        ("topic:terraform",         200),
        ("topic:opentelemetry",     100),
        # 2025-2026 infra trends
        ("topic:wasm",              200),
        ("topic:wasi",              100),
        ("topic:serverless",        200),
        ("topic:edge-computing",    100),
        ("topic:docker",            300),
        ("topic:github-actions",    200),
        ("topic:nix",               100),
        ("topic:bazel",             200),
        ("topic:vitest",            100),
        ("topic:playwright",        200),
        ("topic:turborepo",         100),
    ],
}


async def search_by_star_threshold(
    vertical: str = "ai_ml",
    limit: int = 50,
) -> list[dict]:
    """
    Discover repos with `stars >= threshold` for the given vertical without
    any date restriction.  Complements the trending-based discovery by surfacing
    established repos that are no longer "trending" but are widely adopted.

    Returns a list of raw repo dicts compatible with the shape expected by
    auto_discover_and_sync (has `full_name`, `name`, `html_url`, etc.).
    """
    queries = STAR_THRESHOLD_TOPICS.get(vertical, STAR_THRESHOLD_TOPICS["ai_ml"])

    async with aiohttp.ClientSession() as session:
        batches = await asyncio.gather(*[
            _search_api(session, f"{topic} stars:>={min_stars}")
            for topic, min_stars in queries
        ], return_exceptions=True)

    seen: dict[str, dict] = {}
    for batch in batches:
        if not isinstance(batch, list):
            logger.warning(f"Star-threshold search error: {batch}")
            continue
        for repo in batch:
            fn = repo.get("full_name", "")
            if not fn:
                continue
            if fn not in seen or repo.get("stargazers_count", 0) > seen[fn].get("stargazers_count", 0):
                seen[fn] = repo

    return sorted(seen.values(), key=lambda r: r.get("stargazers_count", 0), reverse=True)[:limit]


def _age_days(created_at: str) -> int:
    if not created_at:
        return 0
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days
    except Exception:
        return 0


def _infer_category(repo: dict) -> str:
    """
    Best-effort category inference from topics, language, name, and description.
    Ordered from most-specific (well-known topic signal) to least-specific
    (keyword fallback).  Language is used as a tie-breaker / secondary signal.
    """
    topics = set(repo.get("topics", []))
    name   = (repo.get("name")        or "").lower()
    desc   = (repo.get("description") or "").lower()
    lang   = (repo.get("language")    or "").lower()
    text   = name + " " + desc

    # ── AI/ML sub-categories (specific topic combos) ──────────────────────────
    if topics & {"vector-database", "vector-search", "faiss", "weaviate", "pinecone",
                 "chroma", "chromadb", "hnswlib", "milvus", "qdrant", "annoy"}:
        return "Vector Databases"
    if any(w in text for w in ["vector database", "vector store", "vector search",
                                "embedding store", "similarity search"]):
        return "Vector Databases"

    if topics & {"ai-agent", "ai-agents", "autonomous-agents", "autogpt", "langchain",
                 "llm-agent", "agent-framework", "multi-agent", "crewai", "llamaindex",
                 "agentic", "browser-automation", "ui-automation", "web-agent",
                 "gui-agent", "computer-use", "a2a"}:
        return "Agent Frameworks"
    if any(w in text for w in ["agent framework", "autonomous agent", "multi-agent",
                                "llm agent", "ai agent", "browser agent", "gui agent",
                                "web agent", "browser automation", "ui automation",
                                "computer use", "page agent"]):
        return "Agent Frameworks"

    if topics & {"mcp", "model-context-protocol"}:
        return "MCP Tools"
    if any(w in text for w in ["model context protocol", "mcp server", "mcp client"]):
        return "MCP Tools"

    if topics & {"coding-assistant", "ai-coding", "copilot", "code-generation"}:
        return "Coding Assistants"
    if any(w in text for w in ["coding assistant", "ai coding", "code completion",
                                "ai pair programmer"]):
        return "Coding Assistants"

    if topics & {"llm-inference", "vllm", "llama-cpp", "gguf", "tensorrt",
                 "onnxruntime", "triton-inference", "tgi", "tensorrt-llm",
                 "deepspeed-inference"}:
        return "Inference Engines"
    if any(w in text for w in ["llm inference", "llm serving", "model inference",
                                "inference server", "inference engine"]):
        return "Inference Engines"

    if topics & {"fine-tuning", "lora", "rlhf", "instruction-tuning", "peft",
                 "sft", "dpo", "qlora", "adapter"}:
        return "Fine-tuning Toolkits"
    if any(w in text for w in ["fine-tun", "finetun", "lora ", "rlhf",
                                "instruction tun", "parameter-efficient"]):
        return "Fine-tuning Toolkits"

    if topics & {"text-to-speech", "tts", "speech-recognition", "asr",
                 "voice-cloning", "audio-processing"}:
        return "Speech & Audio"
    if any(w in text for w in ["text to speech", "speech to text", "voice cloning",
                                "audio generation"]):
        return "Speech & Audio"

    if topics & {"text-to-image", "stable-diffusion", "diffusion-model",
                 "image-generation", "sdxl", "comfyui"}:
        return "Image Generation"
    if any(w in text for w in ["text to image", "image generation", "stable diffusion"]):
        return "Image Generation"

    if topics & {"model-serving", "mlops", "kubeflow", "bentoml", "seldon",
                 "kfserving", "mlflow", "model-registry"}:
        return "Model Serving / Runtimes"
    if any(w in text for w in ["model serving", "model deployment", "ml pipeline",
                                "mlops platform"]):
        return "Model Serving / Runtimes"

    if topics & {"distributed-training", "horovod", "deepspeed", "megatron",
                 "ray-train", "pytorch-lightning"}:
        return "Distributed Compute / Infra"
    if any(w in text for w in ["distributed training", "model parallelism",
                                "tensor parallelism"]):
        return "Distributed Compute / Infra"

    if topics & {"llm-evaluation", "benchmarks", "evals", "evaluation",
                 "llm-benchmark", "lm-eval", "helm", "mmlu"}:
        return "Evaluation Frameworks"
    if any(w in text for w in ["llm evaluation", "model evaluation", "benchmark suite",
                                "eval framework", "evals platform"]):
        return "Evaluation Frameworks"

    if topics & {"llm", "large-language-model", "language-model", "gpt", "llama",
                 "generative-ai", "foundation-model", "causal-lm",
                 "mistral", "gemini", "claude", "ollama", "local-llm"}:
        return "LLM Models"

    # ── Blockchain (distinctive vocabulary — check before generic AI topics) ──
    if topics & {"blockchain", "ethereum", "smart-contracts", "web3", "defi",
                 "solidity", "nft", "layer2", "zero-knowledge", "dao",
                 "bitcoin", "solana", "cosmos", "cross-chain", "evm", "substrate",
                 "account-abstraction", "restaking", "rollup", "modular-blockchain",
                 "ton", "sui", "move-language", "zk-rollup", "zk-snark", "depin"}:
        return "Blockchain"
    if lang in ("solidity", "vyper", "move"):
        return "Blockchain"
    if any(w in text for w in ["blockchain", "ethereum", "smart contract", "solidity",
                                "bitcoin", "defi protocol", "web3", "nft minting",
                                "zero-knowledge proof", "layer 2", " l2 "]):
        return "Blockchain"

    # ── Security ──────────────────────────────────────────────────────────────
    if topics & {"security", "cybersecurity", "vulnerability-scanner",
                 "penetration-testing", "devsecops", "cryptography",
                 "authentication", "zero-trust", "fuzzing", "reverse-engineering",
                 "malware-analysis", "osint", "network-security",
                 "supply-chain-security", "red-team", "exploit", "cve",
                 "sbom", "sast", "dast", "api-security", "container-security",
                 "cloud-security", "secrets-management", "sca", "vulnerability-management"}:
        return "Security"
    if any(w in text for w in ["security scanner", "vulnerability scan", "pentest",
                                "exploit", " cve ", "malware", "osint tool",
                                "intrusion detection", "threat intel", "sbom", "dast", "sast",
                                "security audit", "reverse engineer", "fuzzer"]):
        return "Security"

    # ── Data Engineering ──────────────────────────────────────────────────────
    if topics & {"data-engineering", "etl", "data-pipeline", "workflow-orchestration",
                 "apache-airflow", "streaming", "kafka", "spark", "data-lake",
                 "dbt", "data-warehouse", "flink", "delta-lake", "trino",
                 "presto", "databricks", "iceberg", "apache-iceberg", "dagster",
                 "data-quality", "great-expectations", "polars", "duckdb",
                 "data-lakehouse", "cdc", "debezium", "data-catalog", "parquet", "arrow"}:
        return "Data Engineering"
    if any(w in text for w in ["data pipeline", "data engineering", "etl pipeline",
                                "workflow orchestrat", "data lakehouse",
                                "streaming pipeline", "batch processing",
                                "data catalog", "data quality", "columnar storage",
                                "query engine", "apache iceberg", "cdc tool"]):
        return "Data Engineering"

    # ── Web Frameworks ─────────────────────────────────────────────────────────
    if topics & {"web-framework", "rest-api", "nodejs", "react", "vuejs", "svelte",
                 "fastapi", "nextjs", "django", "flask", "graphql", "grpc",
                 "microservices", "websocket", "typescript", "angular",
                 "nuxt", "remix", "htmx", "spring-boot", "rails",
                 "astro", "hono", "elysia", "sveltekit", "solid-js", "bun",
                 "deno", "edge-runtime"}:
        return "Web Frameworks"
    if any(w in text for w in ["web framework", "http server", "rest api",
                                "graphql server", "grpc framework",
                                "frontend framework", "backend framework",
                                "full-stack", "fullstack", "metaframework"]):
        return "Web Frameworks"

    # ── DevTools ──────────────────────────────────────────────────────────────
    if topics & {"developer-tools", "cli", "terminal", "code-editor", "productivity",
                 "devtools", "linter", "formatter", "language-server",
                 "vscode-extension", "debugging", "profiler", "neovim",
                 "intellij-plugin", "git", "shell", "zsh", "bash", "tmux",
                 "dotfiles", "headless-browser", "playwright", "puppeteer", "cdp",
                 "wasm", "webassembly", "supabase", "appwrite"}:
        return "DevTools"
    if lang in ("go", "rust", "zig") and any(
        w in text for w in ["cli", "tool", "utility", "command", "plugin",
                             "extension", "linter", "formatter", "debugger"]
    ):
        return "DevTools"
    if any(w in text for w in ["developer tool", "dev tool", "cli tool",
                                "code editor", "text editor", "ide plugin",
                                "lsp server", "language server",
                                "code formatter", "code linter",
                                "terminal emulator", "headless browser"]):
        return "DevTools"

    # ── OSS Tools ─────────────────────────────────────────────────────────────
    if topics & {"build-tool", "bundler", "package-manager", "testing",
                 "infrastructure", "observability", "ci-cd", "automation",
                 "orm", "api-client", "linting", "code-generation",
                 "documentation", "monorepo", "containerization",
                 "kubernetes", "terraform", "ansible", "opentelemetry",
                 "prometheus", "grafana", "docker", "helm", "pulumi",
                 "wasm", "wasi", "serverless", "edge-computing",
                 "nix", "bazel", "vitest", "pnpm", "turborepo", "podman", "github-actions"}:
        return "OSS Tools"
    if any(w in text for w in ["build tool", "build system", "bundler",
                                "package manager", "test framework", "test runner",
                                "monorepo tool", "container orchestrat",
                                "infrastructure as code", "observabilit",
                                "ci/cd", "deployment tool", "orm framework",
                                "opentelemetry", "distributed tracing",
                                "serverless framework", "edge computing"]):
        return "OSS Tools"

    # ── Broader AI / ML (catch-all) ────────────────────────────────────────────
    if topics & {"machine-learning", "deep-learning", "pytorch", "tensorflow",
                 "scikit-learn", "neural-network", "computer-vision", "nlp",
                 "multimodal", "diffusion-model", "huggingface", "rag",
                 "embeddings", "ai", "ml", "synthetic-data", "dataset", 
                 "chatbot", "function-calling", "structured-output", "prompt-engineering"}:
        return "AI / ML"
    if lang in ("python", "jupyter notebook") and any(
        w in text for w in ["neural", "model training", "gradient",
                             "transformer", "attention", "dataset", "train loop"]
    ):
        return "AI / ML"
    if any(w in text for w in ["machine learning", "deep learning", "neural network",
                                "computer vision", "natural language processing",
                                "model training", "dataset", "synthetic data"]):
        return "AI / ML"

    return "AI / ML"
