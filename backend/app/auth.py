"""
auth.py — Centralized Clerk JWT verification for all protected endpoints.

Clerk issues RS256-signed JWTs. The `sub` claim equals the Clerk user ID.
Public keys are fetched from Clerk's JWKS endpoint and cached in-process
for CLERK_JWKS_CACHE_TTL seconds (default: 300s).

Required env vars:
  CLERK_JWKS_URL  — e.g. https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json
                    Find this in Clerk Dashboard → API Keys → JWKS URL.

Usage:
  from app.auth import get_current_user
  @router.get("/foo")
  def foo(user_id: str = Depends(get_current_user)):
      ...  # user_id is the verified Clerk user ID (sub claim)
"""

import logging
import os
from functools import lru_cache
from typing import Optional

import jwt
from jwt import PyJWKClient, InvalidTokenError, ExpiredSignatureError, DecodeError
from fastapi import Depends, Header, HTTPException, status

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

CLERK_JWKS_URL: str = os.getenv("CLERK_JWKS_URL", "")
# Cache TTL for the remote JWKS key set (seconds). PyJWKClient handles this.
CLERK_JWKS_CACHE_TTL: int = int(os.getenv("CLERK_JWKS_CACHE_TTL", "300"))


# ── JWKS Client (singleton, lazy-initialised) ─────────────────────────────────

@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    """
    Returns a module-level singleton PyJWKClient.
    Called once; subsequent calls return the cached instance.
    Thread-safe because lru_cache is thread-safe in CPython.
    """
    url = CLERK_JWKS_URL
    if not url:
        raise RuntimeError(
            "CLERK_JWKS_URL is not set. "
            "Add it to your .env: "
            "CLERK_JWKS_URL=https://<instance>.clerk.accounts.dev/.well-known/jwks.json"
        )
    return PyJWKClient(
        url,
        cache_jwk_set=True,
        lifespan=CLERK_JWKS_CACHE_TTL,
    )


# ── Core verification logic ───────────────────────────────────────────────────

def _verify_clerk_token(token: str) -> str:
    """
    Verifies a Clerk-issued JWT and returns the user ID (`sub` claim).
    Raises HTTPException 401 on any verification failure.
    """
    try:
        client = _jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True, "verify_aud": False},
            # Clerk tokens do not always set `aud`. If yours does, set:
            #   audience=os.getenv("CLERK_AUDIENCE", "")
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except DecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token is malformed: {exc}",
        )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {exc}",
        )
    except RuntimeError as exc:
        # CLERK_JWKS_URL not configured — server misconfiguration
        logger.error("Auth configuration error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured.",
        )
    except Exception as exc:
        # Network failure fetching JWKS, etc.
        logger.warning("Unexpected auth error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed.",
        )

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the 'sub' claim.",
        )
    return user_id


# ── FastAPI dependency ────────────────────────────────────────────────────────

def get_current_user(
    authorization: Optional[str] = Header(None),
) -> str:
    """
    FastAPI dependency. Reads `Authorization: Bearer <token>`,
    verifies the Clerk JWT, and returns the verified Clerk user ID.

    Use as:
        user_id: str = Depends(get_current_user)
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must use Bearer scheme.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _verify_clerk_token(token.strip())
