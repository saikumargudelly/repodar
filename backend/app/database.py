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
        "pool_size": 10,          # Maintain 10 persistent connections
        "max_overflow": 20,       # Allow 20 additional overflow connections
        "pool_pre_ping": True,    # Test connections before using (prevents stale connections)
        "pool_recycle": 3600,     # Recycle connections every 1 hour
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

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
