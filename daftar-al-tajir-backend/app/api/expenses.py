"""Expenses API endpoints."""
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import User, Expense
from app.services.business_service import business_service
from app.api.deps import get_current_user, get_active_user
from app.schemas.schemas import ExpenseItem, MessageResponse

router = APIRouter(prefix="/expenses", tags=["المصروفات"])


@router.get("/", summary="قائمة المصروفات")
async def get_expenses(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200, description="عدد النتائج"),
    offset: int = Query(0, ge=0, description="بداية النتائج"),
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get expenses with optional date range, category filters, and pagination."""
    expenses = await business_service.get_expenses(
        db, current_user.id, start_date, end_date, category
    )
    # Apply pagination
    total = len(expenses)
    paginated = expenses[offset:offset + limit]
    return {
        "total": total,
        "expenses": [
            {
                "id": str(exp.id),
                "category": exp.category,
                "amount": exp.amount,
                "description": exp.description,
                "starts_new_cycle": exp.starts_new_cycle,
                "created_at": str(exp.created_at)
            }
            for exp in paginated
        ]
    }


@router.post("/", summary="إضافة مصروف")
async def add_expense(
    request: ExpenseItem,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a single expense."""
    from app.models.models import Expense as ExpenseModel
    expense = ExpenseModel(
        user_id=current_user.id,
        category=request.category,
        amount=request.amount,
        description=request.description,
        receipt_image=request.receipt_image,
        starts_new_cycle=(request.category == "RESTOCK")
    )
    db.add(expense)

    if request.category == "RESTOCK":
        await business_service._start_new_cycle(db, current_user.id, date.today())

    await db.flush()

    return {
        "message": "تم إضافة المصروف بنجاح",
        "expense_id": str(expense.id)
    }
