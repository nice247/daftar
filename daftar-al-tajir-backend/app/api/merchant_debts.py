"""Merchant Debts API - ديون التاجر على الموردين."""
from uuid import UUID
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.models import User, MerchantDebt, MerchantDebtPayment, Expense
from app.services.business_service import business_service
from app.api.deps import get_active_user
from app.schemas.schemas import (
    MerchantDebtCreate, MerchantDebtResponse,
    MerchantDebtPaymentCreate, MessageResponse
)

router = APIRouter(prefix="/merchant-debts", tags=["ديون التاجر"])


@router.get("/", summary="قائمة ديون التاجر")
async def list_merchant_debts(
    status_filter: Optional[str] = Query(None, description="unpaid, partial, paid"),
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all merchant debts with optional status filter."""
    query = select(MerchantDebt).where(MerchantDebt.user_id == current_user.id)
    if status_filter and status_filter in ("unpaid", "partial", "paid"):
        query = query.where(MerchantDebt.status == status_filter)
    query = query.order_by(MerchantDebt.created_at.desc())
    result = await db.execute(query)
    debts = list(result.scalars().all())

    return [
        {
            "id": str(d.id),
            "supplier_name": d.supplier_name,
            "debt_type": d.debt_type,
            "total_amount": d.total_amount,
            "paid_amount": d.paid_amount,
            "remaining": d.total_amount - d.paid_amount,
            "status": d.status,
            "description": d.description,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in debts
    ]


@router.post("/", summary="إضافة دين جديد على التاجر")
async def create_merchant_debt(
    request: MerchantDebtCreate,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a new debt the merchant owes to a supplier."""
    debt = MerchantDebt(
        user_id=current_user.id,
        supplier_name=request.supplier_name,
        debt_type=request.debt_type,
        total_amount=request.total_amount,
        paid_amount=Decimal(0),
        status="unpaid",
        description=request.description,
    )
    db.add(debt)
    await db.commit()
    await db.refresh(debt)

    return {
        "message": "تم تسجيل الدين بنجاح",
        "debt_id": str(debt.id),
    }


@router.post("/pay", summary="تسجيل سداد دين على التاجر")
async def pay_merchant_debt(
    request: MerchantDebtPaymentCreate,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a payment on a merchant debt."""
    result = await db.execute(
        select(MerchantDebt).where(
            MerchantDebt.id == request.merchant_debt_id,
            MerchantDebt.user_id == current_user.id,
        )
    )
    debt = result.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="الدين غير موجود")

    remaining = debt.total_amount - debt.paid_amount
    if request.amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"مبلغ السداد ({request.amount}) أكبر من المتبقي ({remaining})"
        )

    # Record payment
    payment = MerchantDebtPayment(
        merchant_debt_id=debt.id,
        amount=request.amount,
        payment_method=request.payment_method,
        description=request.description,
    )
    db.add(payment)

    # Update debt
    debt.paid_amount += request.amount
    if debt.paid_amount >= debt.total_amount:
        debt.status = "paid"
    else:
        debt.status = "partial"

    # Record as a real Expense
    expense = Expense(
        user_id=current_user.id,
        category="OTHER",
        amount=request.amount,
        description=f"سداد دين للمورد: {debt.supplier_name} - {request.description or ''}".strip(" -"),
        starts_new_cycle=False,
        created_at=business_service._get_local_date()
    )
    db.add(expense)
    await db.flush()

    # Update active cycle totals
    await business_service._update_cycle_totals(db, current_user.id)

    await db.commit()
    await db.refresh(debt)

    return {
        "message": "تم تسجيل السداد بنجاح",
        "remaining": debt.total_amount - debt.paid_amount,
        "status": debt.status,
    }


@router.get("/{debt_id}/payments", summary="عرض سداداد دين معين")
async def get_debt_payments(
    debt_id: UUID,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all payments for a specific merchant debt."""
    # Verify ownership
    debt_result = await db.execute(
        select(MerchantDebt).where(
            MerchantDebt.id == debt_id,
            MerchantDebt.user_id == current_user.id,
        )
    )
    debt = debt_result.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="الدين غير موجود")

    payments_result = await db.execute(
        select(MerchantDebtPayment)
        .where(MerchantDebtPayment.merchant_debt_id == debt_id)
        .order_by(MerchantDebtPayment.payment_date.desc())
    )
    payments = list(payments_result.scalars().all())

    return {
        "debt": {
            "id": str(debt.id),
            "supplier_name": debt.supplier_name,
            "debt_type": debt.debt_type,
            "total_amount": debt.total_amount,
            "paid_amount": debt.paid_amount,
            "remaining": debt.total_amount - debt.paid_amount,
            "status": debt.status,
        },
        "payments": [
            {
                "id": str(p.id),
                "amount": p.amount,
                "payment_method": p.payment_method,
                "description": p.description,
                "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            }
            for p in payments
        ],
    }


@router.delete("/{debt_id}", summary="حذف دين على التاجر")
async def delete_merchant_debt(
    debt_id: UUID,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a merchant debt (only if no payments have been made)."""
    result = await db.execute(
        select(MerchantDebt).where(
            MerchantDebt.id == debt_id,
            MerchantDebt.user_id == current_user.id,
        )
    )
    debt = result.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="الدين غير موجود")

    if debt.paid_amount > 0:
        raise HTTPException(status_code=400, detail="لا يمكن حذف دين عليه سداداد")

    await db.delete(debt)
    return MessageResponse(message="تم حذف الدين بنجاح")


@router.get("/summary", summary="ملخص ديون التاجر")
async def get_debts_summary(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get summary of merchant debts."""
    # Total outstanding
    total_result = await db.execute(
        select(
            func.coalesce(func.sum(MerchantDebt.total_amount - MerchantDebt.paid_amount), 0)
        ).where(
            MerchantDebt.user_id == current_user.id,
            MerchantDebt.status.in_(["unpaid", "partial"])
        )
    )
    total_outstanding = total_result.scalar() or Decimal(0)

    # Count by status
    count_result = await db.execute(
        select(
            MerchantDebt.status,
            func.count(MerchantDebt.id)
        ).where(MerchantDebt.user_id == current_user.id)
        .group_by(MerchantDebt.status)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    return {
        "total_outstanding": total_outstanding,
        "unpaid_count": counts.get("unpaid", 0),
        "partial_count": counts.get("partial", 0),
        "paid_count": counts.get("paid", 0),
    }
