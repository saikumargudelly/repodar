"""
A2A Card Ingestion Service
==========================
Discovers, fetches, validates, and stores Agent-to-Agent (A2A) capability cards.

Handles every known agent/plugin card format:
  - A2A spec v1   (Google standard): capabilities={streaming:true}, skills=[...]
  - A2A spec v0.3: capabilities=[{name, method, path}]
  - OpenAI plugin manifest: name_for_human, api.url
  - MCP server info: serverInfo.name, tools/prompts/resources
  - Custom / Repodar seeded cards: name, provider, categories, capabilities=[...]
  - Unknown JSON: best-effort extraction of name/description from any field

Security rules enforced:
  - Only http/https schemes allowed
  - Private, loopback, link-local and reserved IPs are blocked (SSRF)
  - localhost and 0.0.0.0 blocked explicitly
  - 10-second request timeout
  - Only GET used for card fetching
"""

import asyncio
import ipaddress
import json
import logging
import socket
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.a2a_service import A2AService, A2ACapability

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic schemas for A2A card validation
# ---------------------------------------------------------------------------

class CapabilityCard(BaseModel):
    """A single callable capability / endpoint exposed by the agent."""
    name: str = ""
    method: str = "POST"
    path: str = ""
    description: str = ""

    @field_validator("method")
    @classmethod
    def uppercase_method(cls, v: str) -> str:
        return v.upper()


class SkillCard(BaseModel):
    """A2A spec v1 skill — a high-level task type the agent can perform."""
    id: str = ""
    name: str = ""
    description: str = ""
    tags: list[str] = []
    examples: list[str] = []
    inputModes: list[str] = []
    outputModes: list[str] = []


