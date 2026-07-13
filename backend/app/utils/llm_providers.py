import os
import logging
import asyncio
import time
import httpx
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Configurable timeouts
TIMEOUT_SECONDS = 20.0

# API Keys and endpoints (initialized to None to support dynamic env loading and test mocking)
GEMINI_API_KEY = None
CEREBRAS_API_KEY = None
GROQ_API_KEY = None

GEMINI_MODEL = None
CEREBRAS_MODEL = None
GROQ_MODEL = None

SUPPORTED_MODELS = {
    "Gemini": {
        "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
        "default": "gemini-2.5-flash"
    },
    "Cerebras": {
        "models": ["gemma-4-31b", "gpt-oss-120b", "zai-glm-4.7", "llama3.1-8b", "llama3.1-70b", "llama-3.3-70b"],
        "default": "gemma-4-31b"
    },
    "Groq": {
        "models": ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"],
        "default": "llama-3.3-70b-versatile"
    }
}

def _get_gemini_key() -> str:
    val = globals().get("GEMINI_API_KEY")
    if val is None:
        return os.getenv("GEMINI_API_KEY", "").strip()
    return val

def _get_gemini_model() -> str:
    val = globals().get("GEMINI_MODEL")
    if val is None:
        val = os.getenv("GEMINI_MODEL", "").strip()
    if not val:
        return SUPPORTED_MODELS["Gemini"]["default"]
    if val not in SUPPORTED_MODELS["Gemini"]["models"]:
        logger.warning(f"Configured Gemini model '{val}' is not supported. Falling back to '{SUPPORTED_MODELS['Gemini']['default']}'.")
        return SUPPORTED_MODELS["Gemini"]["default"]
    return val

def _get_cerebras_key() -> str:
    val = globals().get("CEREBRAS_API_KEY")
    if val is None:
        return os.getenv("CEREBRAS_API_KEY", "").strip()
    return val

def _get_cerebras_model() -> str:
    val = globals().get("CEREBRAS_MODEL")
    if val is None:
        val = os.getenv("CEREBRAS_MODEL", "").strip()
    if not val:
        return SUPPORTED_MODELS["Cerebras"]["default"]
    if val not in SUPPORTED_MODELS["Cerebras"]["models"]:
        logger.warning(f"Configured Cerebras model '{val}' is not supported. Falling back to '{SUPPORTED_MODELS['Cerebras']['default']}'.")
        return SUPPORTED_MODELS["Cerebras"]["default"]
    return val

def _get_groq_key() -> str:
    val = globals().get("GROQ_API_KEY")
    if val is None:
        return os.getenv("GROQ_API_KEY", "").strip()
    return val

def _get_groq_model() -> str:
    val = globals().get("GROQ_MODEL")
    if val is None:
        val = os.getenv("GROQ_MODEL", "").strip()
    if not val:
        return SUPPORTED_MODELS["Groq"]["default"]
    if val not in SUPPORTED_MODELS["Groq"]["models"]:
        logger.warning(f"Configured Groq model '{val}' is not supported. Falling back to '{SUPPORTED_MODELS['Groq']['default']}'.")
        return SUPPORTED_MODELS["Groq"]["default"]
    return val

# Shared HTTP Clients for connection pooling
_async_client = httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
_sync_client = httpx.Client(timeout=TIMEOUT_SECONDS)

from dataclasses import dataclass
import json
from typing import Union, Callable

# Custom Pipeline Exceptions
class LLMOrchestrationError(RuntimeError):
    """Base error for all LLM orchestration pipeline exceptions."""
    pass

class ProviderRequestError(LLMOrchestrationError):
    """HTTP or network-level error during the provider API request."""
    pass

class ResponseExtractionError(LLMOrchestrationError):
    """Failed to extract text or metadata from the provider response payload."""
    pass

class EmptyResponseError(LLMOrchestrationError):
    """Provider returned an empty or whitespace-only response text."""
    pass

class FormatValidationError(LLMOrchestrationError):
    """Fallback compatibility wrapper for format errors."""
    pass

class JSONParseError(LLMOrchestrationError):
    """Failed to parse output as valid JSON when JSON was required."""
    pass

