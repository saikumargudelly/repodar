"""
Research Intelligence Module.

Houses:
1. QueryExpansionEngine: Expands search criteria into domain-specific terms.
2. ResearchScorer: Calculates Confidence, Risk, and generates Evidence Citations.
"""

import logging
import json
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta

from app.utils.llm import async_chat_completion, GROQ_API_KEY

logger = logging.getLogger(__name__)

# ─── Static Concept Expansions ───────────────────────────────────────────────
STATIC_EXPANSIONS = {
    "agent framework": ["agent orchestration", "multi-agent", "workflow engine", "graph execution", "mcp", "a2a", "tool calling"],
    "agentic": ["agent orchestration", "multi-agent", "autonomous agents", "langchain", "crewai", "autogen"],
    "llm": ["large language model", "transformer", "llama", "deep learning", "inference", "vector db"],
    "vector database": ["vector search", "similarity search", "embeddings", "milvus", "qdrant", "weaviate", "chromadb", "hnsw"],
    "rag": ["retrieval augmented generation", "vector search", "document retrieval", "knowledge base", "embeddings", "llama-index", "langchain"],
    "inference": ["llm inference", "model serving", "vllm", "llama.cpp", "onnx", "tensorrt"],
    "mcp": ["model context protocol", "llm tools", "agent tools", "context sharing", "anthropic mcp"],
    "fine-tuning": ["lora", "qlora", "peft", "sft", "dpo", "deepspeed", "adapter"],
    "database": ["sql", "nosql", "postgres", "redis", "clickhouse", "timeseries", "acid", "query optimizer"],
    "observability": ["monitoring", "tracing", "opentelemetry", "prometheus", "grafana", "metrics", "apm", "jaeger", "ebpf"],
    "ci/cd": ["github actions", "jenkins", "pipeline", "automated testing", "continuous integration", "deployment", "gitops"],
    "devops": ["docker", "kubernetes", "terraform", "ansible", "ci-cd", "cloud native", "helm", "infrastructure as code"],
    "cloud": ["aws", "gcp", "azure", "serverless", "s3", "iam", "cloud native", "vpc"],
    "security": ["authentication", "oauth", "sast", "dast", "vulnerability scanner", "pentest", "cryptography", "zero-trust", "secrets management"],
    "backend": ["fastapi", "django", "spring boot", "express", "graphql", "grpc", "rest api", "orm", "mvc"],
    "frontend": ["react", "next.js", "vue", "svelte", "typescript", "state management", "webpack", "vite", "tailwind"],
}


class QueryExpansionEngine:
    """Expands queries using zero-token local maps and cached LLM fallbacks."""

    @staticmethod
    def _local_expand(query: str) -> List[str]:
        """Check query string against local concept mappings."""
        q_lower = query.lower()
        expanded = []
        for key, terms in STATIC_EXPANSIONS.items():
            if key in q_lower:
                expanded.extend(terms)
        return list(set(expanded))

    @classmethod
    async def expand_query(cls, query: str) -> List[str]:
        """
        Expand query. Checks static rules first, then queries cached Groq.
        """
        # 1. Check local static dictionary first
        local_exp = cls._local_expand(query)
        if local_exp:
            logger.info(f"Local query expansion matched: {query} -> {local_exp[:4]}...")
            return local_exp

        # 2. Redis/InMemory Cache Check via FastAPICache
        from fastapi_cache import FastAPICache
        cache_backend = None
        try:
            cache_backend = FastAPICache.get_backend()
        except Exception:
            pass

        query_hash = hashlib.md5(query.strip().lower().encode("utf-8")).hexdigest()
        cache_key = f"research:expansion:{query_hash}"

        if cache_backend:
            try:
                cached = await cache_backend.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Failed to read query expansion cache: {e}")

        # 3. LLM Fallback
        expansions = []
        if GROQ_API_KEY:
            prompt = f"""You are an expert GitHub researcher. The user is searching for: "{query}"
Generate 5-7 closely related technical search terms, topics, libraries, or concepts that represent identical technical domains.
Output JSON only with a single key "expansions" containing a list of strings."""

            try:
                messages = [
                    {"role": "system", "content": "You expand search terms. Return JSON containing 'expansions' only. No prose."},
                    {"role": "user", "content": prompt}
                ]
                res = await async_chat_completion(
                    messages=messages,
                    temperature=0.1,
                    max_tokens=250,
                    response_format={"type": "json_object"}
                )
                if res and res.text:
                    data = json.loads(res.text)
                    expansions = data.get("expansions", [])
            except Exception as e:
                logger.warning(f"Groq query expansion failed: {e}")

        # Clean fallback if Groq failed or key is missing
        if not expansions:
            # Simple keyword tokens
            tokens = [t.strip().lower() for t in query.split() if len(t.strip()) > 3]
            expansions = [t for t in tokens if t not in {"show", "find", "best", "most", "trending"}]

        # Store to cache
        if cache_backend and expansions:
            try:
                await cache_backend.set(cache_key, json.dumps(expansions), expire=604800) # 7 days
            except Exception as e:
                logger.warning(f"Failed to write query expansion cache: {e}")

        return expansions


