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
    merchant_debts_router, backup_router
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

    # Safe idempotent migrations for existing tables
    from sqlalchemy import text
    migration_statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS restock_cycle_days INTEGER DEFAULT 7;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date DATE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING_VERIFICATION';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) DEFAULT 'merchant';",
        "ALTER TABLE merchant_debts ADD COLUMN IF NOT EXISTS debt_type VARCHAR(20) DEFAULT 'goods';",
        "ALTER TABLE merchant_debts ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) DEFAULT 0;",
        "ALTER TABLE merchant_debts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unpaid';",
        "ALTER TABLE merchant_debts ADD COLUMN IF NOT EXISTS description TEXT;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) DEFAULT 0;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;",
        "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;",
        "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS starts_new_cycle BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE restock_cycles ADD COLUMN IF NOT EXISTS opening_stock_value NUMERIC(15, 2) DEFAULT 0;",
        "ALTER TABLE restock_cycles ADD COLUMN IF NOT EXISTS cycle_purchases NUMERIC(15, 2) DEFAULT 0;",
        "ALTER TABLE restock_cycles ADD COLUMN IF NOT EXISTS closing_stock_value NUMERIC(15, 2) DEFAULT 0;",
        "ALTER TABLE restock_cycles ADD COLUMN IF NOT EXISTS cogs NUMERIC(15, 2) DEFAULT 0;",
        "ALTER TABLE restock_cycles ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(15, 2) DEFAULT 0;",
        # High-performance indexes
        "CREATE INDEX IF NOT EXISTS idx_invoices_user_type_created ON invoices (user_id, invoice_type, created_at);",
        "CREATE INDEX IF NOT EXISTS idx_expenses_user_category_created ON expenses (user_id, category, created_at);",
        "CREATE INDEX IF NOT EXISTS idx_debt_payments_user_date ON debt_payments (user_id, payment_date);",
        "CREATE INDEX IF NOT EXISTS idx_other_income_user_date ON other_income (user_id, income_date);",
        "CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_merchant_debts_user_status ON merchant_debts (user_id, status);",
        "CREATE INDEX IF NOT EXISTS idx_restock_cycles_user_status ON restock_cycles (user_id, status);",
        "CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);",
    ]

    # Retry connection up to 5 times (safeguard for cold starts on serverless Postgres like Neon)
    max_retries = 5
    db_connected = False
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                for stmt in migration_statements:
                    try:
                        await conn.execute(text(stmt))
                    except Exception as e:
                        logger.warning(f"Schema migration note ({stmt}): {e}")
            db_connected = True
            logger.info("Database tables and column migrations verified")
            break
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt}/{max_retries} failed: {e}")
            if attempt < max_retries:
                await asyncio.sleep(3)
            else:
                logger.error("Could not connect to database during startup. Application will start in degraded mode.")

    # Seed admin account
    if db_connected:
        try:
            await seed_admin()
            logger.info("Admin account seeded")
        except Exception as e:
            logger.error(f"Error seeding admin: {e}")

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
            if admin.status != "ACTIVE":
                admin.status = "ACTIVE"
                await session.commit()
                logger.info(f"Admin account reactivated: {admin.phone}")
            else:
                logger.info(f"Admin account exists: {admin.phone}")


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
    if isinstance(CORS_ORIGINS, str):
        if CORS_ORIGINS.strip().startswith("["):
            origins = json.loads(CORS_ORIGINS)
        else:
            origins = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
    else:
        origins = CORS_ORIGINS
except Exception:
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
app.include_router(backup_router, prefix="/api/v1")

# ============ Static Files Mount ============
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ============ Root & Health Routes ============

@app.api_route("/", methods=["GET", "HEAD"], tags=["الصحة"])
async def root():
    return {
        "message": "جاري التحميل...",
        "docs": "/api/docs"
    }


@app.get("/ping", tags=["الصحة"])
@app.get("/api/v1/ping", tags=["الصحة"])
async def ping():
    """Ultra-fast, zero-DB ping endpoint for keep-alive cron jobs / uptime monitors."""
    return {
        "status": "awake",
        "pong": True,
        "time": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health", tags=["الصحة"])
async def health_check():
    """Health check - pings DB to keep connection alive."""
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "healthy", "db": "connected"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}

@app.get("/api/v1/app/version", tags=["التحديثات"])
async def get_app_version():
    """Public version check endpoint for auto-update mechanism."""
    return {
        "versionCode": 3,
        "versionName": "1.0.2",
        "downloadUrl": "/static/app-arm64-v8a-release.apk",
        "forceUpdate": False,
        "releaseNotes": "تحديث الإصدار 1.0.2: إدارة المخزون والدورات المحاسبية وتناسق الواجهة وإعادة تعيين كلمة المرور"
    }

# ============ Serve React Frontend ============
# This must be at the very bottom to act as a catch-all route.

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "daftar-al-tajir-frontend", "dist"))

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