class SchemaValidationError(LLMOrchestrationError):
    """JSON output is missing required keys or fields."""
    pass

class BusinessValidationError(LLMOrchestrationError):
    """JSON output fields failed semantic business validation (e.g. empty analysis sections)."""
    pass


@dataclass
class LLMResponse:
    text: str
    provider: str
    model: str
    latency_ms: float
    status_code: Optional[int]
    finish_reason: Optional[str]
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    raw_response: Union[dict, str, None] = None


@dataclass
class ProviderStats:
    successes: int = 0
    failures: int = 0
    total_latency_ms: float = 0.0
    timeouts: int = 0
    rate_limits: int = 0
    json_failures: int = 0
    schema_failures: int = 0
    consecutive_failures: int = 0
    cooldown_until: float = 0.0


class ProviderHealthManager:
    def __init__(self, cooldown_duration_sec: float = 60.0, max_consecutive_failures: int = 3):
        self.cooldown_duration_sec = cooldown_duration_sec
        self.max_consecutive_failures = max_consecutive_failures
        self.stats: Dict[str, ProviderStats] = {}

    def get_stats(self, provider_name: str) -> ProviderStats:
        if provider_name not in self.stats:
            self.stats[provider_name] = ProviderStats()
        return self.stats[provider_name]

    def is_healthy(self, provider_name: str) -> bool:
        stats = self.get_stats(provider_name)
        now = time.time()
        if stats.cooldown_until > now:
            return False
        return True

    def record_success(self, provider_name: str, latency_ms: float):
        stats = self.get_stats(provider_name)
        stats.successes += 1
        stats.total_latency_ms += latency_ms
        stats.consecutive_failures = 0
        stats.cooldown_until = 0.0

    def record_failure(self, provider_name: str, error_type: str):
        stats = self.get_stats(provider_name)
        stats.failures += 1
        stats.consecutive_failures += 1
        
        if error_type == "timeout":
            stats.timeouts += 1
        elif error_type == "rate_limit":
            stats.rate_limits += 1
        elif error_type == "json_parsing":
            stats.json_failures += 1
        elif error_type == "schema_validation":
            stats.schema_failures += 1

        if stats.consecutive_failures >= self.max_consecutive_failures:
            stats.cooldown_until = time.time() + self.cooldown_duration_sec
            logger.warning(
                f"[LLM Health] Provider {provider_name} has failed {stats.consecutive_failures} times consecutively. "
                f"Placing in cooldown for {self.cooldown_duration_sec}s."
            )

health_manager = ProviderHealthManager()


def validate_llm_output(
    response_text: str,
    require_json: bool = False,
    required_keys: Optional[List[str]] = None,
    min_content_length: Optional[int] = None,
    custom_validator: Optional[Callable[[Any], bool]] = None,
) -> None:
    """
    Validates LLM response. Raises specific orchestration exceptions.
    """
    # 1. Empty response check
    if not response_text or not response_text.strip():
        raise EmptyResponseError("LLM response text is empty or only whitespace.")

    # 2. Min content length check
    if min_content_length and len(response_text.strip()) < min_content_length:
        raise BusinessValidationError(f"Response length {len(response_text)} is less than minimum {min_content_length}.")

    if not require_json and not required_keys:
        return

    # 3. JSON Parsing
    text_to_parse = response_text.strip()
    if text_to_parse.startswith("```"):
        parts = text_to_parse.split("```")
        if len(parts) >= 3:
            text_to_parse = parts[1]
            if text_to_parse.startswith("json"):
                text_to_parse = text_to_parse[4:]
    
    try:
        parsed = json.loads(text_to_parse.strip())
    except json.JSONDecodeError as e:
        raise JSONParseError(f"Failed to parse JSON: {e}") from e

    # 4. Schema validation (required keys)
    if required_keys:
        if not isinstance(parsed, dict):
            raise SchemaValidationError(f"Expected a JSON object/dict, got: {type(parsed)}")
        
        for key in required_keys:
            if key not in parsed:
                raise SchemaValidationError(f"Missing required key: '{key}'")
            
            # 5. Business validation (empty analysis sections)
            val = parsed[key]
            if val is None:
                raise BusinessValidationError(f"Required key '{key}' has null value.")
            if isinstance(val, str) and not val.strip():
                raise BusinessValidationError(f"Required key '{key}' has empty/whitespace string value.")
            if isinstance(val, list) and not val:
                raise BusinessValidationError(f"Required key '{key}' has empty list value.")

    # 6. Custom Validator
    if custom_validator:
        try:
            valid = custom_validator(parsed)
            if not valid:
                raise BusinessValidationError("Custom validation failed.")
        except Exception as e:
            raise BusinessValidationError(f"Custom validator raised error: {e}") from e


class BaseLLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        pass

    @abstractmethod
    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        pass

    def _extract_text(self, resp_data: Any) -> str:
        raise NotImplementedError()

    def _extract_finish_reason(self, resp_data: Any) -> Optional[str]:
        return None

    def _extract_token_usage(self, resp_data: Any) -> tuple[Optional[int], Optional[int], Optional[int]]:
        return None, None, None


class GeminiProvider(BaseLLMProvider):
    @property
    def name(self) -> str:
        return "Gemini"

    def is_configured(self) -> bool:
        return bool(_get_gemini_key())

    def _prepare_request(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, str]],
    ) -> Dict[str, Any]:
        system_prompt = None
        contents = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                system_prompt = content
            else:
                gemini_role = "model" if role == "assistant" else "user"
                contents.append({
                    "role": gemini_role,
                    "parts": [{"text": content}]
                })

        model = _get_gemini_model()
        body = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if system_prompt:
            body["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }
        if response_format and response_format.get("type") == "json_object":
            body["generationConfig"]["responseMimeType"] = "application/json"

        # Disable thinking budget for Gemini 2.5 reasoning models to prevent truncated outputs
        if "2.5" in model:
            body["generationConfig"]["thinkingConfig"] = {
                "thinkingBudget": 0
            }

        return body

    def _extract_text(self, resp_data: Any) -> str:
        try:
            candidates = resp_data.get("candidates", [])
            if not candidates:
                raise ResponseExtractionError(f"No candidates returned by Gemini. Response: {resp_data}")
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                raise ResponseExtractionError(f"No content parts returned by Gemini. Response: {resp_data}")
            text = parts[0].get("text", "")
            return text.strip()
        except (KeyError, IndexError, TypeError) as e:
            raise ResponseExtractionError(f"Unexpected response structure from Gemini: {resp_data}") from e

    def _extract_finish_reason(self, resp_data: Any) -> Optional[str]:
        try:
            candidates = resp_data.get("candidates", [])
            if candidates:
                return candidates[0].get("finishReason")
        except Exception:
            pass
        return None

    def _extract_token_usage(self, resp_data: Any) -> tuple[Optional[int], Optional[int], Optional[int]]:
        try:
            meta = resp_data.get("usageMetadata", {})
            prompt = meta.get("promptTokenCount")
            completion = meta.get("candidatesTokenCount")
            total = meta.get("totalTokenCount")
            return prompt, completion, total
        except Exception:
            pass
        return None, None, None

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        api_key = _get_gemini_key()
        model = _get_gemini_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        start_time = time.perf_counter()
        try:
            response = await _async_client.post(url, json=body)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            raise ProviderRequestError(f"HTTP request failed: {e}") from e
            
        latency_ms = (time.perf_counter() - start_time) * 1000
        text = self._extract_text(resp_json)
        finish_reason = self._extract_finish_reason(resp_json)
        p_tok, c_tok, t_tok = self._extract_token_usage(resp_json)

        return LLMResponse(
            text=text,
            provider=self.name,
            model=model,
            latency_ms=latency_ms,
            status_code=response.status_code,
            finish_reason=finish_reason,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            raw_response=resp_json,
        )

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        api_key = _get_gemini_key()
        model = _get_gemini_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        start_time = time.perf_counter()
        try:
            response = _sync_client.post(url, json=body)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            raise ProviderRequestError(f"HTTP request failed: {e}") from e
            
        latency_ms = (time.perf_counter() - start_time) * 1000
        text = self._extract_text(resp_json)
        finish_reason = self._extract_finish_reason(resp_json)
        p_tok, c_tok, t_tok = self._extract_token_usage(resp_json)

        return LLMResponse(
            text=text,
            provider=self.name,
            model=model,
            latency_ms=latency_ms,
            status_code=response.status_code,
            finish_reason=finish_reason,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            raw_response=resp_json,
        )


class CerebrasProvider(BaseLLMProvider):
    @property
    def name(self) -> str:
        return "Cerebras"

    def is_configured(self) -> bool:
        return bool(_get_cerebras_key())

    def _prepare_request(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, str]],
    ) -> Dict[str, Any]:
        model = _get_cerebras_model()
        body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # Disable response_format for Cerebras as it causes token repetition loops (e.g. on gemma-4-31b)
        # We rely instead on our strict prompting and robust JSON validation parser.
        # if response_format:
        #     body["response_format"] = response_format
        return body

    def _extract_text(self, resp_data: Any) -> str:
        try:
            return resp_data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as e:
            raise ResponseExtractionError(f"Unexpected response structure from Cerebras: {resp_data}") from e

    def _extract_finish_reason(self, resp_data: Any) -> Optional[str]:
        try:
            return resp_data["choices"][0].get("finish_reason")
        except Exception:
            pass
        return None

    def _extract_token_usage(self, resp_data: Any) -> tuple[Optional[int], Optional[int], Optional[int]]:
        try:
            usage = resp_data.get("usage", {})
            prompt = usage.get("prompt_tokens")
            completion = usage.get("completion_tokens")
            total = usage.get("total_tokens")
            return prompt, completion, total
        except Exception:
            pass
        return None, None, None

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        url = "https://api.cerebras.ai/v1/chat/completions"
        api_key = _get_cerebras_key()
        model = _get_cerebras_model()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        start_time = time.perf_counter()
        try:
            response = await _async_client.post(url, headers=headers, json=body)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            raise ProviderRequestError(f"HTTP request failed: {e}") from e
            
        latency_ms = (time.perf_counter() - start_time) * 1000
        text = self._extract_text(resp_json)
        finish_reason = self._extract_finish_reason(resp_json)
        p_tok, c_tok, t_tok = self._extract_token_usage(resp_json)

        return LLMResponse(
            text=text,
            provider=self.name,
            model=model,
            latency_ms=latency_ms,
            status_code=response.status_code,
            finish_reason=finish_reason,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            raw_response=resp_json,
        )

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        url = "https://api.cerebras.ai/v1/chat/completions"
        api_key = _get_cerebras_key()
        model = _get_cerebras_model()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        start_time = time.perf_counter()
        try:
            response = _sync_client.post(url, headers=headers, json=body)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            raise ProviderRequestError(f"HTTP request failed: {e}") from e
            
        latency_ms = (time.perf_counter() - start_time) * 1000
        text = self._extract_text(resp_json)
        finish_reason = self._extract_finish_reason(resp_json)
        p_tok, c_tok, t_tok = self._extract_token_usage(resp_json)

        return LLMResponse(
            text=text,
            provider=self.name,
            model=model,
            latency_ms=latency_ms,
            status_code=response.status_code,
            finish_reason=finish_reason,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            raw_response=resp_json,
        )


