"""
Ecosystem Intelligence Service.
Implements metadata-first classification, Jaccard-based relationship graph mapping,
category-level strength scoring, and ecosystem report generation.
"""

import json
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from app.models.repository import Repository
from app.services.research_intelligence import ResearchScorer
from app.utils.llm import async_chat_completion, GROQ_API_KEY

logger = logging.getLogger(__name__)

# Topic map to deterministically classify repositories into categories/domains
# Structured knowledge separated by evidence type
GITHUB_TOPICS = {
    # LLM Models
    "generative-ai": "LLM Models",
    "foundation-model": "LLM Models",
    "large-language-models": "LLM Models",
    
    # Agent Frameworks
    "multi-agent": "Agent Frameworks",
    "agentic": "Agent Frameworks",
    "ai-agent": "Agent Frameworks",
    "autonomous-agents": "Agent Frameworks",
    "llm-agent": "Agent Frameworks",
    "agent-framework": "Agent Frameworks",
    "agent-orchestration": "Agent Frameworks",
    "autonomous-agent": "Agent Frameworks",
    "agentic-workflow": "Agent Frameworks",

    # Inference Engines
    "triton-inference": "Inference Engines",
    "inference-engine": "Inference Engines",

    # Model Serving / Runtimes
    "model-serving": "Model Serving / Runtimes",
    "model-registry": "Model Serving / Runtimes",

    # Vector Databases
    "vector-db": "Vector Databases",
    "vector-search": "Vector Databases",
    "vector-database": "Vector Databases",

    # Distributed Compute / Infra
    "distributed-training": "Distributed Compute / Infra",
    "parallel-computing": "Distributed Compute / Infra",
    "distributed-computing": "Distributed Compute / Infra",
    "parallel-training": "Distributed Compute / Infra",
    "large-scale-model-training": "Distributed Compute / Infra",
    "model-training": "Distributed Compute / Infra",
    "pre-training": "Distributed Compute / Infra",
    "pretraining": "Distributed Compute / Infra",
    "high-performance-training": "Distributed Compute / Infra",
    "data-parallelism": "Distributed Compute / Infra",
    "model-parallelism": "Distributed Compute / Infra",
    "pipeline-parallelism": "Distributed Compute / Infra",

    # Evaluation Frameworks
    "llm-evaluation": "Evaluation Frameworks",
    "llm-benchmark": "Evaluation Frameworks",
    "llm-eval": "Evaluation Frameworks",

    # Fine-tuning Toolkits
    "fine-tuning": "Fine-tuning Toolkits",
    "instruction-tuning": "Fine-tuning Toolkits",
    "finetuning": "Fine-tuning Toolkits",
    "reinforcement-learning": "Fine-tuning Toolkits",

    # DevTools
    "developer-tools": "DevTools",
    "code-editor": "DevTools",
    "vscode-extension": "DevTools",
    "intellij-plugin": "DevTools",
    "dev-server": "DevTools",
    "command-runner": "DevTools",

    # Web Frameworks
    "web-framework": "Web Frameworks",
    "rest-api": "Web Frameworks",
    "microservices": "Web Frameworks",

    # Security
    "vulnerability-scanner": "Security",
    "penetration-testing": "Security",
    "devsecops": "Security",
    "zero-trust": "Security",
    "malware-analysis": "Security",
    "network-security": "Security",
    "supply-chain-security": "Security",
    "red-team": "Security",
    "static-analysis": "Security",
    "credential-scanner": "Security",
    "secret-scanning": "Security",

    # Data Engineering
    "data-engineering": "Data Engineering",
    "data-pipeline": "Data Engineering",
    "workflow-orchestration": "Data Engineering",
    "data-lake": "Data Engineering",
    "data-warehouse": "Data Engineering",
    "delta-lake": "Data Engineering",
    "dataops": "Data Engineering",
    "data-integration": "Data Engineering",

    # Blockchain
    "smart-contracts": "Blockchain",
    "zero-knowledge": "Blockchain",
    "cross-chain": "Blockchain",

    # DevOps / Infrastructure -> Data & Infra
    "opentelemetry": "Data & Infra",
    "containerization": "Data & Infra",

    # AI / ML
    "deep-learning": "AI / ML",
    "machine-learning": "AI / ML",
    "neural-network": "AI / ML",
    "computer-vision": "AI / ML",
    "diffusion-model": "AI / ML"
}

