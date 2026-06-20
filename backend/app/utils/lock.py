import asyncio
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)

class DistributedPipelineLock:
    """
    PostgreSQL session-level advisory lock wrapper with local asyncio.Lock fallback for SQLite.
    Prevents concurrent pipeline executions across multiple Uvicorn workers and server instances.
    """
    def __init__(self, class_id: int = 1337, obj_id: int = 4242):
        self._local_lock = asyncio.Lock()
        self._class_id = class_id
        self._obj_id = obj_id
        self._db_session = None
        self._acquired = False

    def locked(self) -> bool:
        """
        Check if the lock is held locally or globally in the database.
        """
        if self._local_lock.locked():
            return True

        from app.database import SessionLocal
        db = SessionLocal()
        try:
            if db.bind.dialect.name == "postgresql":
                sql = """
                    SELECT EXISTS (
                        SELECT 1 FROM pg_locks 
                        WHERE locktype = 'advisory' 
                          AND classid = :class_id 
                          AND objid = :obj_id
                    )
                """
                return bool(db.execute(text(sql), {"class_id": self._class_id, "obj_id": self._obj_id}).scalar())
            return False
        except Exception as e:
            logger.error(f"[DistributedLock] Error checking advisory lock status: {e}")
            return False
        finally:
            db.close()

    async def acquire(self) -> bool:
        """
        Acquire the lock. Returns True if successfully acquired, False otherwise.
        """
        # 1. Try to acquire the process-local lock first
        if self._local_lock.locked():
            return False
        
        await self._local_lock.acquire()

        # 2. Try to acquire the database-level lock
        from app.database import SessionLocal
        self._db_session = SessionLocal()
        try:
            if self._db_session.bind.dialect.name == "postgresql":
                # Try to acquire a session-level advisory lock
                sql = "SELECT pg_try_advisory_lock(:class_id, :obj_id)"
                res = self._db_session.execute(text(sql), {"class_id": self._class_id, "obj_id": self._obj_id}).scalar()
                if res:
                    self._acquired = True
                    return True
                else:
                    self._db_session.close()
                    self._db_session = None
                    self._local_lock.release()
                    return False
            else:
                # SQLite fallback
                self._acquired = True
                return True
        except Exception as e:
            logger.error(f"[DistributedLock] Failed to acquire distributed lock: {e}")
            if self._db_session:
                self._db_session.close()
                self._db_session = None
            self._local_lock.release()
            return False

    async def release(self):
        """
        Release the lock and clean up the database session.
        """
        try:
            if self._acquired:
                if self._db_session and self._db_session.bind.dialect.name == "postgresql":
                    sql = "SELECT pg_advisory_unlock(:class_id, :obj_id)"
                    self._db_session.execute(text(sql), {"class_id": self._class_id, "obj_id": self._obj_id})
                    self._db_session.commit()
                self._acquired = False
        except Exception as e:
            logger.error(f"[DistributedLock] Error releasing distributed lock: {e}")
        finally:
            if self._db_session:
                try:
                    self._db_session.close()
                except Exception:
                    pass
                self._db_session = None
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