class GroqProvider(BaseLLMProvider):
    @property
    def name(self) -> str:
        return "Groq"

    def is_configured(self) -> bool:
        return bool(_get_groq_key())

    def _prepare_request(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, str]],
    ) -> Dict[str, Any]:
        model = _get_groq_model()
        body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            body["response_format"] = response_format
        return body

    def _extract_text(self, resp_data: Any) -> str:
        try:
            return resp_data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as e:
            raise ResponseExtractionError(f"Unexpected response structure from Groq: {resp_data}") from e

    def _extract_finish_reason(self, resp_data: Any) -> Optional[str]:
        try:
            return resp_data["choices"][0].get("finish_reason")
        except Exception:
            pass
        return None

    def _extract_token_usage(self, resp_data: Any) -> tuple[Optional[int], Optional[int], Optional[int]]:
        try:
            usage = resp_data.get("usage", {})
            prompt = usage.get("prompt_tokens")
            completion = usage.get("completion_tokens")
            total = usage.get("total_tokens")
            return prompt, completion, total
        except Exception:
            pass
        return None, None, None

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        url = "https://api.groq.com/openai/v1/chat/completions"
        api_key = _get_groq_key()
        model = _get_groq_model()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        start_time = time.perf_counter()
        try:
            response = await _async_client.post(url, headers=headers, json=body)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            raise ProviderRequestError(f"HTTP request failed: {e}") from e
            
        latency_ms = (time.perf_counter() - start_time) * 1000
        text = self._extract_text(resp_json)
        finish_reason = self._extract_finish_reason(resp_json)
        p_tok, c_tok, t_tok = self._extract_token_usage(resp_json)

        return LLMResponse(
            text=text,
            provider=self.name,
            model=model,
            latency_ms=latency_ms,
            status_code=response.status_code,
            finish_reason=finish_reason,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            raw_response=resp_json,
        )

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        url = "https://api.groq.com/openai/v1/chat/completions"
        api_key = _get_groq_key()
        model = _get_groq_model()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        start_time = time.perf_counter()
        try:
            response = _sync_client.post(url, headers=headers, json=body)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            raise ProviderRequestError(f"HTTP request failed: {e}") from e
            
        latency_ms = (time.perf_counter() - start_time) * 1000
        text = self._extract_text(resp_json)
        finish_reason = self._extract_finish_reason(resp_json)
        p_tok, c_tok, t_tok = self._extract_token_usage(resp_json)

        return LLMResponse(
            text=text,
            provider=self.name,
            model=model,
            latency_ms=latency_ms,
            status_code=response.status_code,
            finish_reason=finish_reason,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            raw_response=resp_json,
        )