TECHNOLOGIES = {
    # LLM Models
    "llama": "LLM Models",
    "mistral": "LLM Models",
    "gpt": "LLM Models",
    "gemini": "LLM Models",
    "claude": "LLM Models",
    "gemma": "LLM Models",
    "phi3": "LLM Models",
    "phi4": "LLM Models",

    # Agent Frameworks
    "crewai": "Agent Frameworks",
    "autogen": "Agent Frameworks",
    "langchain": "Agent Frameworks",
    "autogpt": "Agent Frameworks",
    "llamaindex": "Agent Frameworks",
    "llama-index": "Agent Frameworks",
    "llama_index": "Agent Frameworks",
    "dspy": "Agent Frameworks",
    "semantic-kernel": "Agent Frameworks",
    "langgraph": "Agent Frameworks",
    "lang-graph": "Agent Frameworks",

    # Inference Engines
    "vllm": "Inference Engines",
    "llama.cpp": "Inference Engines",
    "llama-cpp": "Inference Engines",
    "gguf": "Inference Engines",
    "tensorrt": "Inference Engines",
    "onnxruntime": "Inference Engines",
    "tgi": "Inference Engines",
    "tensorrt-llm": "Inference Engines",
    "deepspeed-inference": "Inference Engines",
    "ollama": "Inference Engines",
    "llamafile": "Inference Engines",
    "fastchat": "Inference Engines",
    "mlc-llm": "Inference Engines",
    "text-generation-webui": "Inference Engines",

    # Model Serving / Runtimes
    "litellm": "Model Serving / Runtimes",
    "mlflow": "Model Serving / Runtimes",
    "bentoml": "Model Serving / Runtimes",
    "kubeflow": "Model Serving / Runtimes",
    "kfserving": "Model Serving / Runtimes",
    "seldon": "Model Serving / Runtimes",
    "triton": "Model Serving / Runtimes",
    "triton-inference-server": "Model Serving / Runtimes",
    "jina": "Model Serving / Runtimes",
    "skypilot": "Model Serving / Runtimes",

    # Vector Databases
    "milvus": "Vector Databases",
    "qdrant": "Vector Databases",
    "weaviate": "Vector Databases",
    "chromadb": "Vector Databases",
    "chroma": "Vector Databases",
    "faiss": "Vector Databases",
    "pinecone": "Vector Databases",
    "hnswlib": "Vector Databases",
    "annoy": "Vector Databases",
    "vespa": "Vector Databases",
    "marqo": "Vector Databases",
    "deeplake": "Vector Databases",
    "pgvector": "Vector Databases",

    # Distributed Compute / Infra
    "deepspeed": "Distributed Compute / Infra",
    "horovod": "Distributed Compute / Infra",
    "megatron": "Distributed Compute / Infra",
    "pytorch-lightning": "Distributed Compute / Infra",
    "ray-train": "Distributed Compute / Infra",
    "jax": "Distributed Compute / Infra",
    "ray": "Distributed Compute / Infra",
    "mlx": "Distributed Compute / Infra",

    # Evaluation Frameworks
    "lm-eval": "Evaluation Frameworks",
    "helm": "Evaluation Frameworks",

    # Fine-tuning Toolkits
    "peft": "Fine-tuning Toolkits",
    "lora": "Fine-tuning Toolkits",
    "trl": "Fine-tuning Toolkits",

    # DevTools
    "neovim": "DevTools",
    "tmux": "DevTools",
    "biome": "DevTools",

    # Web Frameworks
    "fastapi": "Web Frameworks",
    "django": "Web Frameworks",
    "react": "Web Frameworks",
    "vuejs": "Web Frameworks",
    "svelte": "Web Frameworks",
    "nextjs": "Web Frameworks",
    "flask": "Web Frameworks",
    "angular": "Web Frameworks",
    "nuxt": "Web Frameworks",
    "remix": "Web Frameworks",
    "htmx": "Web Frameworks",
    "spring-boot": "Web Frameworks",
    "rails": "Web Frameworks",
    "vite": "Web Frameworks",

    # Security
    "semgrep": "Security",
    "trufflehog": "Security",

    # Data Engineering
    "apache-airflow": "Data Engineering",
    "kafka": "Data Engineering",
    "spark": "Data Engineering",
    "dbt": "Data Engineering",
    "flink": "Data Engineering",
    "trino": "Data Engineering",
    "presto": "Data Engineering",
    "databricks": "Data Engineering",
    "iceberg": "Data Engineering",
    "arrow": "Data Engineering",

    # Blockchain
    "ethereum": "Blockchain",
    "solana": "Blockchain",
    "cosmos": "Blockchain",
    "evm": "Blockchain",
    "substrate": "Blockchain",
    "nickel-lang": "Blockchain",

    # DevOps / Infrastructure -> Data & Infra
    "kubernetes": "Data & Infra",
    "docker": "Data & Infra",
    "terraform": "Data & Infra",
    "ansible": "Data & Infra",
    "prometheus": "Data & Infra",
    "grafana": "Data & Infra",
    "pulumi": "Data & Infra",

    # AI / ML
    "pytorch": "AI / ML",
    "tensorflow": "AI / ML",
    "scikit-learn": "AI / ML",
    "huggingface": "AI / ML"
}

