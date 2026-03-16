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
    # Core AI / ML
    "topic:llm", "topic:machine-learning", "topic:deep-learning",
    "topic:large-language-model", "topic:generative-ai",
    "topic:artificial-intelligence", "topic:neural-network",
    "topic:foundation-model", "topic:causal-lm", "topic:pretrained-model",
    # Agent / Agentic
    "topic:ai-agent", "topic:ai-agents", "topic:autonomous-agents",
    "topic:multi-agent", "topic:llm-agent", "topic:agent-framework",
    "topic:crewai", "topic:langchain", "topic:llamaindex",
    "topic:autogpt", "topic:agentic",
    # Browser / GUI automation
    "topic:browser-automation", "topic:ui-automation", "topic:web-agent",
    "topic:gui-agent", "topic:computer-use", "topic:rpa",
    "topic:desktop-automation", "topic:screen-agent",
    # MCP & tool-use protocols
    "topic:mcp", "topic:model-context-protocol", "topic:function-calling",
    "topic:tool-use", "topic:structured-output", "topic:a2a",
    # Coding assistants
    "topic:coding-assistant", "topic:ai-coding", "topic:copilot",
    "topic:code-generation", "topic:ai-pair-programmer",
    # Inference & serving
    "topic:llm-inference", "topic:llm-serving", "topic:vllm",
    "topic:llama-cpp", "topic:gguf", "topic:tensorrt", "topic:onnxruntime",
    "topic:tgi", "topic:tensorrt-llm", "topic:triton-inference",
    "topic:mlc-llm", "topic:exllama",
    # Local / on-device AI
    "topic:ollama", "topic:local-llm", "topic:on-device-ai",
    "topic:edge-ai", "topic:private-ai",
    # RAG / knowledge
    "topic:rag", "topic:retrieval-augmented-generation", "topic:embeddings",
    "topic:vector-database", "topic:knowledge-graph", "topic:semantic-search",
    "topic:document-qa", "topic:graphrag",
    # Fine-tuning
    "topic:fine-tuning", "topic:lora", "topic:rlhf", "topic:peft",
    "topic:dpo", "topic:qlora", "topic:instruction-tuning", "topic:sft",
    "topic:reward-model", "topic:rlaif",
    # Speech & audio
    "topic:text-to-speech", "topic:tts", "topic:speech-recognition",
    "topic:asr", "topic:voice-cloning", "topic:audio-generation",
    "topic:speech-synthesis", "topic:voice-ai", "topic:whisper",
    "topic:speaker-diarization", "topic:real-time-voice",
    "topic:voice-assistant", "topic:voice-agent",
    # Image / vision
    "topic:text-to-image", "topic:stable-diffusion", "topic:diffusion-model",
    "topic:image-generation", "topic:sdxl", "topic:comfyui",
    "topic:controlnet", "topic:lora-training",
    # Video generation
    "topic:text-to-video", "topic:video-generation", "topic:video-diffusion",
    "topic:video-synthesis",
    # Multimodal / VLM
    "topic:multimodal", "topic:vision-language-model", "topic:vlm",
    "topic:visual-question-answering", "topic:ocr", "topic:document-understanding",
    # Reasoning
    "topic:reasoning", "topic:chain-of-thought", "topic:tree-of-thought",
    "topic:deepseek", "topic:self-consistency",
    # Frameworks
    "topic:transformers", "topic:huggingface", "topic:pytorch",
    "topic:tensorflow", "topic:jax", "topic:computer-vision", "topic:nlp",
    # Evaluation & benchmarks
    "topic:llm-evaluation", "topic:benchmarks", "topic:evals",
    "topic:llm-benchmark", "topic:lm-eval", "topic:helm",
    # AI safety / alignment
    "topic:ai-safety", "topic:alignment", "topic:red-teaming",
    "topic:interpretability", "topic:mechanistic-interpretability",
    "topic:adversarial", "topic:robustness",
    # AI ops / infra
    "topic:mlops", "topic:model-registry", "topic:model-monitoring",
    "topic:feature-store", "topic:experiment-tracking",
    "topic:mlflow", "topic:kubeflow", "topic:bentoml",
    # Distributed compute
    "topic:distributed-training", "topic:deepspeed", "topic:horovod",
    "topic:megatron", "topic:pytorch-lightning", "topic:ray",
    # Prompt engineering
    "topic:prompt-engineering", "topic:prompt-optimization",
    "topic:dspy", "topic:langfuse",
    # Data / synthetic
    "topic:synthetic-data", "topic:dataset", "topic:data-annotation",
    "topic:data-labeling", "topic:rlvr",
    # Chat / assistants
    "topic:chatbot", "topic:openai-api", "topic:anthropic", "topic:gemini",
]