# Registry for dynamic instantiation
PROVIDERS_REGISTRY = {
    "gemini": GeminiProvider,
    "cerebras": CerebrasProvider,
    "groq": GroqProvider,
}


_failed_providers = set()

def get_active_providers() -> List[BaseLLMProvider]:
    order_str = os.getenv("LLM_PROVIDER_ORDER", "gemini,cerebras,groq")
    order = [p.strip().lower() for p in order_str.split(",") if p.strip()]
    
    active = []
    for name in order:
        if name in PROVIDERS_REGISTRY:
            if name in _failed_providers:
                continue
            
            provider_name = name.capitalize() if name != "gemini" else "Gemini"
            if not health_manager.is_healthy(provider_name):
                logger.warning(f"[LLM Health] Skipping provider {provider_name} due to active cooldown.")
                continue

            provider_cls = PROVIDERS_REGISTRY[name]
            provider = provider_cls()
            if provider.is_configured():
                active.append(provider)
            else:
                logger.debug(f"LLM Provider {provider.name} is skipped because it is not configured.")
    return active

async def validate_llm_configuration():
    """
    Validates active LLM providers by firing a lightweight test prompt.
    If a provider fails (unauthorized, rate-limited, etc.), adds it to _failed_providers.
    """
    logger.info("Initializing startup functional validation for configured LLM providers...")
    test_messages = [{"role": "user", "content": "ping"}]
    
    order_str = os.getenv("LLM_PROVIDER_ORDER", "gemini,cerebras,groq")
    order = [p.strip().lower() for p in order_str.split(",") if p.strip()]
    
    for name in order:
        if name in PROVIDERS_REGISTRY:
            provider_cls = PROVIDERS_REGISTRY[name]
            provider = provider_cls()
            if not provider.is_configured():
                logger.info(f"LLM Provider {provider.name} is not configured.")
                continue
                
            logger.info(f"Testing connectivity for LLM Provider: {provider.name}...")
            start_time = time.perf_counter()
            try:
                await provider.chat_completion(test_messages, temperature=0.1, max_tokens=2)
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                logger.info(f"[LLM Start Validation] {provider.name} connectivity check passed in {duration_ms}ms.")
            except Exception as exc:
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                error_msg = get_error_message(exc)
                is_trans = is_transient_error(exc)
                if not is_trans:
                    logger.warning(
                        f"[LLM Start Validation] Provider {provider.name} FAILED functional check in {duration_ms}ms: {error_msg}. "
                        f"Removing {provider.name} from active provider chain permanently."
                    )
                    _failed_providers.add(name)
                else:
                    logger.warning(
                        f"[LLM Start Validation] Provider {provider.name} FAILED functional check due to transient error: {error_msg}. "
                        f"Keeping in active chain (will rely on active cooldown/fallback)."
                    )