PROTOCOLS = {
    "mcp": "Model Context Protocol",
    "model-context-protocol": "Model Context Protocol",
    "a2a": "Agent-to-Agent",
    "graphql": "Web Frameworks",
    "grpc": "Web Frameworks",
    "websocket": "Web Frameworks"
}

LANGUAGES = {
    "typescript": "Web Frameworks",
    "solidity": "Blockchain"
}

DESCRIPTION_KEYWORDS = {
    # LLM Models
    "large-language-model": "LLM Models",
    "causal-lm": "LLM Models",
    "slm": "LLM Models",
    "small-language-model": "LLM Models",

    # Inference Engines
    "inference": "Inference Engines",
    "text-generation": "Inference Engines",
    "text-generation-webui": "Inference Engines",

    # Distributed Compute / Infra
    "parallelization": "Distributed Compute / Infra",

    # Evaluation Frameworks
    "evaluation": "Evaluation Frameworks",
    "benchmark": "Evaluation Frameworks",
    "benchmarks": "Evaluation Frameworks",
    "evals": "Evaluation Frameworks",

    # Fine-tuning Toolkits
    "fine-tune": "Fine-tuning Toolkits",
    "rlhf": "Fine-tuning Toolkits",
    "sft": "Fine-tuning Toolkits",
    "dpo": "Fine-tuning Toolkits",
    "qlora": "Fine-tuning Toolkits",
    "adapter": "Fine-tuning Toolkits",

    # DevTools
    "productivity": "DevTools",
    "linter": "DevTools",
    "formatter": "DevTools",
    "language-server": "DevTools",
    "debugging": "DevTools",
    "profiler": "DevTools",
    "dotfiles": "DevTools",

    # Security
    "security": "Security",
    "vulnerability": "Security",
    "cybersecurity": "Security",
    "cryptography": "Security",
    "authentication": "Security",
    "fuzzing": "Security",
    "reverse-engineering": "Security",
    "osint": "Security",
    "exploit": "Security",
    "cve": "Security",
    "credentials": "Security",
    "leaked": "Security",

    # Data Engineering
    "etl": "Data Engineering",
    "streaming": "Data Engineering",
    "dataflow": "Data Engineering",

    # Blockchain
    "blockchain": "Blockchain",
    "web3": "Blockchain",
    "defi": "Blockchain",
    "nft": "Blockchain",
    "layer2": "Blockchain",
    "dao": "Blockchain",
    "bitcoin": "Blockchain",

    # DevOps / Infrastructure -> Data & Infra
    "infrastructure": "Data & Infra",
    "observability": "Data & Infra",
    "ci-cd": "Data & Infra",
    "automation": "Data & Infra",

    # AI / ML
    "nlp": "AI / ML",
    "multimodal": "AI / ML",
    "rag": "AI / ML",
    "embeddings": "AI / ML"
}

