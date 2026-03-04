import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./repodar.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Configure engine based on database type
connect_args = {}
engine_kwargs = {
    "echo": False,
}

if DATABASE_URL.startswith("sqlite"):
    # SQLite: Local development
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
    
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
        except Exception:
            # WAL mode not supported on this file system (e.g., Railway)
            # Fall back to default DELETE mode which is more compatible
            try:
                cursor.execute("PRAGMA journal_mode=DELETE")
                cursor.execute("PRAGMA synchronous=FULL")
            except Exception:
                pass
        cursor.close()

elif DATABASE_URL.startswith("postgresql"):
    # PostgreSQL: Production on Railway
    # Optimize connection pooling for efficient resource usage with Redis/Celery
    engine_kwargs.update({
        "pool_size": 10,  # Number of persistent DB connections to maintain
        "max_overflow": 20,  # Allow up to 20 additional connections when pool exhausted
        "pool_pre_ping": True,  # Verify connections are alive before using them
        "pool_recycle": 3600,  # Recycle connections after 1 hour to avoid stale connections
        "connect_args": {"connect_timeout": 10}
    })
    engine = create_engine(DATABASE_URL, **engine_kwargs)
    
    # Set application name for query monitoring
    @event.listens_for(engine, "connect")
    def set_application_name(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("SET application_name = 'repodar-api'")
        cursor.close()

else:
    raise ValueError(f"Unsupported DATABASE_URL: {DATABASE_URL}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
