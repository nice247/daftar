"""Customer and Debt management API endpoints."""
from uuid import UUID
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from app.core.database import get_db
from app.models.models import User, Customer, Invoice, DebtPayment
from app.services.business_service import business_service
from app.api.deps import get_current_user, get_active_user
from app.schemas.schemas import (
    CustomerCreate, CustomerResponse, InvoiceResponse,
    DebtCreate, DebtPaymentCreate, DebtWaiverRequest, MessageResponse
)

router = APIRouter(prefix="/customers", tags=["العملاء والديون"])


# ============ Customer CRUD ============

@router.post("/", response_model=CustomerResponse, summary="إضافة عميل جديد")
async def create_customer(
    request: CustomerCreate,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a new customer (name + phone)."""
    try:
        customer = await business_service.create_customer(
            db, current_user.id, request.name, request.phone
        )
        return customer
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=list[CustomerResponse], summary="قائمة العملاء")
async def get_customers(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all customers for the current merchant."""
    customers = await business_service.get_customers(db, current_user.id)
    return customers


@router.get("/{customer_id}", summary="تفاصيل العميل")
async def get_customer(
    customer_id: UUID,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get customer details with outstanding invoices."""
    customer = await business_service.get_customer(db, customer_id, current_user.id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="العميل غير موجود")

    # Get outstanding invoices
    inv_result = await db.execute(
        select(Invoice).where(
            Invoice.customer_id == customer_id,
            Invoice.user_id == current_user.id,
            Invoice.invoice_type.in_(["DEBT", "CASH"]),
            Invoice.is_cancelled == False,
            Invoice.paid_amount < Invoice.total_amount
        ).order_by(Invoice.created_at)
    )
    invoices = list(inv_result.scalars().all())

    return {
        "id": str(customer.id),
        "name": customer.name,
        "phone": customer.phone,
        "total_debt": customer.total_debt,
        "outstanding_invoices": [
            {
                "id": str(inv.id),
                "invoice_type": inv.invoice_type,
                "total_amount": inv.total_amount,
                "paid_amount": inv.paid_amount,
                "remaining": inv.total_amount - inv.paid_amount,
                "created_at": str(inv.created_at)
            }
            for inv in invoices
        ]
    }


@router.put("/{customer_id}", response_model=CustomerResponse, summary="تعديل عميل")
async def update_customer(
    customer_id: UUID,
    request: CustomerCreate,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update customer details."""
    customer = await business_service.get_customer(db, customer_id, current_user.id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="العميل غير موجود")

    customer.name = request.name
    customer.phone = request.phone
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", response_model=MessageResponse, summary="حذف عميل")
async def delete_customer(
    customer_id: UUID,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a customer."""
    customer = await business_service.get_customer(db, customer_id, current_user.id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="العميل غير موجود")

    if customer.total_debt > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="لا يمكن حذف عميل لديه ديون قائمة")

    await db.delete(customer)
    await db.commit()
    return MessageResponse(message="تم حذف العميل بنجاح")


# ============ Debt Management ============

@router.post("/debt", summary="تسجيل دين جديد")
async def add_debt(
    request: DebtCreate,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a credit sale (debt) for a customer."""
    # Verify customer belongs to user
    customer = await business_service.get_customer(db, request.customer_id, current_user.id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="العميل غير موجود")

    invoice = await business_service.add_debt(
        db, current_user.id, request.customer_id,
        request.amount, request.debt_type, request.description
    )
    await db.commit()
    await db.refresh(customer)

    return {
        "message": "تم تسجيل الدين بنجاح",
        "invoice_id": str(invoice.id),
        "customer_debt": customer.total_debt
    }


@router.post("/debt/pay", summary="تسجيل سداد دين")
async def pay_debt(
    request: DebtPaymentCreate,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Record a debt payment. If no invoice_id is specified,
    the amount is distributed to the oldest outstanding debts.
    """
    customer = await business_service.get_customer(db, request.customer_id, current_user.id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="العميل غير موجود")

    if request.amount > customer.total_debt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"مبلغ السداد أكبر من الدين القائم ({customer.total_debt}). هل تريد إضافة رصيد دائن؟"
        )

    payment = await business_service.pay_debt(
        db, current_user.id, request.customer_id,
        request.amount, request.invoice_id
    )
    await db.commit()
    await db.refresh(customer)

    return {
        "message": "تم تسجيل السداد بنجاح",
        "payment_id": str(payment.id),
        "remaining_debt": customer.total_debt
    }


@router.post("/debt/waive", summary="إعفاء من دين")
async def waive_debt(
    request: DebtWaiverRequest,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Waive (forgive) part or all of a debt. Recorded as an expense."""
    customer = await business_service.get_customer(db, request.customer_id, current_user.id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="العميل غير موجود")

    if request.amount > customer.total_debt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"مبلغ الإعفاء ({request.amount}) أكبر من الدين القائم ({customer.total_debt})"
        )

    expense = await business_service.waive_debt(
        db, current_user.id, request.customer_id,
        request.amount, request.reason
    )
    await db.commit()
    await db.refresh(customer)

    return {
        "message": "تم الإعفاء من الدين",
        "expense_id": str(expense.id),
        "remaining_debt": customer.total_debt
    }
