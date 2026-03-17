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


import json
import groq

async def _dynamic_topics(category: str, limit: int = 15) -> list[str]:
    """Dynamically generate GitHub topics for a given vertical or category using an LLM."""
    if not category or category.lower() == "all":
        category = "artificial intelligence and machine learning"
    
    prompt = f"""
    You are an expert GitHub researcher. The user wants to discover trending GitHub repositories related to: "{category}"
    
    List the top {limit} most exact, high-volume GitHub topic tags (the ones you see in github.com/topics) for this category.
    Only return authentic GitHub topics.
    
    Format: Return a JSON object with a single key "topics" containing a list of strings.
    Topic strings must be exact GitHub tag format (e.g. "machine-learning" not "Machine Learning", lowercase, hyphens).
    Do NOT include the "topic:" prefix in your JSON array, just the raw tag name.
    """
    
    try:
        client = groq.AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
        completion = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(completion.choices[0].message.content)
        tags = data.get("topics", [])
        return [f"topic:{t}" for t in tags[:limit]]
    except Exception as e:
        logger.error(f"Failed to dynamically generate topics for {category}: {e}")
        return [f"topic:{category.lower().replace(' ', '-')}"]

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
    target_topic = category_filter if category_filter else vertical
    topics = await _dynamic_topics(target_topic, limit=20)

    # Only use GitHub Trending for the AI/ML vertical on short periods
    if period in TRENDING_SINCE and vertical == "ai_ml":
        results = await _fetch_trending(period, limit=limit)
    else:
        results = await _fetch_search(period, limit=limit, topics=topics)

    # If using Trending (which is broad), we filter results by the topics we generated
    if period in TRENDING_SINCE and vertical == "ai_ml" and category_filter:
        raw_tags = [t.replace("topic:", "") for t in topics]
        filtered = []
        for r in results:
            r_topics = set(r.get("topics", []))
            r_text = (r.get("name", "") + " " + (r.get("description") or "")).lower()
            if bool(r_topics & set(raw_tags)) or any(tag.replace('-', ' ') in r_text for tag in raw_tags):
                filtered.append(r)
        results = filtered

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
    topics = await _dynamic_topics(vertical, limit=15)

    async with aiohttp.ClientSession() as session:
        batches = await asyncio.gather(*[
            _search_api(session, f"{topic} stars:>=100")
            for topic in topics
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
    Categories are now dynamically constructed upstream. This is a basic fallback for UI grouping
    in the web dashboard if the repo doesn't strictly state a category.
    """
    topics = set(repo.get("topics", []))
    name   = (repo.get("name")        or "").lower()
    desc   = (repo.get("description") or "").lower()
    lang   = (repo.get("language")    or "").lower()
    text   = name + " " + desc

    if topics & {"react", "vue", "nextjs", "ios", "android", "frontend", "mobile"}:
        return "Web & Mobile"
    if topics & {"database", "infra", "kubernetes", "docker", "cloud", "aws", "gcp"}:
        return "Data & Infra"
    if topics & {"security", "crypto", "auth", "osint"}:
        return "Security"
    if "game" in text or topics & {"godot", "unity", "graphics"}:
        return "Creative & Gaming"
    
    return "AI / ML"

