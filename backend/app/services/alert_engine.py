"""
Alert Engine — event-based, async-friendly.

Architecture:
  AlertRule  (model) → defines threshold conditions per user
  AlertEvent (pydantic) → fired event passed to delivery workers
  AlertEngine → evaluate_rules() called at end of ingestion cycle

Delivery: fire-and-forget via asyncio.create_task() — never blocks ingestion.
Webhooks: HTTP POST to configured endpoint.
Email: stub (plug in any SMTP/SES/Resend adapter).
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import socket
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import aiohttp
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ─── SSRF guard — reused from a2a_ingestion pattern ——————————————————————

_PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local / AWS metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _is_safe_webhook_url(url: str) -> bool:
    """Return False if the URL resolves to a private/internal IP (SSRF prevention)."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        ip = ipaddress.ip_address(socket.gethostbyname(hostname))
        for net in _PRIVATE_RANGES:
            if ip in net:
                return False
        return True
    except Exception:
        return False  # deny on any resolution failure


# ─── Event schema ──────────────────────────────────────────────────────────────

class AlertEvent(BaseModel):
    event_type:  str          # "TREND_SPIKE" | "STAR_SURGE" | "BREAKOUT" | "SCORE_THRESHOLD"
    repo_id:     str
    repo_name:   str
    owner:       str
    name:        str
    github_url:  str
    metric:      str          # which metric triggered
    value:       float        # current metric value
    threshold:   float        # configured threshold
    score:       Optional[float] = None
    fired_at:    str = ""     # ISO timestamp

    def model_post_init(self, __context):
        if not self.fired_at:
            self.fired_at = datetime.now(timezone.utc).isoformat()


# ─── Condition evaluators (pure functions) ────────────────────────────────────

_CONDITION_OPERATORS = {
    ">":  lambda v, t: v > t,
    ">=": lambda v, t: v >= t,
    "<":  lambda v, t: v < t,
    "<=": lambda v, t: v <= t,
    "==": lambda v, t: abs(v - t) < 0.001,
}

METRIC_FIELD_MAP = {
    "trend_score":          ("cm", "trend_score"),
    "sustainability_score": ("cm", "sustainability_score"),
    "star_velocity_7d":     ("cm", "star_velocity_7d"),
    "acceleration":         ("cm", "acceleration"),
    "stars":                ("dm", "stars"),
    "daily_star_delta":     ("dm", "daily_star_delta"),
    "breakout_probability": ("forecast", "breakout_probability"),
}


def evaluate_condition(
    condition_str: str,       # e.g. "trend_score > 0.80"
    metric_values: dict,      # {"trend_score": 0.91, "stars": 14200, ...}
) -> tuple[bool, Optional[float], Optional[float]]:
    """
    Parse and evaluate a condition string against current metric values.
    Returns (triggered: bool, value: float|None, threshold: float|None).
    """
    try:
        parts = condition_str.strip().split()
        if len(parts) != 3:
            return False, None, None
        metric, op, threshold_str = parts
        threshold = float(threshold_str)
        value = metric_values.get(metric)
        if value is None:
            return False, None, None
        op_fn = _CONDITION_OPERATORS.get(op)
        if not op_fn:
            return False, None, None
        return op_fn(value, threshold), float(value), threshold
    except Exception as e:
        logger.warning(f"Condition eval error for '{condition_str}': {e}")
        return False, None, None


# ─── Webhook delivery (async, fire-and-forget) ───────────────────────────────

async def _deliver_webhook(url: str, event: AlertEvent, timeout: int = 8) -> bool:
    """POST event payload to webhook URL. Returns True on success."""
    # SSRF guard: block delivery to private/internal addresses
    if not _is_safe_webhook_url(url):
        logger.warning(f"[alert_engine] Blocked SSRF webhook delivery to unsafe URL: {url}")
        return False

    payload = event.model_dump()
    payload["repo"] = {
        "id":        event.repo_id,
        "name":      event.repo_name,
        "owner":     event.owner,
        "full_name": event.repo_name,
        "github_url": event.github_url,
    }
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json", "User-Agent": "Repodar/1.0"},
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as resp:
                ok = resp.status < 300
                if not ok:
                    logger.warning(f"Webhook {url} responded {resp.status}")
                return ok
    except Exception as e:
        logger.warning(f"Webhook delivery failed to {url}: {e}")
        return False


# ─── Alert evaluation engine ─────────────────────────────────────────────────

async def evaluate_alert_rules(
    repo,           # Repository ORM object
    cm,             # ComputedMetric ORM object (or None)
    dm,             # DailyMetric ORM object (or None)
    rules: list,    # list of AlertRule ORM objects for this repo/global
    forecast_values: Optional[dict] = None,
) -> list[AlertEvent]:
    """
    Evaluate all user-defined alert rules against a single repo's latest metrics.
    Fires webhook delivery tasks for triggered rules.

    Returns list of AlertEvent objects that fired (for audit logging).
    """
    if not rules:
        return []

    metric_values = {}
    if cm:
        metric_values["trend_score"]          = cm.trend_score or 0.0
        metric_values["sustainability_score"] = cm.sustainability_score or 0.0
        metric_values["star_velocity_7d"]     = cm.star_velocity_7d or 0.0
        metric_values["acceleration"]         = cm.acceleration or 0.0
    if dm:
        metric_values["stars"]             = float(dm.stars or 0)
        metric_values["daily_star_delta"]  = float(dm.daily_star_delta or 0)
    if forecast_values:
        metric_values.update(forecast_values)

    fired: list[AlertEvent] = []

    for rule in rules:
        try:
            triggered, value, threshold = evaluate_condition(rule.condition, metric_values)
            if not triggered:
                continue

            event = AlertEvent(
                event_type=_classify_event(rule.condition),
                repo_id=repo.id,
                repo_name=f"{repo.owner}/{repo.name}",
                owner=repo.owner,
                name=repo.name,
                github_url=repo.github_url,
                metric=rule.condition.split()[0],
                value=value or 0.0,
                threshold=threshold or 0.0,
            )
            fired.append(event)

            # Async webhook delivery — non-blocking
            if rule.webhook_url:
                asyncio.create_task(_deliver_webhook(rule.webhook_url, event))

            logger.info(f"Alert fired: {event.event_type} for {event.repo_name} ({rule.condition}={value:.3f})")
        except Exception as e:
            logger.warning(f"Alert rule {getattr(rule, 'id', '?')} eval error: {e}")

    return fired


def _classify_event(condition: str) -> str:
    metric = condition.split()[0] if condition else ""
    mapping = {
        "trend_score":         "SCORE_THRESHOLD",
        "star_velocity_7d":    "STAR_SURGE",
        "acceleration":        "TREND_SPIKE",
        "breakout_probability": "BREAKOUT",
        "daily_star_delta":    "STAR_SURGE",
        "stars":               "MILESTONE",
    }
    return mapping.get(metric, "THRESHOLD_EXCEEDED")