class A2ACardSchema(BaseModel):
    """
    Normalised representation of any agent/plugin capability card.

    Supported source formats
    ────────────────────────
    A2A spec v1 (Google):
        capabilities: {streaming: bool, pushNotifications: bool, ...}
        skills: [{id, name, description, tags, examples, inputModes, outputModes}]
        provider: {organization, url}
        defaultInputModes / defaultOutputModes: [str]
        authentication: {schemes: [str]}
        documentationUrl: str
        supportsAuthenticatedExtendedCard: bool

    A2A spec v0.3 / legacy endpoint list:
        capabilities: [{name, method, path, description}]

    OpenAI plugin manifest:
        schema_version: "v1"
        name_for_human / description_for_human
        api: {type, url}
        auth: {type}

    MCP server info:
        serverInfo: {name, version}
        tools / prompts / resources: [{name, description}]

    Custom / Repodar seeded cards:
        name, provider (str), categories, capabilities (list)

    Unknown JSON:
        Best-effort extraction: looks for any of dozens of common name/desc fields.
    """
    # Core identity
    name: str = ""
    description: str = ""
    version: str = "1.0"
    provider: str = ""
    categories: list[str] = []
    documentation_url: str = ""

    # Capabilities — always a flat list after normalisation
    capabilities: list[CapabilityCard] = []
    # Spec v1 raw skills (kept for reference)
    skills: list[SkillCard] = []

    # Rich metadata extracted from the card
    auth_schemes: list[str] = []        # e.g. ["Bearer", "ApiKey"]
    input_modes: list[str] = []         # e.g. ["text", "voice"]
    output_modes: list[str] = []        # e.g. ["text", "audio"]
    supports_streaming: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_card(cls, data: Any) -> Any:  # noqa: C901
        """
        Pre-process any raw JSON dict into the normalised shape.
        Never raises — worst case returns an empty-but-valid card.
        """
        if not isinstance(data, dict):
            return data

        # ── FORMAT DETECTION ──────────────────────────────────────────────

        # OpenAI plugin manifest
        if data.get("schema_version") == "v1" and "name_for_human" in data:
            return cls._from_openai_plugin(data)

        # MCP server info (tools/prompts array at top level or under serverInfo)
        if "serverInfo" in data or ("tools" in data and "prompts" in data):
            return cls._from_mcp(data)

        # ── A2A / custom card normalisation ───────────────────────────────

        # provider: dict → string
        provider = data.get("provider", "")
        if isinstance(provider, dict):
            data["provider"] = (
                provider.get("organization")
                or provider.get("name")
                or provider.get("url", "")
            )

        # capabilities: feature-flag dict → clear; capability list → keep
        caps = data.get("capabilities")
        if isinstance(caps, dict):
            # Extract feature flags before clearing
            data["supports_streaming"] = bool(caps.get("streaming", False))
            data["capabilities"] = []
        elif not isinstance(caps, list):
            data["capabilities"] = []

        # skills → synthetic capability entries + rich metadata
        skills_raw = data.get("skills", [])
        if not isinstance(skills_raw, list):
            skills_raw = []
            data["skills"] = []

        if not data["capabilities"] and skills_raw:
            data["capabilities"] = cls._skills_to_capabilities(skills_raw)

        # agentCapabilities (seen on some HF-hosted agents) — merge if present
        agent_caps = data.get("agentCapabilities")
        if isinstance(agent_caps, dict):
            data["supports_streaming"] = bool(
                data.get("supports_streaming")
                or agent_caps.get("streaming", False)
            )

        # Rich metadata
        auth = data.get("authentication") or {}
        if isinstance(auth, dict):
            schemes = auth.get("schemes", [])
            data["auth_schemes"] = [s for s in schemes if isinstance(s, str)]

        data["input_modes"] = cls._coerce_str_list(
            data.get("defaultInputModes") or data.get("inputModes") or []
        )
        data["output_modes"] = cls._coerce_str_list(
            data.get("defaultOutputModes") or data.get("outputModes") or []
        )
        data["documentation_url"] = str(
            data.get("documentationUrl") or data.get("documentation_url") or ""
        )

        # categories: fall back to skill tags if no explicit categories
        if not data.get("categories"):
            all_tags: list[str] = list(data.get("tags") or data.get("topics") or [])
            for sk in skills_raw:
                if isinstance(sk, dict):
                    all_tags.extend(sk.get("tags", []))
            # Deduplicate preserving order
            seen: set[str] = set()
            data["categories"] = [
                t for t in all_tags if t and not (t in seen or seen.add(t))  # type: ignore[func-returns-value]
            ]
        if not isinstance(data.get("categories"), list):
            data["categories"] = []

        # name: fall back to hostname-derived value (handled post-parse elsewhere)
        if not data.get("name"):
            data["name"] = (
                data.get("title")
                or data.get("agent_name")
                or data.get("service_name")
                or ""
            )

        return data

    # ── Static helpers ────────────────────────────────────────────────────

    @staticmethod
    def _skills_to_capabilities(skills_raw: list[Any]) -> list[dict]:
        """Convert A2A spec v1 skills into CapabilityCard-compatible dicts."""
        result = []
        for sk in skills_raw:
            if not isinstance(sk, dict):
                continue
            skill_id = sk.get("id") or ""
            skill_name = sk.get("name") or skill_id or "skill"
            skill_desc = sk.get("description", "")
            tags = sk.get("tags") or []
            examples = sk.get("examples") or []

            # Build a rich description: desc + examples
            parts = [p for p in [skill_desc, ", ".join(f'"{e}"' for e in examples[:3])] if p]
            full_desc = " — Examples: ".join(parts) if len(parts) > 1 else (parts[0] if parts else "")

            path = f"/{skill_id or skill_name.lower().replace(' ', '-')}"
            result.append({
                "name": skill_name,
                "method": "POST",
                "path": path,
                "description": full_desc or (", ".join(tags) if tags else ""),
            })
        return result

    @staticmethod
    def _coerce_str_list(val: Any) -> list[str]:
        if isinstance(val, list):
            return [str(v) for v in val if v]
        return []

    @classmethod
    def _from_openai_plugin(cls, data: dict) -> dict:
        """Normalise an OpenAI plugin manifest into our card shape."""
        api_info = data.get("api") or {}
        api_url = str(api_info.get("url") or "")
        auth_type = str((data.get("auth") or {}).get("type") or "none")
        return {
            "name": data.get("name_for_human") or data.get("name_for_model") or "",
            "description": data.get("description_for_human") or data.get("description_for_model") or "",
            "version": "openai-plugin-v1",
            "provider": "",
            "documentation_url": data.get("legal_info_url") or data.get("logo_url") or "",
            "auth_schemes": [auth_type] if auth_type != "none" else [],
            "capabilities": [{"name": "OpenAPI spec", "method": "GET", "path": api_url, "description": "OpenAPI spec endpoint"}] if api_url else [],
            "skills": [],
            "categories": ["openai-plugin"],
            "input_modes": ["text"],
            "output_modes": ["text"],
            "supports_streaming": False,
        }

    @classmethod
    def _from_mcp(cls, data: dict) -> dict:
        """Normalise an MCP server info response into our card shape."""
        server = data.get("serverInfo") or {}
        tools = [t for t in (data.get("tools") or []) if isinstance(t, dict)]
        prompts = [p for p in (data.get("prompts") or []) if isinstance(p, dict)]
        resources = [r for r in (data.get("resources") or []) if isinstance(r, dict)]

        caps = []
        for item in (tools + prompts + resources):
            item_name = item.get("name") or ""
            caps.append({
                "name": item_name,
                "method": "POST",
                "path": f"/{item_name}",
                "description": item.get("description") or "",
            })
        return {
            "name": server.get("name") or data.get("name") or "",
            "description": data.get("description") or "",
            "version": server.get("version") or "mcp",
            "provider": "",
            "documentation_url": "",
            "auth_schemes": [],
            "capabilities": caps,
            "skills": [],
            "categories": ["mcp"],
            "input_modes": ["text"],
            "output_modes": ["text"],
            "supports_streaming": False,
        }


# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------

_BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain", "0.0.0.0"}


def _is_safe_url(url: str) -> tuple[bool, str]:
    """
    Returns (True, "") if URL is safe to fetch, or (False, reason) if blocked.
    Prevents SSRF against private/loopback infrastructure.
    """
    try:
        parsed = urlparse(url)
    except Exception as exc:
        return False, f"URL parse error: {exc}"

    if parsed.scheme not in ("http", "https"):
        return False, f"Scheme '{parsed.scheme}' not allowed — only http/https"

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False, "Missing hostname"

    if hostname in _BLOCKED_HOSTNAMES:
        return False, f"Hostname '{hostname}' is blocked"

    # Resolve DNS and check every returned address
    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        return False, f"DNS resolution failed: {exc}"

    for addr_info in addr_infos:
        raw_ip = addr_info[4][0]
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_unspecified
            or ip.is_multicast
        ):
            return False, f"IP {raw_ip} is in a blocked range (private/loopback/reserved)"

    return True, ""


# ---------------------------------------------------------------------------
# Core fetch logic
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Error classification tags — embedded in error strings for status mapping
# ---------------------------------------------------------------------------
_ERR_DNS       = "[dns-fail]"       # hostname does not exist
_ERR_AUTH      = "[auth-required]"  # 401/403 on all attempted paths
_ERR_TIMEOUT   = "[timeout]"        # connection / read timeout
_ERR_SSL       = "[ssl-error]"      # TLS/certificate problem
_ERR_NO_CARD   = "[no-card]"        # service reachable but no card found
_ERR_RATE_LIMIT= "[rate-limited]"   # 429 from service
_ERR_SLEEPING  = "[sleeping]"       # 503 — PaaS cold start (Render/Fly free tier)

