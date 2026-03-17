"""
Research Mode API router.

Endpoints:
  POST   /research/sessions                     → create session
  GET    /research/sessions                     → list user's sessions
  GET    /research/sessions/{id}                → session + messages + pins
  PATCH  /research/sessions/{id}                → update title/description
  DELETE /research/sessions/{id}                → delete session

  POST   /research/sessions/{id}/message       → send message → triggers agent
  GET    /research/sessions/{id}/stream        → SSE stream for pending message

  POST   /research/sessions/{id}/pins          → pin a repo
  DELETE /research/sessions/{id}/pins/{pin_id} → unpin
  PATCH  /research/sessions/{id}/pins/{pin_id} → update note/stage

  POST   /research/sessions/{id}/report        → generate AI report
  GET    /research/sessions/{id}/report        → fetch existing report

  POST   /research/sessions/{id}/share         → generate share token
  GET    /research/share/{token}               → public read-only view
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.research import (
    ResearchSession,
    ResearchMessage,
    ResearchPin,
    ResearchReport,
    ResearchShare,
)
from app.services.research_agent import (
    fast_route,
    process_message,
    stream_process_message,
    generate_report,
    generate_social_post,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/research", tags=["Research"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _session_or_404(session_id: str, user_id: str, db: Session) -> ResearchSession:
    s = db.query(ResearchSession).filter_by(id=session_id, user_id=user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Research session not found.")
    return s


def _serialize_session(s: ResearchSession) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "description": s.description,
        "verticals": json.loads(s.verticals_json) if s.verticals_json else [],
        "message_count": len(s.messages),
        "pin_count": len(s.pins),
        "has_report": s.report is not None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _serialize_message(m: ResearchMessage) -> dict:
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "intent": m.intent,
        "github_query": m.github_query,
        "query_explanation": m.query_explanation,
        "repos": json.loads(m.repos_json) if m.repos_json else [],
        "confidence": m.confidence,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _serialize_pin(p: ResearchPin) -> dict:
    return {
        "id": p.id,
        "repo_full_name": p.repo_full_name,
        "repo_data": json.loads(p.repo_data_json) if p.repo_data_json else {},
        "note": p.note,
        "stage": p.stage,
        "pinned_at": p.pinned_at.isoformat() if p.pinned_at else None,
    }


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    user_id: str
    title: str = "Untitled Research"
    description: Optional[str] = None
    verticals: List[str] = []


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    verticals: Optional[List[str]] = None


class SendMessageRequest(BaseModel):
    user_id: str
    content: str = Field(..., min_length=1, max_length=2000)
    user_tier: str = "free"  # free | pro | team


class PinRepoRequest(BaseModel):
    user_id: str
    repo_full_name: str
    repo_data: dict = {}
    note: Optional[str] = None
    stage: str = "watch"  # watch | evaluate | track | dismiss


class UpdatePinRequest(BaseModel):
    user_id: str
    note: Optional[str] = None
    stage: Optional[str] = None


class GenerateReportRequest(BaseModel):
    user_id: str


class CreateShareRequest(BaseModel):
    user_id: str
    ttl_days: Optional[int] = 7  # None = never expires


# ─── Session CRUD ─────────────────────────────────────────────────────────────

@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionRequest, db: Session = Depends(get_db)):
    s = ResearchSession(
        user_id=body.user_id,
        title=body.title.strip() or "Untitled Research",
        description=body.description,
        verticals_json=json.dumps(body.verticals) if body.verticals else None,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    logger.info(f"[research] Created session {s.id} for user {s.user_id}")
    return _serialize_session(s)


@router.get("/sessions")
def list_sessions(
    user_id: str = Query(..., description="Clerk user ID"),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ResearchSession)
        .filter_by(user_id=user_id)
        .order_by(ResearchSession.updated_at.desc())
        .all()
    )
    return [_serialize_session(s) for s in sessions]


@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, user_id, db)
    return {
        **_serialize_session(s),
        "messages": [_serialize_message(m) for m in s.messages],
        "pins": [_serialize_pin(p) for p in s.pins],
        "report": {
            "content_md": s.report.content_md,
            "generated_at": s.report.generated_at.isoformat(),
            "repos_count": s.report.repos_count,
        } if s.report else None,
    }


@router.patch("/sessions/{session_id}")
def update_session(
    session_id: str,
    body: UpdateSessionRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, user_id, db)
    if body.title is not None:
        s.title = body.title.strip() or s.title
    if body.description is not None:
        s.description = body.description
    if body.verticals is not None:
        s.verticals_json = json.dumps(body.verticals)
    s.updated_at = _utcnow()
    db.commit()
    return _serialize_session(s)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, user_id, db)
    db.delete(s)
    db.commit()


# ─── Messaging — REST (non-streaming) ─────────────────────────────────────────

@router.post("/sessions/{session_id}/message")
async def send_message(
    session_id: str,
    body: SendMessageRequest,
    db: Session = Depends(get_db),
):
    """Send a user message and get back a full agent response (non-streaming)."""
    s = _session_or_404(session_id, body.user_id, db)

    # Save user message
    user_msg = ResearchMessage(
        session_id=session_id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)
    db.commit()

    # Build context (last 3 turns = 6 messages)
    context = [
        {"role": m.role, "content": m.content}
        for m in s.messages[-6:]
        if m.id != user_msg.id  # exclude the one we just added
    ]

    # Run agent
    result = await process_message(
        message=body.content,
        context_turns=context,
        user_tier=body.user_tier,
    )

    # Save agent message
    agent_msg = ResearchMessage(
        session_id=session_id,
        role="agent",
        content=result.content,
        intent=result.intent,
        github_query=result.github_query,
        query_explanation=result.query_explanation,
        repos_json=json.dumps(result.repos) if result.repos else None,
        confidence=result.confidence,
    )
    db.add(agent_msg)
    s.updated_at = _utcnow()
    db.commit()
    db.refresh(agent_msg)

    return {
        **_serialize_message(agent_msg),
        "suggested_follow_ups": result.suggested_follow_ups,
        "stream_id": None,  # REST mode — no stream
    }


# ─── Messaging — SSE streaming ────────────────────────────────────────────────

@router.get("/sessions/{session_id}/stream")
async def stream_message(
    session_id: str,
    user_id: str = Query(...),
    message: str = Query(..., min_length=1, max_length=2000),
    user_tier: str = Query("free"),
    db: Session = Depends(get_db),
):
    """
    SSE endpoint. Streams agent response events:
      status | query_explanation | repos | token | done | error

    Frontend uses EventSource to consume this.
    """
    s = _session_or_404(session_id, user_id, db)

    # Save user message immediately so context is correct
    user_msg = ResearchMessage(
        session_id=session_id,
        role="user",
        content=message,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Build context (last 3 turns, excluding message we just saved)
    context = [
        {"role": m.role, "content": m.content}
        for m in (
            db.query(ResearchMessage)
            .filter_by(session_id=session_id)
            .order_by(ResearchMessage.created_at.asc())
            .all()
        )[-7:-1]  # last 6 messages before the current one
    ]

    # Accumulate agent output to persist after streaming
    collected_content: list[str] = []
    collected_repos: list[dict] = []
    collected_meta: dict = {}

    async def _event_generator():
        nonlocal collected_content, collected_repos, collected_meta
        try:
            async for chunk in stream_process_message(
                message=message,
                context_turns=context,
                user_tier=user_tier,
            ):
                yield chunk
                # Parse to accumulate
                try:
                    payload = json.loads(chunk.removeprefix("data: ").strip())
                    t = payload.get("type")
                    if t == "token":
                        collected_content.append(payload.get("text", ""))
                    elif t == "repos":
                        collected_repos = payload.get("data", [])
                    elif t == "done":
                        data = payload.get("data") or payload.get("text", "")
                        if isinstance(data, dict):
                            collected_meta = data
                        elif isinstance(data, str) and not collected_content:
                            collected_content.append(data)
                except Exception:
                    pass
        finally:
            # Persist agent message to DB after streaming completes
            try:
                full_content = "".join(collected_content)
                if not full_content:
                    full_content = collected_meta.get("text", "")
                agent_msg = ResearchMessage(
                    session_id=session_id,
                    role="agent",
                    content=full_content or "(empty response)",
                    intent=collected_meta.get("intent"),
                    github_query=collected_meta.get("github_query"),
                    query_explanation=collected_meta.get("query_explanation"),
                    repos_json=json.dumps(collected_repos) if collected_repos else None,
                    confidence=collected_meta.get("confidence"),
                )
                db.add(agent_msg)
                s.updated_at = _utcnow()
                db.commit()
            except Exception as exc:
                logger.warning(f"[research] Failed to persist agent message: {exc}")

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        },
    )


# ─── Pins ─────────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/pins", status_code=201)
def pin_repo(
    session_id: str,
    body: PinRepoRequest,
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, body.user_id, db)

    # Check duplicate
    existing = db.query(ResearchPin).filter_by(
        session_id=session_id, repo_full_name=body.repo_full_name
    ).first()
    if existing:
        return _serialize_pin(existing)  # idempotent

    pin = ResearchPin(
        session_id=session_id,
        repo_full_name=body.repo_full_name,
        repo_data_json=json.dumps(body.repo_data),
        note=body.note,
        stage=body.stage,
    )
    db.add(pin)
    s.updated_at = _utcnow()
    db.commit()
    db.refresh(pin)
    return _serialize_pin(pin)


@router.delete("/sessions/{session_id}/pins/{pin_id}", status_code=204)
def unpin_repo(
    session_id: str,
    pin_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, user_id, db)
    pin = db.query(ResearchPin).filter_by(id=pin_id, session_id=session_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found.")
    db.delete(pin)
    s.updated_at = _utcnow()
    db.commit()


@router.patch("/sessions/{session_id}/pins/{pin_id}")
def update_pin(
    session_id: str,
    pin_id: str,
    body: UpdatePinRequest,
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, body.user_id, db)
    pin = db.query(ResearchPin).filter_by(id=pin_id, session_id=session_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found.")
    if body.note is not None:
        pin.note = body.note
    if body.stage is not None:
        valid_stages = {"watch", "evaluate", "track", "dismiss"}
        if body.stage not in valid_stages:
            raise HTTPException(status_code=422, detail=f"stage must be one of {valid_stages}")
        pin.stage = body.stage
    db.commit()
    db.refresh(pin)
    return _serialize_pin(pin)


# ─── Report ───────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/report")
async def create_report(
    session_id: str,
    body: GenerateReportRequest,
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, body.user_id, db)

    pins = s.pins
    pin_dicts = [json.loads(p.repo_data_json) for p in pins if p.repo_data_json]
    queries_used = list({
        m.github_query for m in s.messages
        if m.role == "agent" and m.github_query
    })

    # Guardrail 7: minimum 3 pins enforced inside generate_report()
    md = await generate_report(
        session_title=s.title,
        pins=pin_dicts,
        queries_used=queries_used,
    )

    # Upsert report
    if s.report:
        s.report.content_md = md
        s.report.repos_count = len(pins)
        s.report.queries_json = json.dumps(queries_used)
        s.report.generated_at = _utcnow()
    else:
        report = ResearchReport(
            session_id=session_id,
            content_md=md,
            repos_count=len(pins),
            queries_json=json.dumps(queries_used),
        )
        db.add(report)

    s.updated_at = _utcnow()
    db.commit()

    return {
        "content_md": md,
        "repos_count": len(pins),
        "generated_at": _utcnow().isoformat(),
    }


@router.get("/sessions/{session_id}/report")
def get_report(
    session_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, user_id, db)
    if not s.report:
        raise HTTPException(status_code=404, detail="No report generated yet for this session.")
    return {
        "content_md": s.report.content_md,
        "repos_count": s.report.repos_count,
        "generated_at": s.report.generated_at.isoformat() if s.report.generated_at else None,
    }


# ─── Share ────────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/share")
def create_share(
    session_id: str,
    body: CreateShareRequest,
    db: Session = Depends(get_db),
):
    s = _session_or_404(session_id, body.user_id, db)

    if s.share:
        # Refresh token + expiry
        s.share.expires_at = (
            _utcnow() + timedelta(days=body.ttl_days)
            if body.ttl_days else None
        )
        db.commit()
        token = s.share.token
    else:
        share = ResearchShare(
            session_id=session_id,
            expires_at=_utcnow() + timedelta(days=body.ttl_days) if body.ttl_days else None,
        )
        db.add(share)
        db.commit()
        db.refresh(share)
        token = share.token

    return {
        "token": token,
        "share_url": f"/research/share/{token}",
        "expires_at": s.share.expires_at.isoformat() if s.share and s.share.expires_at else None,
    }


@router.get("/share/{token}")
def get_shared_session(token: str, db: Session = Depends(get_db)):
    """Public read-only view — no auth required."""
    share = db.query(ResearchShare).filter_by(token=token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired.")

    # Check expiry
    if share.expires_at and share.expires_at < _utcnow():
        raise HTTPException(status_code=410, detail="This share link has expired.")

    s = share.session
    return {
        "title": s.title,
        "description": s.description,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "pins": [_serialize_pin(p) for p in s.pins],
        "report": {
            "content_md": s.report.content_md,
            "generated_at": s.report.generated_at.isoformat(),
            "repos_count": s.report.repos_count,
        } if s.report else None,
        "message_count": len(s.messages),
    }


# ─── Social Post / Blog ───────────────────────────────────────────────────────

class GenerateBlogRequest(BaseModel):
    user_id: str
    platform: str = "reddit"   # reddit | twitter | linkedin
    niche: str = ""            # optional context e.g. "AI agents"
    repo: dict = Field(default_factory=dict)  # full repo data dict from research results


@router.post("/sessions/{session_id}/blog")
async def generate_blog_post(
    session_id: str,
    body: GenerateBlogRequest,
    db: Session = Depends(get_db),
):
    """
    Generate a platform-specific social post / blog draft for a pinned or searched repo.
    Returns the generated markdown post copy.
    """
    _session_or_404(session_id, body.user_id, db)  # auth check only

    valid_platforms = {"reddit", "twitter", "linkedin"}
    if body.platform not in valid_platforms:
        raise HTTPException(status_code=422, detail=f"platform must be one of {valid_platforms}")

    if not body.repo:
        raise HTTPException(status_code=422, detail="repo data is required")

    post_content = await generate_social_post(
        repo=body.repo,
        platform=body.platform,
        niche=body.niche,
    )

    return {
        "platform": body.platform,
        "content": post_content,
        "repo_name": body.repo.get("full_name", "unknown"),
    }
