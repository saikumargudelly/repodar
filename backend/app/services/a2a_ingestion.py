"""
A2A Card Ingestion Service
==========================
Discovers, fetches, validates, and stores Agent-to-Agent capability cards
from AI services that expose a GET /a2a-card endpoint.

Security rules enforced:
  - Only http/https schemes allowed
  - Private, loopback, link-local and reserved IPs are blocked
  - localhost and 0.0.0.0 are blocked explicitly
  - 10-second request timeout
  - Only GET requests are used when fetching cards
"""

import ipaddress
import json
import logging
import socket
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse, urljoin

import httpx
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.a2a_service import A2AService, A2ACapability

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic schemas for A2A card validation
# ---------------------------------------------------------------------------

class CapabilityCard(BaseModel):
    name: str
    method: str = "GET"
    path: str
    description: str = ""

    @field_validator("method")
    @classmethod
    def uppercase_method(cls, v: str) -> str:
        return v.upper()


class A2ACardSchema(BaseModel):
    name: str
    description: str = ""
    version: str = "1.0"
    provider: str = ""
    categories: list[str] = []
    capabilities: list[CapabilityCard] = []


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

async def fetch_a2a_card(base_url: str) -> tuple[Optional[A2ACardSchema], int, str]:
    """
    Fetch and validate an A2A card from ``base_url/a2a-card``.

    Returns:
        (card, latency_ms, error_msg)
        card is None on failure; error_msg is "" on success.
    """
    card_url = urljoin(base_url.rstrip("/") + "/", "a2a-card")

    safe, reason = _is_safe_url(card_url)
    if not safe:
        return None, 0, reason

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(card_url)
            latency_ms = int((time.monotonic() - start) * 1000)

            if resp.status_code != 200:
                return None, latency_ms, f"HTTP {resp.status_code}"

            data = resp.json()
    except httpx.TimeoutException:
        return None, 10_000, "Request timed out after 10 s"
    except httpx.RequestError as exc:
        return None, int((time.monotonic() - start) * 1000), f"Request error: {exc}"
    except Exception as exc:
        return None, int((time.monotonic() - start) * 1000), f"Unexpected error: {exc}"

    try:
        card = A2ACardSchema.model_validate(data)
    except Exception as exc:
        return None, latency_ms, f"Schema validation failed: {exc}"

    return card, latency_ms, ""


# ---------------------------------------------------------------------------
# Database persistence
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def ingest_service_by_url(base_url: str, db: Session) -> tuple[Optional[A2AService], str]:
    """
    Full pipeline: fetch → validate → upsert service + capabilities.

    Returns (service, error_msg).
    """
    # Sanitise trailing slash
    base_url = base_url.rstrip("/")

    card, latency_ms, error = await fetch_a2a_card(base_url)
    now = _utcnow()

    # Look up existing record
    existing = db.query(A2AService).filter(A2AService.base_url == base_url).first()

    if error or card is None:
        if existing:
            existing.status = "unreachable" if "timed out" in error or "HTTP" in error else "invalid"
            existing.last_checked_at = now
            existing.response_latency_ms = latency_ms if latency_ms else existing.response_latency_ms
            db.commit()
            logger.warning(f"[a2a] Service {base_url} marked {existing.status}: {error}")
        else:
            logger.warning(f"[a2a] Failed to ingest new service {base_url}: {error}")
        return existing, error

    # Upsert service record
    if existing:
        service = existing
    else:
        service = A2AService(id=str(uuid.uuid4()), base_url=base_url, created_at=now)
        db.add(service)

    service.name = card.name or base_url
    service.provider = card.provider or None
    service.description = card.description or None
    service.version = card.version or None
    service.categories = json.dumps(card.categories) if card.categories else None
    service.status = "active"
    service.response_latency_ms = latency_ms
    service.last_checked_at = now
    service.last_seen_at = now

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
