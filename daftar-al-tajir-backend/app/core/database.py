"""Database configuration with Neon PostgreSQL support.

Handles:
- Auto SSL for external databases (Neon, Render, etc.)
- Smaller pool sizes for serverless/connection-limited databases
- Both async (asyncpg) and sync (psycopg2) engines
"""
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlparse
from app.core.config import DATABASE_URL, DATABASE_URL_SYNC

# Detect if we're using an external/cloud database (Neon, Render, Supabase, RDS, etc.)
_parsed_url = urlparse(DATABASE_URL)
_hostname = _parsed_url.hostname or ""
_is_external_db = (
    (bool(_hostname) and not _hostname.startswith("localhost") and not _hostname.startswith("127."))
    or "neon.tech" in DATABASE_URL 
    or "render.com" in DATABASE_URL 
    or "supabase" in DATABASE_URL
    or "dpg-" in _hostname
)

# SSL context for asyncpg (Neon/Render external requires SSL)
_ssl_context = None
if _is_external_db and "sqlite" not in DATABASE_URL:
    _ssl_context = ssl.create_default_context()
    _ssl_context.check_hostname = False
    _ssl_context.verify_mode = ssl.CERT_NONE

# Async engine (for FastAPI endpoints)
_engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
    "pool_recycle": 300,  # Recycle connections after 5 minutes to prevent stale dropped sockets
}

if _is_external_db:
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 3
    # Connect args for SSL
    if _ssl_context:
        _engine_kwargs["connect_args"] = {"ssl": _ssl_context}
else:
    _engine_kwargs["pool_size"] = 20
    _engine_kwargs["max_overflow"] = 10

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """Dependency that provides a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Sync engine (for Alembic migrations)
_sync_engine_kwargs = {
    "echo": False,
    "poolclass": None,
}

if _is_external_db:
    _sync_engine_kwargs["pool_size"] = 3
    _sync_engine_kwargs["max_overflow"] = 2
    _sync_engine_kwargs["pool_pre_ping"] = True

sync_engine = create_engine(DATABASE_URL_SYNC, **_sync_engine_kwargs)
sync_session = sessionmaker(sync_engine)
