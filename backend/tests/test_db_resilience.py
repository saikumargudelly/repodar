import asyncio
from unittest.mock import MagicMock, patch
import pytest
import sqlalchemy.exc

from app.database import engine, get_db, SessionLocal
from app.models import Repository
from app.utils.db import (
    classify_db_error,
    ErrorNature,
    ErrorScope,
    RecoveryStrategy,
    DBErrorClassification,
)
from app.utils.lock import DistributedPipelineLock


# ─── 1. Structured Database Error Classification Tests ─────────────────────────

class MockDBAPIError(Exception):
    def __init__(self, message, pgcode=None):
        super().__init__(message)
        self.pgcode = pgcode


def test_classify_deadlock_40P01():
    orig = MockDBAPIError("deadlock detected", pgcode="40P01")
    exc = sqlalchemy.exc.DBAPIError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.TRANSIENT
    assert res.scope == ErrorScope.TRANSACTION
    assert res.recommended_recovery == RecoveryStrategy.RETRY_TRANSACTION
    assert res.sqlstate == "40P01"
    assert res.is_retryable is True


def test_classify_serialization_40001():
    orig = MockDBAPIError("could not serialize access due to concurrent update", pgcode="40001")
    exc = sqlalchemy.exc.DBAPIError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.TRANSIENT
    assert res.scope == ErrorScope.TRANSACTION
    assert res.recommended_recovery == RecoveryStrategy.RETRY_TRANSACTION
    assert res.sqlstate == "40001"
    assert res.is_retryable is True


def test_classify_admin_shutdown_57P01():
    orig = MockDBAPIError("terminating connection due to administrator command", pgcode="57P01")
    exc = sqlalchemy.exc.DBAPIError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.TRANSIENT
    assert res.scope == ErrorScope.CONNECTION
    assert res.recommended_recovery == RecoveryStrategy.RECONNECT
    assert res.sqlstate == "57P01"
    assert res.is_retryable is False  # RECONNECT requires re-establishing connectivity, not blind replay


def test_classify_connection_exception_class_08():
    orig = MockDBAPIError("connection failure", pgcode="08006")
    exc = sqlalchemy.exc.DBAPIError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.TRANSIENT
    assert res.scope == ErrorScope.CONNECTION
    assert res.recommended_recovery == RecoveryStrategy.RECONNECT
    assert res.sqlstate == "08006"
    assert res.is_retryable is False


def test_classify_auth_failure_28P01():
    orig = MockDBAPIError("password authentication failed for user", pgcode="28P01")
    exc = sqlalchemy.exc.DBAPIError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.PERMANENT
    assert res.scope == ErrorScope.CONNECTION
    assert res.recommended_recovery == RecoveryStrategy.DO_NOT_RETRY
    assert res.is_retryable is False


def test_classify_integrity_error_23505():
    orig = MockDBAPIError("duplicate key value violates unique constraint", pgcode="23505")
    exc = sqlalchemy.exc.IntegrityError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.PERMANENT
    assert res.scope == ErrorScope.STATEMENT
    assert res.recommended_recovery == RecoveryStrategy.DO_NOT_RETRY
    assert res.sqlstate == "23505"
    assert res.is_retryable is False


def test_classify_data_error_22001():
    orig = MockDBAPIError("value too long for type character varying(50)", pgcode="22001")
    exc = sqlalchemy.exc.DataError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.PERMANENT
    assert res.scope == ErrorScope.STATEMENT
    assert res.recommended_recovery == RecoveryStrategy.DO_NOT_RETRY
    assert res.sqlstate == "22001"
    assert res.is_retryable is False


def test_classify_programming_error_42601():
    orig = MockDBAPIError("syntax error at or near 'SELEKT'", pgcode="42601")
    exc = sqlalchemy.exc.ProgrammingError("statement", {}, orig)
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.PERMANENT
    assert res.scope == ErrorScope.STATEMENT
    assert res.recommended_recovery == RecoveryStrategy.DO_NOT_RETRY
    assert res.sqlstate == "42601"
    assert res.is_retryable is False


def test_classify_disconnect_string_matching_without_sqlstate():
    exc = Exception("psycopg2.OperationalError: server closed the connection unexpectedly")
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.TRANSIENT
    assert res.scope == ErrorScope.CONNECTION
    assert res.recommended_recovery == RecoveryStrategy.RECONNECT
    assert res.is_retryable is False


def test_classify_generic_operational_error_remains_unknown():
    # An OperationalError without SQLSTATE or disconnect indicators must remain UNKNOWN
    exc = sqlalchemy.exc.OperationalError("some internal driver state error", {}, Exception("internal error"))
    res = classify_db_error(exc)
    assert res.nature == ErrorNature.UNKNOWN
    assert res.scope == ErrorScope.UNKNOWN
    assert res.recommended_recovery == RecoveryStrategy.UNKNOWN
    assert res.is_retryable is False


def test_classify_connection_loss_during_commit():
    orig = MockDBAPIError("connection failure during commit", pgcode="08006")
    exc = sqlalchemy.exc.DBAPIError("commit", {}, orig)
    res = classify_db_error(exc, during_commit=True)
    assert res.nature == ErrorNature.UNKNOWN
    assert res.scope == ErrorScope.COMMIT
    assert res.recommended_recovery == RecoveryStrategy.REQUIRES_IDEMPOTENCY
    assert res.is_retryable is False


