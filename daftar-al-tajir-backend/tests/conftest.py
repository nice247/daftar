"""Pytest configuration and fixtures for Daftar Al-Tajir API tests."""
import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.models import Base, Customer, Invoice, RestockCycle, SystemSettings, User
from app.schemas.schemas import OCRResult
from app.services.ocr_service import ocr_service
from app.services.telegram_service import telegram_service

# ============ SQLite Compilers for PostgreSQL Types ============

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"


# ============ Database Engine & Session ============

TEST_DATABASE_URL = "sqlite+aiosqlite://"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Disable real telegram bot
    telegram_service._initialized = False

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional async database session for tests."""
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an HTTP async test client with overridden get_db dependency."""
    async def override_get_db():
        async with TestingSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ============ User Fixtures ============

@pytest_asyncio.fixture
async def merchant_user(db_session: AsyncSession) -> User:
    """Create and return an active merchant user."""
    user = User(
        id=uuid.uuid4(),
        phone="0902642768",
        store_name="متجر التجربة",
        email="merchant@example.com",
        password_hash=hash_password("Pass1234"),
        status="ACTIVE",
        role="merchant",
        subscription_end_date=date.today() + timedelta(days=30),
        restock_cycle_days=7,
    )
    db_session.add(user)

    # Default system settings
    settings = SystemSettings(
        monthly_price=3000,
        quarterly_price=8000,
        semi_annual_price=15000,
    )
    db_session.add(settings)

    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def merchant_token(merchant_user: User) -> str:
    """Return JWT access token for the merchant."""
    return create_access_token(
        data={"sub": str(merchant_user.id), "role": merchant_user.role}
    )


@pytest_asyncio.fixture
def merchant_auth_headers(merchant_token: str) -> dict:
    """Return authorization headers for the merchant."""
    return {"Authorization": f"Bearer {merchant_token}"}


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create and return an active admin user."""
    admin = User(
        id=uuid.uuid4(),
        phone="0912345678",
        store_name="مدير النظام",
        email="admin@example.com",
        password_hash=hash_password("AdminPass123"),
        status="ACTIVE",
        role="admin",
        subscription_end_date=date.today() + timedelta(days=3650),
        restock_cycle_days=7,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest_asyncio.fixture
def admin_token(admin_user: User) -> str:
    """Return JWT access token for the admin."""
    return create_access_token(
        data={"sub": str(admin_user.id), "role": admin_user.role}
    )


@pytest_asyncio.fixture
def admin_auth_headers(admin_token: str) -> dict:
    """Return authorization headers for the admin."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest_asyncio.fixture
async def frozen_user(db_session: AsyncSession) -> User:
    """Create and return a frozen merchant user."""
    user = User(
        id=uuid.uuid4(),
        phone="0999999999",
        store_name="متجر مجمد",
        password_hash=hash_password("Pass1234"),
        status="FROZEN",
        role="merchant",
        subscription_end_date=date.today() - timedelta(days=5),
        restock_cycle_days=7,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def frozen_auth_headers(frozen_user: User) -> dict:
    token = create_access_token(
        data={"sub": str(frozen_user.id), "role": frozen_user.role}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def expired_user(db_session: AsyncSession) -> User:
    """Create and return an active status user whose subscription has expired."""
    user = User(
        id=uuid.uuid4(),
        phone="0988888888",
        store_name="متجر منتهي الاشتراك",
        password_hash=hash_password("Pass1234"),
        status="ACTIVE",
        role="merchant",
        subscription_end_date=date.today() - timedelta(days=1),
        restock_cycle_days=7,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def expired_auth_headers(expired_user: User) -> dict:
    token = create_access_token(
        data={"sub": str(expired_user.id), "role": expired_user.role}
    )
    return {"Authorization": f"Bearer {token}"}