WEAK_KEYWORDS = {
    "llm": "LLM Models",
    "phi": "LLM Models",
    "agent": "Agent Frameworks",
    "serving": "Model Serving / Runtimes",
    "eval": "Evaluation Frameworks",
    "editor": "DevTools",
    "cli": "DevTools",
    "git": "DevTools",
    "terminal": "DevTools",
    "devtools": "DevTools",
    "shell": "DevTools",
    "web": "Web Frameworks",
    "nodejs": "Web Frameworks",
    "frontend": "Web Frameworks",
    "pipeline": "Data Engineering",
    "nickel": "Blockchain",
    "ai": "AI / ML",
    "ml": "AI / ML"
}

# Monolithic map dynamically constructed to maintain 100% backward compatibility and exact behavior
SEED_CATEGORY_MAP = {
    **GITHUB_TOPICS,
    **TECHNOLOGIES,
    **PROTOCOLS,
    **LANGUAGES,
    **DESCRIPTION_KEYWORDS,
    **WEAK_KEYWORDS
}

# Category adjacency map to identify companion technologies
ADJACENCY_MAP = {
    "Agent Frameworks": ["Vector Databases", "Inference Engines", "Model Context Protocol", "Model Serving / Runtimes"],
    "LLM Models": ["Inference Engines", "Fine-tuning Toolkits", "Distributed Compute / Infra"],
    "Inference Engines": ["Model Serving / Runtimes", "Distributed Compute / Infra", "LLM Models"],
    "Vector Databases": ["Agent Frameworks", "Data Engineering"],
    "Model Context Protocol": ["Agent Frameworks"],
    "Data Engineering": ["Vector Databases", "Agent Frameworks"],
    "Model Serving / Runtimes": ["Inference Engines", "Agent Frameworks"],
}