class ResearchScorer:
    """Computes technical scores, risks, and maps citations for recommendations."""

    @staticmethod
    def calculate_activity_score(repo: Dict[str, Any]) -> float:
        """
        Activity Score (0.0 - 1.0)
        Inputs: star velocity (velocity_proxy), days since last push.
        """
        # Star velocity normalisation: cap at 25 stars/day
        vel = repo.get("velocity_proxy") or repo.get("star_velocity_7d") or 0.0
        vel_norm = min(1.0, float(vel) / 25.0)

        # Recency normalisation: decay over 90 days
        push_days = repo.get("days_since_push") or 0
        rec_norm = max(0.0, 1.0 - (float(push_days) / 90.0))

        # Weight: 40% velocity, 60% recency
        score = (vel_norm * 0.4) + (rec_norm * 0.6)
        return round(min(1.0, max(0.0, score)), 4)

    @staticmethod
    def calculate_readiness_score(repo: Dict[str, Any]) -> float:
        """
        Readiness Score (0.0 - 1.0)
        Inputs: license permissiveness, CI/CD presence, test presence, docs quality.
        """
        license_cat = repo.get("license_category") or "unknown"
        if license_cat in ("permissive", "mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "apache"):
            lic_score = 0.3
        elif license_cat in ("copyleft", "gpl", "agpl", "gpl-3.0", "gpl-2.0"):
            lic_score = 0.1
        else:
            lic_score = 0.0

        cicd_score = 0.25 if repo.get("has_ci_cd") else 0.0
        tests_score = 0.25 if repo.get("has_tests") else 0.0

        # Documentation quality component (max 0.20)
        readme_len = repo.get("readme_len") or 0
        docs_score = min(0.20, float(readme_len) / 8000.0)

        return round(min(1.0, lic_score + cicd_score + tests_score + docs_score), 4)

    @staticmethod
    def calculate_community_health_score(repo: Dict[str, Any]) -> float:
        """
        Community Health Score (0.0 - 1.0)
        Inputs: fork-to-star ratio, contributor counts, open issues.
        """
        stars = max(repo.get("stars", 0), 1)
        forks = repo.get("forks", 0)
        issues = repo.get("open_issues", 0)

        # Fork ratio: optimal is >= 15% forks to stars
        fork_ratio = forks / stars
        fork_norm = min(1.0, fork_ratio / 0.15)

        # Open issue ratio: lower ratio is healthier; penalty triggers above 15% issues/stars
        issue_ratio = issues / stars
        issue_norm = max(0.0, 1.0 - (min(issue_ratio, 0.4) / 0.4))

        # Weight: 50% fork adoption, 50% issue control
        score = (fork_norm * 0.5) + (issue_norm * 0.5)
        return round(min(1.0, max(0.0, score)), 4)

    @classmethod
    def calculate_confidence_score(cls, repo: Dict[str, Any]) -> Dict[str, Any]:
        """
        Research Confidence Score (0 - 100)
        Combines Activity, Readiness, Community, Docs, and Star stability.
        """
        act = cls.calculate_activity_score(repo)
        read = cls.calculate_readiness_score(repo)
        comm = cls.calculate_community_health_score(repo)

        # Docs quality (0-1.0)
        readme_len = repo.get("readme_len") or 0
        docs = min(1.0, float(readme_len) / 5000.0)

        # Stability: star growth consistency. Standard defaults to 0.90 if no spikes
        # Spikes occur when 7d velocity is > 4x 30d velocity (sudden hype)
        vel_7 = float(repo.get("velocity_proxy") or repo.get("star_velocity_7d") or 0.0)
        vel_30 = float(repo.get("star_velocity_30d") or 0.0)
        
        stability = 1.0
        if vel_30 > 0.1 and vel_7 > 2.0:
            ratio = vel_7 / vel_30
            if ratio > 4.0:
                stability = max(0.4, 1.0 - (ratio - 4.0) * 0.05)

        # Weights: Activity 25%, Readiness 25%, Community 25%, Docs 15%, Stability 10%
        final_score = (act * 0.25) + (read * 0.25) + (comm * 0.25) + (docs * 0.15) + (stability * 0.10)
        score_pct = int(round(final_score * 100))

        if score_pct >= 75:
            level = "High"
            reason = "Recommended due to active maintainers, frequent releases, strong documentation, and healthy contributor activity."
        elif score_pct >= 40:
            level = "Medium"
            reason = "Moderately active project. Solid documentation but shows slowing release intervals or higher open issue backlogs."
        else:
            level = "Low"
            reason = "Low confidence: Project shows signs of stagnation, missing tests or CI/CD pipelines, and high issue-to-star ratios."

        return {
            "score": score_pct,
            "level": level,
            "reason": reason
        }

    @staticmethod
    def calculate_risk_score(repo: Dict[str, Any]) -> Dict[str, Any]:
        """
        Risk Score (0 - 100) — negative signal analysis.
        Triggers: stale push, single maintainer, backlog size, missing tests/CI.
        """
        risk_points = 0
        factors = []

        # 1. No updates / pushed_at stale
        push_days = repo.get("days_since_push") or 0
        if push_days > 180:
            risk_points += 30
            factors.append("No repository updates in the last 6 months")

        # 2. Contributor size warning (proxy via forks/stars or raw if we have it)
        # If stars are high but forks are very low, or total contributors <= 1
        contributors = repo.get("contributors") or 0
        if contributors == 1:
            risk_points += 25
            factors.append("Single maintainer dependency detected")

        # 3. High open issue backlog
        issues = repo.get("open_issues") or 0
        stars = repo.get("stars") or 0
        if issues > 200 and (issues / max(stars, 1)) > 0.15:
            risk_points += 20
            factors.append("High open issue backlog (>200 issues)")

        # 4. Missing test framework
        if not repo.get("has_tests"):
            risk_points += 15
            factors.append("Missing test suite indicators in codebase")

        # 5. Missing CI/CD pipelines
        if not repo.get("has_ci_cd"):
            risk_points += 10
            factors.append("No active CI/CD automation detected")

        score = min(100, risk_points)
        return {
            "score": score,
            "factors": factors
        }

    @classmethod
    def generate_evidence_citations(cls, repo: Dict[str, Any]) -> List[str]:
        """Produces evidence citations matching claims to codebase statistics."""
        citations = []
        
        # 1. Push recency citation
        push_days = repo.get("days_since_push") or 0
        if push_days == 0:
            citations.append("Pushed updates within the last 24 hours")
        else:
            citations.append(f"Last code commit pushed {push_days} days ago")

        # 2. Releases citation
        # If we have release frequency
        release_freq = repo.get("release_frequency") or 0.0
        if release_freq > 0:
            citations.append(f"CADENCE: {round(release_freq, 2)} releases per week historically")

        # 3. Stars / Commits citation
        stars = repo.get("stars") or 0
        vel_7 = repo.get("velocity_proxy") or repo.get("star_velocity_7d") or 0.0
        if vel_7 > 0.1:
            citations.append(f"VELOCITY: Gaining {round(vel_7, 1)} stars per day on average over the last week")

        # 4. Code quality citation
        if repo.get("has_tests") and repo.get("has_ci_cd"):
            citations.append("QA: Automated test folders and GitHub Actions CI/CD workflows identified in main branch")
        elif repo.get("has_tests"):
            citations.append("QA: Unit test directories present in root layout")
        elif repo.get("has_ci_cd"):
            citations.append("QA: CI/CD configurations present in workflows directory")

        # 5. License category
        license_cat = repo.get("license_category") or "unknown"
        license_name = repo.get("license") or "unspecified"
        citations.append(f"COMPLIANCE: Monitored under '{license_name}' ({license_cat.upper()} category) license")

        return citations
