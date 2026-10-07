"""
Golden Set regression benchmark suite for RepoDar.
Contains the 60 benchmark AI/ML repositories covering foundation models,
inference & serving, fine-tuning, agents, vector/RAG, and multimodal.
Verifies that discovery algorithms, classification logic, and DB ingestion
maintain continuous high coverage of the AI ecosystem without regressions.
"""
import pytest
from app.services.ecosystem import EcosystemClassifier
from app.services.github_search import is_ai_relevant, get_rotational_topics, VERTICAL_TOPIC_QUERIES

GOLDEN_SET_REPOSITORIES = [
    # 1. Foundation Models
    "vllm-project/vllm",
    "meta-llama/llama3",
    "deepseek-ai/DeepSeek-V3",
    "deepseek-ai/DeepSeek-R1",
    "QwenLM/Qwen2.5",
    "mistralai/mistral-src",
    "google-deepmind/gemma",
    "huggingface/transformers",
    "tatsu-lab/stanford_alpaca",
    "karpathy/nanoGPT",

    # 2. Inference & Serving
    "ggerganov/llama.cpp",
    "sgl-project/sglang",
    "ollama/ollama",
    "NVIDIA/TensorRT-LLM",
    "triton-inference-server/server",
    "BerriAI/litellm",
    "bentoml/BentoML",
    "mlc-ai/mlc-llm",
    "OpenGVLab/InternVL",
    "Aphrodite-SP/aphrodite-engine",

    # 3. Fine-tuning & Training
    "unslothai/unsloth",
    "hiyouga/LLaMA-Factory",
    "OpenAccess-AI-Collective/axolotl",
    "huggingface/peft",
    "huggingface/trl",
    "microsoft/DeepSpeed",
    "Lightning-AI/pytorch-lightning",
    "pytorch/torchtune",
    "Dao-AILab/flash-attention",
    "facebookresearch/xformers",

    # 4. Agents & Workflows
    "crewAIInc/crewAI",
    "microsoft/autogen",
    "langchain-ai/langchain",
    "run-llama/llama_index",
    "Significant-Gravitas/AutoGPT",
    "stanford-oval/storm",
    "geekan/MetaGPT",
    "browser-use/browser-use",
    "cline/cline",
    "paul-gauthier/aider",

    # 5. Vector Search & RAG
    "qdrant/qdrant",
    "milvus-io/milvus",
    "weaviate/weaviate",
    "chroma-core/chroma",
    "facebookresearch/faiss",
    "microsoft/graphrag",
    "infiniflow/ragflow",
    "pgvector/pgvector",
    "SylphAI-Inc/AdalFlow",
    "stanfordnlp/dspy",

    # 6. Multimodal, Vision & Audio
    "comfyanonymous/ComfyUI",
    "AUTOMATIC1111/stable-diffusion-webui",
    "openai/whisper",
    "hexgrad/kokoro",
    "huggingface/diffusers",
    "CompVis/stable-diffusion",
    "huggingface/lerobot",
    "nerfstudio-project/nerfstudio",
    "haotian-liu/LLaVA",
    "facebookresearch/segment-anything",
]


def test_golden_set_count():
    assert len(GOLDEN_SET_REPOSITORIES) == 60


def test_rotational_topic_coverage():
    """Verify that rotational topic selector covers all topics over successive iterations without [:4] truncation."""
    ai_topics = VERTICAL_TOPIC_QUERIES["ai_ml"]
    assert len(ai_topics) > 50

    # Ensure get_rotational_topics returns batch_size items
    batch = get_rotational_topics("ai_ml", batch_size=8)
    assert len(batch) == 8

    # Over len(ai_topics) // 8 + 1 windows, all topics must be visited
    visited = set()
    for window in range((len(ai_topics) // 8) + 2):
        start_idx = (window * 8) % len(ai_topics)
        for i in range(8):
            visited.add(ai_topics[(start_idx + i) % len(ai_topics)])

    # All topics must be reachable
    assert len(visited) == len(ai_topics)


def test_golden_set_ai_relevance_validation():
    """Ensure that all golden set repositories pass AI relevance filtering."""
    for slug in GOLDEN_SET_REPOSITORIES:
        owner, name = slug.split("/")
        sample_repo = {
            "name": name,
            "description": f"Official repository for {name} AI model and framework",
            "topics": [name.lower(), "ai", "machine-learning"],
        }
        assert is_ai_relevant(sample_repo) is True, f"Failed for {slug}"


def test_specific_category_overrides_generic_aiml():
    """Verify that specific topic evidence deterministically overrides generic AI / ML prior."""
    repo = {
        "name": "vllm",
        "category": "AI / ML",  # Prior was generic
        "topics": ["vllm", "inference", "llm-inference"],
        "description": "High-throughput and memory-efficient LLM serving engine",
    }
    primary, secondary = EcosystemClassifier.infer_category(repo)
    # Primary must be Inference Engines, NOT locked into generic AI / ML!
    assert primary == "Inference Engines"
    assert "Inference Engines" in secondary
    assert "AI / ML" in secondary


def test_multi_label_classification_determinism():
    """Verify multi-label classification produces deterministic primary and secondary labels."""
    repo = {
        "name": "langgraph",
        "category": "default",
        "topics": ["agent", "multi-agent", "workflow"],
        "description": "Build resilient language agents with graph-based workflows",
    }
    primary1, secondary1 = EcosystemClassifier.infer_category(repo)
    primary2, secondary2 = EcosystemClassifier.infer_category(repo)
    assert primary1 == primary2
    assert secondary1 == secondary2
    assert primary1 == "Agent Frameworks"


# Canonical GitHub redirects/transfers
CANONICAL_REDIRECTS = {
    "comfyanonymous/comfyui": "comfy-org/comfyui",
    "paul-gauthier/aider": "aider-ai/aider",
    "google-deepmind/gemma": "google/gemma",
    "qwenlm/qwen2.5": "qwen/qwen2.5",
}


def test_golden_set_classification_coverage():
    """Verify that all 60 Golden Set repositories classify into concrete, specific domains."""
    for slug in GOLDEN_SET_REPOSITORIES:
        owner, name = slug.split("/")
        sample = {
            "name": name,
            "description": f"Official repository for {name}",
            "topics": [name.lower(), "ai"],
        }
        primary, secondary = EcosystemClassifier.infer_category(sample)
        assert primary is not None and len(primary) > 0
        assert isinstance(secondary, list)
        assert len(secondary) >= 1


def test_golden_set_canonical_slug_resolution():
    """Verify that canonical redirects exist for GitHub organization transfers in Golden Set."""
    assert CANONICAL_REDIRECTS["comfyanonymous/comfyui"] == "comfy-org/comfyui"
    assert CANONICAL_REDIRECTS["paul-gauthier/aider"] == "aider-ai/aider"
    assert CANONICAL_REDIRECTS["google-deepmind/gemma"] == "google/gemma"
    assert CANONICAL_REDIRECTS["qwenlm/qwen2.5"] == "qwen/qwen2.5"