class EcosystemClassifier:
    """Classifies repositories into multiple categories using metadata-first logic."""

    SPECIFICITY_RANK = {
        "Model Context Protocol": 1,
        "Agent-to-Agent": 2,
        "Fine-tuning Toolkits": 3,
        "Distributed Compute / Infra": 4,
        "Vector Databases": 5,
        "Inference Engines": 6,
        "Model Serving / Runtimes": 7,
        "Evaluation Frameworks": 8,
        "Agent Frameworks": 9,
        "Blockchain": 10,
        "Security": 11,
        "Data Engineering": 12,
        "Data & Infra": 13,
        "DevTools": 14,
        "Web Frameworks": 15,
        "LLM Models": 16,
        "AI / ML": 17,
        "OSS Tools": 18
    }

    TOPIC_ALIASES = {
        "lang-chain": "langchain",
        "lang_chain": "langchain",
        "langchain-ai": "langchain",
        "react-native": "react-native",
        "react_native": "react-native",
        "pytorch-lightning": "pytorch-lightning",
        "lightning": "pytorch-lightning",
    }

    # Overly generic terms that must not match in description keywords
    PROHIBITED_DESC_KEYWORDS = {
        "ai", "ml", "tool", "framework", "application", "platform", "library", "service"
    }

    @classmethod
    def classify_repo(cls, repo: Repository) -> List[str]:
        """Classify repository based on topics, description, and primary category."""
        _, categories = cls.infer_category(repo)
        return categories

    @staticmethod
    def _is_token_match(topic_lc: str, key: str) -> bool:
        """Token-aware boundary match. Splitting topics by '-' and '_' to check for complete tokens."""
        import re
        topic_tokens = re.split(r'[^a-zA-Z0-9]+', topic_lc)
        key_tokens = re.split(r'[^a-zA-Z0-9]+', key.lower())
        
        n_t = len(topic_tokens)
        n_k = len(key_tokens)
        if n_k > n_t:
            return False
            
        for i in range(n_t - n_k + 1):
            match = True
            for j in range(n_k):
                t_tok = topic_tokens[i + j]
                k_tok = key_tokens[j]
                if j == n_k - 1:
                    if len(k_tok) < 4:
                        if t_tok != k_tok:
                            match = False
                            break
                    else:
                        if not t_tok.startswith(k_tok):
                            match = False
                            break
                else:
                    if t_tok != k_tok:
                        match = False
                        break
            if match:
                return True
        return False

    @staticmethod
    def _is_desc_match(desc_lc: str, key: str) -> bool:
        """Punctuation-aware distinct word match for description keywords with basic plural support."""
        import re
        # Normalize hyphens/underscores to spaces to match both hyphenated and spaced variants
        normalized_key = key.replace('-', ' ').replace('_', ' ')
        normalized_desc = desc_lc.replace('-', ' ').replace('_', ' ')
        
        # Build regex allowing optional plural suffixes (s/es) for the final token of the keyword
        words = normalized_key.split()
        pattern_parts = []
        for idx, w in enumerate(words):
            if idx == len(words) - 1:
                # Add optional plural suffix for the last word token
                pattern_parts.append(re.escape(w) + r'(?:s|es)?')
            else:
                pattern_parts.append(re.escape(w))
        
        pattern = r'\b' + r'\s+'.join(pattern_parts) + r'\b'
        return bool(re.search(pattern, normalized_desc))

    @staticmethod
    def _normalize_topic(topic_lc: str) -> str:
        """Normalize topic by removing non-alphanumeric separator characters."""
        import re
        return re.sub(r'[^a-zA-Z0-9]+', '', topic_lc)

    @classmethod
    def infer_category(cls, repo: Any) -> Tuple[str, List[str]]:
        """
        Receives a repository object (or dict), resolves primary category and plural categories.
        Primary and secondary categories are determined deterministically using priority rules and specificity tie-breakers.
        """
        matched_priorities = {}  # category_name -> priority integer (lower = higher priority)

        # 1. Seed Category (Priority 1)
        repo_category = None
        if hasattr(repo, "category"):
            repo_category = repo.category
        elif isinstance(repo, dict):
            repo_category = repo.get("category")
            
        if repo_category and repo_category.lower() not in ("untracked", "default", "system"):
            matched_priorities[repo_category] = 1

        # Extract name safely
        name = ""
        if hasattr(repo, "name"):
            name = repo.name
        elif isinstance(repo, dict):
            name = repo.get("name") or ""
        name_lc = (name or "").lower()

        # Extract topics safely
        topics = []
        if hasattr(repo, "topics"):
            topics = repo.topics
        elif isinstance(repo, dict):
            topics = repo.get("topics", [])
            
        repo_topics = []
        if topics:
            if isinstance(topics, list):
                repo_topics = topics
            elif isinstance(topics, str):
                try:
                    repo_topics = json.loads(topics)
                except Exception:
                    pass

        # Extract description and language safely
        description = ""
        if hasattr(repo, "description"):
            description = repo.description
        elif isinstance(repo, dict):
            description = repo.get("description") or ""
        desc_lc = (description or "").lower()
        
        language = ""
        if hasattr(repo, "primary_language"):
            language = repo.primary_language
        elif isinstance(repo, dict):
            language = repo.get("language") or repo.get("primary_language") or ""
        lang_lc = (language or "").lower()

        # Evaluate repository name rules
        if name_lc:
            # 2. Exact Name Match (Priority 2)
            if name_lc in SEED_CATEGORY_MAP:
                cat = SEED_CATEGORY_MAP[name_lc]
                matched_priorities[cat] = min(matched_priorities.get(cat, 99), 2)
            # 3. Alias Name Match (Priority 3)
            if name_lc in cls.TOPIC_ALIASES:
                alias = cls.TOPIC_ALIASES[name_lc]
                if alias in SEED_CATEGORY_MAP:
                    cat = SEED_CATEGORY_MAP[alias]
                    matched_priorities[cat] = min(matched_priorities.get(cat, 99), 3)
            # 4. Normalized Name Match (Priority 4)
            norm_name = cls._normalize_topic(name_lc)
            if norm_name in SEED_CATEGORY_MAP:
                cat = SEED_CATEGORY_MAP[norm_name]
                matched_priorities[cat] = min(matched_priorities.get(cat, 99), 4)

        # Evaluate topic-based rules
        for topic in repo_topics:
            topic_lc = topic.lower()
            
            # 2. Exact Topic Match (Priority 2)
            if topic_lc in SEED_CATEGORY_MAP:
                cat = SEED_CATEGORY_MAP[topic_lc]
                matched_priorities[cat] = min(matched_priorities.get(cat, 99), 2)
                
            # 3. Alias Topic Match (Priority 3)
            if topic_lc in cls.TOPIC_ALIASES:
                alias = cls.TOPIC_ALIASES[topic_lc]
                if alias in SEED_CATEGORY_MAP:
                    cat = SEED_CATEGORY_MAP[alias]
                    matched_priorities[cat] = min(matched_priorities.get(cat, 99), 3)
                    
            # 4. Normalized Topic Match (Priority 4)
            norm_topic = cls._normalize_topic(topic_lc)
            if norm_topic in SEED_CATEGORY_MAP:
                cat = SEED_CATEGORY_MAP[norm_topic]
                matched_priorities[cat] = min(matched_priorities.get(cat, 99), 4)

        # 5. Description Keyword Match (Priority 5)
        for key, val in SEED_CATEGORY_MAP.items():
            # Exclude weak generic description keywords to reduce false positives
            if key in cls.PROHIBITED_DESC_KEYWORDS:
                continue
            if cls._is_desc_match(desc_lc, key):
                matched_priorities[val] = min(matched_priorities.get(val, 99), 5)

        # 6. Substring Name & Topic Match (Priority 6)
        if name_lc:
            for key, val in SEED_CATEGORY_MAP.items():
                if cls._is_token_match(name_lc, key):
                    matched_priorities[val] = min(matched_priorities.get(val, 99), 6)
        for topic in repo_topics:
            topic_lc = topic.lower()
            for key, val in SEED_CATEGORY_MAP.items():
                if cls._is_token_match(topic_lc, key):
                    matched_priorities[val] = min(matched_priorities.get(val, 99), 6)

        # 7. Language Fallback (Priority 7)
        if lang_lc == "solidity":
            matched_priorities["Blockchain"] = min(matched_priorities.get("Blockchain", 99), 7)

        # 8. OSS Tools Fallback (Priority 8)
        if not matched_priorities:
            matched_priorities["OSS Tools"] = 8

        # Sorting key for secondary categories (Guarantee 5 & Section 67 Conflict resolution)
        def sort_key(cat):
            p = matched_priorities.get(cat, 99)
            s = cls.SPECIFICITY_RANK.get(cat, 99)
            return (p, s, cat)

        sorted_cats = sorted(matched_priorities.keys(), key=sort_key)

        # Determine primary category (Guarantee 4)
        if repo_category and repo_category.lower() not in ("untracked", "default", "system"):
            primary = repo_category
        else:
            primary = sorted_cats[0]

        return primary, sorted_cats


