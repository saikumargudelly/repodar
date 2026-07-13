import pytest
import httpx
import asyncio
import logging
from unittest.mock import MagicMock
from app.utils import llm_providers
from app.utils.llm_providers import (
    GeminiProvider,
    CerebrasProvider,
    GroqProvider,
    FallbackLLMProvider,
    validate_llm_output,
    JSONParseError,
    SchemaValidationError,
    BusinessValidationError,
    EmptyResponseError,
    ProviderRequestError,
)

logger = logging.getLogger(__name__)

class MockResponse:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json_data = json_data or {}

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if 400 <= self.status_code < 600:
            raise httpx.HTTPStatusError(
                message=f"HTTP Status Error {self.status_code}",
                request=httpx.Request("POST", "https://api.example.com"),
                response=self
            )

@pytest.fixture(autouse=True)
def clean_health_states(monkeypatch):
    monkeypatch.setattr(llm_providers.time, "sleep", lambda x: None)
    async def dummy_sleep(x):
        pass
    monkeypatch.setattr(llm_providers.asyncio, "sleep", dummy_sleep)

    monkeypatch.setattr(llm_providers, "GEMINI_API_KEY", "mock-key")
    monkeypatch.setattr(llm_providers, "CEREBRAS_API_KEY", "mock-key")
    monkeypatch.setattr(llm_providers, "GROQ_API_KEY", "mock-key")

    llm_providers.health_manager = llm_providers.ProviderHealthManager(cooldown_duration_sec=10.0, max_consecutive_failures=2)
    llm_providers._failed_providers.clear()

def create_raw_response(provider, text, status_code=200):
    if status_code != 200:
        return MockResponse(status_code=status_code)
    if provider == "Gemini":
        json_data = {"candidates": [{"content": {"parts": [{"text": text}]}}]}
    else:
        json_data = {"choices": [{"message": {"content": text}}]}
    return MockResponse(status_code=200, json_data=json_data)


@pytest.mark.asyncio
async def test_pipeline_success_gemini(monkeypatch):
    """Test successful deep summary JSON generation by Gemini."""
    valid_json = '{"what": "framework", "why": "gap", "how": "architecture", "tech_stack": ["python"], "use_cases": ["scen1"]}'
    
    async def mock_post(*args, **kwargs):
        return create_raw_response("Gemini", valid_json)

    monkeypatch.setattr(llm_providers._async_client, "post", mock_post)

    provider = FallbackLLMProvider(providers=[GeminiProvider()])
    messages = [{"role": "user", "content": "hello"}]
    
    res = await provider.chat_completion(
        messages=messages,
        response_format={"type": "json_object"},
        json_required_keys=["what", "why", "how", "tech_stack", "use_cases"],
    )
    assert res.provider == "Gemini"
    assert res.text == valid_json


@pytest.mark.asyncio
async def test_pipeline_json_in_markdown(monkeypatch):
    """Test JSON enclosed in markdown code fences parsing successfully."""
    fenced_json = '```json\n{"what": "framework", "why": "gap", "how": "architecture", "tech_stack": ["python"], "use_cases": ["scen1"]}\n```'
    
    async def mock_post(*args, **kwargs):
        return create_raw_response("Gemini", fenced_json)

    monkeypatch.setattr(llm_providers._async_client, "post", mock_post)

    provider = FallbackLLMProvider(providers=[GeminiProvider()])
    messages = [{"role": "user", "content": "hello"}]
    
    res = await provider.chat_completion(
        messages=messages,
        response_format={"type": "json_object"},
        json_required_keys=["what", "why", "how", "tech_stack", "use_cases"],
    )
    assert res.provider == "Gemini"
    assert "framework" in res.text


@pytest.mark.asyncio
async def test_pipeline_invalid_json_fallback(monkeypatch, caplog):
    """Test invalid JSON returned by Gemini falls back to Cerebras."""
    caplog.set_level(logging.INFO)
    invalid_json = "{malformed JSON}"
    valid_json = '{"what": "framework", "why": "gap", "how": "architecture", "tech_stack": ["python"], "use_cases": ["scen1"]}'

    async def mock_post(url, *args, **kwargs):
        if "generativelanguage.googleapis.com" in url:
            return create_raw_response("Gemini", invalid_json)
        else:
            return create_raw_response("Cerebras", valid_json)

    monkeypatch.setattr(llm_providers._async_client, "post", mock_post)

    provider = FallbackLLMProvider(providers=[GeminiProvider(), CerebrasProvider()])
    messages = [{"role": "user", "content": "hello"}]
    
    res = await provider.chat_completion(
        messages=messages,
        response_format={"type": "json_object"},
        json_required_keys=["what", "why", "how", "tech_stack", "use_cases"],
    )
    assert res.provider == "Cerebras"
    assert "Falling back to Cerebras" in caplog.text


