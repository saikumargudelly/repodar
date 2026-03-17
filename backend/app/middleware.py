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


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"HTTP {request.method} {request.url.path} - {response.status_code} - {process_time:.4f}s")
        return response


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _today_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


class APIKeyMiddleware(BaseHTTPMiddleware):
    """
    Middleware that:
    1. Only intercepts requests to paths starting with /api/v1
    2. Reads X-API-Key header
    3. Validates the key against the api_keys table (SHA-256 hash match)
    4. Enforces per-day rate limits based on the tier
    5. Increments call counters and updates last_used_at
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if not request.url.path.startswith(_PUBLIC_V1_PREFIX):
            return await call_next(request)

        raw_key: Optional[str] = request.headers.get("X-API-Key")
        if not raw_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing X-API-Key header. Get a key at /dev/api-keys."},
            )

        key_hash = _hash_key(raw_key)

        db: Session = SessionLocal()
        try:
            api_key: Optional[ApiKey] = (
                db.query(ApiKey)
                .filter(ApiKey.key_hash == key_hash, ApiKey.is_active == True)  # noqa: E712
                .first()
            )
            if api_key is None:
                return JSONResponse(status_code=401, content={"detail": "Invalid or revoked API key."})

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
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Daily rate limit exceeded ({day_limit} calls). Upgrade your plan.",
                        "tier": api_key.tier,
                        "limit": day_limit,
                        "used": api_key.calls_today,
                    },
                )

            # Increment counters
            api_key.calls_today += 1
            api_key.calls_this_month += 1
            api_key.calls_total += 1
            api_key.last_used_at = _utcnow()
            db.commit()

            # Expose resolved info to downstream endpoints via request.state
            request.state.api_key_id = api_key.id
            request.state.api_key_tier = api_key.tier
        except Exception as exc:
            logger.error(f"[APIKeyMiddleware] DB error: {exc}", exc_info=True)
            db.rollback()
            return JSONResponse(status_code=500, content={"detail": "Internal server error validating API key."})
        finally:
            db.close()

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(api_key.day_limit())
        response.headers["X-RateLimit-Remaining"] = str(max(0, api_key.day_limit() - api_key.calls_today))
        return response
