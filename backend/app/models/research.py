"""
Research Mode DB models.

Five tables:
  research_sessions  — named research workspaces per user
  research_messages  — conversation turns (user / agent) with repo snapshots
  research_pins      — repos manually curated from any message result
  research_reports   — AI-generated markdown reports per session
  research_shares    — time-limited public share tokens
"""
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _new_uuid():
    return str(uuid.uuid4())


def _new_token():
    return secrets.token_urlsafe(24)


# ─── Session ─────────────────────────────────────────────────────────────────

class ResearchSession(Base):
    __tablename__ = "research_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Research")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # JSON array of vertical keys active for this session, e.g. '["ai_ml","devtools"]'
    verticals_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    messages: Mapped[list["ResearchMessage"]] = relationship(
        "ResearchMessage", back_populates="session",
        cascade="all, delete-orphan", order_by="ResearchMessage.created_at"
    )
    pins: Mapped[list["ResearchPin"]] = relationship(
        "ResearchPin", back_populates="session",
        cascade="all, delete-orphan"
    )
    report: Mapped[Optional["ResearchReport"]] = relationship(
        "ResearchReport", back_populates="session",
        cascade="all, delete-orphan", uselist=False
    )
    share: Mapped[Optional["ResearchShare"]] = relationship(
        "ResearchShare", back_populates="session",
        cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        Index("ix_research_sessions_user_updated", "user_id", "updated_at"),
    )

    def __repr__(self):
        return f"<ResearchSession {self.id} user={self.user_id} '{self.title}'>"


# ─── Message ─────────────────────────────────────────────────────────────────

class ResearchMessage(Base):
    __tablename__ = "research_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)   # 'user' | 'agent'
    content: Mapped[str] = mapped_column(Text, nullable=False)       # markdown

    # Intent classified by the agent (search|compare|landscape|temporal|report|
    # repo_detail|out_of_scope|clarify)
    intent: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Raw GitHub query string used (for transparency shown in the UI)
    github_query: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Plain-English explanation of the query shown before results load
    query_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # JSON snapshot of repos returned by GitHub API for this turn
    repos_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Confidence score from the intent parser (0.0–1.0)
    confidence: Mapped[Optional[float]] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)

    session: Mapped["ResearchSession"] = relationship("ResearchSession", back_populates="messages")

    def __repr__(self):
        return f"<ResearchMessage {self.id} role={self.role} intent={self.intent}>"


# ─── Pin ─────────────────────────────────────────────────────────────────────

class ResearchPin(Base):
    __tablename__ = "research_pins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # full_name = "owner/name" — NOT a FK to repositories table because pinned
    # repos come from real-time GitHub API and may not be in our DB.
    repo_full_name: Mapped[str] = mapped_column(String(512), nullable=False)

    # Snapshot of all metrics at pin time (JSON) — decoupled from DB
    repo_data_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Stage: watch | evaluate | track | dismiss
    stage: Mapped[str] = mapped_column(String(20), nullable=False, default="watch")

    pinned_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped["ResearchSession"] = relationship("ResearchSession", back_populates="pins")

    __table_args__ = (
        Index("ix_research_pins_session_repo", "session_id", "repo_full_name", unique=True),
    )

    def __repr__(self):
        return f"<ResearchPin {self.repo_full_name} stage={self.stage}>"


# ─── Report ──────────────────────────────────────────────────────────────────

class ResearchReport(Base):
    __tablename__ = "research_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )
    content_md: Mapped[str] = mapped_column(Text, nullable=False)
    repos_count: Mapped[int] = mapped_column(Integer, default=0)
    queries_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped["ResearchSession"] = relationship("ResearchSession", back_populates="report")

    def __repr__(self):
        return f"<ResearchReport session={self.session_id} repos={self.repos_count}>"


# ─── Share ───────────────────────────────────────────────────────────────────

class ResearchShare(Base):
    __tablename__ = "research_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default=_new_token, index=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # None = never expires
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped["ResearchSession"] = relationship("ResearchSession", back_populates="share")

    def __repr__(self):
        return f"<ResearchShare token={self.token[:8]}… session={self.session_id}>"
