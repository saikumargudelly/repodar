import logging
import os
from typing import Iterable, Optional

import httpx

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://repodar.vercel.app").rstrip("/")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "alerts@repodar.vercel.app")


def send_email(to_email: str, subject: str, html: str, text: Optional[str] = None) -> tuple[bool, Optional[str]]:
    """Send an email via Resend if configured."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — email send skipped")
        return False, "RESEND_API_KEY not configured"

    payload = {
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        if response.status_code in (200, 201):
            return True, None
        return False, f"HTTP {response.status_code}: {response.text[:200]}"
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        return False, str(exc)


def build_watchlist_alert_email(repo_owner: str, repo_name: str, alert_type: str, headline: str, detail_lines: Iterable[str]) -> str:
    detail_html = "".join(f"<li>{line}</li>" for line in detail_lines)
    repo_url = f"{FRONTEND_URL}/repo/{repo_owner}/{repo_name}"
    watchlist_url = f"{FRONTEND_URL}/watchlist"
    return f"""
    <div style=\"font-family: Inter, Arial, sans-serif; color: #e6edf3; background: #0d1117; padding: 24px;\">
      <div style=\"max-width: 640px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 28px;\">
        <p style=\"margin: 0 0 8px; color: #58a6ff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;\">Repodar Watchlist Alert</p>
        <h2 style=\"margin: 0 0 10px; font-size: 24px;\">{repo_owner}/{repo_name}</h2>
        <p style=\"margin: 0 0 18px; color: #8b949e;\">{headline}</p>
        <ul style=\"margin: 0 0 22px; padding-left: 18px; color: #e6edf3;\">{detail_html}</ul>
        <div style=\"display: flex; gap: 12px; flex-wrap: wrap;\">
          <a href=\"{repo_url}\" style=\"background: #58a6ff; color: #0d1117; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;\">Open Repo Radar</a>
          <a href=\"{watchlist_url}\" style=\"border: 1px solid #30363d; color: #e6edf3; text-decoration: none; padding: 10px 16px; border-radius: 8px;\">Manage Watchlist</a>
        </div>
        <p style=\"margin: 18px 0 0; color: #6e7681; font-size: 12px;\">Alert type: {alert_type}</p>
      </div>
    </div>
    """


def build_digest_email(
    frequency: str,
    alerts: list[dict],
    top_breakouts: list[dict],
    unsubscribe_url: Optional[str] = None,
) -> str:
    alert_rows = "".join(
        f"<li><strong>{item['repo']}</strong> — {item['headline']}</li>" for item in alerts
    ) or "<li>No new alerts in this period.</li>"
    breakout_rows = "".join(
        f"<li><strong>{item['repo']}</strong> — Trend {item['trend_score']:.3f}, Sustain {item['sustainability_label']}</li>"
        for item in top_breakouts
    ) or "<li>No scored repos available yet.</li>"
    unsubscribe_html = ""
    if unsubscribe_url:
        unsubscribe_html = f'<p style="margin: 18px 0 0; color: #6e7681; font-size: 12px;"><a href="{unsubscribe_url}" style="color: #8b949e;">Unsubscribe</a></p>'
    return f"""
    <div style=\"font-family: Inter, Arial, sans-serif; color: #e6edf3; background: #0d1117; padding: 24px;\">
      <div style=\"max-width: 720px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 28px;\">
        <p style=\"margin: 0 0 8px; color: #58a6ff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;\">Repodar {frequency.title()} Digest</p>
        <h2 style=\"margin: 0 0 14px; font-size: 24px;\">GitHub AI ecosystem moves worth watching</h2>
        <p style=\"margin: 0 0 22px; color: #8b949e;\">The latest alert activity and top breakouts from Repodar.</p>
        <h3 style=\"margin: 0 0 10px; font-size: 16px;\">Alerts</h3>
        <ul style=\"margin: 0 0 24px; padding-left: 18px;\">{alert_rows}</ul>
        <h3 style=\"margin: 0 0 10px; font-size: 16px;\">Top Breakouts</h3>
        <ul style=\"margin: 0; padding-left: 18px;\">{breakout_rows}</ul>
        {unsubscribe_html}
      </div>
    </div>
    """