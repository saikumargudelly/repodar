"""
Resilient LLM Client Wrapper for Groq.

Features:
1. Global Concurrency Limit: Limits concurrent requests to Groq (RPM mitigation).
2. Exponential Backoff with Jitter: Retries on RateLimitError and APIStatusErrors (HTTP 429/5xx).
3. Token Capping: Truncates user input if it exceeds safe lengths (TPM mitigation).
4. Synchronous & Asynchronous support.
5. Safe Fallbacks: Gracefully returns None or a fallback string instead of crashing.
"""

import os
import logging
import asyncio
import random
from typing import List, Dict, Any, Optional
from groq import AsyncGroq, Groq
from groq import RateLimitError, APIStatusError, APIConnectionError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Instantiations
async_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
sync_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Concurrency semaphore: prevent slamming the Groq API concurrently
# Low-tier/Always-Free Groq API keys have low RPM limits (e.g. 30 RPM)
_groq_semaphore = asyncio.Semaphore(2)

def _is_rate_limit_or_server_error(exception: Exception) -> bool:
    """Check if the exception is due to rate limits or temporary server errors."""
    if isinstance(exception, RateLimitError):
        return True
    if isinstance(exception, APIConnectionError):
        return True
    if isinstance(exception, APIStatusError):
        # Retry on HTTP 429 (Rate Limit) and HTTP 5xx (Server Error)
        return exception.status_code == 429 or exception.status_code >= 500
    return False

@retry(
    stop=stop_after_attempt(5),
    wait=wait_random_exponential(multiplier=1, max=10),
    retry=retry_if_exception_type((RateLimitError, APIConnectionError, APIStatusError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
async def _execute_async_chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 800,
    response_format: Optional[Dict[str, str]] = None,
) -> str:
    """Internal helper with Tenacity retries for async completions."""
    if not async_client:
        raise ValueError("Async Groq client is not configured (missing GROQ_API_KEY)")
    
    kwargs = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        kwargs["response_format"] = response_format

    async with _groq_semaphore:
        response = await async_client.chat.completions.create(**kwargs)
        return (response.choices[0].message.content or "").strip()

async def async_chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 800,
    response_format: Optional[Dict[str, str]] = None,
    fallback_text: Optional[str] = None,
) -> Optional[str]:
    """
    Perform a safe, rate-limit-resilient async chat completion.
    Returns the generated text, or fallback_text if it fails after all retries.
    """
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured. Skipping LLM request.")
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
        return await _execute_async_chat_completion(
            messages=sanitized_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        )
    except Exception as exc:
        logger.error(f"Groq API async request failed after retries: {exc}", exc_info=True)
        return fallback_text

# Synchronous wrapper with tenancy retries
@retry(
    stop=stop_after_attempt(5),
    wait=wait_random_exponential(multiplier=1, max=10),
    retry=retry_if_exception_type((RateLimitError, APIConnectionError, APIStatusError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
def _execute_sync_chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 800,
    response_format: Optional[Dict[str, str]] = None,
) -> str:
    """Internal helper with Tenacity retries for sync completions."""
    if not sync_client:
        raise ValueError("Sync Groq client is not configured (missing GROQ_API_KEY)")
    
    kwargs = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        kwargs["response_format"] = response_format

    response = sync_client.chat.completions.create(**kwargs)
    return (response.choices[0].message.content or "").strip()

def sync_chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 800,
    response_format: Optional[Dict[str, str]] = None,
    fallback_text: Optional[str] = None,
) -> Optional[str]:
    """
    Perform a safe, rate-limit-resilient sync chat completion.
    Returns the generated text, or fallback_text if it fails after all retries.
    """
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured. Skipping LLM request.")
        return fallback_text

    sanitized_messages = []
    for msg in messages:
        content = msg.get("content", "")
        if len(content) > 8000:
            content = content[:8000] + "\n[Content truncated to prevent rate limits...]"
        sanitized_messages.append({"role": msg["role"], "content": content})

    try:
        return _execute_sync_chat_completion(
            messages=sanitized_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        )
    except Exception as exc:
        logger.error(f"Groq API sync request failed after retries: {exc}", exc_info=True)
        return fallback_text
