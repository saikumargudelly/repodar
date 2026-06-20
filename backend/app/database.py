import os
import sys
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# On Railway (production), DATABASE_URL must be PostgreSQL (auto-injected by plugin)
# Locally, default to SQLite for development
if not DATABASE_URL:
    # Check if we're likely on Railway (has RAILWAY_ENVIRONMENT set)
    if os.getenv("RAILWAY_ENVIRONMENT"):
        raise ValueError(
            "FATAL: DATABASE_URL not set on Railway. "
            "Add PostgreSQL plugin to Railway dashboard. "
            "It will auto-inject DATABASE_URL as a PostgreSQL connection string."
        )
    # Local development default
    DATABASE_URL = "sqlite:///./repodar.db"

# Normalize Railway/Heroku-style postgres:// → postgresql:// (SQLAlchemy 2.x requires this)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Validate database type
if not (DATABASE_URL.startswith("sqlite") or DATABASE_URL.startswith("postgresql")):
    raise ValueError(
        f"Unsupported DATABASE_URL. Must be SQLite (local) or PostgreSQL (production). Got: {DATABASE_URL}"
    )

# Configure engine based on database type
connect_args = {}
engine_kwargs = {"echo": False}

if DATABASE_URL.startswith("sqlite"):
    # SQLite: Local development only
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
    
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
        except Exception:
            # WAL mode not supported on some file systems
            # Fall back to DELETE mode (more compatible but slower)
            try:
                cursor.execute("PRAGMA journal_mode=DELETE")
                cursor.execute("PRAGMA synchronous=FULL")
            except Exception:
                pass
        cursor.close()

elif DATABASE_URL.startswith("postgresql"):  # includes normalized postgres:// URLs
    # PostgreSQL: Production on Railway
    # Optimized connection pooling for async workloads with Celery
    engine_kwargs.update({
        "pool_size": 2,           # Keep pool small to avoid Neon Max Connections errors under multi-worker setup
        "max_overflow": 2,        # Overflow cap to handle minor spikes
        "pool_pre_ping": True,    # Test connections before using
        "pool_recycle": 1800,     # Recycle connections every 30 minutes
        "pool_timeout": 15,       # Timeout if no connection is available within 15 seconds
        "connect_args": {"connect_timeout": 10, "keepalives": 1, "keepalives_idle": 30}
    })
    engine = create_engine(DATABASE_URL, **engine_kwargs)
    
    # Set application name for monitoring and debugging
    @event.listens_for(engine, "connect")
    def set_application_name(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("SET application_name = 'repodar-api'")
        except Exception:
            pass  # Not critical if fails
        cursor.close()

else:
    # Fallback to sqlite if somehow it doesn't match above patterns
    engine = create_engine(DATABASE_URL, **engine_kwargs)

import time
import threading
import logging

pool_logger = logging.getLogger("app.database.pool")
_active_connections_lock = threading.Lock()
_active_connections = {}

def _check_pool_exhaustion(t_now):
    pool = engine.pool
    pool_size = 0
    if hasattr(pool, "size"):
        try:
            pool_size = pool.size()
        except Exception:
            pass
    if pool_size <= 0:
        pool_size = getattr(pool, "_pool_size", 2)
        
    checked_out = len(_active_connections)
    
    longest_checkout = 0.0
    with _active_connections_lock:
        for conn_id, info in _active_connections.items():
            duration = t_now - info["checkout_time"]
            if duration > longest_checkout:
                longest_checkout = duration
            
    overflow = 0
    if hasattr(pool, "overflow"):
        try:
            overflow = pool.overflow()
        except Exception:
            pass
            
    is_postgresql = engine.dialect.name == "postgresql"
    pool_exhausted = is_postgresql and pool_size > 0 and checked_out >= pool_size
    long_checkout = longest_checkout > 10.0
    
    if pool_exhausted or long_checkout:
        pool_logger.warning(
            f"[POOL WARNING]\n"
            f"Checked Out: {checked_out}/{pool_size}\n"
            f"Overflow: {overflow}\n"
            f"Longest Checkout: {longest_checkout:.1f}s"
        )

@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    t_now = time.time()
    connection_record.info['checkout_time'] = t_now
    conn_id = id(dbapi_connection)
    with _active_connections_lock:
        _active_connections[conn_id] = {
            "checkout_time": t_now,
            "thread_name": threading.current_thread().name,
        }
    _check_pool_exhaustion(t_now)

@event.listens_for(engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    t_now = time.time()
    conn_id = id(dbapi_connection)
    with _active_connections_lock:
        _active_connections.pop(conn_id, None)
        
    checkout_time = connection_record.info.get('checkout_time')
    if checkout_time:
        duration = t_now - checkout_time
        if duration > 10.0:
            pool_logger.warning(
                f"[POOL WARNING] Connection {conn_id} checked in after being held for {duration:.1f}s"
            )
        elif duration > 5.0:
            pool_logger.warning(
                f"SQLAlchemy connection {conn_id} held for {duration:.2f} seconds! "
                "This could indicate a session/transaction leak or network boundary call."
            )
    _check_pool_exhaustion(t_now)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

