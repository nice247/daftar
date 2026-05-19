"""Daftar Al-Tajir Backend - دفتر التاجر
Merchant Sales, Expenses & Debt Management System
Built with FastAPI + PostgreSQL + Telegram Bot + OCR
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

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
    reports_router, products_router, admin_router, ocr_router,
    merchant_debts_router
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

    # Initialize Telegram bot (send-only, no polling)
    telegram_service.initialize()
    logger.info("Telegram bot initialized (send-only mode)")

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
    from app.core.security import verify_password

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
                subscription_end_date=datetime.now(timezone.utc).date() + timedelta(days=36500)
            )
            session.add(admin)
            await session.commit()
            logger.info(f"Admin account created: {ADMIN_PHONE}")
        else:
            if not verify_password(ADMIN_PASSWORD, admin.password_hash):
                admin.password_hash = hash_password(ADMIN_PASSWORD)
                admin.phone = ADMIN_PHONE
                admin.status = "ACTIVE"
                await session.commit()
                logger.info(f"Admin password updated for: {ADMIN_PHONE}")
            else:
                if admin.status != "ACTIVE":
                    admin.status = "ACTIVE"
                    await session.commit()
                    logger.info(f"Admin account reactivated: {ADMIN_PHONE}")
                else:
                    logger.info(f"Admin account exists: {ADMIN_PHONE}")


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
    description="Merchant Sales, Expenses & Debt Management System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
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

# ============ GZip Middleware (Performance) ============
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)

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
app.include_router(merchant_debts_router, prefix="/api/v1")

# ============ Root Route ============

@app.api_route("/", methods=["GET", "HEAD"], tags=["الصحة"])
async def root():
    return {
        "message": "جاري التحميل...",
        "docs": "/api/docs"
    }


@app.get("/health", tags=["الصحة"])
async def health_check():
    """Health check - pings DB to keep connection alive (used by cron job)."""
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "healthy", "db": "connected"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}

# ============ Serve React Frontend ============
# This must be at the very bottom to act as a catch-all route.



@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_frontend(full_path: str):
    """
    Catch-all route to serve React frontend files and handle client-side routing.
    """
    # If the path starts with /api/, it means it's an unhandled API route, return 404 JSON
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")

    # Try to serve a specific file from the dist directory (e.g., assets/xxx.js)
    if full_path:
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

    # If it's not a file (e.g., /, /login, /admin), serve index.html for React Router
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    # If frontend hasn't been built yet, show a simple message instead of failing
    return {
        "message": "Backend is running. Frontend build not found.",
        "hint": f"Ensure 'npm run build' generates {index_path}"
    }
