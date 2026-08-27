from dataclasses import dataclass
from enum import Enum
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func
import sqlalchemy.exc

from app.models import ComputedMetric, DailyMetric


class ErrorNature(str, Enum):
    TRANSIENT = "TRANSIENT"
    PERMANENT = "PERMANENT"
    UNKNOWN = "UNKNOWN"


class ErrorScope(str, Enum):
    CONNECTION = "CONNECTION"
    STATEMENT = "STATEMENT"
    TRANSACTION = "TRANSACTION"
    COMMIT = "COMMIT"
    UNKNOWN = "UNKNOWN"


class RecoveryStrategy(str, Enum):
    RETRY_STATEMENT = "RETRY_STATEMENT"
    RETRY_TRANSACTION = "RETRY_TRANSACTION"
    RECONNECT = "RECONNECT"
    DO_NOT_RETRY = "DO_NOT_RETRY"
    REQUIRES_IDEMPOTENCY = "REQUIRES_IDEMPOTENCY"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class DBErrorClassification:
    nature: ErrorNature
    scope: ErrorScope
    recommended_recovery: RecoveryStrategy
    sqlstate: Optional[str] = None
    reason: str = ""
    is_retryable: bool = False


_DISCONNECT_MESSAGE_SUBSTRINGS = (
    "server closed the connection unexpectedly",
    "connection reset by peer",
    "terminating connection due to administrator command",
    "ssl connection has been closed unexpectedly",
    "could not connect to server",
    "connection already closed",
    "connection is closed",
    "connection refused",
    "connection timed out",
    "broken pipe",
)


def _is_disconnect_error(exc: Exception, msg_lower: str) -> bool:
    """Check if exception represents an explicit network connection loss."""
    if getattr(exc, "connection_invalidated", False) or getattr(exc, "is_disconnect", False):
        return True
    orig = getattr(exc, "orig", None)
    if orig and (getattr(orig, "connection_invalidated", False) or getattr(orig, "is_disconnect", False)):
        return True
    return any(sub in msg_lower for sub in _DISCONNECT_MESSAGE_SUBSTRINGS)


