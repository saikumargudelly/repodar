"""
Resilient LLM Client Wrapper with Multi-Provider Fallback.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from app.utils.llm_providers import FallbackLLMProvider, get_active_providers, GROQ_API_KEY as ACTUAL_GROQ_API_KEY

logger = logging.getLogger(__name__)

# To maintain compatibility with modules that check `if not GROQ_API_KEY:`,
# we set GROQ_API_KEY to a truthy dummy value if any provider is configured.
class LLMConfigProxy(str):
    def __new__(cls):
        return super().__new__(cls, ACTUAL_GROQ_API_KEY or "llm_is_configured_proxy")

    def __bool__(self) -> bool:
        return len(get_active_providers()) > 0

    def __len__(self) -> int:
        return len(get_active_providers())

    def __eq__(self, other):
        if other == "":
            return not bool(self)
        return super().__eq__(other)

    def __ne__(self, other):
        if other == "":
            return bool(self)
        return super().__ne__(other)

GROQ_API_KEY = LLMConfigProxy()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

_fallback_provider = FallbackLLMProvider()

async def async_chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 800,
    response_format: Optional[Dict[str, str]] = None,
    fallback_text: Optional[str] = None,
) -> Optional[str]:
    """
    Perform a safe, rate-limit-resilient async chat completion with multi-provider fallback.
    Returns the generated text, or fallback_text if it fails after all retries.
    """
    if not GROQ_API_KEY:
        logger.warning("No LLM providers configured. Skipping LLM request.")
        return fallback_text

    # Pre-emptively cap input tokens by limiting message character count
    # Average 4 characters per token; cap total prompt content to ~8,000 characters (~2,000 tokens)
    sanitized_messages = []
    for msg in messages:
        content = msg.get("content", "")
        if len(content) > 8000:
            logger.info(f"Truncating prompt message from {len(content)} to 8000 characters to prevent TPM limits")
            content = content[:8000] + "\n[Content truncated to prevent rate limits...]"
        sanitized_messages.append({"role": msg["role"], "content": content})

    try:
        return await _fallback_provider.chat_completion(
            messages=sanitized_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        )
    except Exception as exc:
        logger.error(f"LLM request failed across all providers: {exc}", exc_info=True)
        return fallback_text

def sync_chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 800,
    response_format: Optional[Dict[str, str]] = None,
    fallback_text: Optional[str] = None,
) -> Optional[str]:
    """
    Perform a safe, rate-limit-resilient sync chat completion with multi-provider fallback.
    Returns the generated text, or fallback_text if it fails after all retries.
    """
    if not GROQ_API_KEY:
        logger.warning("No LLM providers configured. Skipping LLM request.")
        return fallback_text

    sanitized_messages = []
    for msg in messages:
        content = msg.get("content", "")
        if len(content) > 8000:
            content = content[:8000] + "\n[Content truncated to prevent rate limits...]"
        sanitized_messages.append({"role": msg["role"], "content": content})

    try:
        return _fallback_provider.chat_completion_sync(
            messages=sanitized_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        )
    except Exception as exc:
        logger.error(f"LLM request failed across all providers: {exc}", exc_info=True)
        return fallback_text