class RelationshipGraphEngine:
    """Builds and ranks explainable relationships between repositories and categories."""

    @staticmethod
    def _cosine_similarity(a: set, b: set) -> float:
        """Jaccard similarity as a proxy for cosine similarity."""
        if not a or not b:
            return 0.0
        intersection = len(a & b)
        union = len(a | b)
        return intersection / union if union > 0 else 0.0

    @staticmethod
    def _build_feature_set(repo: Repository) -> set:
        """Combined feature set of topics, language, and categories."""
        features = set()
        topics = []
        if repo.topics:
            if isinstance(repo.topics, list):
                topics = repo.topics
            elif isinstance(repo.topics, str):
                try:
                    topics = json.loads(repo.topics)
                except Exception:
                    pass
        features.update(t.lower() for t in topics)
        if repo.primary_language:
            features.add(f"lang:{repo.primary_language.lower()}")
        if repo.category:
            features.add(f"cat:{repo.category.lower()}")
        return features

    @classmethod
    def build_relationships(cls, pivot: Repository, db: Session) -> Dict[str, Any]:
        """Build relationships deterministically using metadata (Jaccard similarity + Categories)."""
        pivot_categories = pivot.categories or EcosystemClassifier.classify_repo(pivot)
        pivot_features = cls._build_feature_set(pivot)
        primary_category = pivot.category or (pivot_categories[0] if pivot_categories else "OSS Tools")

        # Fetch all active repos from the DB for similarity analysis
        candidates = db.query(Repository).filter(
            Repository.is_active == True,
            Repository.id != pivot.id
        ).all()

        relationships = []

        # 1. Detect Alternatives (repos in same category or high topic similarity)
        for cand in candidates:
            cand_categories = cand.categories or EcosystemClassifier.classify_repo(cand)
            cand_features = cls._build_feature_set(cand)
            sim = cls._cosine_similarity(pivot_features, cand_features)

            shared_topics = set(t.lower() for t in (pivot.topics or [])) & set(t.lower() for t in (cand.topics or []))
            is_same_cat = bool(set(pivot_categories) & set(cand_categories))

            # Quality proxy: Confidence score
            conf_data = ResearchScorer.calculate_confidence_score({
                "stars": cand.stars_snapshot or 0,
                "velocity_proxy": cand.stars_snapshot / max(cand.age_days or 1, 1),
                "days_since_push": 0,  # assume fresh for query
                "has_ci_cd": cand.has_ci_cd,
                "has_tests": cand.has_tests,
                "license_category": cand.license_category,
                "readme_len": 2000,
            })
            conf_score = conf_data["score"]

            if is_same_cat or sim >= 0.20:
                rel_type = "alternative"
                source = "topic_similarity" if sim >= 0.20 else "shared_category"
                # Rank score: 60% similarity, 40% confidence/quality
                confidence = round((sim * 0.6) + ((conf_score / 100.0) * 0.4), 2)

                explanation = ""
                if shared_topics:
                    explanation = f"Shares category '{primary_category}' and topics: {', '.join(list(shared_topics)[:3])}."
                else:
                    explanation = f"Falls under the same technological category '{primary_category}'."

                relationships.append({
                    "related_repo": f"{cand.owner}/{cand.name}",
                    "relationship": rel_type,
                    "source": source,
                    "confidence": confidence,
                    "explanation": explanation,
                    "stars": cand.stars_snapshot or 0,
                    "primary_language": cand.primary_language,
                    "description": cand.description or ""
                })

        # 2. Detect Companion Technologies (adjacent categories)
        adj_categories = []
        for cat in pivot_categories:
            adj_categories.extend(ADJACENCY_MAP.get(cat, []))
        adj_categories = list(set(adj_categories))

        if adj_categories:
            # Query top repos in adjacent categories
            companions = db.query(Repository).filter(
                Repository.is_active == True,
                Repository.category.in_(adj_categories)
            ).order_by(Repository.stars_snapshot.desc()).limit(10).all()

            for comp in companions:
                # Add relationship
                explanation = f"Often used alongside '{primary_category}' for stateful memory, inference, or integration."
                relationships.append({
                    "related_repo": f"{comp.owner}/{comp.name}",
                    "relationship": "companion",
                    "source": "adjacent_category",
                    "confidence": 0.80,
                    "explanation": explanation,
                    "stars": comp.stars_snapshot or 0,
                    "primary_language": comp.primary_language,
                    "description": comp.description or ""
                })

        # Sort relationships by confidence descending
        relationships.sort(key=lambda x: x["confidence"], reverse=True)

        return {
            "categories": pivot_categories,
            "relationships": relationships
        }


