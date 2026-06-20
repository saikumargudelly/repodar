"""
Ecosystem Intelligence Service.
Implements metadata-first classification, Jaccard-based relationship graph mapping,
category-level strength scoring, and ecosystem report generation.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from app.models.repository import Repository
from app.services.research_intelligence import ResearchScorer
from app.utils.llm import async_chat_completion, GROQ_API_KEY

logger = logging.getLogger(__name__)

# Topic map to deterministically classify repositories into categories/domains
SEED_CATEGORY_MAP = {
    "llm": "LLM Models",
    "large-language-model": "LLM Models",
    "llama": "LLM Models",
    "mistral": "LLM Models",
    "agent": "Agent Frameworks",
    "multi-agent": "Agent Frameworks",
    "agentic": "Agent Frameworks",
    "orchestration": "Agent Frameworks",
    "crewai": "Agent Frameworks",
    "autogen": "Agent Frameworks",
    "langchain": "Agent Frameworks",
    "inference": "Inference Engines",
    "vllm": "Inference Engines",
    "llama.cpp": "Inference Engines",
    "serving": "Model Serving / Runtimes",
    "model-serving": "Model Serving / Runtimes",
    "litellm": "Model Serving / Runtimes",
    "vector-db": "Vector Databases",
    "vector-search": "Vector Databases",
    "milvus": "Vector Databases",
    "qdrant": "Vector Databases",
    "weaviate": "Vector Databases",
    "chromadb": "Vector Databases",
    "deepspeed": "Distributed Compute / Infra",
    "distributed": "Distributed Compute / Infra",
    "gpu-sharing": "Distributed Compute / Infra",
    "eval": "Evaluation Frameworks",
    "evaluation": "Evaluation Frameworks",
    "benchmark": "Evaluation Frameworks",
    "fine-tune": "Fine-tuning Toolkits",
    "fine-tuning": "Fine-tuning Toolkits",
    "peft": "Fine-tuning Toolkits",
    "lora": "Fine-tuning Toolkits",
    "editor": "DevTools",
    "cli": "DevTools",
    "git": "DevTools",
    "web": "Web Frameworks",
    "fastapi": "Web Frameworks",
    "django": "Web Frameworks",
    "security": "Security",
    "vulnerability": "Security",
    "secrets": "Security",
    "data-engineering": "Data Engineering",
    "etl": "Data Engineering",
    "pipeline": "Data Engineering",
    "blockchain": "Blockchain",
    "ethereum": "Blockchain",
    "smart-contracts": "Blockchain",
    "mcp": "Model Context Protocol",
    "model-context-protocol": "Model Context Protocol",
    "a2a": "Agent-to-Agent"
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

    @staticmethod
    def classify_repo(repo: Repository) -> List[str]:
        """Classify repository based on topics, description, and primary category."""
        matched = set()

        # 1. Check primary category from seed/seeder
        if repo.category and repo.category.lower() not in ("untracked", "default"):
            # Map known categories to canonical category names
            matched.add(repo.category)

        # 2. Check topics
        repo_topics = []
        if repo.topics:
            if isinstance(repo.topics, list):
                repo_topics = repo.topics
            elif isinstance(repo.topics, str):
                try:
                    repo_topics = json.loads(repo.topics)
                except Exception:
                    pass

        for topic in repo_topics:
            topic_lc = topic.lower()
            if topic_lc in SEED_CATEGORY_MAP:
                matched.add(SEED_CATEGORY_MAP[topic_lc])
            # Partial matches
            for key, val in SEED_CATEGORY_MAP.items():
                if key in topic_lc:
                    matched.add(val)

        # 3. Fallback: Check description keywords
        desc_lc = (repo.description or "").lower()
        for key, val in SEED_CATEGORY_MAP.items():
            if f" {key} " in f" {desc_lc} ":
                matched.add(val)

        # If nothing matched, default to "OSS Tools"
        if not matched:
            matched.add("OSS Tools")

        return sorted(list(matched))


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
    async def build_relationships(cls, pivot: Repository, db: Session) -> Dict[str, Any]:
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
        strength = EcosystemStrengthScorer.calculate_category_strength(primary_category, db)

        # Retrieve alternatives and companions
        rels = await RelationshipGraphEngine.build_relationships(repo, db)
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
            return res or "Failed to generate report narrative."
        except Exception as exc:
            logger.warning(f"Groq ecosystem report generation failed: {exc}")
            return "Failed to generate ecosystem report."