# Candidate paths tried in priority order — first 200 + valid JSON wins.
#
# Source: A2A Python SDK v0.3.0 constants.py
#   AGENT_CARD_WELL_KNOWN_PATH      = '/.well-known/agent-card.json'  (current)
#   PREV_AGENT_CARD_WELL_KNOWN_PATH = '/.well-known/agent.json'       (deprecated)
#   EXTENDED_AGENT_CARD_PATH        = '/agent/authenticatedExtendedCard'
#   DEFAULT_RPC_URL                 = '/'  ← JSON-RPC endpoint, NOT the card
#
# We try both spec paths (many live services honour both), then legacy and
# alternative conventions used in the wild.
_CARD_PATHS = [
    ".well-known/agent-card.json",   # A2A spec v0.3+ (SDK CURRENT standard)
    ".well-known/agent.json",        # A2A spec v1 / older (SDK DEPRECATED but widely deployed)
    ".well-known/ai-plugin.json",    # OpenAI plugin manifest
    "a2a-card",                      # legacy Repodar / custom path
    "a2a",                           # minimal custom path
    "agent-card",                    # common alternative (no extension)
    "agent.json",                    # bare root-level JSON variant
    "agent-card.json",               # bare root-level with extension
    "mcp",                           # MCP server-info endpoint
    "v1/agent-card",                 # versioned REST convention
    "api/agent-card",                # API-prefixed convention
]


