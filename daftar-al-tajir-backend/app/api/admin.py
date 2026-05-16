"""Admin dashboard API endpoints."""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import get_db
from app.core.security import hash_password
from app.models.models import User, Subscription
from app.api.deps import get_current_admin
from app.schemas.schemas import (
    AdminUserListResponse, AdminExtendSubscription,
    AdminToggleUser, AdminAddUser, MessageResponse
)

router = APIRouter(prefix="/admin", tags=["لوحة تحكم الأدمن"])


@router.get("/users", summary="قائمة المستخدمين")
async def list_users(
    search: Optional[str] = Query(None, description="بحث برقم الهاتف"),
    status_filter: Optional[str] = Query(None, description="تصفية بالحالة"),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of all users. Admin cannot see commercial data.
    Can search by phone number.
    """
    query = select(User).where(User.role == "merchant")

    if search:
        query = query.where(User.phone.ilike(f"%{search}%"))
    if status_filter:
        query = query.where(User.status == status_filter)

    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = list(result.scalars().all())

    return [
        {
            "id": str(u.id),
            "phone": u.phone,
            "store_name": u.store_name,
            "status": u.status,
            "subscription_end_date": str(u.subscription_end_date) if u.subscription_end_date else None,
            "created_at": str(u.created_at)
        }
        for u in users
    ]


@router.post("/extend-subscription", summary="تمديد اشتراك")
async def extend_subscription(
    request: AdminExtendSubscription,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Extend a user's subscription by any number of days."""
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="المستخدم غير موجود")

    if user.subscription_end_date and user.subscription_end_date > datetime.now(timezone.utc).date():
        user.subscription_end_date += timedelta(days=request.days)
    else:
        user.subscription_end_date = datetime.now(timezone.utc).date() + timedelta(days=request.days)

    if user.status == "FROZEN":
        user.status = "ACTIVE"

    await db.flush()

    return MessageResponse(
        message=f"تم تمديد الاشتراك {request.days} يوم",
        detail=f"تاريخ الانتهاء الجديد: {user.subscription_end_date}"
    )


@router.post("/toggle-user", summary="تعطيل/تنشيط حساب")
async def toggle_user(
    request: AdminToggleUser,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Activate or freeze a user account."""
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="المستخدم غير موجود")

    if request.action == "freeze":
        user.status = "FROZEN"
        return MessageResponse(message="تم تجميد الحساب")
    elif request.action == "activate":
        user.status = "ACTIVE"
        return MessageResponse(message="تم تنشيط الحساب")
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="إجراء غير صالح")


@router.post("/add-user", summary="إضافة مستخدم يدوياً")
async def add_user_manually(
    request: AdminAddUser,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Manually add a user (bypass OCR verification)."""
    # Check if phone exists
    result = await db.execute(select(User).where(User.phone == request.phone))
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="رقم الهاتف مسجل مسبقاً")

    user = User(
        phone=request.phone,
        store_name=request.store_name,
        password_hash=hash_password(request.password),
        status="ACTIVE",
        role="merchant",
        subscription_end_date=datetime.now(timezone.utc).date() + timedelta(days=request.subscription_days)
    )
    db.add(user)

    # Create approved subscription
    subscription = Subscription(
        user_id=user.id,
        plan=request.plan,
        status="APPROVED",
        ocr_status="MANUAL_REVIEW",
        reviewed_by=admin.id
    )
    db.add(subscription)
    await db.flush()

    return {
        "message": "تم إضافة المستخدم بنجاح",
        "user_id": str(user.id),
        "subscription_end_date": str(user.subscription_end_date)
    }


@router.get("/stats", summary="إحصائيات النظام")
async def get_system_stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get system-wide statistics."""
    # Total users
    total = await db.execute(select(func.count(User.id)).where(User.role == "merchant"))
    total_users = total.scalar()

    # Active users
    active = await db.execute(
        select(func.count(User.id)).where(User.role == "merchant", User.status == "ACTIVE")
    )
    active_users = active.scalar()

    # Frozen users
    frozen = await db.execute(
        select(func.count(User.id)).where(User.role == "merchant", User.status == "FROZEN")
    )
    frozen_users = frozen.scalar()

    # Pending verification
    pending = await db.execute(
        select(func.count(User.id)).where(User.role == "merchant", User.status == "PENDING_VERIFICATION")
    )
    pending_users = pending.scalar()

    # Pending subscriptions
    pending_subs = await db.execute(
        select(func.count(Subscription.id)).where(Subscription.status == "PENDING")
    )
    pending_subscriptions = pending_subs.scalar()

    # Expiring soon (within 3 days)
    soon = await db.execute(
        select(func.count(User.id)).where(
            User.role == "merchant",
            User.subscription_end_date <= datetime.now(timezone.utc).date() + timedelta(days=3),
            User.subscription_end_date > datetime.now(timezone.utc).date()
        )
    )
    expiring_soon = soon.scalar()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "frozen_users": frozen_users,
        "pending_verification": pending_users,
        "pending_subscriptions": pending_subscriptions,
        "expiring_soon": expiring_soon
    }