# ─── Consolidated 9 user-facing verticals ─────────────────────────────────────
# Each absorbs multiple reference sub-domains so discovery is comprehensive
# while the UI stays clean. Sub-category inference (_infer_category) remains
# fully granular (30+ tags) regardless of which vertical found the repo.
VERTICAL_TOPIC_QUERIES: dict[str, list[str]] = {

    # ── 1. AI / ML (all sub-domains) ─────────────────────────────────────────
    "ai_ml": AI_TOPIC_QUERIES,

    # ── 2. DevTools (dev tooling + desktop apps) ──────────────────────────────
    "devtools": [
        "topic:developer-tools", "topic:cli", "topic:terminal",
        "topic:code-editor", "topic:productivity", "topic:devtools",
        "topic:linter", "topic:formatter", "topic:language-server",
        "topic:vscode-extension", "topic:debugging", "topic:profiler",
        "topic:neovim", "topic:vim", "topic:shell", "topic:git",
        "topic:github", "topic:git-hooks", "topic:dotfiles",
        "topic:zsh", "topic:bash", "topic:fish", "topic:tmux",
        "topic:alacritty", "topic:wezterm", "topic:kitty",
        "topic:intellij-plugin",
        # Headless browsers & automation
        "topic:headless-browser", "topic:playwright", "topic:puppeteer",
        "topic:cdp", "topic:selenium", "topic:cypress",
        # Modern runtimes
        "topic:bun", "topic:deno", "topic:wasm", "topic:webassembly", "topic:zig",
        # Platform SDKs
        "topic:supabase", "topic:appwrite", "topic:neon",
        # Code search & navigation
        "topic:code-search", "topic:ast", "topic:tree-sitter",
        "topic:ripgrep", "topic:mise", "topic:asdf", "topic:fnm", "topic:nvm",
        # Desktop apps (absorbed from desktop vertical)
        "topic:electron", "topic:tauri", "topic:wails", "topic:gtk",
        "topic:qt", "topic:imgui", "topic:slint", "topic:iced", "topic:egui",
        "topic:window-manager", "topic:compositor", "topic:wayland",
    ],

    # ── 3. Web & Mobile (web frameworks + mobile + networking) ────────────────
    "web_mobile": [
        "topic:web-framework", "topic:rest-api", "topic:nodejs",
        "topic:react", "topic:vuejs", "topic:fastapi", "topic:graphql",
        "topic:grpc", "topic:typescript", "topic:svelte", "topic:nextjs",
        "topic:nuxtjs", "topic:django", "topic:flask", "topic:fastify",
        "topic:expressjs", "topic:microservices", "topic:websocket",
        "topic:ssr", "topic:spa", "topic:pwa",
        # Trending frameworks
        "topic:astro", "topic:htmx", "topic:hono", "topic:elysia",
        "topic:remix", "topic:sveltekit", "topic:solid-js", "topic:bun",
        "topic:deno", "topic:edge-runtime", "topic:spring-boot", "topic:rails",
        "topic:laravel", "topic:phoenix", "topic:elixir", "topic:golang",
        "topic:gin", "topic:echo", "topic:fiber", "topic:actix", "topic:axum",
        "topic:tauri", "topic:wails",
        # Mobile (absorbed from mobile vertical)
        "topic:ios", "topic:android", "topic:react-native", "topic:flutter",
        "topic:swift", "topic:kotlin", "topic:swiftui", "topic:jetpack-compose",
        "topic:expo", "topic:capacitor", "topic:ionic", "topic:mobile",
        "topic:cross-platform", "topic:maui", "topic:app-development",
        # Networking protocols (absorbed from networking vertical)
        "topic:http", "topic:http3", "topic:quic", "topic:tcp",
        "topic:websocket", "topic:dns", "topic:proxy", "topic:nginx",
        "topic:caddy", "topic:traefik", "topic:webrtc", "topic:p2p",
        "topic:mqtt", "topic:libp2p",
    ],

    # ── 4. Data & Infrastructure (data + databases + cloud + observability) ───
    "data_infra": [
        # Data engineering
        "topic:data-engineering", "topic:etl", "topic:data-pipeline",
        "topic:workflow-orchestration", "topic:apache-airflow",
        "topic:streaming", "topic:kafka", "topic:spark", "topic:data-lake",
        "topic:dbt", "topic:data-warehouse", "topic:analytics", "topic:flink",
        "topic:delta-lake", "topic:trino", "topic:presto", "topic:databricks",
        "topic:apache-iceberg", "topic:iceberg", "topic:dagster",
        "topic:data-quality", "topic:great-expectations", "topic:polars",
        "topic:duckdb", "topic:data-lakehouse", "topic:cdc", "topic:debezium",
        "topic:data-catalog", "topic:parquet", "topic:arrow",
        "topic:datafusion", "topic:airbyte", "topic:meltano",
        "topic:metabase", "topic:superset", "topic:data-mesh",
        # Databases (absorbed)
        "topic:database", "topic:sql", "topic:nosql", "topic:postgresql",
        "topic:mysql", "topic:sqlite", "topic:mongodb", "topic:redis",
        "topic:cassandra", "topic:elasticsearch", "topic:opensearch",
        "topic:vector-database", "topic:time-series-database", "topic:influxdb",
        "topic:timescaledb", "topic:clickhouse", "topic:graph-database",
        "topic:neo4j", "topic:knowledge-graph", "topic:cockroachdb", "topic:tidb",
        "topic:neon", "topic:turso", "topic:libsql", "topic:surrealdb",
        "topic:pocketbase", "topic:pgvector", "topic:lancedb",
        "topic:weaviate", "topic:qdrant", "topic:milvus", "topic:chroma",
        # Cloud & infra (absorbed)
        "topic:aws", "topic:gcp", "topic:azure", "topic:cloud-native",
        "topic:kubernetes", "topic:terraform", "topic:serverless",
        "topic:infrastructure-as-code", "topic:service-mesh", "topic:istio",
        "topic:envoy", "topic:distributed-systems", "topic:message-queue",
        "topic:rabbitmq", "topic:nats", "topic:chaos-engineering",
        "topic:platform-engineering", "topic:backstage", "topic:container",
        "topic:docker", "topic:podman", "topic:ebpf", "topic:firecracker",
        "topic:crossplane", "topic:dapr", "topic:temporal",
        "topic:argocd", "topic:fluxcd", "topic:gitops",
        # Observability (absorbed)
        "topic:observability", "topic:monitoring", "topic:logging",
        "topic:tracing", "topic:metrics", "topic:opentelemetry",
        "topic:prometheus", "topic:grafana", "topic:jaeger", "topic:zipkin",
        "topic:tempo", "topic:loki", "topic:sentry", "topic:error-tracking",
        "topic:apm", "topic:profiling", "topic:ebpf", "topic:pyroscope",
        "topic:signoz", "topic:incident-management",
    ],

    # ── 5. Security ──────────────────────────────────────────────────────────
    "security": [
        "topic:security", "topic:cybersecurity", "topic:vulnerability-scanner",
        "topic:penetration-testing", "topic:devsecops", "topic:cryptography",
        "topic:authentication", "topic:authorization", "topic:zero-trust",
        "topic:fuzzing", "topic:reverse-engineering", "topic:malware-analysis",
        "topic:osint", "topic:network-security", "topic:supply-chain-security",
        "topic:red-team", "topic:threat-intelligence", "topic:incident-response",
        "topic:forensics", "topic:exploit", "topic:cve", "topic:honeypot",
        "topic:ids", "topic:ips", "topic:waf",
        "topic:sbom", "topic:sast", "topic:dast", "topic:api-security",
        "topic:container-security", "topic:cloud-security",
        "topic:secrets-management", "topic:sca", "topic:vulnerability-management",
        "topic:sigstore", "topic:cosign", "topic:slsa",
        "topic:identity", "topic:oauth", "topic:jwt",
        "topic:passkey", "topic:webauthn", "topic:privacy",
        "topic:tor", "topic:vpn", "topic:tls", "topic:encryption",
    ],

    # ── 6. OSS Tools & Build Infra ────────────────────────────────────────────
    "oss_tools": [
        "topic:build-tool", "topic:bundler", "topic:package-manager",
        "topic:testing", "topic:infrastructure", "topic:ci-cd",
        "topic:automation", "topic:api-client", "topic:orm", "topic:linting",
        "topic:code-generation", "topic:documentation", "topic:monorepo",
        "topic:containerization", "topic:kubernetes", "topic:helm",
        "topic:terraform", "topic:pulumi", "topic:ansible",
        "topic:opentelemetry", "topic:prometheus", "topic:grafana",
        "topic:alerting",
        "topic:wasm", "topic:wasi", "topic:serverless", "topic:edge-computing",
        "topic:nix", "topic:nixos", "topic:bazel", "topic:vitest",
        "topic:playwright", "topic:pnpm", "topic:turborepo",
        "topic:docker", "topic:podman", "topic:github-actions",
        "topic:gitops", "topic:argocd", "topic:fluxcd",
        "topic:crossplane", "topic:dapr", "topic:temporal",
        "topic:openapi", "topic:swagger", "topic:protobuf",
        "topic:json-schema", "topic:zod",
    ],

    # ── 7. Blockchain & Fintech ───────────────────────────────────────────────
    "blockchain": [
        "topic:blockchain", "topic:ethereum", "topic:smart-contracts",
        "topic:web3", "topic:defi", "topic:solidity", "topic:nft",
        "topic:layer2", "topic:zero-knowledge", "topic:dao", "topic:bitcoin",
        "topic:solana", "topic:cosmos", "topic:cross-chain", "topic:evm",
        "topic:polkadot", "topic:substrate", "topic:near", "topic:avalanche",
        "topic:aptos",
        "topic:account-abstraction", "topic:restaking", "topic:rollup",
        "topic:modular-blockchain", "topic:ton", "topic:sui",
        "topic:move-language", "topic:zk-rollup", "topic:zk-snark",
        "topic:zk-proof", "topic:depin", "topic:eigenlayer", "topic:celestia",
        "topic:starknet", "topic:zksync", "topic:optimism", "topic:arbitrum",
        "topic:base", "topic:erc4337", "topic:dex", "topic:amm",
        "topic:lending", "topic:oracle", "topic:wallet", "topic:rwa",
        # Fintech (absorbed)
        "topic:fintech", "topic:payments", "topic:banking", "topic:open-banking",
        "topic:trading", "topic:algorithmic-trading", "topic:quantitative-finance",
        "topic:risk-management", "topic:portfolio-management",
        "topic:backtesting", "topic:compliance", "topic:personal-finance",
    ],

    # ── 8. Science & Research (health + edu + robotics + embedded) ────────────
    "science": [
        # Health & Bioinformatics
        "topic:bioinformatics", "topic:genomics", "topic:proteomics",
        "topic:sequencing", "topic:drug-discovery", "topic:cheminformatics",
        "topic:protein-structure", "topic:alphafold", "topic:molecular-dynamics",
        "topic:scrnaseq", "topic:single-cell", "topic:medical-imaging",
        "topic:ehr", "topic:fhir", "topic:health-informatics", "topic:neuroscience",
        "topic:brain-computer-interface", "topic:bci",
        # Education & Research Tools
        "topic:education", "topic:e-learning", "topic:jupyter",
        "topic:notebook", "topic:academic", "topic:research",
        "topic:scientific-computing", "topic:scipy", "topic:numpy",
        "topic:matplotlib", "topic:visualization", "topic:data-visualization",
        "topic:d3", "topic:plotly", "topic:latex",
        "topic:knowledge-base", "topic:obsidian", "topic:note-taking",
        "topic:second-brain", "topic:pkm",
        # Robotics (absorbed)
        "topic:robotics", "topic:ros", "topic:ros2", "topic:robot",
        "topic:autonomous-driving", "topic:self-driving", "topic:drone",
        "topic:uav", "topic:slam", "topic:path-planning", "topic:motion-planning",
        "topic:manipulation", "topic:embodied-ai", "topic:robot-learning",
        "topic:sim-to-real", "topic:simulation", "topic:gazebo",
        "topic:mujoco", "topic:isaac", "topic:humanoid", "topic:legged-robots",
        # Embedded & IoT (absorbed)
        "topic:embedded", "topic:rtos", "topic:arduino", "topic:esp32",
        "topic:esp-idf", "topic:zephyr", "topic:freertos",
        "topic:micropython", "topic:circuitpython", "topic:raspberry-pi",
        "topic:fpga", "topic:verilog", "topic:risc-v", "topic:arm",
        "topic:stm32", "topic:firmware", "topic:baremetal",
        "topic:ble", "topic:bluetooth", "topic:iot", "topic:matter",
        "topic:zigbee", "topic:home-automation", "topic:homeassistant",
    ],

    # ── 9. Creative & Gaming (gamedev + creative coding) ──────────────────────
    "creative": [
        # Game Development
        "topic:game-development", "topic:game-engine", "topic:unity",
        "topic:godot", "topic:unreal-engine", "topic:pygame", "topic:bevy",
        "topic:opengl", "topic:vulkan", "topic:webgpu", "topic:wgpu",
        "topic:graphics", "topic:rendering", "topic:ray-tracing", "topic:shader",
        "topic:glsl", "topic:hlsl", "topic:wgsl", "topic:physics-engine",
        "topic:2d-game", "topic:3d-game", "topic:multiplayer",
        "topic:procedural-generation", "topic:ecs", "topic:animation",
        "topic:voxel", "topic:pixel-art", "topic:xr", "topic:ar", "topic:vr",
        "topic:mixed-reality", "topic:webgl", "topic:threejs",
        "topic:babylonjs", "topic:cocos", "topic:phaser",
        # Creative Coding & Generative Art (absorbed)
        "topic:creative-coding", "topic:generative-art", "topic:procedural-art",
        "topic:p5js", "topic:processing", "topic:openframeworks",
        "topic:shader-art", "topic:ray-marching", "topic:fractals",
        "topic:live-coding", "topic:supercollider", "topic:tidal-cycles",
        "topic:music-generation", "topic:midi", "topic:audio-visualization",
        "topic:svg", "topic:canvas", "topic:ascii-art", "topic:demoscene",
        "topic:interactive",
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
        # ── AI/ML sub-categories (most granular) ────────────────────────────
        "LLM Models": [
            "llm", "large-language-model", "language-model", "generative-ai",
            "gpt", "llama", "mistral", "gemini", "claude", "foundation-model",
            "causal-lm", "ollama", "local-llm", "pretrained-model",
            "openai", "deepseek", "qwen", "phi", "falcon",
        ],
        "Agent Frameworks": [
            "ai-agent", "ai-agents", "autonomous-agents", "langchain", "autogpt",
            "llm-agent", "agent-framework", "multi-agent", "crewai",
            "llamaindex", "agentic", "browser-automation", "ui-automation",
            "web-agent", "gui-agent", "computer-use", "a2a", "agent-to-agent",
            "autogen", "metagpt", "desktop-automation", "screen-agent", "rpa",
        ],
        "MCP Tools": [
            "mcp", "model-context-protocol", "mcp-server", "mcp-client",
            "mcp-tool", "mcp-plugin",
        ],
        "Coding Assistants": [
            "coding-assistant", "ai-coding", "copilot", "code-generation",
            "ai-pair-programmer", "code-completion", "cursor", "codeium",
            "tabby", "aider",
        ],
        "Inference Engines": [
            "llm-inference", "inference", "llama-cpp", "vllm", "gguf",
            "tensorrt", "onnxruntime", "triton-inference", "tgi", "tensorrt-llm",
            "mlc-llm", "exllama", "inference-server", "llm-serving",
        ],
        "Vector Databases": [
            "vector-database", "vector-search", "embeddings", "faiss",
            "weaviate", "pinecone", "chroma", "chromadb", "hnswlib",
            "milvus", "qdrant", "annoy", "lancedb", "pgvector", "usearch",
        ],
        "RAG Frameworks": [
            "rag", "retrieval-augmented-generation", "graphrag", "document-qa",
            "semantic-search", "knowledge-retrieval", "hybrid-search",
            "reranking", "haystack", "long-context",
        ],
        "Model Serving / Runtimes": [
            "model-serving", "mlops", "triton", "bentoml", "kubeflow",
            "seldon", "kfserving", "mlflow", "model-registry",
            "torchserve", "ray-serve", "cog",
        ],
        "Distributed Compute / Infra": [
            "distributed-training", "mlops", "ray", "deepspeed",
            "horovod", "megatron", "pytorch-lightning", "accelerate", "colossalai",
        ],
        "Evaluation Frameworks": [
            "llm-evaluation", "benchmarks", "evals", "evaluation",
            "llm-benchmark", "lm-eval", "helm", "mmlu", "humaneval",
            "bigbench", "ragas",
        ],
        "Fine-tuning Toolkits": [
            "fine-tuning", "lora", "rlhf", "instruction-tuning",
            "peft", "sft", "dpo", "qlora", "adapter", "rlvr",
            "rlaif", "reward-model", "unsloth", "axolotl", "trl",
        ],
        "Speech & Audio": [
            "text-to-speech", "tts", "speech-recognition", "asr",
            "voice-cloning", "audio-processing", "speech-synthesis",
            "voice-ai", "whisper", "speaker-diarization", "real-time-voice",
            "voice-assistant", "voice-agent", "audio-generation",
            "music-generation", "bark",
        ],
        "Image Generation": [
            "text-to-image", "stable-diffusion", "diffusion-model",
            "image-generation", "sdxl", "comfyui", "controlnet",
            "lora-training", "image-editing", "inpainting", "flux",
        ],
        "Video Generation": [
            "text-to-video", "video-generation", "video-diffusion",
            "video-synthesis", "animate-diff", "cogvideo",
        ],
        "Multimodal Models": [
            "multimodal", "vision-language-model", "vlm",
            "visual-question-answering", "image-captioning",
            "ocr", "document-understanding", "llava", "qwen-vl",
        ],
        "Reasoning Models": [
            "reasoning", "chain-of-thought", "tree-of-thought",
            "self-consistency", "o1", "mathematical-reasoning",
        ],
        "AI Safety & Alignment": [
            "ai-safety", "alignment", "red-teaming", "interpretability",
            "mechanistic-interpretability", "adversarial", "robustness",
            "watermarking", "constitutional-ai",
        ],
        "Prompt Engineering": [
            "prompt-engineering", "prompt-optimization", "dspy",
            "langfuse", "prompt-tuning", "few-shot", "zero-shot",
        ],
        "Synthetic Data": [
            "synthetic-data", "data-generation", "data-labeling",
            "data-annotation", "dataset", "rlvr",
        ],
        # ── Other verticals ───────────────────────────────────────────────────
        "DevTools": [
            "developer-tools", "cli", "terminal", "code-editor", "productivity",
            "devtools", "linter", "formatter", "language-server",
            "vscode-extension", "debugging", "profiler", "neovim",
            "shell", "git", "intellij-plugin", "tmux", "dotfiles",
            "headless-browser", "playwright", "puppeteer", "cdp",
            "bun", "deno", "wasm", "webassembly", "supabase", "appwrite",
            "tree-sitter", "ripgrep", "mise", "fnm",
            "electron", "tauri", "wails", "window-manager",
        ],
        "Web & Mobile": [
            "web-framework", "rest-api", "nodejs", "react", "vuejs", "svelte",
            "fastapi", "nextjs", "django", "flask", "graphql", "grpc",
            "microservices", "websocket", "typescript", "angular", "nuxt",
            "spring-boot", "rails", "laravel", "phoenix",
            "astro", "htmx", "hono", "elysia", "remix", "sveltekit",
            "solid-js", "bun", "deno", "edge-runtime", "actix", "axum",
            "gin", "echo", "fiber",
            "ios", "android", "react-native", "flutter", "swift",
            "kotlin", "swiftui", "jetpack-compose", "expo", "mobile",
            "http", "http3", "quic", "webrtc", "mqtt", "proxy", "dns",
        ],
        "Security": [
            "security", "cybersecurity", "vulnerability-scanner",
            "penetration-testing", "devsecops", "cryptography",
            "authentication", "zero-trust", "fuzzing", "reverse-engineering",
            "malware-analysis", "osint", "network-security",
            "supply-chain-security", "red-team", "exploit", "cve",
            "sbom", "sast", "dast", "api-security", "container-security",
            "cloud-security", "secrets-management", "sca",
            "vulnerability-management", "sigstore", "slsa",
            "passkey", "webauthn", "identity",
        ],
        "Data & Infrastructure": [
            "data-engineering", "etl", "data-pipeline", "workflow-orchestration",
            "apache-airflow", "streaming", "kafka", "spark", "data-lake",
            "dbt", "data-warehouse", "flink", "delta-lake", "trino",
            "apache-iceberg", "iceberg", "dagster", "data-quality",
            "polars", "duckdb", "data-lakehouse", "cdc", "debezium",
            "data-catalog", "parquet", "arrow", "datafusion", "airbyte",
            "database", "sql", "nosql", "postgresql", "mysql", "mongodb",
            "redis", "elasticsearch", "clickhouse", "vector-database",
            "time-series-database", "graph-database", "neo4j",
            "cockroachdb", "surrealdb", "pgvector", "lancedb", "chroma",
            "aws", "gcp", "azure", "cloud-native", "kubernetes", "terraform",
            "serverless", "service-mesh", "istio", "ebpf", "argocd",
            "observability", "monitoring", "opentelemetry", "prometheus",
            "grafana", "sentry", "apm",
        ],
        "Blockchain": [
            "blockchain", "ethereum", "smart-contracts", "web3", "defi",
            "solidity", "nft", "layer2", "zero-knowledge", "dao",
            "bitcoin", "solana", "cosmos", "cross-chain", "evm",
            "account-abstraction", "restaking", "rollup",
            "modular-blockchain", "ton", "sui", "move-language",
            "zk-rollup", "zk-snark", "depin", "rwa",
        ],
        "Fintech": [
            "fintech", "payments", "banking", "open-banking",
            "trading", "algorithmic-trading", "quantitative-finance",
            "risk-management", "portfolio-management", "backtesting",
        ],
        "OSS Tools": [
            "build-tool", "bundler", "package-manager", "testing",
            "infrastructure", "ci-cd", "automation",
            "orm", "api-client", "linting", "code-generation",
            "documentation", "monorepo", "containerization",
            "kubernetes", "terraform", "ansible", "opentelemetry",
            "prometheus", "grafana", "helm", "wasm", "wasi",
            "serverless", "edge-computing", "nix", "bazel",
            "vitest", "playwright", "pnpm", "turborepo",
            "docker", "podman", "github-actions", "argocd",
        ],
        "Science & Research": [
            "bioinformatics", "genomics", "proteomics", "drug-discovery",
            "protein-structure", "alphafold", "single-cell", "medical-imaging",
            "ehr", "fhir", "neuroscience",
            "education", "e-learning", "jupyter", "scientific-computing",
            "robotics", "ros", "ros2", "autonomous-driving", "drone",
            "slam", "embodied-ai", "robot-learning", "mujoco", "humanoid",
            "embedded", "rtos", "arduino", "esp32", "raspberry-pi",
            "fpga", "risc-v", "iot", "home-automation",
        ],
        "Creative & Gaming": [
            "game-development", "game-engine", "unity", "godot",
            "bevy", "opengl", "vulkan", "webgpu", "graphics", "rendering",
            "shader", "glsl", "physics-engine", "threejs", "webgl",
            "creative-coding", "generative-art", "p5js", "processing",
            "music-generation", "midi", "audio-visualization",
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
        "license":               (repo.get("license") or {}).get("spdx_id", ""),
        "homepage":              repo.get("homepage") or "",
        "is_fork":               repo.get("fork", False),
        "archived":              repo.get("archived", False),
        # Trending-only: raw gain label e.g. "1,234 stars today"
        "star_gain_label":       repo.get("_star_gain_str", ""),
    }


# ─── Star-threshold broad discovery ─────────────────────────────────────────
# These queries catch popular repos that may never appear on GitHub Trending
# (older, stable libraries) but are widely used in the ecosystem.

STAR_THRESHOLD_TOPICS: dict[str, list[tuple[str, int]]] = {
    # (topic_query, min_stars).  Floors are intentionally modest so well-established
    # but niche tools aren't excluded.
    "ai_ml": [
        ("topic:machine-learning",       300),
        ("topic:deep-learning",          300),
        ("topic:llm",                    200),
        ("topic:generative-ai",          200),
        ("topic:transformers",           300),
        ("topic:diffusion-model",        200),
        ("topic:computer-vision",        300),
        ("topic:nlp",                    300),
        ("topic:rag",                    100),
        ("topic:embeddings",             200),
        ("topic:ai-agent",               100),
        ("topic:ai-agents",              100),
        ("topic:browser-automation",     100),
        ("topic:ui-automation",          100),
        ("topic:web-agent",              100),
        ("topic:gui-agent",              100),
        ("topic:computer-use",           100),
        ("topic:huggingface",            200),
        ("topic:mcp",                    100),
        ("topic:model-context-protocol", 100),
        ("topic:coding-assistant",       100),
        ("topic:ai-coding",              100),
        ("topic:ollama",                 200),
        ("topic:local-llm",              100),
        ("topic:text-to-speech",         200),
        ("topic:tts",                    200),
        ("topic:speech-recognition",     200),
        ("topic:text-to-image",          200),
        ("topic:stable-diffusion",       200),
        ("topic:vision-language-model",  100),
        ("topic:synthetic-data",         100),
        ("topic:chatbot",                200),
        ("topic:function-calling",       100),
        ("topic:prompt-engineering",     100),
        ("topic:fine-tuning",            200),
        ("topic:lora",                   200),
        ("topic:rlhf",                   100),
        ("topic:peft",                   100),
        ("topic:llm-inference",          100),
        ("topic:vllm",                   100),
        ("topic:text-to-video",          100),
        ("topic:video-generation",       100),
        ("topic:multimodal",             200),
        ("topic:vlm",                    100),
        ("topic:reasoning",              100),
        ("topic:ai-safety",              100),
        ("topic:interpretability",       100),
        ("topic:dspy",                   100),
        ("topic:voice-agent",            100),
        ("topic:voice-assistant",        100),
        ("topic:real-time-voice",        100),
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
        ("topic:headless-browser",  100),
        ("topic:playwright",        200),
        ("topic:puppeteer",         200),
        ("topic:cdp",               100),
        ("topic:bun",               200),
        ("topic:deno",              200),
        ("topic:wasm",              200),
        ("topic:supabase",          200),
        ("topic:tree-sitter",       100),
        ("topic:ripgrep",           100),
        ("topic:mise",               50),
        ("topic:fnm",                50),
        ("topic:electron",          200),
        ("topic:tauri",             100),
        ("topic:window-manager",     50),
    ],
    "web_mobile": [
        ("topic:web-framework",   300),
        ("topic:rest-api",        300),
        ("topic:graphql",         200),
        ("topic:grpc",            200),
        ("topic:typescript",      300),
        ("topic:microservices",   200),
        ("topic:websocket",       200),
        ("topic:astro",           200),
        ("topic:htmx",            100),
        ("topic:hono",            100),
        ("topic:elysia",          100),
        ("topic:remix",           200),
        ("topic:sveltekit",       100),
        ("topic:solid-js",        100),
        ("topic:edge-runtime",    100),
        ("topic:actix",           100),
        ("topic:axum",            100),
        ("topic:gin",             200),
        ("topic:fiber",           100),
        ("topic:flutter",         300),
        ("topic:react-native",    300),
        ("topic:ios",             200),
        ("topic:android",         200),
        ("topic:swiftui",         200),
        ("topic:jetpack-compose", 100),
        ("topic:expo",            200),
    ],
    "data_infra": [
        ("topic:data-engineering",   200),
        ("topic:etl",                200),
        ("topic:data-pipeline",      200),
        ("topic:kafka",              300),
        ("topic:spark",              300),
        ("topic:dbt",                200),
        ("topic:data-warehouse",     200),
        ("topic:flink",              300),
        ("topic:trino",              200),
        ("topic:apache-iceberg",     200),
        ("topic:dagster",            200),
        ("topic:polars",             200),
        ("topic:duckdb",             200),
        ("topic:data-quality",       100),
        ("topic:data-lakehouse",     100),
        ("topic:cdc",                100),
        ("topic:parquet",            200),
        ("topic:arrow",              200),
        ("topic:airbyte",            100),
        ("topic:postgresql",         300),
        ("topic:redis",              300),
        ("topic:mongodb",            200),
        ("topic:elasticsearch",      300),
        ("topic:clickhouse",         200),
        ("topic:vector-database",    100),
        ("topic:graph-database",     100),
        ("topic:cockroachdb",        200),
        ("topic:surrealdb",          100),
        ("topic:pgvector",           100),
        ("topic:qdrant",             100),
        ("topic:weaviate",           100),
        ("topic:milvus",             100),
        ("topic:chroma",             100),
        ("topic:kubernetes",         300),
        ("topic:terraform",          200),
        ("topic:aws",                200),
        ("topic:cloud-native",       200),
        ("topic:service-mesh",       100),
        ("topic:istio",              200),
        ("topic:ebpf",               100),
        ("topic:opentelemetry",      100),
        ("topic:prometheus",         300),
        ("topic:grafana",            300),
        ("topic:argocd",             200),
        ("topic:sentry",             200),
        ("topic:pyroscope",          100),
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
        ("topic:sbom",                    100),
        ("topic:sast",                    100),
        ("topic:dast",                    100),
        ("topic:container-security",      100),
        ("topic:cloud-security",          100),
        ("topic:api-security",            100),
        ("topic:secrets-management",      100),
        ("topic:sigstore",                100),
        ("topic:slsa",                    100),
        ("topic:passkey",                  50),
        ("topic:webauthn",                100),
    ],
    "oss_tools": [
        ("topic:build-tool",         200),
        ("topic:bundler",            200),
        ("topic:package-manager",    200),
        ("topic:testing",            300),
        ("topic:ci-cd",              200),
        ("topic:infrastructure",     300),
        ("topic:automation",         200),
        ("topic:orm",                200),
        ("topic:api-client",         100),
        ("topic:monorepo",           100),
        ("topic:kubernetes",         300),
        ("topic:terraform",          200),
        ("topic:opentelemetry",      100),
        ("topic:wasm",               200),
        ("topic:wasi",               100),
        ("topic:serverless",         200),
        ("topic:edge-computing",     100),
        ("topic:docker",             300),
        ("topic:github-actions",     200),
        ("topic:nix",                100),
        ("topic:bazel",              200),
        ("topic:vitest",             100),
        ("topic:playwright",         200),
        ("topic:turborepo",          100),
        ("topic:argocd",             100),
        ("topic:temporal",           100),
        ("topic:dapr",               100),
    ],
    "blockchain": [
        ("topic:blockchain",           200),
        ("topic:ethereum",             200),
        ("topic:smart-contracts",      200),
        ("topic:web3",                 200),
        ("topic:defi",                 200),
        ("topic:solidity",             100),
        ("topic:layer2",               100),
        ("topic:zero-knowledge",       100),
        ("topic:dao",                  100),
        ("topic:solana",               200),
        ("topic:account-abstraction",  100),
        ("topic:restaking",            100),
        ("topic:rollup",               100),
        ("topic:zk-rollup",            100),
        ("topic:ton",                  100),
        ("topic:sui",                  100),
        ("topic:depin",                100),
        ("topic:rwa",                   50),
        ("topic:starknet",              50),
        ("topic:zksync",                50),
        ("topic:fintech",              100),
        ("topic:payments",             100),
        ("topic:trading",              100),
        ("topic:algorithmic-trading",  100),
    ],
    "science": [
        ("topic:robotics",             200),
        ("topic:ros",                  200),
        ("topic:ros2",                 200),
        ("topic:autonomous-driving",   100),
        ("topic:drone",                100),
        ("topic:slam",                 100),
        ("topic:embodied-ai",           50),
        ("topic:robot-learning",        50),
        ("topic:simulation",           100),
        ("topic:mujoco",               100),
        ("topic:humanoid",              50),
        ("topic:iot",                  200),
        ("topic:arduino",              200),
        ("topic:raspberry-pi",         200),
        ("topic:esp32",                100),
        ("topic:home-automation",      100),
        ("topic:homeassistant",        200),
        ("topic:risc-v",               100),
        ("topic:bioinformatics",       200),
        ("topic:genomics",             100),
        ("topic:drug-discovery",        50),
        ("topic:alphafold",            100),
        ("topic:jupyter",              300),
        ("topic:scientific-computing", 100),
        ("topic:scipy",                100),
    ],
    "creative": [
        ("topic:game-engine",           200),
        ("topic:godot",                 200),
        ("topic:bevy",                  100),
        ("topic:webgpu",                100),
        ("topic:wgpu",                  100),
        ("topic:vulkan",                200),
        ("topic:opengl",                200),
        ("topic:shader",                100),
        ("topic:glsl",                  100),
        ("topic:physics-engine",        100),
        ("topic:multiplayer",           100),
        ("topic:ecs",                   100),
        ("topic:threejs",               300),
        ("topic:webgl",                 200),
        ("topic:creative-coding",       100),
        ("topic:generative-art",        100),
        ("topic:p5js",                  100),
        ("topic:processing",            200),
        ("topic:music-generation",      100),
        ("topic:midi",                  100),
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
    (keyword fallback). Language is used as a tie-breaker / secondary signal.
    """
    topics = set(repo.get("topics", []))
    name   = (repo.get("name")        or "").lower()
    desc   = (repo.get("description") or "").lower()
    lang   = (repo.get("language")    or "").lower()
    text   = name + " " + desc

    # ── MCP Tools ─────────────────────────────────────────────────────────────
    if topics & {"mcp", "model-context-protocol", "mcp-server", "mcp-client",
                 "mcp-tool", "mcp-plugin"}:
        return "MCP Tools"
    if any(w in text for w in ["model context protocol", "mcp server", "mcp client",
                                "mcp plugin", "mcp tool"]):
        return "MCP Tools"

    # ── Speech & Audio ────────────────────────────────────────────────────────
    if topics & {"text-to-speech", "tts", "speech-recognition", "asr",
                 "voice-cloning", "audio-processing", "speech-synthesis",
                 "voice-ai", "whisper", "speaker-diarization", "real-time-voice",
                 "voice-assistant", "voice-agent", "audio-generation"}:
        return "Speech & Audio"
    if any(w in text for w in ["text to speech", "speech to text", "voice cloning",
                                "audio generation", "voice assistant", "voice agent",
                                "real-time voice", "speaker diarization"]):
        return "Speech & Audio"

    # ── Vector Databases ──────────────────────────────────────────────────────
    if topics & {"vector-database", "vector-search", "faiss", "weaviate", "pinecone",
                 "chroma", "chromadb", "hnswlib", "milvus", "qdrant", "annoy",
                 "lancedb", "pgvector", "usearch"}:
        return "Vector Databases"
    if any(w in text for w in ["vector database", "vector store", "vector search",
                                "embedding store", "similarity search"]):
        return "Vector Databases"

    # ── RAG Frameworks ────────────────────────────────────────────────────────
    if topics & {"rag", "retrieval-augmented-generation", "graphrag", "document-qa",
                 "knowledge-retrieval", "hybrid-search", "reranking", "haystack"}:
        return "RAG Frameworks"
    if any(w in text for w in ["retrieval augmented", "rag pipeline", "rag framework",
                                "document qa", "knowledge retrieval", "graphrag"]):
        return "RAG Frameworks"

    # ── Agent Frameworks ──────────────────────────────────────────────────────
    if topics & {"ai-agent", "ai-agents", "autonomous-agents", "autogpt", "langchain",
                 "llm-agent", "agent-framework", "multi-agent", "crewai", "llamaindex",
                 "agentic", "browser-automation", "ui-automation", "web-agent",
                 "gui-agent", "computer-use", "a2a", "agent-to-agent",
                 "autogen", "metagpt", "desktop-automation", "screen-agent"}:
        return "Agent Frameworks"
    if any(w in text for w in ["agent framework", "autonomous agent", "multi-agent",
                                "llm agent", "ai agent", "browser agent", "gui agent",
                                "web agent", "browser automation", "ui automation",
                                "computer use", "page agent", "screen agent",
                                "desktop automation"]):
        return "Agent Frameworks"

    # ── Coding Assistants ─────────────────────────────────────────────────────
    if topics & {"coding-assistant", "ai-coding", "copilot", "code-generation",
                 "ai-pair-programmer", "code-completion", "cursor", "codeium",
                 "tabby", "aider"}:
        return "Coding Assistants"
    if any(w in text for w in ["coding assistant", "ai coding", "code completion",
                                "ai pair programmer", "code autocomplete"]):
        return "Coding Assistants"

    # ── Video Generation ──────────────────────────────────────────────────────
    if topics & {"text-to-video", "video-generation", "video-diffusion",
                 "video-synthesis", "animate-diff", "cogvideo"}:
        return "Video Generation"
    if any(w in text for w in ["text to video", "video generation", "video diffusion",
                                "video synthesis"]):
        return "Video Generation"

    # ── Image Generation ──────────────────────────────────────────────────────
    if topics & {"text-to-image", "stable-diffusion", "diffusion-model",
                 "image-generation", "sdxl", "comfyui", "controlnet",
                 "lora-training", "flux"}:
        return "Image Generation"
    if any(w in text for w in ["text to image", "image generation", "stable diffusion",
                                "diffusion model", "comfyui workflow"]):
        return "Image Generation"

    # ── Multimodal Models ─────────────────────────────────────────────────────
    if topics & {"multimodal", "vision-language-model", "vlm",
                 "visual-question-answering", "image-captioning",
                 "ocr", "document-understanding", "llava", "qwen-vl"}:
        return "Multimodal Models"
    if any(w in text for w in ["vision language model", "multimodal model", "vlm",
                                "visual question answering", "document understanding"]):
        return "Multimodal Models"

    # ── Reasoning Models ──────────────────────────────────────────────────────
    if topics & {"reasoning", "chain-of-thought", "tree-of-thought",
                 "self-consistency", "o1", "mathematical-reasoning"}:
        return "Reasoning Models"
    if any(w in text for w in ["chain of thought", "tree of thought", "reasoning model",
                                "mathematical reasoning", "step-by-step reasoning"]):
        return "Reasoning Models"

    # ── Inference Engines ─────────────────────────────────────────────────────
    if topics & {"llm-inference", "vllm", "llama-cpp", "gguf", "tensorrt",
                 "onnxruntime", "triton-inference", "tgi", "tensorrt-llm",
                 "mlc-llm", "exllama", "llm-serving"}:
        return "Inference Engines"
    if any(w in text for w in ["llm inference", "llm serving", "model inference",
                                "inference server", "inference engine", "gguf"]):
        return "Inference Engines"

    # ── Fine-tuning Toolkits ──────────────────────────────────────────────────
    if topics & {"fine-tuning", "lora", "rlhf", "instruction-tuning", "peft",
                 "sft", "dpo", "qlora", "adapter", "rlvr", "rlaif", "reward-model",
                 "unsloth", "axolotl", "trl"}:
        return "Fine-tuning Toolkits"
    if any(w in text for w in ["fine-tun", "finetun", "lora ", "rlhf",
                                "instruction tun", "parameter-efficient", "dpo training",
                                "reward model", "rlvr"]):
        return "Fine-tuning Toolkits"

    # ── AI Safety & Alignment ─────────────────────────────────────────────────
    if topics & {"ai-safety", "alignment", "red-teaming", "interpretability",
                 "mechanistic-interpretability", "adversarial", "robustness",
                 "watermarking", "constitutional-ai"}:
        return "AI Safety & Alignment"
    if any(w in text for w in ["ai safety", "ai alignment", "mechanistic interpretability",
                                "adversarial robustness", "red teaming", "watermark"]):
        return "AI Safety & Alignment"

    # ── Prompt Engineering ────────────────────────────────────────────────────
    if topics & {"prompt-engineering", "prompt-optimization", "dspy",
                 "langfuse", "prompt-tuning"}:
        return "Prompt Engineering"
    if any(w in text for w in ["prompt engineering", "prompt optimization",
                                "prompt template", "meta-prompt", "few-shot prompting"]):
        return "Prompt Engineering"

    # ── Evaluation Frameworks ─────────────────────────────────────────────────
    if topics & {"llm-evaluation", "benchmarks", "evals", "evaluation",
                 "llm-benchmark", "lm-eval", "helm", "mmlu", "humaneval",
                 "bigbench", "ragas"}:
        return "Evaluation Frameworks"
    if any(w in text for w in ["llm evaluation", "model evaluation", "benchmark suite",
                                "eval framework", "evals platform"]):
        return "Evaluation Frameworks"

    # ── Model Serving / Runtimes ──────────────────────────────────────────────
    if topics & {"model-serving", "mlops", "kubeflow", "bentoml", "seldon",
                 "kfserving", "mlflow", "model-registry", "torchserve",
                 "ray-serve", "cog"}:
        return "Model Serving / Runtimes"
    if any(w in text for w in ["model serving", "model deployment", "ml pipeline",
                                "mlops platform"]):
        return "Model Serving / Runtimes"

    # ── Distributed Compute / Infra ───────────────────────────────────────────
    if topics & {"distributed-training", "horovod", "deepspeed", "megatron",
                 "ray-train", "pytorch-lightning", "accelerate", "colossalai"}:
        return "Distributed Compute / Infra"
    if any(w in text for w in ["distributed training", "model parallelism",
                                "tensor parallelism", "data parallel"]):
        return "Distributed Compute / Infra"

    # ── Synthetic Data ────────────────────────────────────────────────────────
    if topics & {"synthetic-data", "data-generation", "data-labeling", "data-annotation",
                 "rlvr"}:
        return "Synthetic Data"
    if any(w in text for w in ["synthetic data", "data generation", "data labeling",
                                "data annotation", "rlvr"]):
        return "Synthetic Data"

    # ── LLM Models (catch-all for general LLM repos) ─────────────────────────
    if topics & {"llm", "large-language-model", "language-model", "gpt", "llama",
                 "generative-ai", "foundation-model", "causal-lm",
                 "mistral", "gemini", "claude", "ollama", "local-llm",
                 "deepseek", "qwen", "chatbot", "openai-api", "anthropic"}:
        return "LLM Models"

    # ── Creative & Gaming ─────────────────────────────────────────────────────
    if topics & {"game-development", "game-engine", "unity", "godot", "unreal-engine",
                 "pygame", "bevy", "opengl", "vulkan", "webgpu", "wgpu",
                 "graphics", "rendering", "ray-tracing", "shader", "glsl",
                 "physics-engine", "ecs", "threejs", "webgl",
                 "creative-coding", "generative-art", "procedural-art",
                 "p5js", "processing", "shader-art", "fractals", "live-coding",
                 "music-generation", "midi", "audio-visualization"}:
        return "Creative & Gaming"
    if lang in ("hlsl", "glsl", "wgsl") or any(
        w in text for w in ["game engine", "game development", "shader",
                             "rendering engine", "creative coding", "generative art",
                             "procedural art", "game jam"]):
        return "Creative & Gaming"

    # ── Blockchain / Web3 ─────────────────────────────────────────────────────
    if topics & {"blockchain", "ethereum", "smart-contracts", "web3", "defi",
                 "solidity", "nft", "layer2", "zero-knowledge", "dao",
                 "bitcoin", "solana", "cosmos", "cross-chain", "evm", "substrate",
                 "account-abstraction", "restaking", "rollup", "modular-blockchain",
                 "ton", "sui", "move-language", "zk-rollup", "zk-snark", "depin",
                 "rwa", "starknet", "zksync", "optimism", "arbitrum"}:
        return "Blockchain"
    if lang in ("solidity", "vyper", "move"):
        return "Blockchain"
    if any(w in text for w in ["blockchain", "ethereum", "smart contract", "solidity",
                                "bitcoin", "defi protocol", "web3", "nft minting",
                                "zero-knowledge proof", "layer 2", " l2 "]):
        return "Blockchain"

    # ── Fintech ───────────────────────────────────────────────────────────────
    if topics & {"fintech", "payments", "banking", "open-banking",
                 "trading", "algorithmic-trading", "quantitative-finance",
                 "risk-management", "portfolio-management", "backtesting"}:
        return "Fintech"
    if any(w in text for w in ["trading strategy", "algorithmic trading", "quant finance",
                                "portfolio management", "risk model", "backtesting",
                                "payments api", "open banking"]):
        return "Fintech"

    # ── Security ──────────────────────────────────────────────────────────────
    if topics & {"security", "cybersecurity", "vulnerability-scanner",
                 "penetration-testing", "devsecops", "cryptography",
                 "authentication", "zero-trust", "fuzzing", "reverse-engineering",
                 "malware-analysis", "osint", "network-security",
                 "supply-chain-security", "red-team", "exploit", "cve",
                 "sbom", "sast", "dast", "api-security", "container-security",
                 "cloud-security", "secrets-management", "sca",
                 "vulnerability-management", "sigstore", "slsa",
                 "passkey", "webauthn", "identity"}:
        return "Security"
    if any(w in text for w in ["security scanner", "vulnerability scan", "pentest",
                                "exploit", " cve ", "malware", "osint tool",
                                "intrusion detection", "threat intel", "sbom", "dast",
                                "sast", "security audit", "reverse engineer", "fuzzer",
                                "passkey", "webauthn", "sigstore"]):
        return "Security"

    # ── Observability / Monitoring (Data & Infra sub-domain) ──────────────────
    if topics & {"observability", "monitoring", "logging", "tracing", "metrics",
                 "opentelemetry", "prometheus", "grafana", "jaeger", "zipkin",
                 "tempo", "loki", "sentry", "apm", "pyroscope", "signoz"}:
        return "Data & Infrastructure"
    if any(w in text for w in ["observability platform", "distributed tracing",
                                "metrics collection", "log aggregation"]):
        return "Data & Infrastructure"

    # ── Data & Infrastructure (databases + cloud + data eng) ──────────────────
    if topics & {"data-engineering", "etl", "data-pipeline", "workflow-orchestration",
                 "apache-airflow", "streaming", "kafka", "spark", "data-lake",
                 "dbt", "data-warehouse", "flink", "delta-lake", "trino",
                 "apache-iceberg", "dagster", "polars", "duckdb", "data-lakehouse",
                 "cdc", "debezium", "parquet", "arrow", "airbyte",
                 "database", "sql", "nosql", "postgresql", "mysql", "mongodb",
                 "redis", "elasticsearch", "clickhouse", "vector-database",
                 "time-series-database", "graph-database", "neo4j",
                 "cockroachdb", "surrealdb", "pgvector", "lancedb", "milvus",
                 "aws", "gcp", "azure", "cloud-native", "kubernetes", "terraform",
                 "serverless", "service-mesh", "istio", "ebpf", "argocd",
                 "gitops", "platform-engineering", "backstage", "crossplane"}:
        return "Data & Infrastructure"
    if any(w in text for w in ["data pipeline", "etl pipeline", "data lakehouse",
                                "stream processing", "workflow orchestration",
                                "time series", "graph database", "kubernetes cluster",
                                "cloud infrastructure", "infrastructure as code",
                                "data warehouse", "data engineering"]):
        return "Data & Infrastructure"

    # ── Science & Research ────────────────────────────────────────────────────
    if topics & {"bioinformatics", "genomics", "proteomics", "drug-discovery",
                 "protein-structure", "alphafold", "single-cell", "medical-imaging",
                 "ehr", "fhir", "neuroscience", "bci",
                 "education", "e-learning", "jupyter", "scientific-computing",
                 "robotics", "ros", "ros2", "autonomous-driving", "drone", "uav",
                 "slam", "embodied-ai", "robot-learning", "simulation",
                 "mujoco", "gazebo", "humanoid", "legged-robots",
                 "embedded", "rtos", "arduino", "esp32", "esp-idf", "zephyr",
                 "freertos", "micropython", "raspberry-pi", "fpga", "verilog",
                 "risc-v", "stm32", "firmware", "ble", "iot", "matter",
                 "zigbee", "home-automation", "homeassistant"}:
        return "Science & Research"
    if lang in ("verilog", "vhdl", "systemverilog"):
        return "Science & Research"
    if any(w in text for w in ["bioinformatics", "genomics", "drug discovery",
                                "protein structure", "medical imaging", "healthcare",
                                "robotics framework", "ros2", "autonomous robot",
                                "embedded system", "microcontroller", "rtos",
                                "home automation", "iot platform", "fpga design"]):
        return "Science & Research"

    # ── Web & Mobile ──────────────────────────────────────────────────────────
    if topics & {"ios", "android", "react-native", "flutter", "swift", "kotlin",
                 "swiftui", "jetpack-compose", "expo", "capacitor", "ionic", "mobile",
                 "cross-platform", "maui"}:
        return "Web & Mobile"
    if lang in ("swift", "kotlin", "dart"):
        return "Web & Mobile"
    if topics & {"web-framework", "rest-api", "nodejs", "react", "vuejs", "fastapi",
                 "graphql", "grpc", "typescript", "svelte", "nextjs", "django",
                 "flask", "microservices", "websocket", "astro", "htmx", "hono",
                 "elysia", "remix", "sveltekit", "solid-js", "edge-runtime",
                 "spring-boot", "rails", "laravel", "phoenix",
                 "actix", "axum", "gin", "echo", "fiber"}:
        return "Web & Mobile"
    if any(w in text for w in ["mobile app", "ios app", "android app", "flutter app",
                                "react native", "cross-platform app",
                                "web framework", "rest api", "api server",
                                "http server", "web server"]):
        return "Web & Mobile"

    # ── DevTools ──────────────────────────────────────────────────────────────
    if topics & {"developer-tools", "cli", "terminal", "code-editor", "productivity",
                 "devtools", "linter", "formatter", "language-server", "vscode-extension",
                 "debugging", "profiler", "neovim", "vim", "shell", "git",
                 "intellij-plugin", "tmux", "dotfiles", "zsh", "bash", "fish",
                 "headless-browser", "playwright", "puppeteer", "cdp", "selenium",
                 "bun", "deno", "wasm", "webassembly", "supabase", "appwrite",
                 "tree-sitter", "ripgrep", "mise", "fnm", "nvm", "asdf",
                 "electron", "tauri", "wails", "gtk", "qt", "window-manager",
                 "compositor", "wayland"}:
        return "DevTools"
    if any(w in text for w in ["developer tool", "cli tool", "command line",
                                "code editor", "language server", "vscode extension",
                                "neovim plugin", "terminal emulator", "shell script",
                                "git tool", "debugging tool", "profiler",
                                "headless browser", "browser automation",
                                "desktop app", "window manager"]):
        return "DevTools"

    # ── Creative & Gaming (secondary fallback) ────────────────────────────────
    if any(w in text for w in ["game development", "game engine", "rendering",
                                "pixel art", "generative art", "creative coding",
                                "procedural generation"]):
        return "Creative & Gaming"

    # ── OSS Tools (build / ci / infra tooling) ────────────────────────────────
    if topics & {"build-tool", "bundler", "package-manager", "testing", "ci-cd",
                 "automation", "monorepo", "containerization", "helm", "pulumi",
                 "ansible", "nix", "nixos", "bazel", "vitest", "pnpm",
                 "turborepo", "docker", "podman", "github-actions",
                 "openapi", "swagger", "protobuf", "zod"}:
        return "OSS Tools"
    if any(w in text for w in ["build system", "package manager", "ci pipeline",
                                "test runner", "containerization", "infrastructure tool",
                                "automation tool", "bundler", "monorepo tool"]):
        return "OSS Tools"

    # ── Broader AI / ML (catch-all) ───────────────────────────────────────────
    if topics & {"machine-learning", "deep-learning", "pytorch", "tensorflow",
                 "jax", "scikit-learn", "neural-network", "computer-vision",
                 "nlp", "huggingface", "ai", "ml",
                 "function-calling", "structured-output",
                 "artificial-intelligence"}:
        return "AI / ML"
    if lang in ("python", "jupyter notebook") and any(
        w in text for w in ["neural", "model training", "gradient",
                             "transformer", "attention", "dataset", "train loop",
                             "language model"]):
        return "AI / ML"
    if any(w in text for w in ["machine learning", "deep learning", "neural network",
                                "computer vision", "natural language processing",
                                "model training", "dataset", "synthetic data",
                                "foundation model", "large language"]):
        return "AI / ML"

    return "AI / ML"