def is_transient_error(exc: Exception) -> bool:
    if isinstance(exc, ProviderRequestError) and exc.__cause__:
        exc = exc.__cause__

    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError, asyncio.TimeoutError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code
        # HTTP 429 and 5xx are transient
        return status_code == 429 or status_code >= 500
    if isinstance(exc, FormatValidationError):
        return True
    return False


def get_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    if isinstance(exc, httpx.TimeoutException):
        return "Timeout"
    if isinstance(exc, httpx.NetworkError):
        return "Network Error"
    return f"Error: {str(exc)}"


async def execute_with_retry_async(
    provider: BaseLLMProvider,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
    response_format: Optional[Dict[str, str]],
    json_required_keys: Optional[List[str]] = None,
) -> LLMResponse:
    last_error = None
    
    model_used = ""
    if provider.name == "Gemini":
        model_used = _get_gemini_model()
    elif provider.name == "Cerebras":
        model_used = _get_cerebras_model()
    elif provider.name == "Groq":
        model_used = _get_groq_model()
        
    for attempt in range(1, 4):
        attempt_start = time.perf_counter()
        http_status = None
        finish_reason = None
        raw_response = "N/A"
        raw_len = 0
        preview = "N/A"
        
        extraction_result = "N/A"
        json_parsing_result = "N/A"
        schema_validation_result = "N/A"
        object_validation_result = "N/A"
        
        try:
            res_obj = await provider.chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
            
            http_status = res_obj.status_code
            finish_reason = res_obj.finish_reason
            raw_response = res_obj.raw_response
            raw_len = len(res_obj.text)
            preview = res_obj.text[:300].replace("\n", " ")
            extraction_result = "Success"
            
            require_json = (response_format and response_format.get("type") == "json_object") or bool(json_required_keys)
            
            try:
                validate_llm_output(
                    res_obj.text,
                    require_json=require_json,
                    required_keys=json_required_keys,
                )
                json_parsing_result = "Success" if require_json else "N/A"
                schema_validation_result = "Success" if json_required_keys else "N/A"
                object_validation_result = "Success" if json_required_keys else "N/A"
            except JSONParseError as e:
                json_parsing_result = f"Error: {e}"
                schema_validation_result = "Skipped"
                object_validation_result = "Skipped"
                raise
            except SchemaValidationError as e:
                json_parsing_result = "Success"
                schema_validation_result = f"Error: {e}"
                object_validation_result = "Skipped"
                raise
            except BusinessValidationError as e:
                json_parsing_result = "Success"
                schema_validation_result = "Success"
                object_validation_result = f"Error: {e}"
                raise
            except EmptyResponseError as e:
                extraction_result = f"Error: {e}"
                raise
            
            latency = (time.perf_counter() - attempt_start) * 1000
            res_obj.latency_ms = latency
            
            health_manager.record_success(provider.name, latency)
            
            logger.info(
                "[LLM PIPELINE TELEMETRY] Success | Provider=%s | Model=%s | Status=%s | Latency=%.2fms | "
                "Attempt=%s/3 | Length=%s | FinishReason=%s | Preview='%s' | "
                "Extraction=%s | JSONParsing=%s | SchemaValidation=%s | ObjectValidation=%s",
                provider.name, res_obj.model, http_status, latency,
                attempt, raw_len, finish_reason, preview,
                extraction_result, json_parsing_result, schema_validation_result, object_validation_result
            )
            return res_obj

        except Exception as exc:
            latency = (time.perf_counter() - attempt_start) * 1000
            last_error = exc
            
            error_type = "request"
            if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
                error_type = "timeout"
            elif isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
                error_type = "rate_limit"
            elif isinstance(exc, JSONParseError):
                error_type = "json_parsing"
            elif isinstance(exc, (SchemaValidationError, BusinessValidationError)):
                error_type = "schema_validation"
            
            health_manager.record_failure(provider.name, error_type)
            
            err_msg = str(exc)
            if isinstance(exc, httpx.HTTPStatusError):
                http_status = exc.response.status_code
                raw_response = exc.response.text
                err_msg = f"HTTP status error: {exc.response.status_code}"
                
            is_trans = is_transient_error(exc)
            
            logger.error(
                "[LLM PIPELINE TELEMETRY] FAILURE | Provider=%s | Model=%s | Status=%s | Latency=%.2fms | "
                "Attempt=%s/3 | Error='%s' | Transient=%s | Extraction=%s | "
                "JSONParsing=%s | SchemaValidation=%s | ObjectValidation=%s",
                provider.name, model_used, http_status, latency,
                attempt, err_msg, is_trans, extraction_result,
                json_parsing_result, schema_validation_result, object_validation_result
            )
            
            if not is_trans or attempt == 3:
                raise exc
            
            backoff_sec = 0.5 * (2 ** (attempt - 1))
            logger.info(f"Retrying {provider.name} in {backoff_sec}s (attempt {attempt + 1}/3)...")
            await asyncio.sleep(backoff_sec)
            
    if last_error:
        raise last_error
    raise RuntimeError(f"Unexpected end of retry loop for {provider.name}")