class EcosystemStrengthScorer:
    """Calculates category-level strength scores dynamically from repository activity metrics."""

    @staticmethod
    def calculate_category_strength(category: str, db: Session) -> Dict[str, Any]:
        """Calculate ecosystem strength score (0-100) for a given category."""
        repos = db.query(Repository).filter(
            Repository.is_active == True,
            Repository.category == category
        ).all()

        if not repos:
            return {"score": 50, "status": "Inactive", "details": "No active repositories detected in this category."}

        # 1. Project Count Score (max 20 points, 1 point per active project up to 20)
        proj_score = min(20, len(repos) * 1.5)

        # 2. Total Activity (max 30 points, based on total accumulated stars and daily deltas)
        total_stars = sum(r.stars_snapshot or 0 for r in repos)
        star_score = min(30, (total_stars / 10000) * 5) # 10k stars = 5 pts

        # 3. Growth velocity (max 20 points, average of star velocity)
        avg_vel = 0.0
        for r in repos:
            age = max(r.age_days or 1, 1)
            avg_vel += (r.stars_snapshot or 0) / age
        avg_vel /= len(repos)
        vel_score = min(20, avg_vel * 2)

        # 4. Quality score (max 30 points, average of confidence scores)
        avg_conf = 0.0
        for r in repos:
            conf_data = ResearchScorer.calculate_confidence_score({
                "stars": r.stars_snapshot or 0,
                "velocity_proxy": r.stars_snapshot / max(r.age_days or 1, 1),
                "days_since_push": 0,
                "has_ci_cd": r.has_ci_cd,
                "has_tests": r.has_tests,
                "license_category": r.license_category,
                "readme_len": 2000,
            })
            avg_conf += conf_data["score"]
        avg_conf /= len(repos)
        quality_score = (avg_conf / 100.0) * 30

        final_score = int(round(proj_score + star_score + vel_score + quality_score))
        final_score = min(100, max(0, final_score))

        if final_score >= 85:
            status = "Highly Mature"
            details = f"Strong established ecosystem with high developer adoption, active maintainer velocities, and mature libraries."
        elif final_score >= 60:
            status = "Growing"
            details = f"Healthy ecosystem showing growing adoption, steady velocity, and expanding repository counts."
        else:
            status = "Emerging / Niche"
            details = f"New or highly specialized ecosystem with early traction, smaller contributor pools, and moderate activity levels."

        return {
            "score": final_score,
            "status": status,
            "details": details,
            "metrics": {
                "active_projects": len(repos),
                "total_stars": total_stars,
                "average_velocity": round(avg_vel, 2)
            }
        }


