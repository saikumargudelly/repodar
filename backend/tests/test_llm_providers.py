import pytest
import httpx
import logging
from unittest.mock import MagicMock
from app.utils import llm_providers
from app.utils.llm_providers import (
    GeminiProvider,
    CerebrasProvider,
    GroqProvider,
    FallbackLLMProvider,
    get_active_providers,
    ProviderRequestError,
)

logger = logging.getLogger(__name__)

# --- Mock Response Helper ---
class MockResponse:
    def __init__(self, status_code=200, json_data=None, exception=None):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.exception = exception

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.exception is not None:
            raise self.exception
        if 400 <= self.status_code < 600:
            request = httpx.Request("POST", "https://api.example.com")
            raise httpx.HTTPStatusError(
                message=f"HTTP Status Error {self.status_code}",
                request=request,
                response=self
            )

@pytest.fixture(autouse=True)
def mock_sleep_and_keys(monkeypatch):
    # Mock sleep to make backoff retries instantaneous
    monkeypatch.setattr(llm_providers.time, "sleep", lambda x: None)
    async def dummy_sleep(x):
        pass
    monkeypatch.setattr(llm_providers.asyncio, "sleep", dummy_sleep)

    # Set default mock API keys
    monkeypatch.setattr(llm_providers, "GEMINI_API_KEY", "mock-gemini-key")
    monkeypatch.setattr(llm_providers, "CEREBRAS_API_KEY", "mock-cerebras-key")
    monkeypatch.setattr(llm_providers, "GROQ_API_KEY", "mock-groq-key")

    # Set standard fallback chain order for unit test assertions
    monkeypatch.setenv("LLM_PROVIDER_ORDER", "gemini,cerebras,groq")

    # Clean up global health manager and failed provider states
    llm_providers.health_manager = llm_providers.ProviderHealthManager()
    llm_providers._failed_providers.clear()


def create_mock_response(url, text, status_code=200, exception=None):
    if exception:
        return MockResponse(exception=exception)
    if status_code == 200:
        if "generativelanguage.googleapis.com" in url:
            json_data = {"candidates": [{"content": {"parts": [{"text": text}]}}]}
        else:
            json_data = {"choices": [{"message": {"content": text}}]}
        return MockResponse(status_code=status_code, json_data=json_data)
    else:
        return MockResponse(status_code=status_code)


# --- Tests ---

@pytest.mark.asyncio
async def test_get_active_providers(monkeypatch):
    # Default order: gemini, cerebras, groq
    providers = get_active_providers()
    assert len(providers) == 3
    assert providers[0].name == "Gemini"
    assert providers[1].name == "Cerebras"
    assert providers[2].name == "Groq"

    # Custom order
    monkeypatch.setenv("LLM_PROVIDER_ORDER", "groq,gemini")
    providers = get_active_providers()
    assert len(providers) == 2
    assert providers[0].name == "Groq"
    assert providers[1].name == "Gemini"

    # Missing API keys skipping
    monkeypatch.setattr(llm_providers, "GEMINI_API_KEY", "")
    monkeypatch.setattr(llm_providers, "GROQ_API_KEY", "")
    monkeypatch.delenv("LLM_PROVIDER_ORDER", raising=False)
    providers = get_active_providers()
    assert len(providers) == 1
    assert providers[0].name == "Cerebras"