def classify_db_error(exc: Exception, during_commit: bool = False) -> DBErrorClassification:
    """
    Classifies a database exception into structured failure nature, failure scope,
    and recommended recovery strategy using PostgreSQL SQLSTATE and driver error details.

    Note: A recovery value of RECONNECT indicates database connectivity must be
    re-established, and does NOT imply the failed operation is safe to replay.
    Generic OperationalErrors without recognized SQLSTATE or disconnect indicators
    remain UNKNOWN and are not marked retryable.
    """
    if exc is None:
        return DBErrorClassification(
            nature=ErrorNature.UNKNOWN,
            scope=ErrorScope.UNKNOWN,
            recommended_recovery=RecoveryStrategy.UNKNOWN,
            reason="No exception provided",
            is_retryable=False,
        )

    orig = getattr(exc, "orig", None)
    sqlstate = (
        getattr(orig, "pgcode", None)
        or getattr(orig, "sqlstate", None)
        or getattr(exc, "pgcode", None)
        or getattr(exc, "sqlstate", None)
    )
    if sqlstate is not None:
        sqlstate = str(sqlstate).strip().upper()

    msg_lower = f"{str(exc)} {str(orig) if orig else ''}".lower()
    is_disconnect = _is_disconnect_error(exc, msg_lower)

    # ── 1. Known SQLSTATE Classifications ─────────────────────────────────────

    # Deadlock detected (40P01)
    if sqlstate == "40P01":
        return DBErrorClassification(
            nature=ErrorNature.TRANSIENT,
            scope=ErrorScope.TRANSACTION,
            recommended_recovery=RecoveryStrategy.RETRY_TRANSACTION,
            sqlstate=sqlstate,
            reason="PostgreSQL deadlock detected (40P01)",
            is_retryable=True,
        )

    # Serialization failure (40001)
    if sqlstate == "40001":
        return DBErrorClassification(
            nature=ErrorNature.TRANSIENT,
            scope=ErrorScope.TRANSACTION,
            recommended_recovery=RecoveryStrategy.RETRY_TRANSACTION,
            sqlstate=sqlstate,
            reason="PostgreSQL serialization failure (40001)",
            is_retryable=True,
        )

    # Database server shutdown / cannot connect now (57P01, 57P02, 57P03)
    if sqlstate in ("57P01", "57P02", "57P03"):
        if during_commit:
            return DBErrorClassification(
                nature=ErrorNature.UNKNOWN,
                scope=ErrorScope.COMMIT,
                recommended_recovery=RecoveryStrategy.REQUIRES_IDEMPOTENCY,
                sqlstate=sqlstate,
                reason=f"Database shutdown during COMMIT ({sqlstate}) - transaction outcome unknown",
                is_retryable=False,
            )
        return DBErrorClassification(
            nature=ErrorNature.TRANSIENT,
            scope=ErrorScope.CONNECTION,
            recommended_recovery=RecoveryStrategy.RECONNECT,
            sqlstate=sqlstate,
            reason=f"Database server shutting down / unavailable ({sqlstate})",
            is_retryable=False,
        )

    # Connection exception SQLSTATEs (Class 08)
    if sqlstate and sqlstate.startswith("08"):
        if during_commit:
            return DBErrorClassification(
                nature=ErrorNature.UNKNOWN,
                scope=ErrorScope.COMMIT,
                recommended_recovery=RecoveryStrategy.REQUIRES_IDEMPOTENCY,
                sqlstate=sqlstate,
                reason=f"Connection exception during COMMIT ({sqlstate}) - transaction outcome unknown",
                is_retryable=False,
            )
        return DBErrorClassification(
            nature=ErrorNature.TRANSIENT,
            scope=ErrorScope.CONNECTION,
            recommended_recovery=RecoveryStrategy.RECONNECT,
            sqlstate=sqlstate,
            reason=f"PostgreSQL connection exception ({sqlstate})",
            is_retryable=False,
        )

    # Authentication / Authorization failures (Class 28)
    if (sqlstate and sqlstate.startswith("28")) or sqlstate == "28P01":
        return DBErrorClassification(
            nature=ErrorNature.PERMANENT,
            scope=ErrorScope.CONNECTION,
            recommended_recovery=RecoveryStrategy.DO_NOT_RETRY,
            sqlstate=sqlstate,
            reason=f"Authentication/Authorization failure ({sqlstate})",
            is_retryable=False,
        )

    # Integrity / Constraint violations (Class 23 or SQLAlchemy IntegrityError)
    if (sqlstate and sqlstate.startswith("23")) or isinstance(exc, sqlalchemy.exc.IntegrityError):
        return DBErrorClassification(
            nature=ErrorNature.PERMANENT,
            scope=ErrorScope.COMMIT if during_commit else ErrorScope.STATEMENT,
            recommended_recovery=RecoveryStrategy.DO_NOT_RETRY,
            sqlstate=sqlstate or "23000",
            reason=f"Integrity constraint violation ({sqlstate or 'IntegrityError'})",
            is_retryable=False,
        )

    # Data errors / truncation / type mismatch (Class 22 or SQLAlchemy DataError)
    if (sqlstate and sqlstate.startswith("22")) or isinstance(exc, sqlalchemy.exc.DataError):
        return DBErrorClassification(
            nature=ErrorNature.PERMANENT,
            scope=ErrorScope.STATEMENT,
            recommended_recovery=RecoveryStrategy.DO_NOT_RETRY,
            sqlstate=sqlstate or "22000",
            reason=f"Data error / value out of range ({sqlstate or 'DataError'})",
            is_retryable=False,
        )

    # Syntax / Undefined column / table / schema errors (Class 42 or SQLAlchemy ProgrammingError)
    if (sqlstate and sqlstate.startswith("42")) or isinstance(exc, sqlalchemy.exc.ProgrammingError):
        return DBErrorClassification(
            nature=ErrorNature.PERMANENT,
            scope=ErrorScope.STATEMENT,
            recommended_recovery=RecoveryStrategy.DO_NOT_RETRY,
            sqlstate=sqlstate or "42000",
            reason=f"Programming / SQL syntax error ({sqlstate or 'ProgrammingError'})",
            is_retryable=False,
        )

    # ── 2. Disconnection / Connection-Loss (when SQLSTATE not present) ─────────
    if is_disconnect:
        if during_commit:
            return DBErrorClassification(
                nature=ErrorNature.UNKNOWN,
                scope=ErrorScope.COMMIT,
                recommended_recovery=RecoveryStrategy.REQUIRES_IDEMPOTENCY,
                sqlstate=sqlstate,
                reason="Connection lost during COMMIT - transaction outcome unknown",
                is_retryable=False,
            )
        return DBErrorClassification(
            nature=ErrorNature.TRANSIENT,
            scope=ErrorScope.CONNECTION,
            recommended_recovery=RecoveryStrategy.RECONNECT,
            sqlstate=sqlstate,
            reason="Database connection disconnected or reset",
            is_retryable=False,
        )

    # ── 3. Unknown / Generic Errors ───────────────────────────────────────────
    # OperationalErrors or other exceptions without verified SQLSTATE or disconnect indicators
    # remain UNKNOWN and are NOT automatically marked retryable.
    scope = ErrorScope.COMMIT if during_commit else ErrorScope.UNKNOWN
    return DBErrorClassification(
        nature=ErrorNature.UNKNOWN,
        scope=scope,
        recommended_recovery=RecoveryStrategy.UNKNOWN,
        sqlstate=sqlstate,
        reason=f"Unclassified database error: {type(exc).__name__}",
        is_retryable=False,
    )


# ─── Query Subquery Helpers ──────────────────────────────────────────────────

def get_latest_metric_subquery(db: Session):
    """
    Returns the single most-recent ComputedMetric row per repo.
    Pre-fetches the latest date from the database to perform a direct, highly indexed join.
    """
    latest_date = db.query(func.max(ComputedMetric.date)).scalar()
    return (
        db.query(
            ComputedMetric.repo_id.label("repo_id"),
            ComputedMetric.trend_score.label("trend_score"),
            ComputedMetric.acceleration.label("acceleration"),
            ComputedMetric.star_velocity_7d.label("star_velocity_7d"),
            ComputedMetric.star_velocity_30d.label("star_velocity_30d"),
            ComputedMetric.contributor_growth_rate.label("contributor_growth_rate"),
            ComputedMetric.sustainability_score.label("sustainability_score"),
            ComputedMetric.sustainability_label.label("sustainability_label"),
        )
        .filter(ComputedMetric.date == latest_date)
        .subquery()
    )


def get_latest_daily_metric_subquery(db: Session):
    """
    Returns the single most-recent DailyMetric row per repo.
    Pre-fetches the latest daily metric date to perform a direct indexed join.
    """
    latest_date = db.query(func.max(DailyMetric.captured_at)).scalar()
    return (
        db.query(
            DailyMetric.repo_id.label("repo_id"),
            DailyMetric.stars.label("stars"),
        )
        .filter(DailyMetric.captured_at == latest_date)
        .subquery()
    )