@pytest.mark.asyncio
async def test_pipeline_schema_violation_fallback(monkeypatch, caplog):
    """Test JSON missing required fields returned by Gemini falls back to Cerebras."""
    caplog.set_level(logging.INFO)
    missing_fields_json = '{"what": "framework"}' # Missing why, how, tech_stack, use_cases
    valid_json = '{"what": "framework", "why": "gap", "how": "architecture", "tech_stack": ["python"], "use_cases": ["scen1"]}'

    async def mock_post(url, *args, **kwargs):
        if "generativelanguage.googleapis.com" in url:
            return create_raw_response("Gemini", missing_fields_json)
        else:
            return create_raw_response("Cerebras", valid_json)

    monkeypatch.setattr(llm_providers._async_client, "post", mock_post)

    provider = FallbackLLMProvider(providers=[GeminiProvider(), CerebrasProvider()])
    messages = [{"role": "user", "content": "hello"}]
    
    res = await provider.chat_completion(
        messages=messages,
        response_format={"type": "json_object"},
        json_required_keys=["what", "why", "how", "tech_stack", "use_cases"],
    )
    assert res.provider == "Cerebras"
    assert "Falling back to Cerebras" in caplog.text


@pytest.mark.asyncio
async def test_pipeline_empty_fields_business_violation_fallback(monkeypatch, caplog):
    """Test JSON with empty fields returned by Gemini falls back to Cerebras."""
    caplog.set_level(logging.INFO)
    empty_fields_json = '{"what": "framework", "why": "", "how": "architecture", "tech_stack": [], "use_cases": ["scen1"]}'
    valid_json = '{"what": "framework", "why": "gap", "how": "architecture", "tech_stack": ["python"], "use_cases": ["scen1"]}'

    async def mock_post(url, *args, **kwargs):
        if "generativelanguage.googleapis.com" in url:
            return create_raw_response("Gemini", empty_fields_json)
        else:
            return create_raw_response("Cerebras", valid_json)

    monkeypatch.setattr(llm_providers._async_client, "post", mock_post)

    provider = FallbackLLMProvider(providers=[GeminiProvider(), CerebrasProvider()])
    messages = [{"role": "user", "content": "hello"}]
    
    res = await provider.chat_completion(
        messages=messages,
        response_format={"type": "json_object"},
        json_required_keys=["what", "why", "how", "tech_stack", "use_cases"],
    )
    assert res.provider == "Cerebras"
    assert "Falling back to Cerebras" in caplog.text


@pytest.mark.asyncio
async def test_pipeline_provider_cooldown(monkeypatch, caplog):
    """Test that a provider that fails repeatedly gets temporarily placed in cooldown."""
    caplog.set_level(logging.WARNING)

    # Gemini fails with HTTP 500, Cerebras succeeds
    async def mock_post(url, *args, **kwargs):
        if "generativelanguage.googleapis.com" in url:
            return create_raw_response("Gemini", "", status_code=500)
        else:
            return create_raw_response("Cerebras", "Success")

    monkeypatch.setattr(llm_providers._async_client, "post", mock_post)

    provider = FallbackLLMProvider(providers=[GeminiProvider(), CerebrasProvider()])
    messages = [{"role": "user", "content": "hello"}]

    # Call 1: Gemini fails, falls back to Cerebras (Gemini consecutive failures = 1)
    await provider.chat_completion(messages)
    
    # Call 2: Gemini fails again, falls back to Cerebras (Gemini consecutive failures = 2) -> Cooldown triggers
    await provider.chat_completion(messages)

    # Assert warning log exists for cooldown trigger
    assert any("Placing in cooldown" in record.message for record in caplog.records)

    # Call 3: Gemini should be skipped completely because it is in cooldown
    caplog.clear()
    res = await provider.chat_completion(messages)
    assert res.provider == "Cerebras"
    # Should see the skip log warning
    assert any("Skipping provider Gemini due to active cooldown" in record.message for record in caplog.records)
