import asyncio
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from app.database import DATABASE_URL

logger = logging.getLogger(__name__)

# Dedicated unpooled engine ensuring advisory lock connections never consume application pool slots
_advisory_engine = None


def _get_advisory_engine():
    global _advisory_engine
    if _advisory_engine is None:
        if DATABASE_URL.startswith("postgresql"):
            _advisory_engine = create_engine(
                DATABASE_URL,
                poolclass=NullPool,
                connect_args={"connect_timeout": 10, "keepalives": 1, "keepalives_idle": 30},
            )
        else:
            # SQLite local fallback
            _advisory_engine = create_engine(
                DATABASE_URL,
                connect_args={"check_same_thread": False},
            )
    return _advisory_engine


class DistributedPipelineLock:
    """
    PostgreSQL session-level advisory lock wrapper with local asyncio.Lock fallback for SQLite.
    Uses a dedicated unpooled connection to guarantee that long-lived advisory locks never
    occupy or starve connections in the main application connection pool.
    """
    def __init__(self, class_id: int = 1337, obj_id: int = 4242):
        self._local_lock = asyncio.Lock()
        self._class_id = class_id
        self._obj_id = obj_id
        self._dedicated_conn = None
        self._acquired = False

    def locked(self) -> bool:
        """
        Check if the lock is held locally or globally in the database.
        """
        if self._local_lock.locked():
            return True

        engine = _get_advisory_engine()
        if engine.dialect.name == "postgresql":
            try:
                with engine.connect() as conn:
                    sql = """
                        SELECT EXISTS (
                            SELECT 1 FROM pg_locks 
                            WHERE locktype = 'advisory' 
                              AND classid = :class_id 
                              AND objid = :obj_id
                        )
                    """
                    return bool(conn.execute(text(sql), {"class_id": self._class_id, "obj_id": self._obj_id}).scalar())
            except Exception as e:
                logger.error(f"[DistributedLock] Error checking advisory lock status: {e}")
                return False
        return False

    async def acquire(self) -> bool:
        """
        Acquire the lock. Returns True if successfully acquired, False otherwise.
        Ensures dedicated connection is closed and local lock released if acquisition fails.
        """
        # 1. Try to acquire the process-local lock first
        if self._local_lock.locked():
            return False

        await self._local_lock.acquire()

        # 2. Try to acquire the database-level lock on dedicated unpooled connection
        engine = _get_advisory_engine()
        if engine.dialect.name == "postgresql":
            conn = None
            try:
                conn = engine.connect()
                sql = "SELECT pg_try_advisory_lock(:class_id, :obj_id)"
                res = conn.execute(text(sql), {"class_id": self._class_id, "obj_id": self._obj_id}).scalar()
                if res:
                    self._dedicated_conn = conn
                    self._acquired = True
                    return True
                else:
                    try:
                        conn.close()
                    except Exception:
                        pass
                    if self._local_lock.locked():
                        self._local_lock.release()
                    return False
            except Exception as e:
                logger.error(f"[DistributedLock] Failed to acquire distributed lock: {e}")
                if conn:
                    try:
                        conn.close()
                    except Exception:
                        pass
                if self._local_lock.locked():
                    self._local_lock.release()
                return False
        else:
            # SQLite fallback: local lock is sufficient
            self._acquired = True
            return True

    async def release(self):
        """
        Release the lock and clean up the dedicated database connection. Idempotent.
        """
        try:
            if self._acquired and self._dedicated_conn:
                try:
                    sql = "SELECT pg_advisory_unlock(:class_id, :obj_id)"
                    self._dedicated_conn.execute(text(sql), {"class_id": self._class_id, "obj_id": self._obj_id})
                except Exception as e:
                    logger.error(f"[DistributedLock] Error executing advisory unlock: {e}")
        finally:
            if self._dedicated_conn:
                try:
                    self._dedicated_conn.close()
                except Exception as e:
                    logger.warning(f"[DistributedLock] Error closing dedicated connection: {e}")
                self._dedicated_conn = None
            self._acquired = False
            if self._local_lock.locked():
                self._local_lock.release()

    async def __aenter__(self):
        locked = await self.acquire()
        if not locked:
            raise RuntimeError("Pipeline lock is already held.")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.release()


# Global pipeline lock instance
pipeline_lock = DistributedPipelineLock()

