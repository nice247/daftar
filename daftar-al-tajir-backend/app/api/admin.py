"""Admin dashboard API endpoints."""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.core.database import get_db
from app.core.security import hash_password
from app.models.models import User, Subscription, SystemSettings
from app.api.deps import get_current_admin
from app.schemas.schemas import (
    AdminUserListResponse, AdminExtendSubscription,
    AdminToggleUser, AdminAddUser, MessageResponse, SystemSettingsSchema
)

router = APIRouter(prefix="/admin", tags=["لوحة تحكم الأدمن"])


@router.get("/settings", response_model=SystemSettingsSchema, summary="إعدادات النظام")
async def get_system_settings(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get global system settings (prices, etc)."""
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id.desc()).limit(1))
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        
    return settings


@router.put("/settings", response_model=SystemSettingsSchema, summary="تحديث إعدادات النظام")
async def update_system_settings(
    request: SystemSettingsSchema,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update global system settings."""
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id.desc()).limit(1))
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = SystemSettings(**request.model_dump())
        db.add(settings)
    else:
        for key, value in request.model_dump().items():
            setattr(settings, key, value)
            
    await db.commit()
    await db.refresh(settings)
    return settings


@router.get("/users", response_model=list[AdminUserListResponse], summary="قائمة المستخدمين")
async def list_users(
    search: Optional[str] = Query(None, description="بحث برقم الهاتف أو الاسم"),
    status_filter: Optional[str] = Query(None, description="تصفية بالحالة"),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of all users (merchants and admins).
    Can search by phone number or store name.
    """
    query = select(User)

    if search:
        query = query.where(
            or_(
                User.phone.ilike(f"%{search}%"),
                User.store_name.ilike(f"%{search}%")
            )
        )
    if status_filter:
        query = query.where(User.status == status_filter)

    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


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

    await db.commit()

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
        message = "تم تجميد الحساب"
    elif request.action == "activate":
        user.status = "ACTIVE"
        message = "تم تنشيط الحساب"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="إجراء غير صالح")
    
    await db.commit()
    return MessageResponse(message=message)


@router.post("/add-user", summary="إضافة مستخدم يدوياً")
async def add_user_manually(
    request: AdminAddUser,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Manually add a user (merchant or admin)."""
    # Check if phone exists
    result = await db.execute(select(User).where(User.phone == request.phone))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="رقم الهاتف مسجل مسبقاً")

    # Set subscription end date based on role
    if request.role == "admin":
        # Admins have a very long subscription
        subscription_end_date = datetime.now(timezone.utc).date() + timedelta(days=36500)
    else:
        # Merchants get the specified number of days
        subscription_end_date = datetime.now(timezone.utc).date() + timedelta(days=request.subscription_days)

    user = User(
        phone=request.phone,
        store_name=request.store_name,
        password_hash=hash_password(request.password),
        status="ACTIVE",
        role=request.role,
        subscription_end_date=subscription_end_date
    )
    db.add(user)
    await db.flush() # Flush to get the user.id

    # Create an approved subscription record ONLY for merchants
    if request.role == "merchant":
        subscription = Subscription(
            user_id=user.id,
            amount=None,
            status="APPROVED",
            ocr_status="MANUAL_REVIEW",
            reviewed_by=admin.id
        )
        db.add(subscription)
    
    await db.commit()

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
    # Total users (merchants only for this stat)
    total_merchants = await db.scalar(select(func.count(User.id)).where(User.role == "merchant"))

    # Active users (merchants only)
    active_merchants = await db.scalar(
        select(func.count(User.id)).where(and_(User.role == "merchant", User.status == "ACTIVE"))
    )

    # Frozen users (merchants only)
    frozen_merchants = await db.scalar(
        select(func.count(User.id)).where(and_(User.role == "merchant", User.status == "FROZEN"))
    )

    # Pending verification (merchants only)
    pending_verification = await db.scalar(
        select(func.count(User.id)).where(and_(User.role == "merchant", User.status == "PENDING_VERIFICATION"))
    )

    # Pending subscriptions
    pending_subscriptions = await db.scalar(
        select(func.count(Subscription.id)).where(Subscription.status == "PENDING")
    )

    # Expiring soon (within 3 days)
    expiring_soon = await db.scalar(
        select(func.count(User.id)).where(
            User.role == "merchant",
            User.subscription_end_date <= datetime.now(timezone.utc).date() + timedelta(days=3),
            User.subscription_end_date > datetime.now(timezone.utc).date()
        )
    )

    return {
        "total_users": total_merchants,
        "active_users": active_merchants,
        "frozen_users": frozen_merchants,
        "pending_verification": pending_verification,
        "pending_subscriptions": pending_subscriptions,
        "expiring_soon": expiring_soon
    }



