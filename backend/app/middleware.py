"""
Public API v1 middleware — validates X-API-Key header and enforces rate limits.
Applies to all routes mounted under the /api/v1 prefix.
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.api_key import ApiKey

logger = logging.getLogger(__name__)

_PUBLIC_V1_PREFIX = "/api/v1"


class LoggingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                process_time = time.time() - start_time
                if process_time > 2.0:
                    import os
                    logger.warning(
                        f"[SLOW REQUEST]\n"
                        f"{scope['method']} {scope['path']}\n"
                        f"Duration: {process_time:.2f}s\n"
                        f"Worker PID: {os.getpid()}"
                    )
                duration_ms = process_time * 1000
                if duration_ms < 100:
                    category = "Excellent"
                elif duration_ms < 300:
                    category = "Good"
                elif duration_ms < 1000:
                    category = "Investigate"
                else:
                    category = "Optimize"
                logger.info(
                    f"HTTP {scope['method']} {scope['path']} - {message['status']} - "
                    f"{duration_ms:.1f}ms [{category}]"
                )
            await send(message)

        await self.app(scope, receive, send_wrapper)


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _today_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


class APIKeyMiddleware:
    """
    ASGI Middleware that:
    1. Only intercepts requests to paths starting with /api/v1
    2. Reads X-API-Key header
    3. Validates the key against the api_keys table (SHA-256 hash match)
    4. Enforces per-day rate limits based on the tier
    5. Increments call counters and updates last_used_at
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        if not path.startswith(_PUBLIC_V1_PREFIX):
            await self.app(scope, receive, send)
            return

        # Read X-API-Key header from scope["headers"]
        headers = dict(scope["headers"])
        raw_key = headers.get(b"x-api-key")
        if not raw_key:
            response = JSONResponse(
                status_code=401,
                content={"detail": "Missing X-API-Key header. Get a key at /dev/api-keys."},
            )
            await response(scope, receive, send)
            return

        try:
            raw_key_str = raw_key.decode("utf-8")
        except Exception:
            response = JSONResponse(status_code=400, content={"detail": "Invalid header encoding."})
            await response(scope, receive, send)
            return

        key_hash = _hash_key(raw_key_str)

        db: Session = SessionLocal()
        try:
            api_key = (
                db.query(ApiKey)
                .filter(ApiKey.key_hash == key_hash, ApiKey.is_active == True)  # noqa: E712
                .first()
            )
            if api_key is None:
                response = JSONResponse(status_code=401, content={"detail": "Invalid or revoked API key."})
                await response(scope, receive, send)
                return

            # Check and reset daily counter if it rolled over midnight
            today = _today_date()
            reset_date = (
                api_key.calls_day_reset_at.strftime("%Y-%m-%d")
                if api_key.calls_day_reset_at
                else None
            )
            if reset_date != today:
                api_key.calls_today = 0
                api_key.calls_day_reset_at = _utcnow()

            day_limit = api_key.day_limit()
            if api_key.calls_today >= day_limit:
                response = JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Daily rate limit exceeded ({day_limit} calls). Upgrade your plan.",
                        "tier": api_key.tier,
                        "limit": day_limit,
                        "used": api_key.calls_today,
                    },
                )
                await response(scope, receive, send)
                return

            # Increment counters
            api_key.calls_today += 1
            api_key.calls_this_month += 1
            api_key.calls_total += 1
            api_key.last_used_at = _utcnow()
            db.commit()

            # Set scope state (ASGI pattern)
            if "state" not in scope:
                scope["state"] = {}
            scope["state"]["api_key_id"] = api_key.id
            scope["state"]["api_key_tier"] = api_key.tier
            
            day_limit_val = api_key.day_limit()
            remaining_val = max(0, api_key.day_limit() - api_key.calls_today)
        except Exception as exc:
            logger.error(f"[APIKeyMiddleware] DB error: {exc}", exc_info=True)
            db.rollback()
            response = JSONResponse(status_code=500, content={"detail": "Internal server error validating API key."})
            await response(scope, receive, send)
            return
        finally:
            db.close()

        # Add headers to response during send
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers_list = list(message.get("headers", []))
                headers_list.append((b"x-ratelimit-limit", str(day_limit_val).encode()))
                headers_list.append((b"x-ratelimit-remaining", str(remaining_val).encode()))
                message["headers"] = headers_list
            await send(message)

        await self.app(scope, receive, send_wrapper)


class CacheControlMiddleware:
    """
    Sets Cache-Control: public, s-maxage=300 header on eligible read-only paths:
    /dashboard, /topics, /radar, /feed, /forecast.
    Handles both direct and /api prefixed routes (used in production proxies).
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope["method"]
        path = scope["path"]

        # Only cache GET requests
        if method == "GET":
            clean_path = path.lower()
            if clean_path.endswith("/") and len(clean_path) > 1:
                clean_path = clean_path[:-1]

            is_cacheable = False
            # Check prefixes for cache candidates
            for cand in ["/dashboard", "/topics", "/radar", "/feed", "/forecast",
                         "/api/dashboard", "/api/topics", "/api/radar", "/api/feed", "/api/forecast"]:
                if clean_path == cand or clean_path.startswith(cand + "/"):
                    # Exclude admin and internal actions
                    if "/admin" not in clean_path and "/run-all-sync" not in clean_path:
                        is_cacheable = True
                        break

            if is_cacheable:
                async def send_wrapper(message):
                    if message["type"] == "http.response.start":
                        headers_list = list(message.get("headers", []))
                        # Remove existing Cache-Control header if any
                        headers_list = [h for h in headers_list if h[0].lower() != b"cache-control"]
                        headers_list.append((b"cache-control", b"public, s-maxage=300"))
                        message["headers"] = headers_list
                    await send(message)

                await self.app(scope, receive, send_wrapper)
                return

        await self.app(scope, receive, send)