async def fetch_a2a_card(base_url: str) -> tuple[Optional[A2ACardSchema], int, str]:
    """
    Fetch and validate an A2A capability card from base_url.

    Tries each path in _CARD_PATHS in order; the first that returns HTTP 200
    with parseable, object-shaped JSON wins.  On failure, each path's error
    is tagged so that `ingest_service_by_url` can set a meaningful DB status.

    Handles:
      - HTML landing pages / auth-redirect pages  (content-type check)
      - 401/403 auth-gated cards                 → [auth-required] tag
      - 503 sleeping PaaS services               → [sleeping] tag + retry once
      - 429 rate-limiting                        → [rate-limited] tag
      - SSL/TLS certificate errors               → [ssl-error] tag
      - Response size > 1 MB                    → skipped (DoS guard)
      - Non-object JSON (array, string…)        → skipped with note
      - DNS resolution failures                 → [dns-fail] tag (caught upstream)

    Returns: (card, latency_ms, error_msg) — card is None on failure.
    """
    base = base_url.rstrip("/")

    # SSRF check on the base URL (hostname is identical for all candidate paths)
    safe, reason = _is_safe_url(base + "/")
    if not safe:
        if "DNS" in reason or "nodename" in reason:
            return None, 0, f"{_ERR_DNS}{reason}"
        return None, 0, reason

    path_errors: list[str] = []
    auth_blocked = 0
    rate_limited = 0
    sleeping = 0
    n_paths = len(_CARD_PATHS)

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0),
        follow_redirects=True,
    ) as client:
        for path in _CARD_PATHS:
            card_url = f"{base}/{path}"
            start = time.monotonic()
            try:
                resp = await client.get(
                    card_url,
                    headers={"Accept": "application/json, */*;q=0.8"},
                )
                latency_ms = int((time.monotonic() - start) * 1000)

                # ── Status-code triage ──────────────────────────────────
                if resp.status_code in (401, 403):
                    auth_blocked += 1
                    path_errors.append(
                        f"{path}: HTTP {resp.status_code} (auth required — "
                        "card may exist but needs credentials)"
                    )
                    continue

                if resp.status_code == 429:
                    rate_limited += 1
                    retry_after = resp.headers.get("Retry-After", "unknown")
                    path_errors.append(
                        f"{path}: HTTP 429 (rate limited; Retry-After: {retry_after})"
                    )
                    continue

                if resp.status_code == 503:
                    sleeping += 1
                    # PaaS free-tier cold start — wait and retry once
                    body_hint = resp.text[:120].replace("\n", " ").strip()
                    path_errors.append(
                        f"{path}: HTTP 503 (service unavailable / cold start: {body_hint!r})"
                    )
                    await asyncio.sleep(3)
                    try:
                        resp2 = await client.get(
                            card_url,
                            headers={"Accept": "application/json, */*;q=0.8"},
                        )
                        if resp2.status_code == 200:
                            resp = resp2   # fall through to JSON parsing below
                            latency_ms = int((time.monotonic() - start) * 1000)
                        else:
                            continue
                    except Exception:
                        continue

                if resp.status_code != 200:
                    path_errors.append(f"{path}: HTTP {resp.status_code}")
                    continue

                # ── Content-type guard — skip HTML pages ────────────────
                ct = resp.headers.get("content-type", "").lower()
                if "text/html" in ct:
                    path_errors.append(
                        f"{path}: HTML response (landing page or auth redirect, not JSON)"
                    )
                    continue

                # ── Response size guard (1 MB DoS protection) ───────────
                raw = resp.content
                if len(raw) > 1_048_576:
                    path_errors.append(
                        f"{path}: response too large ({len(raw):,} bytes — skipped for safety)"
                    )
                    continue

                # ── JSON parse ──────────────────────────────────────────
                try:
                    data = resp.json()
                except Exception as exc:
                    path_errors.append(f"{path}: invalid JSON ({exc})")
                    continue

                if not isinstance(data, dict):
                    path_errors.append(
                        f"{path}: JSON root is {type(data).__name__}, not an object"
                    )
                    continue

                # ── Schema validation ───────────────────────────────────
                try:
                    card = A2ACardSchema.model_validate(data)
                except Exception as exc:
                    path_errors.append(f"{path}: schema error ({exc})")
                    continue

                # Derive name from hostname when card omits it
                if not card.name:
                    card.name = urlparse(base_url).netloc or base_url

                logger.info(f"[a2a] Card found at {card_url} ({latency_ms} ms)")
                return card, latency_ms, ""

            except httpx.TimeoutException:
                path_errors.append(f"{path}: {_ERR_TIMEOUT}timeout after 10 s")
                continue
            except httpx.ConnectError as exc:
                raw_msg = str(exc)
                if any(k in raw_msg for k in ("SSL", "certificate", "CERTIFICATE", "handshake")):
                    path_errors.append(f"{path}: {_ERR_SSL}TLS/SSL error ({exc})")
                else:
                    path_errors.append(f"{path}: connection refused / network error ({exc})")
                continue
            except httpx.RequestError as exc:
                path_errors.append(f"{path}: request error ({exc})")
                continue
            except asyncio.CancelledError:
                raise  # never suppress task cancellation
            except Exception as exc:
                path_errors.append(f"{path}: unexpected error ({exc})")
                continue

    # ── Classify the overall failure ────────────────────────────────────────
    summary = "; ".join(path_errors)
    if auth_blocked > 0 and auth_blocked >= (n_paths // 2):
        tag = _ERR_AUTH
        hint = " The agent card appears to be auth-gated (HTTP 401/403)."
    elif rate_limited > 0:
        tag = _ERR_RATE_LIMIT
        hint = " The service is rate-limiting requests."
    elif sleeping > 0:
        tag = _ERR_SLEEPING
        hint = " The service may be in a cold-start / sleeping state (HTTP 503). Try again in a few minutes."
    else:
        tag = _ERR_NO_CARD
        hint = (
            " Ensure it exposes an agent card at one of: "
            "/.well-known/agent-card.json (A2A v0.3 current), "
            "/.well-known/agent.json (A2A v1/deprecated), "
            "/.well-known/ai-plugin.json (OpenAI plugin), "
            "or /a2a-card, /agent-card, /mcp."
        )

    logger.warning(
        f"[a2a] No card found at {base_url} — tried {n_paths} paths: {summary}"
    )
    return None, 0, f"{tag}No agent card found at {base_url}.{hint}"


# ---------------------------------------------------------------------------
# Database persistence
# ---------------------------------------------------------------------------

def _safe_set(obj: Any, attr: str, value: Any) -> None:
    """Set attribute on obj only if it exists on the class (migration-safe)."""
    if hasattr(type(obj), attr):
        setattr(obj, attr, value)


def _classify_error(error: str) -> str:
    """
    Map an error string (with embedded tags from fetch_a2a_card) to an
    A2AService.status value.

    Status values:
      unreachable   — DNS failure, connection refused, timeout, SSL error
      no_card       — service reachable but no A2A card found at any path
      auth_required — card exists but requires authentication
      rate_limited  — service is throttling requests
      sleeping      — PaaS service in cold-start / sleeping state
      invalid       — card found but schema/content invalid
    """
    if _ERR_DNS in error:         return "unreachable"
    if _ERR_TIMEOUT in error:     return "unreachable"
    if _ERR_SSL in error:         return "unreachable"
    if _ERR_AUTH in error:        return "auth_required"
    if _ERR_RATE_LIMIT in error:  return "rate_limited"
    if _ERR_SLEEPING in error:    return "sleeping"
    if _ERR_NO_CARD in error:     return "no_card"
    # Fallback heuristics for errors without tags (e.g. from SSRF check)
    lo = error.lower()
    if any(k in lo for k in ("timeout", "timed out", "connection", "dns", "refused", "ssl")):
        return "unreachable"
    return "invalid"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def ingest_service_by_url(base_url: str, db: Session) -> tuple[Optional[A2AService], str]:
    """
    Full pipeline: fetch → validate → upsert service + capabilities.

    Returns (service, error_msg).

    The input URL is normalised to scheme://host[:port] before use:
    - Trailing slashes stripped
    - Any path component removed (users sometimes paste the full card URL
      e.g. https://agent.example.com/.well-known/agent.json — we extract
      the base and probe all card paths ourselves)
    """
    # ── Normalise to base URL (scheme + host + optional port only) ──────────
    base_url = base_url.strip()
    try:
        _p = urlparse(base_url)
        if _p.scheme not in ("http", "https"):
            return None, f"Invalid URL scheme '{_p.scheme}' — only http/https allowed."
        # Reconstruct without path / query / fragment
        port_part = f":{_p.port}" if _p.port and _p.port not in (80, 443) else ""
        base_url = f"{_p.scheme}://{_p.hostname}{port_part}"
    except Exception as exc:
        return None, f"Could not parse URL: {exc}"

    card, latency_ms, error = await fetch_a2a_card(base_url)
    now = _utcnow()

    # Look up existing record
    existing = db.query(A2AService).filter(A2AService.base_url == base_url).first()

    if error or card is None:
        derived_status = _classify_error(error or "")
        if existing:
            existing.status = derived_status
            existing.last_checked_at = now
            if latency_ms:
                existing.response_latency_ms = latency_ms
            db.commit()
            logger.warning(f"[a2a] Service {base_url} marked '{derived_status}': {error}")
        else:
            logger.warning(f"[a2a] Failed to ingest new service {base_url} ({derived_status}): {error}")
        return existing, error

    # Upsert service record
    if existing:
        service = existing
    else:
        service = A2AService(id=str(uuid.uuid4()), base_url=base_url, created_at=now)
        db.add(service)

    service.name = card.name or urlparse(base_url).netloc or base_url
    service.provider = card.provider or None
    service.description = card.description or None
    service.version = card.version or None
    service.categories = json.dumps(card.categories) if card.categories else None
    service.status = "active"
    service.response_latency_ms = latency_ms
    service.last_checked_at = now
    service.last_seen_at = now
    # Rich metadata — stored only if the model columns exist (graceful if migration pending)
    _safe_set(service, "auth_schemes", json.dumps(card.auth_schemes) if card.auth_schemes else None)
    _safe_set(service, "input_modes", json.dumps(card.input_modes) if card.input_modes else None)
    _safe_set(service, "output_modes", json.dumps(card.output_modes) if card.output_modes else None)
    _safe_set(service, "documentation_url", card.documentation_url or None)
    _safe_set(service, "supports_streaming", int(card.supports_streaming))

    # Wipe and re-insert capabilities (clean diff approach)
    db.query(A2ACapability).filter(A2ACapability.service_id == service.id).delete()
    for cap in card.capabilities:
        db.add(A2ACapability(
            id=str(uuid.uuid4()),
            service_id=service.id,
            name=cap.name,
            method=cap.method,
            path=cap.path,
            description=cap.description or None,
        ))

    db.commit()
    db.refresh(service)
    logger.info(f"[a2a] Ingested service '{service.name}' ({base_url}) "
                f"with {len(card.capabilities)} capabilities in {latency_ms} ms")
    return service, ""


# ---------------------------------------------------------------------------
# Scheduled refresh — runs daily
# ---------------------------------------------------------------------------

async def refresh_all_services() -> dict:
    """Refresh every registered service and return summary stats."""
    db = SessionLocal()
    try:
        services = db.query(A2AService).all()
        base_urls = [s.base_url for s in services]
    finally:
        db.close()

    results = {"refreshed": 0, "unreachable": 0, "failed": 0}
    for url in base_urls:
        db = SessionLocal()
        try:
            _, err = await ingest_service_by_url(url, db)
            if err:
                results["unreachable"] += 1
            else:
                results["refreshed"] += 1
        except Exception as exc:
            logger.error(f"[a2a] Refresh error for {url}: {exc}")
            results["failed"] += 1
        finally:
            db.close()

    logger.info(f"[a2a] Refresh complete: {results}")
    return results


# ---------------------------------------------------------------------------
# GitHub-based discovery (searches for repos that contain /a2a-card)
# ---------------------------------------------------------------------------

_GITHUB_SEARCH_TERMS = [
    '"/a2a-card"',
    '"a2a-card" fastapi',
    '"a2a capability" agent',
    '"agent-tools" fastapi card',
]

_SEED_SERVICES: list[str] = [
    # Add well-known community services here as base URLs when they exist
]


async def discover_from_github(db: Session, token: Optional[str] = None) -> int:
    """Search GitHub for repos that likely expose /a2a-card and register them."""
    import os
    token = token or os.getenv("GITHUB_TOKEN")
    if not token:
        logger.warning("[a2a] No GITHUB_TOKEN — skipping GitHub discovery")
        return 0

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    discovered = 0
    async with httpx.AsyncClient(timeout=15.0) as client:
        for term in _GITHUB_SEARCH_TERMS:
            try:
                resp = await client.get(
                    "https://api.github.com/search/code",
                    params={"q": term, "per_page": 10},
                    headers=headers,
                )
                if resp.status_code != 200:
                    continue

                items = resp.json().get("items", [])
                for item in items:
                    repo_url = item.get("repository", {}).get("html_url", "")
                    if not repo_url:
                        continue
                    # GitHub HTML URL → likely API base → try registering
                    # Convert github.com URL to a plausible deployment URL is heuristic;
                    # skip HTML URLs and only process if homepage is set
                    homepage = item.get("repository", {}).get("homepage", "")
                    if homepage and homepage.startswith("http"):
                        existing = db.query(A2AService).filter(
                            A2AService.base_url == homepage.rstrip("/")
                        ).first()
                        if not existing:
                            _, err = await ingest_service_by_url(homepage, db)
                            if not err:
                                discovered += 1
            except Exception as exc:
                logger.warning(f"[a2a] GitHub discovery search error for '{term}': {exc}")

    # Seed list
    for seed_url in _SEED_SERVICES:
        existing = db.query(A2AService).filter(A2AService.base_url == seed_url.rstrip("/")).first()
        if not existing:
            _, err = await ingest_service_by_url(seed_url, db)
            if not err:
                discovered += 1

    logger.info(f"[a2a] GitHub discovery found {discovered} new services")
    return discovered


async def run_a2a_discovery_pipeline() -> dict:
    """Top-level scheduled job: discover new + refresh existing services."""
    db = SessionLocal()
    try:
        new_count = await discover_from_github(db)
    finally:
        db.close()

    refresh_result = await refresh_all_services()
    return {
        "discovered": new_count,
        **refresh_result,
    }
