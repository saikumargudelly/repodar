import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.a2a_service import A2AService, A2ACapability

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/services", tags=["A2A Services"])


# ─── Response schemas ─────────────────────────────────────────────────────────

class CapabilityOut(BaseModel):
    id: str
    service_id: str
    name: str
    method: str
    path: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class ServiceOut(BaseModel):
    id: str
    name: str
    provider: Optional[str] = None
    base_url: str
    description: Optional[str] = None
    version: Optional[str] = None
    categories: Optional[List[str]] = None
    status: str
    response_latency_ms: Optional[int] = None
    created_at: Optional[str] = None
    last_checked_at: Optional[str] = None
    last_seen_at: Optional[str] = None
    capabilities: List[CapabilityOut] = []
    capability_count: int = 0
    # Rich metadata
    auth_schemes: Optional[List[str]] = None
    input_modes: Optional[List[str]] = None
    output_modes: Optional[List[str]] = None
    documentation_url: Optional[str] = None
    supports_streaming: Optional[bool] = None

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    url: str


class RegisterResponse(BaseModel):
    message: str
    service_id: Optional[str] = None
    status: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/search", response_model=List[ServiceOut])
def search_services(
    capability: str = Query(..., description="Capability name or method keyword to search"),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
):
    """
    Search services by capability name or description.
    Must be defined BEFORE /{service_id} to avoid path conflicts.
    """
    keyword = f"%{capability.lower()}%"
    matching_service_ids = (
        db.query(A2ACapability.service_id)
        .filter(
            (A2ACapability.name.ilike(keyword))
            | (A2ACapability.description.ilike(keyword))
            | (A2ACapability.method.ilike(keyword))
        )
        .distinct()
        .limit(limit)
        .all()
    )
    ids = [row[0] for row in matching_service_ids]
    if not ids:
        return []

    services = db.query(A2AService).filter(A2AService.id.in_(ids)).all()
    return [_to_service_out(s) for s in services]


@router.post("/register", response_model=RegisterResponse)
async def register_service(
    body: RegisterRequest = Body(...),
    db: Session = Depends(get_db),
):
    """
    Register a new A2A service by URL and ingest its capability card.
    The URL must point to a publicly routable host (SSRF protection enforced).
    """
    from app.services.a2a_ingestion import ingest_service_by_url

    try:
        service, err = await ingest_service_by_url(body.url, db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error(f"[services] register failed for {body.url}: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Failed to fetch A2A card: {exc}")

    if service is None:
        # Build a context-aware hint based on the error type
        from app.services.a2a_ingestion import (
            _ERR_AUTH, _ERR_DNS, _ERR_NO_CARD, _ERR_RATE_LIMIT,
            _ERR_SLEEPING, _ERR_SSL, _ERR_TIMEOUT,
        )
        if err:
            if _ERR_AUTH in err:
                detail = (
                    "The agent card appears to require authentication (HTTP 401/403). "
                    "Only publicly-accessible cards can be registered without credentials."
                )
            elif _ERR_DNS in err:
                detail = (
                    f"Cannot reach {body.url}: the domain does not resolve. "
                    "Check that the service is deployed and the URL is correct."
                )
            elif _ERR_TIMEOUT in err:
                detail = (
                    f"Timed out connecting to {body.url}. "
                    "The service may be down or unreachable from this network."
                )
            elif _ERR_SSL in err:
                detail = (
                    f"TLS/SSL error when connecting to {body.url}. "
                    "Ensure the certificate is valid and not self-signed."
                )
            elif _ERR_RATE_LIMIT in err:
                detail = (
                    f"The service at {body.url} is rate-limiting requests (HTTP 429). "
                    "Please wait a few minutes and try again."
                )
            elif _ERR_SLEEPING in err:
                detail = (
                    f"The service at {body.url} is in a cold-start / sleeping state (HTTP 503). "
                    "Wait a minute for it to wake up, then try again."
                )
            else:
                detail = err
        else:
            detail = (
                "Could not find an agent card at any known path. "
                "Ensure the service exposes one of: "
                "/.well-known/agent-card.json (A2A v0.3 current), "
                "/.well-known/agent.json (A2A v1/deprecated), "
                "/.well-known/ai-plugin.json (OpenAI plugin), "
                "or /a2a-card, /agent-card, /mcp."
            )
        raise HTTPException(status_code=422, detail=detail)

    msg = "Service registered and capabilities indexed."
    if err:
        # Existing service was re-checked but is currently unreachable
        msg = f"Service re-registered but is currently {service.status}: {err}"

    return RegisterResponse(
        message=msg,
        service_id=service.id,
        status=service.status,
    )


@router.get("", response_model=List[ServiceOut])
def list_services(
    category: Optional[str] = Query(None, description="Filter by category keyword"),
    provider: Optional[str] = Query(None, description="Filter by provider name"),
    status: Optional[str] = Query(None, description="active | unreachable | invalid"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    """List all registered A2A services with optional filters."""
    q = db.query(A2AService)

    if status:
        q = q.filter(A2AService.status == status)
    if provider:
        q = q.filter(A2AService.provider.ilike(f"%{provider}%"))
    if category:
        # categories is stored as JSON text; use LIKE for portability
        q = q.filter(A2AService.categories.ilike(f"%{category}%"))

    services = q.order_by(A2AService.last_seen_at.desc().nullslast()).limit(limit).all()
    return [_to_service_out(s) for s in services]


@router.get("/{service_id}", response_model=ServiceOut)
def get_service(service_id: str, db: Session = Depends(get_db)):
    """Get a single A2A service with full capability list."""
    service = db.query(A2AService).filter(A2AService.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return _to_service_out(service)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _to_service_out(s: A2AService) -> ServiceOut:
    caps = [
        CapabilityOut(
            id=c.id,
            service_id=c.service_id,
            name=c.name,
            method=c.method,
            path=c.path,
            description=c.description,
        )
        for c in (s.capabilities or [])
    ]
    return ServiceOut(
        id=s.id,
        name=s.name,
        provider=s.provider,
        base_url=s.base_url,
        description=s.description,
        version=s.version,
        categories=_parse_json_list(s.categories),
        status=s.status,
        response_latency_ms=s.response_latency_ms,
        created_at=s.created_at.isoformat() if s.created_at else None,
        last_checked_at=s.last_checked_at.isoformat() if s.last_checked_at else None,
        last_seen_at=s.last_seen_at.isoformat() if s.last_seen_at else None,
        capabilities=caps,
        capability_count=len(caps),
        auth_schemes=_parse_json_list(getattr(s, "auth_schemes", None)),
        input_modes=_parse_json_list(getattr(s, "input_modes", None)),
        output_modes=_parse_json_list(getattr(s, "output_modes", None)),
        documentation_url=getattr(s, "documentation_url", None),
        supports_streaming=bool(getattr(s, "supports_streaming", 0)) if getattr(s, "supports_streaming", None) is not None else None,
    )


def _parse_json_list(value) -> Optional[List[str]]:
    if value is None:
        return None
    if isinstance(value, list):
        return value
    import json
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else None
    except Exception:
        return None
