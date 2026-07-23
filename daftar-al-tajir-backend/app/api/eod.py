"""End-of-Day API endpoints."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import User
from app.services.business_service import business_service
from app.api.deps import get_current_user, get_active_user
from app.schemas.schemas import EODRequest, EODResponse, ExpenseItem, MessageResponse

router = APIRouter(prefix="/eod", tags=["إغلاق اليوم"])


@router.post("/save", response_model=EODResponse, summary="حفظ إغلاق اليوم")
async def save_eod(
    request: EODRequest,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save all end-of-day data including:
    - Cash and Bankak sales
    - Expenses (including restock)
    - Debt payments
    - Other income
    Returns a summary of the day's net cashflow.
    """
    result = await business_service.save_eod(db, current_user.id, request)
    return result


@router.get("/last-restock", summary="آخر شراء (تجديد مخزون)")
async def get_last_restock(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the last restock expense for the 'last purchase' card."""
    restock = await business_service.get_last_restock(db, current_user.id)
    if restock:
        return {
            "date": restock.created_at,
            "amount": restock.amount,
            "description": restock.description
        }
    return {"message": "لا يوجد سجل تجديد مخزون"}


@router.get("/cycle-status", summary="حالة الدورة الحالية")
async def get_cycle_status(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current restock cycle status and progress."""
    cycle = await business_service.get_current_cycle(db, current_user.id)
    if not cycle:
        return {
            "message": "لا توجد دورة نشطة",
            "status": "none",
            "days_remaining": 0,
            "total_sales": 0,
            "total_expenses": 0,
            "net_cashflow": 0
        }

    from datetime import date, timedelta
    today = date.today()
    days_elapsed = (today - cycle.start_date).days
    cycle_days = current_user.restock_cycle_days or 7
    remaining = max(0, cycle_days - days_elapsed)

    expected_end = cycle.start_date + timedelta(days=cycle_days)
    two_days_before_end = expected_end - timedelta(days=2)
    has_recent_restock = await business_service.has_restock_since(db, current_user.id, min_date=two_days_before_end)

    if (today >= expected_end or remaining == 0) and not has_recent_restock:
        return {
            "cycle_id": str(cycle.id),
            "start_date": cycle.start_date,
            "end_date": cycle.end_date or expected_end,
            "days_elapsed": days_elapsed,
            "days_remaining": 0,
            "total_sales": 0,
            "total_expenses": 0,
            "net_cashflow": 0,
            "status": "EXPIRED"
        }

    return {
        "cycle_id": str(cycle.id),
        "start_date": cycle.start_date,
        "end_date": cycle.end_date,
        "days_elapsed": days_elapsed,
        "days_remaining": remaining,
        "total_sales": cycle.total_sales,
        "total_expenses": cycle.total_expenses,
        "net_cashflow": cycle.net_cashflow,
        "status": cycle.status
    }


@router.get("/today", summary="بيانات اليوم الحالي")
async def get_today_data(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get today's accumulated data (invoices, expenses, payments).
    Data stays visible until midnight, then resets automatically.
    """
    from datetime import datetime, timezone, timedelta
    local_today = (datetime.now(timezone.utc) + timedelta(hours=2)).date()
    result = await business_service.get_today_summary(db, current_user.id, target_date=local_today)
    return result


@router.get("/yesterday", summary="بيانات أمس")
async def get_yesterday_data(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get yesterday's accumulated data."""
    from datetime import datetime, timezone, timedelta
    local_today = (datetime.now(timezone.utc) + timedelta(hours=2)).date()
    yesterday = local_today - timedelta(days=1)
    result = await business_service.get_today_summary(db, current_user.id, target_date=yesterday)
    return result
