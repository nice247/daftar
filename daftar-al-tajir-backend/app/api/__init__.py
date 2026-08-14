from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.subscriptions import router as subscriptions_router
from app.api.eod import router as eod_router
from app.api.customers import router as customers_router
from app.api.expenses import router as expenses_router
from app.api.reports import router as reports_router
from app.api.products import router as products_router
from app.api.admin import router as admin_router
from app.api.ocr import router as ocr_router
from app.api.merchant_debts import router as merchant_debts_router
from app.api.backup import router as backup_router

__all__ = [
    "auth_router", "users_router", "subscriptions_router",
    "eod_router", "customers_router", "expenses_router",
    "reports_router", "products_router", "admin_router", "ocr_router",
    "merchant_debts_router", "backup_router"
]
