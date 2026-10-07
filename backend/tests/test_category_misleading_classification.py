import pytest
from app.services.ecosystem import EcosystemClassifier
from app.routers.search import VERTICAL_CATEGORY_MAP


def test_skills_and_developer_tools_not_classified_as_aiml():
    """Verify that personal skills directories and shell tools are classified as DevTools, not AI / ML."""
    matt_skills = {
        "name": "skills",
        "primary_language": "Shell",
        "topics": [],
        "description": "My personal directory of skills, straight from my .claude directory.",
        "category": "AI / ML",  # Prior legacy category
    }
    primary, secondary = EcosystemClassifier.infer_category(matt_skills)
    assert primary == "DevTools", f"Expected DevTools, got {primary}"
    assert "LLM Models" not in secondary, "Mentioning .claude directory should not make a shell repo an LLM Model"


def test_mcp_servers_classified_as_model_context_protocol():
    """Verify that MCP servers and tools classify as Model Context Protocol, not generic AI / ML."""
    mcp_repo = {
        "name": "codebase-memory-mcp",
        "primary_language": "C",
        "topics": ["mcp", "mcp-server", "model-context-protocol", "code-intelligence"],
        "description": "High-performance code intelligence MCP server.",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(mcp_repo)
    assert primary == "Model Context Protocol", f"Expected Model Context Protocol, got {primary}"
    assert primary in secondary


def test_agent_applications_not_classified_as_generic_aiml():
    """Verify that agent frameworks and agent applications classify as Agent Frameworks."""
    open_montage = {
        "name": "OpenMontage",
        "primary_language": "Python",
        "topics": ["agent", "agentic-ai", "video-production"],
        "description": "World's first open-source, agentic video production system.",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(open_montage)
    assert primary == "Agent Frameworks", f"Expected Agent Frameworks, got {primary}"


def test_educational_and_awesome_lists_fallback_to_oss_tools():
    """Verify that non-AI learning repositories, books, and awesome lists fall back to OSS Tools."""
    byox = {
        "name": "build-your-own-x",
        "primary_language": "Markdown",
        "topics": ["programming", "tutorials", "awesome-list"],
        "description": "Master programming by recreating your favorite technologies from scratch.",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(byox)
    assert primary == "OSS Tools", f"Expected OSS Tools, got {primary}"

    ydkjs = {
        "name": "You-Dont-Know-JS",
        "primary_language": None,
        "topics": ["javascript", "book-series", "education"],
        "description": "A book series on the JS language.",
        "category": "AI / ML",
    }
    primary_ydk, _ = EcosystemClassifier.infer_category(ydkjs)
    assert primary_ydk == "OSS Tools", f"Expected OSS Tools, got {primary_ydk}"


def test_model_provider_desc_keywords_do_not_falsely_classify_llm_models():
    """Verify that mentioning claude, openai, chatgpt in descriptions does not falsely trigger LLM Models."""
    wrapper_tool = {
        "name": "git-summarizer",
        "primary_language": "Python",
        "topics": ["git", "developer-tools"],
        "description": "Generate git commit messages using openai or claude API",
        "category": "default",
    }
    primary, secondary = EcosystemClassifier.infer_category(wrapper_tool)
    assert primary == "DevTools", f"Expected DevTools, got {primary}"
    assert "LLM Models" not in secondary


def test_vertical_category_map_includes_model_context_protocol():
    """Ensure Model Context Protocol is included in ai_ml vertical definition."""
    assert "Model Context Protocol" in VERTICAL_CATEGORY_MAP["ai_ml"]
    assert "Agent Frameworks" in VERTICAL_CATEGORY_MAP["ai_ml"]
    assert "Inference Engines" in VERTICAL_CATEGORY_MAP["ai_ml"]
    assert "DevTools" not in VERTICAL_CATEGORY_MAP["ai_ml"]
    assert "OSS Tools" not in VERTICAL_CATEGORY_MAP["ai_ml"]


def test_data_infra_vertical_map_includes_data_and_infra():
    """Ensure Data & Infra is included in data_infra vertical definition so repos are not orphaned."""
    assert "Data & Infra" in VERTICAL_CATEGORY_MAP["data_infra"]
    assert "Data Engineering" in VERTICAL_CATEGORY_MAP["data_infra"]


def test_multi_label_category_assignment():
    """Verify that multi-label categories JSON contains both primary and complementary categories."""
    mcp_tool = {
        "name": "agent-mcp-server",
        "primary_language": "TypeScript",
        "topics": ["mcp", "agent", "devtools"],
        "description": "Agent server implementing model context protocol tools",
        "category": "default",
    }
    primary, secondary = EcosystemClassifier.infer_category(mcp_tool)
    assert primary in ("Model Context Protocol", "Agent Frameworks")
    assert "Model Context Protocol" in secondary
    assert "Agent Frameworks" in secondary


def test_skills_repo_with_llm_in_description_has_no_llm_models_secondary():
    """Verify that repos with 'LLM' in description (like andrej-karpathy-skills) are not tagged as LLM Models."""
    skills_repo = {
        "name": "andrej-karpathy-skills",
        "primary_language": "Shell",
        "topics": [],
        "description": "A single CLAUDE.md file to improve Claude Code behavior, derived from Andrej Karpathy's observations on LLM coding pitfalls.",
        "category": "DevTools",
    }
    primary, secondary = EcosystemClassifier.infer_category(skills_repo)
    assert primary == "DevTools"
    assert "LLM Models" not in secondary, f"Expected LLM Models not in secondary, got {secondary}"


def test_networking_and_data_tools_not_contaminated_with_aiml():
    """Verify that generic networking/storage repos are not contaminated with AI / ML."""
    iroh_repo = {
        "name": "iroh",
        "primary_language": "Rust",
        "topics": ["rust", "p2p", "quic"],
        "description": "Modular networking stack in Rust.",
        "category": "OSS Tools",
    }
    primary, secondary = EcosystemClassifier.infer_category(iroh_repo)
    assert primary == "OSS Tools"
    assert "AI / ML" not in secondary, f"Expected AI / ML not in secondary, got {secondary}"


def test_speech_audio_specialized_from_generic_aiml():
    """Verify that speech, TTS, and voice-cloning tools specialize from generic AI / ML."""
    tts_repo = {
        "name": "TTS",
        "primary_language": "Python",
        "topics": ["tts", "text-to-speech", "deep-learning", "voice-cloning"],
        "description": "Deep learning toolkit for Text2Speech synthesis.",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(tts_repo)
    assert primary == "Speech & Audio"
    assert "Speech & Audio" in secondary
    assert "AI / ML" in secondary


def test_image_generation_specialized_from_generic_aiml():
    """Verify that ComfyUI, diffusion models, and face restoration specialize to Image Generation."""
    comfy_repo = {
        "name": "ComfyUI",
        "primary_language": "Python",
        "topics": ["stable-diffusion", "comfyui", "pytorch", "ai"],
        "description": "The most powerful and modular diffusion model GUI, api and backend.",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(comfy_repo)
    assert primary == "Image Generation"
    assert "Image Generation" in secondary
    assert "AI / ML" in secondary


def test_multimodal_vision_specialized_from_generic_aiml():
    """Verify that OCR and computer vision recognition tools specialize to Multimodal."""
    ocr_repo = {
        "name": "PaddleOCR",
        "primary_language": "Python",
        "topics": ["ocr", "chineseocr", "document-parsing"],
        "description": "Turn any PDF or image document into structured data.",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(ocr_repo)
    assert primary == "Multimodal"
    assert "Multimodal" in secondary
    assert "AI / ML" in secondary


def test_science_research_specialized_from_generic_aiml():
    """Verify that computational biology, genomics, and bioinformatics specialize to Science & Research."""
    bio_repo = {
        "name": "scanpy",
        "primary_language": "Python",
        "topics": ["bioinformatics", "single-cell", "genomics", "data-analysis"],
        "description": "Single-Cell Analysis in Python. Scales to >1M cells.",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(bio_repo)
    assert primary == "Science & Research"
    assert "Science & Research" in secondary
    assert "AI / ML" in secondary


def test_julia_classified_as_devtools_not_aiml():
    """Verify that Julia language compiler classifies as DevTools, not AI / ML."""
    julia_repo = {
        "name": "julia",
        "primary_language": "Julia",
        "topics": ["julia", "programming-language"],
        "description": "The Julia Programming Language",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(julia_repo)
    assert primary == "DevTools"


def test_foundational_ml_frameworks_retained_as_aiml():
    """Verify that genuine foundational machine learning libraries retain AI / ML classification."""
    pytorch_repo = {
        "name": "pytorch",
        "primary_language": "Python",
        "topics": ["neural-network", "deep-learning", "machine-learning", "tensor"],
        "description": "Tensors and Dynamic neural networks in Python with strong GPU acceleration",
        "category": "AI / ML",
    }
    primary, secondary = EcosystemClassifier.infer_category(pytorch_repo)
    assert primary == "AI / ML"

    sklearn_repo = {
        "name": "scikit-learn",
        "primary_language": "Python",
        "topics": ["machine-learning", "data-science", "data-analysis"],
        "description": "scikit-learn: machine learning in Python",
        "category": "AI / ML",
    }
    primary_sk, secondary_sk = EcosystemClassifier.infer_category(sklearn_repo)
    assert primary_sk == "AI / ML"


