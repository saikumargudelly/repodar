"""
Webhooks and Active Alerting Configuration router.

CRUD for user alert rules.
Delivery mechanism itself is inside alert_engine.py.
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert_rule import AlertRule


router = APIRouter(prefix="/alerts", tags=["AlertRules"])
logger = logging.getLogger(__name__)


_PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _assert_safe_url(url: str | None) -> None:
    """Raise 422 if the URL resolves to a private/internal address (SSRF prevention)."""
    if not url:
        return
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(status_code=422, detail="webhook_url must use http or https")
        hostname = parsed.hostname
        if not hostname:
            raise HTTPException(status_code=422, detail="webhook_url has no valid hostname")
        ip = ipaddress.ip_address(socket.gethostbyname(hostname))
        for net in _PRIVATE_RANGES:
            if ip in net:
                raise HTTPException(
                    status_code=422,
                    detail="webhook_url must not target a private or internal address"
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="webhook_url could not be resolved")


class AlertRuleCreate(BaseModel):
    name: str
    condition: str
    frequency: str = "instant"
    webhook_url: str | None = None
    channels: list[str] = ["webhook"]

class AlertRuleResponse(BaseModel):
    id: str
    name: str
    condition: str
    frequency: str
    webhook_url: str | None
    channels: list[str]
    is_active: bool
    created_at: str


@router.get("/rules", response_model=list[AlertRuleResponse])
def get_user_rules(
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    rows = db.query(AlertRule).filter_by(user_id=x_user_id).all()
    import json
    return [
        AlertRuleResponse(
            id=r.id, name=r.name, condition=r.condition,
            frequency=r.frequency, webhook_url=r.webhook_url,
            channels=json.loads(r.channels or '[]'),
            is_active=r.is_active, created_at=r.created_at.isoformat()
        )
        for r in rows
    ]


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
def create_alert_rule(
    body: AlertRuleCreate,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    # SSRF guard: validate webhook URL before persisting
    _assert_safe_url(body.webhook_url)

    import json
    rule = AlertRule(
        user_id=x_user_id,
        name=body.name,
        condition=body.condition,
        frequency=body.frequency,
        webhook_url=body.webhook_url,
        channels=json.dumps(body.channels),
        is_active=True,
    )
    db.add(rule)
    db.commit()
    return AlertRuleResponse(
        id=rule.id, name=rule.name, condition=rule.condition,
        frequency=rule.frequency, webhook_url=rule.webhook_url,
        channels=body.channels, is_active=rule.is_active,
        created_at=rule.created_at.isoformat(),
    )


@router.delete("/rules/{rule_id}", status_code=204)
def delete_alert_rule(
    rule_id: str,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter_by(id=rule_id, user_id=x_user_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