class EcosystemReportGenerator:
    """Generates structured Markdown reports for a technology ecosystem."""

    @staticmethod
    async def generate_report(repo: Repository, db: Session) -> str:
        """Call Groq to enrich and summarize ecosystem-level metrics into a Markdown brief."""
        categories = repo.categories or EcosystemClassifier.classify_repo(repo)
        primary_category = repo.category or (categories[0] if categories else "OSS Tools")
        strength = await asyncio.to_thread(EcosystemStrengthScorer.calculate_category_strength, primary_category, db)

        # Retrieve alternatives and companions
        rels = await asyncio.to_thread(RelationshipGraphEngine.build_relationships, repo, db)
        alternatives = [r for r in rels["relationships"] if r["relationship"] == "alternative"][:4]
        companions = [r for r in rels["relationships"] if r["relationship"] == "companion"][:4]

        # Call Groq to generate a narrative report
        if not GROQ_API_KEY:
            # Fallback markdown if Groq is not configured
            return f"""# Ecosystem Report: {primary_category}
            
## Category Overview
This report maps the open-source software ecosystem around **{repo.owner}/{repo.name}** in the **{primary_category}** domain.
The category has an Ecosystem Strength Score of **{strength['score']}/100** ({strength['status']}).

## Alternatives & Competitors
{chr(10).join(f"- **{a['related_repo']}** ({a['primary_language']}): {a['description']} [Confidence: {a['confidence']}]" for a in alternatives)}

## Related Technologies & Stacks
{chr(10).join(f"- **{c['related_repo']}**: {c['explanation']}" for c in companions)}
"""

        prompt = f"""You are a senior OSS market intelligence analyst. 
Generate a comprehensive, factual ecosystem research report for the domain **{primary_category}** centered around the project **{repo.owner}/{repo.name}**.

Category Metrics:
- Ecosystem Strength Score: {strength['score']}/100 ({strength['status']})
- Active Projects: {strength['metrics']['active_projects']}
- Total Stars: {strength['metrics']['total_stars']}

Repository Data:
Name: {repo.owner}/{repo.name}
Description: {repo.description}
Topics: {repo.topics}

Alternatives detected:
{json.dumps(alternatives, indent=2)}

Companion Technologies detected:
{json.dumps(companions, indent=2)}

Format the report with these specific headers:
# {primary_category} Ecosystem Landscape
## 1. Category Overview
Provide a concise 3-4 sentence explanation of the category, its technical relevance, and the role of {repo.name}.

## 2. Ecosystem Leaders & Strength
Discuss the Ecosystem Strength Score ({strength['score']}/100) and what it implies about developer adoption.

## 3. Direct Alternatives & Competitors
Present a side-by-side analysis of the top alternatives based on the provided list.

## 4. Common Technology Stacks & Companion Tools
Explain how these tools are frequently combined (such as Vector databases or MCP) and why they complement each other.

## 5. Ecosystem Trends & Observations
List 2-3 emerging trends in this domain.

No filler, no exclamation marks. Factual and analyst-grade only."""

        try:
            res = await async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=1500
            )
            return res.text if res else "Failed to generate report narrative."
        except Exception as exc:
            logger.warning(f"Groq ecosystem report generation failed: {exc}")
            return "Failed to generate ecosystem report."