def test_classify_known_non_disconnect_commit_error():
    # Constraint failure during commit (e.g. deferred constraint) must still be classified with its true DB semantics
    orig = MockDBAPIError("duplicate key violates unique constraint", pgcode="23505")
    exc = sqlalchemy.exc.IntegrityError("commit", {}, orig)
    res = classify_db_error(exc, during_commit=True)
    assert res.nature == ErrorNature.PERMANENT
    assert res.scope == ErrorScope.COMMIT
    assert res.recommended_recovery == RecoveryStrategy.DO_NOT_RETRY
    assert res.sqlstate == "23505"
    assert res.is_retryable is False


def test_classify_none_exception():
    res = classify_db_error(None)
    assert res.nature == ErrorNature.UNKNOWN
    assert res.is_retryable is False


# ─── 2. Session Cleanup & Rollback in get_db() Tests ──────────────────────────

def test_get_db_rollback_on_route_exception():
    class DummyRouteError(Exception):
        pass

    gen = get_db()
    db_session = next(gen)
    
    with patch.object(db_session, "rollback") as mock_rollback, \
         patch.object(db_session, "close") as mock_close:
        with pytest.raises(DummyRouteError):
            try:
                raise DummyRouteError("Simulated route handling failure")
            except Exception as e:
                gen.throw(e)

        mock_rollback.assert_called_once()
        mock_close.assert_called_once()


def test_get_db_rollback_failure_does_not_mask_original_exception():
    class OriginalRouteError(Exception):
        pass

    gen = get_db()
    db_session = next(gen)

    with patch.object(db_session, "rollback", side_effect=RuntimeError("Socket dead during rollback")), \
         patch.object(db_session, "close") as mock_close:
        # OriginalRouteError MUST propagate, not the RuntimeError from rollback
        with pytest.raises(OriginalRouteError):
            try:
                raise OriginalRouteError("Original application business logic error")
            except Exception as e:
                gen.throw(e)

        mock_close.assert_called_once()


# ─── 3. PostgreSQL Advisory Lock Isolation Tests ──────────────────────────────

from app.database import _active_connections, _active_connections_lock

def _get_pool_checked_out():
    if hasattr(engine.pool, "checkedout"):
        try:
            return engine.pool.checkedout()
        except Exception:
            pass
    with _active_connections_lock:
        return len(_active_connections)


@pytest.mark.asyncio
async def test_advisory_lock_isolation_and_idempotent_release():
    lock = DistributedPipelineLock(class_id=9999, obj_id=8888)
    
    # Pre-condition: Main application connection pool checkedout count
    initial_checked_out = _get_pool_checked_out()

    acquired = await lock.acquire()
    assert acquired is True
    assert lock.locked() is True

    # Critical Assertion: Dedicated unpooled engine used — main pool checkedout must remain unchanged
    assert _get_pool_checked_out() == initial_checked_out

    # Test release is clean and idempotent
    await lock.release()
    assert lock.locked() is False

    # Calling release again must be a safe no-op
    await lock.release()
    assert lock.locked() is False


@pytest.mark.asyncio
async def test_advisory_lock_context_manager_cleanup_on_exception():
    lock = DistributedPipelineLock(class_id=9999, obj_id=7777)
    
    with pytest.raises(ValueError, match="Pipeline step failed"):
        async with lock:
            assert lock.locked() is True
            raise ValueError("Pipeline step failed")

    # Lock must be released cleanly after exception
    assert lock.locked() is False


# ─── 4. Backfill Network I/O Decoupling Tests ─────────────────────────────────

@pytest.mark.asyncio
async def test_backfill_does_not_hold_db_connection_during_fetch():
    from app.database import Base
    from app.routers.admin import trigger_backfill
    from fastapi import BackgroundTasks

    # Ensure tables exist in test environment
    Base.metadata.create_all(bind=engine)
    
    # Insert a test repository
    db = SessionLocal()
    try:
        if not db.query(Repository).filter_by(owner="testowner", name="testrepo").first():
            repo = Repository(
                id="test-repo-uuid",
                owner="testowner",
                name="testrepo",
                category="AI / ML",
                github_url="https://github.com/testowner/testrepo",
                is_active=True,
            )
            db.add(repo)
            db.commit()
    finally:
        db.close()

    # Mock fetch_repo_metrics to check that pool checkedout count is 0 while network call runs
    network_io_pool_checked_out = None

    async def mock_fetch(all_pending, since_map=None):
        nonlocal network_io_pool_checked_out
        # Measure checked out connections from main pool during async network I/O
        network_io_pool_checked_out = _get_pool_checked_out()
        await asyncio.sleep(0.01)
        return []

    with patch("app.services.github_client.fetch_repo_metrics", side_effect=mock_fetch):
        bg = BackgroundTasks()
        resp = await trigger_backfill(bg)
        assert resp.status == "queued"
        
        # Execute the queued background task
        assert len(bg.tasks) == 1
        await bg.tasks[0]()

    # Verified: 0 connections checked out from application pool during network I/O
    assert network_io_pool_checked_out == 0