@pytest.mark.asyncio
async def test_gemini_success(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    
    # Mock post calls to always return Gemini success
    def mock_post(url, *args, **kwargs):
        return create_mock_response(url, "Gemini Response Success")

    async def mock_post_async(url, *args, **kwargs):
        return create_mock_response(url, "Gemini Response Success")

    monkeypatch.setattr(llm_providers._sync_client, "post", mock_post)
    monkeypatch.setattr(llm_providers._async_client, "post", mock_post_async)

    provider = FallbackLLMProvider()
    messages = [{"role": "user", "content": "Hello"}]

    # Sync completion
    res_sync = provider.chat_completion_sync(messages)
    assert res_sync.text == "Gemini Response Success"
    assert "Success" in caplog.text

    # Async completion
    res_async = await provider.chat_completion(messages)
    assert res_async.text == "Gemini Response Success"


@pytest.mark.asyncio
async def test_gemini_rate_limit_fallback_to_cerebras(monkeypatch, caplog):
    caplog.set_level(logging.INFO)

    call_count = 0
    # Gemini (generativelanguage) returns 429, then Cerebras returns 200 success
    def mock_post(url, *args, **kwargs):
        nonlocal call_count
        if "generativelanguage.googleapis.com" in url:
            call_count += 1
            return create_mock_response(url, "", status_code=429)
        else:
            return create_mock_response(url, "Cerebras Success Response")

    async def mock_post_async(url, *args, **kwargs):
        nonlocal call_count
        if "generativelanguage.googleapis.com" in url:
            call_count += 1
            return create_mock_response(url, "", status_code=429)
        else:
            return create_mock_response(url, "Cerebras Success Response")

    monkeypatch.setattr(llm_providers._sync_client, "post", mock_post)
    monkeypatch.setattr(llm_providers._async_client, "post", mock_post_async)

    provider = FallbackLLMProvider()
    messages = [{"role": "user", "content": "Hello"}]

    # Test Sync Fallback
    res = provider.chat_completion_sync(messages)
    assert res.text == "Cerebras Success Response"
    # Should attempt Gemini 3 times (due to retry) before falling back
    assert call_count == 3
    assert "Gemini" in caplog.text
    assert "Falling back to Cerebras" in caplog.text
    assert "Cerebras" in caplog.text

    # Reset counter and state, then test Async Fallback
    call_count = 0
    llm_providers.health_manager = llm_providers.ProviderHealthManager()
    res_async = await provider.chat_completion(messages)
    assert res_async.text == "Cerebras Success Response"
    assert call_count == 3


@pytest.mark.asyncio
async def test_gemini_timeout_fallback_to_cerebras(monkeypatch, caplog):
    caplog.set_level(logging.INFO)

    call_count = 0
    def mock_post(url, *args, **kwargs):
        nonlocal call_count
        if "generativelanguage.googleapis.com" in url:
            call_count += 1
            # Raise Timeout
            raise httpx.TimeoutException("ReadTimeout")
        else:
            return create_mock_response(url, "Cerebras Success Response")

    async def mock_post_async(url, *args, **kwargs):
        nonlocal call_count
        if "generativelanguage.googleapis.com" in url:
            call_count += 1
            raise httpx.TimeoutException("ReadTimeout")
        else:
            return create_mock_response(url, "Cerebras Success Response")

    monkeypatch.setattr(llm_providers._sync_client, "post", mock_post)
    monkeypatch.setattr(llm_providers._async_client, "post", mock_post_async)

    provider = FallbackLLMProvider()
    messages = [{"role": "user", "content": "Hello"}]

    res = provider.chat_completion_sync(messages)
    assert res.text == "Cerebras Success Response"
    assert call_count == 3
    assert "Timeout" in caplog.text
    assert "Falling back to Cerebras" in caplog.text

    # Reset counter and state, then test Async Fallback
    call_count = 0
    llm_providers.health_manager = llm_providers.ProviderHealthManager()
    res_async = await provider.chat_completion(messages)
    assert res_async.text == "Cerebras Success Response"
    assert call_count == 3


@pytest.mark.asyncio
async def test_gemini_and_cerebras_fail_fallback_to_groq(monkeypatch, caplog):
    caplog.set_level(logging.INFO)

    def mock_post(url, *args, **kwargs):
        if "generativelanguage.googleapis.com" in url:
            return create_mock_response(url, "", status_code=500)
        elif "api.cerebras.ai" in url:
            raise httpx.ConnectError("Connection failed")
        else:
            return create_mock_response(url, "Groq Success Response")

    async def mock_post_async(url, *args, **kwargs):
        if "generativelanguage.googleapis.com" in url:
            return create_mock_response(url, "", status_code=500)
        elif "api.cerebras.ai" in url:
            raise httpx.ConnectError("Connection failed")
        else:
            return create_mock_response(url, "Groq Success Response")

    monkeypatch.setattr(llm_providers._sync_client, "post", mock_post)
    monkeypatch.setattr(llm_providers._async_client, "post", mock_post_async)

    provider = FallbackLLMProvider()
    messages = [{"role": "user", "content": "Hello"}]

    res = provider.chat_completion_sync(messages)
    assert res.text == "Groq Success Response"
    assert "Falling back to Cerebras" in caplog.text
    assert "Falling back to Groq" in caplog.text
    assert "Groq" in caplog.text


@pytest.mark.asyncio
async def test_all_providers_fail(monkeypatch, caplog):
    caplog.set_level(logging.INFO)

    def mock_post(url, *args, **kwargs):
        return create_mock_response(url, "", status_code=503)

    async def mock_post_async(url, *args, **kwargs):
        return create_mock_response(url, "", status_code=503)

    monkeypatch.setattr(llm_providers._sync_client, "post", mock_post)
    monkeypatch.setattr(llm_providers._async_client, "post", mock_post_async)

    provider = FallbackLLMProvider()
    messages = [{"role": "user", "content": "Hello"}]

    with pytest.raises(ProviderRequestError):
        provider.chat_completion_sync(messages)
    assert "All providers in fallback chain failed" in caplog.text


@pytest.mark.asyncio
async def test_validation_error_no_retry_or_fallback(monkeypatch, caplog):
    caplog.set_level(logging.INFO)

    call_count = 0
    def mock_post(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        # HTTP 400 Bad Request
        return create_mock_response(url, "", status_code=400)

    monkeypatch.setattr(llm_providers._sync_client, "post", mock_post)

    provider = FallbackLLMProvider(providers=[GeminiProvider()])
    messages = [{"role": "user", "content": "Hello"}]

    with pytest.raises(ProviderRequestError):
        provider.chat_completion_sync(messages)
    # Must fail immediately on the first attempt without retry (count=1)
    assert call_count == 1
    # Must not fallback to Cerebras
    assert "Falling back to Cerebras" not in caplog.text
