"""Daftar Al-Tajir Backend - دفتر التاجر
Merchant Sales, Expenses & Debt Management System
Built with FastAPI + PostgreSQL + Telegram Bot + OCR
"""
import asyncio
import threading
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import (
    APP_NAME, APP_ENV, DEBUG, CORS_ORIGINS, UPLOAD_DIR,
    ADMIN_PHONE, ADMIN_PASSWORD
)
from app.core.database import engine
from app.core.security import hash_password
from app.models.models import Base, User
from app.api import (
    auth_router, users_router, subscriptions_router,
    eod_router, customers_router, expenses_router,
    reports_router, products_router, admin_router, ocr_router
)
from app.services.telegram_service import telegram_service

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    # ========== STARTUP ==========
    logger.info(f"Starting {APP_NAME} in {APP_ENV} mode...")

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    # Seed admin account
    await seed_admin()
    logger.info("Admin account seeded")

    # Initialize Telegram bot
    telegram_service.initialize()
    bot_thread = threading.Thread(target=telegram_service.run_bot, daemon=True)
    bot_thread.start()
    logger.info("Telegram bot started")

    # Start subscription checker (background task)
    asyncio.create_task(check_subscriptions())

    logger.info(f"{APP_NAME} is ready!")

    yield

    # ========== SHUTDOWN ==========
    logger.info(f"Shutting down {APP_NAME}...")


async def seed_admin():
    """Seed the initial admin account."""
    from sqlalchemy import select
    from app.core.database import async_session

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.role == "admin")
        )
        admin = result.scalar_one_or_none()

        if not admin:
            admin = User(
                phone=ADMIN_PHONE,
                store_name="مدير النظام",
                password_hash=hash_password(ADMIN_PASSWORD),
                status="ACTIVE",
                role="admin",
                subscription_end_date=datetime.now(timezone.utc).date() + timedelta(days=36500)  # 100 years
            )
            session.add(admin)
            await session.commit()
            logger.info(f"Admin account created: {ADMIN_PHONE}")
        else:
            logger.info("Admin account already exists")


async def check_subscriptions():
    """Background task to check for expired subscriptions."""
    while True:
        try:
            await asyncio.sleep(86400)  # Check every 24 hours
            from sqlalchemy import select, and_
            from app.core.database import async_session

            async with async_session() as session:
                today = datetime.now(timezone.utc).date()
                result = await session.execute(
                    select(User).where(
                        User.role == "merchant",
                        User.status == "ACTIVE",
                        User.subscription_end_date < today
                    )
                )
                expired_users = list(result.scalars().all())

                for user in expired_users:
                    user.status = "FROZEN"
                    await telegram_service.notify_subscription_expired(
                        phone=user.phone,
                        store_name=user.store_name
                    )
                    logger.info(f"Frozen expired subscription: {user.phone}")

                await session.commit()

        except Exception as e:
            logger.error(f"Subscription check error: {e}")


# ============ Create FastAPI App ============

app = FastAPI(
    title="دفتر التاجر - Daftar Al-Tajir API",
    description="""
    ## نظام دفتر التاجر - إدارة المبيعات والمصروفات والديون

    Merchant Sales, Expenses & Debt Management System for Sudan retailers.

    ### Features:
    - 🔐 User registration with OCR payment verification
    - 💰 End-of-Day (EOD) screen for daily transactions
    - 👥 Customer & debt management
    - 📊 Financial reports & cycle comparisons
    - 📦 Optional product & inventory tracking
    - 🤖 Telegram bot for admin notifications
    - 🔍 OCR for bank transfer receipt reading
    - 🔑 JWT authentication (7-day tokens)
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# ============ CORS Middleware ============

import json
try:
    origins = json.loads(CORS_ORIGINS) if isinstance(CORS_ORIGINS, str) else CORS_ORIGINS
except:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Register Routers ============

app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(subscriptions_router, prefix="/api/v1")
app.include_router(eod_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(expenses_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(products_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(ocr_router, prefix="/api/v1")


# ============ Health Check ============

@app.get("/", tags=["الصحة"])
async def root():
    """Root endpoint - health check."""
    return {
        "name": "دفتر التاجر",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", tags=["الصحة"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