def execute_with_retry_sync(
    provider: BaseLLMProvider,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
    response_format: Optional[Dict[str, str]],
    json_required_keys: Optional[List[str]] = None,
) -> LLMResponse:
    last_error = None
    
    model_used = ""
    if provider.name == "Gemini":
        model_used = _get_gemini_model()
    elif provider.name == "Cerebras":
        model_used = _get_cerebras_model()
    elif provider.name == "Groq":
        model_used = _get_groq_model()
        
    for attempt in range(1, 4):
        attempt_start = time.perf_counter()
        http_status = None
        finish_reason = None
        raw_response = "N/A"
        raw_len = 0
        preview = "N/A"
        
        extraction_result = "N/A"
        json_parsing_result = "N/A"
        schema_validation_result = "N/A"
        object_validation_result = "N/A"
        
        try:
            res_obj = provider.chat_completion_sync(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
            
            http_status = res_obj.status_code
            finish_reason = res_obj.finish_reason
            raw_response = res_obj.raw_response
            raw_len = len(res_obj.text)
            preview = res_obj.text[:300].replace("\n", " ")
            extraction_result = "Success"
            
            require_json = (response_format and response_format.get("type") == "json_object") or bool(json_required_keys)
            
            try:
                validate_llm_output(
                    res_obj.text,
                    require_json=require_json,
                    required_keys=json_required_keys,
                )
                json_parsing_result = "Success" if require_json else "N/A"
                schema_validation_result = "Success" if json_required_keys else "N/A"
                object_validation_result = "Success" if json_required_keys else "N/A"
            except JSONParseError as e:
                json_parsing_result = f"Error: {e}"
                schema_validation_result = "Skipped"
                object_validation_result = "Skipped"
                raise
            except SchemaValidationError as e:
                json_parsing_result = "Success"
                schema_validation_result = f"Error: {e}"
                object_validation_result = "Skipped"
                raise
            except BusinessValidationError as e:
                json_parsing_result = "Success"
                schema_validation_result = "Success"
                object_validation_result = f"Error: {e}"
                raise
            except EmptyResponseError as e:
                extraction_result = f"Error: {e}"
                raise
            
            latency = (time.perf_counter() - attempt_start) * 1000
            res_obj.latency_ms = latency
            
            health_manager.record_success(provider.name, latency)
            
            logger.info(
                "[LLM PIPELINE TELEMETRY] Success | Provider=%s | Model=%s | Status=%s | Latency=%.2fms | "
                "Attempt=%s/3 | Length=%s | FinishReason=%s | Preview='%s' | "
                "Extraction=%s | JSONParsing=%s | SchemaValidation=%s | ObjectValidation=%s",
                provider.name, res_obj.model, http_status, latency,
                attempt, raw_len, finish_reason, preview,
                extraction_result, json_parsing_result, schema_validation_result, object_validation_result
            )
            return res_obj

        except Exception as exc:
            latency = (time.perf_counter() - attempt_start) * 1000
            last_error = exc
            
            error_type = "request"
            if isinstance(exc, httpx.TimeoutException):
                error_type = "timeout"
            elif isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
                error_type = "rate_limit"
            elif isinstance(exc, JSONParseError):
                error_type = "json_parsing"
            elif isinstance(exc, (SchemaValidationError, BusinessValidationError)):
                error_type = "schema_validation"
            
            health_manager.record_failure(provider.name, error_type)
            
            err_msg = str(exc)
            if isinstance(exc, httpx.HTTPStatusError):
                http_status = exc.response.status_code
                raw_response = exc.response.text
                err_msg = f"HTTP status error: {exc.response.status_code}"
                
            is_trans = is_transient_error(exc)
            
            logger.error(
                "[LLM PIPELINE TELEMETRY] FAILURE | Provider=%s | Model=%s | Status=%s | Latency=%.2fms | "
                "Attempt=%s/3 | Error='%s' | Transient=%s | Extraction=%s | "
                "JSONParsing=%s | SchemaValidation=%s | ObjectValidation=%s",
                provider.name, model_used, http_status, latency,
                attempt, err_msg, is_trans, extraction_result,
                json_parsing_result, schema_validation_result, object_validation_result
            )
            
            if not is_trans or attempt == 3:
                raise exc
            
            backoff_sec = 0.5 * (2 ** (attempt - 1))
            logger.info(f"Retrying {provider.name} in {backoff_sec}s (attempt {attempt + 1}/3)...")
            time.sleep(backoff_sec)
            
    if last_error:
        raise last_error
    raise RuntimeError(f"Unexpected end of retry loop for {provider.name}")


class FallbackLLMProvider(BaseLLMProvider):
    def __init__(self, providers: Optional[List[BaseLLMProvider]] = None):
        self._providers = providers

    @property
    def name(self) -> str:
        return "FallbackProvider"

    def is_configured(self) -> bool:
        providers = self._providers if self._providers is not None else get_active_providers()
        return len(providers) > 0

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
        json_required_keys: Optional[List[str]] = None,
    ) -> LLMResponse:
        raw_providers = self._providers if self._providers is not None else get_active_providers()
        providers = []
        for p in raw_providers:
            if health_manager.is_healthy(p.name):
                providers.append(p)
            else:
                logger.warning(f"[LLM Health] Skipping provider {p.name} due to active cooldown.")
        if not providers:
            raise RuntimeError("No active LLM providers configured in fallback chain.")

        last_exception = None
        for i, provider in enumerate(providers):
            try:
                return await execute_with_retry_async(
                    provider, messages, temperature, max_tokens, response_format, json_required_keys
                )
            except Exception as exc:
                last_exception = exc
                if i < len(providers) - 1:
                    next_provider = providers[i + 1]
                    logger.info(f"Falling back to {next_provider.name} (due to error: {exc})")
                else:
                    logger.error("All providers in fallback chain failed.")
        
        if last_exception:
            raise last_exception
        raise RuntimeError("Fallback chain failed unexpectedly.")

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
        json_required_keys: Optional[List[str]] = None,
    ) -> LLMResponse:
        raw_providers = self._providers if self._providers is not None else get_active_providers()
        providers = []
        for p in raw_providers:
            if health_manager.is_healthy(p.name):
                providers.append(p)
            else:
                logger.warning(f"[LLM Health] Skipping provider {p.name} due to active cooldown.")
        if not providers:
            raise RuntimeError("No active LLM providers configured in fallback chain.")

        last_exception = None
        for i, provider in enumerate(providers):
            try:
                return execute_with_retry_sync(
                    provider, messages, temperature, max_tokens, response_format, json_required_keys
                )
            except Exception as exc:
                last_exception = exc
                if i < len(providers) - 1:
                    next_provider = providers[i + 1]
                    logger.info(f"Falling back to {next_provider.name} (due to error: {exc})")
                else:
                    logger.error("All providers in fallback chain failed.")
        
        if last_exception:
            raise last_exception
        raise RuntimeError("Fallback chain failed unexpectedly.")
