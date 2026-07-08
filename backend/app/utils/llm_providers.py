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
        "models": ["llama3.1-8b", "llama3.1-70b", "llama-3.3-70b"],
        "default": "llama3.1-70b"
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


class FormatValidationError(ValueError):
    """Raised when the LLM response does not match the expected format (e.g. invalid JSON)."""
    pass


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
    ) -> str:
        pass

    @abstractmethod
    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        pass


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

    def _parse_response(self, resp_data: Dict[str, Any]) -> str:
        try:
            candidates = resp_data.get("candidates", [])
            if not candidates:
                raise ValueError(f"No candidates returned by Gemini. Response: {resp_data}")
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                raise ValueError(f"No content parts returned by Gemini. Response: {resp_data}")
            text = parts[0].get("text", "")
            return text.strip()
        except (KeyError, IndexError, TypeError) as e:
            raise ValueError(f"Unexpected response structure from Gemini: {resp_data}") from e

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        api_key = _get_gemini_key()
        model = _get_gemini_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        response = await _async_client.post(url, json=body)
        response.raise_for_status()
        return self._parse_response(response.json())

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        api_key = _get_gemini_key()
        model = _get_gemini_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        response = _sync_client.post(url, json=body)
        response.raise_for_status()
        return self._parse_response(response.json())


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
        if response_format:
            body["response_format"] = response_format
        return body

    def _parse_response(self, resp_data: Dict[str, Any]) -> str:
        try:
            return resp_data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as e:
            raise ValueError(f"Unexpected response structure from Cerebras: {resp_data}") from e

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        url = "https://api.cerebras.ai/v1/chat/completions"
        api_key = _get_cerebras_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        response = await _async_client.post(url, headers=headers, json=body)
        response.raise_for_status()
        return self._parse_response(response.json())

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        url = "https://api.cerebras.ai/v1/chat/completions"
        api_key = _get_cerebras_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        response = _sync_client.post(url, headers=headers, json=body)
        response.raise_for_status()
        return self._parse_response(response.json())


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

    def _parse_response(self, resp_data: Dict[str, Any]) -> str:
        try:
            return resp_data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as e:
            raise ValueError(f"Unexpected response structure from Groq: {resp_data}") from e

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        url = "https://api.groq.com/openai/v1/chat/completions"
        api_key = _get_groq_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        response = await _async_client.post(url, headers=headers, json=body)
        response.raise_for_status()
        return self._parse_response(response.json())

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        url = "https://api.groq.com/openai/v1/chat/completions"
        api_key = _get_groq_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = self._prepare_request(messages, temperature, max_tokens, response_format)
        
        response = _sync_client.post(url, headers=headers, json=body)
        response.raise_for_status()
        return self._parse_response(response.json())


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
                logger.warning(
                    f"[LLM Start Validation] Provider {provider.name} FAILED functional check in {duration_ms}ms: {error_msg}. "
                    f"Removing {provider.name} from active provider chain."
                )
                _failed_providers.add(name)


def is_transient_error(exc: Exception) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError)):
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
) -> str:
    for attempt in range(1, 4):
        start_time = time.perf_counter()
        try:
            res = await provider.chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
            
            # Format validation
            if response_format and response_format.get("type") == "json_object":
                try:
                    import json
                    text_to_parse = res.strip()
                    if text_to_parse.startswith("```"):
                        text_to_parse = text_to_parse.split("```")[1]
                        if text_to_parse.startswith("json"):
                            text_to_parse = text_to_parse[4:]
                    json.loads(text_to_parse)
                except Exception as json_err:
                    raise FormatValidationError(f"Invalid JSON returned: {json_err}") from json_err

            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.info(f"{provider.name} -> Success ({duration_ms} ms)")
            return res
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            is_trans = is_transient_error(exc)
            error_msg = get_error_message(exc)
            
            logger.info(f"{provider.name} -> {error_msg}")
            
            if not is_trans or attempt == 3:
                raise exc
            
            backoff_sec = 0.5 * (2 ** (attempt - 1))
            logger.info(f"Retrying {provider.name} in {backoff_sec}s (attempt {attempt + 1}/3)...")
            await asyncio.sleep(backoff_sec)
    raise RuntimeError(f"Unexpected end of retry loop for {provider.name}")


def execute_with_retry_sync(
    provider: BaseLLMProvider,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
    response_format: Optional[Dict[str, str]],
) -> str:
    for attempt in range(1, 4):
        start_time = time.perf_counter()
        try:
            res = provider.chat_completion_sync(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
            
            # Format validation
            if response_format and response_format.get("type") == "json_object":
                try:
                    import json
                    text_to_parse = res.strip()
                    if text_to_parse.startswith("```"):
                        text_to_parse = text_to_parse.split("```")[1]
                        if text_to_parse.startswith("json"):
                            text_to_parse = text_to_parse[4:]
                    json.loads(text_to_parse)
                except Exception as json_err:
                    raise FormatValidationError(f"Invalid JSON returned: {json_err}") from json_err

            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.info(f"{provider.name} -> Success ({duration_ms} ms)")
            return res
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            is_trans = is_transient_error(exc)
            error_msg = get_error_message(exc)
            
            logger.info(f"{provider.name} -> {error_msg}")
            
            if not is_trans or attempt == 3:
                raise exc
            
            backoff_sec = 0.5 * (2 ** (attempt - 1))
            logger.info(f"Retrying {provider.name} in {backoff_sec}s (attempt {attempt + 1}/3)...")
            time.sleep(backoff_sec)
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
    ) -> str:
        providers = self._providers if self._providers is not None else get_active_providers()
        if not providers:
            raise RuntimeError("No active LLM providers configured in fallback chain.")

        last_exception = None
        for i, provider in enumerate(providers):
            try:
                return await execute_with_retry_async(
                    provider, messages, temperature, max_tokens, response_format
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
    ) -> str:
        providers = self._providers if self._providers is not None else get_active_providers()
        if not providers:
            raise RuntimeError("No active LLM providers configured in fallback chain.")

        last_exception = None
        for i, provider in enumerate(providers):
            try:
                return execute_with_retry_sync(
                    provider, messages, temperature, max_tokens, response_format
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
