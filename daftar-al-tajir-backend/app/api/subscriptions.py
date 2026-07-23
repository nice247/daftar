"""Subscription API endpoints - registration with OCR verification."""
import base64
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import User, Subscription
from app.services.ocr_service import ocr_service
from app.services.telegram_service import telegram_service
from app.api.deps import get_current_user, get_current_admin
from app.schemas.schemas import SubscriptionResponse, SubscriptionReviewRequest, MessageResponse

router = APIRouter(prefix="/subscriptions", tags=["الاشتراكات"])


@router.post("/upload-receipt", summary="رفع إشعار تحويل بنكي لتجديد الاشتراك")
async def upload_receipt(
    receipt_image: UploadFile = File(..., description="صورة إشعار التحويل"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a bank transfer receipt for subscription renewal.
    OCR will extract: amount, reference_number, date.
    """
    # Read image data
    image_data = await receipt_image.read()

    # Run OCR on the receipt
    ocr_result = await ocr_service.extract_from_image(image_data)

    # Verify payment details (fallback logic)
    verification = ocr_service.verify_payment(ocr_result)

    # Create subscription record
    # Only store full image if OCR failed (for manual review)
    # If OCR succeeded, we have the extracted data so we don't need the full image
    receipt_data = None
    if not ocr_result.success:
        receipt_data = base64.b64encode(image_data).decode('utf-8')

    subscription = Subscription(
        user_id=current_user.id,
        plan=None,
        amount=ocr_result.amount,
        receipt_image=receipt_data,
        ocr_data={
            "amount": str(ocr_result.amount) if ocr_result.amount else None,
            "reference_number": ocr_result.reference_number,
            "date": ocr_result.date,
            "raw_text": ocr_result.raw_text[:2000] if ocr_result.raw_text else None,
            "verification": verification,
        },
        ocr_status="SUCCESS" if ocr_result.success else "FAILED",
        status="PENDING"
    )

    if not ocr_result.success:
        subscription.ocr_status = "FAILED"
        # Notify admin about OCR failure
        await telegram_service.notify_ocr_failure(
            phone=current_user.phone,
            store_name=current_user.store_name,
            error=ocr_result.error or "فشل في قراءة الصورة"
        )

    db.add(subscription)
    await db.commit()

    return {
        "message": "تم استلام الإشعار وهو قيد المراجعة" if ocr_result.success else "لم يتم التعرف على الصورة بوضوح، سيتم المراجعة يدوياً",
        "subscription_id": str(subscription.id),
        "ocr_status": subscription.ocr_status,
        "verification": verification,
        "extracted_data": {
            "amount": str(ocr_result.amount) if ocr_result.amount else None,
            "reference_number": ocr_result.reference_number,
            "date": ocr_result.date,
        }
    }


@router.get("/pending", response_model=list[SubscriptionResponse], summary="الاشتراكات المعلقة")
async def get_pending_subscriptions(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all pending subscriptions (admin only)."""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.status == "PENDING")
        .order_by(Subscription.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/review", response_model=MessageResponse, summary="مراجعة اشتراك")
async def review_subscription(
    request: SubscriptionReviewRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Approve or reject a pending subscription (admin only)."""
    result = await db.execute(
        select(Subscription).where(Subscription.id == request.subscription_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الاشتراك غير موجود")

    if subscription.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="تم مراجعة هذا الاشتراك مسبقاً")

    # Get the user
    user_result = await db.execute(select(User).where(User.id == subscription.user_id))
    user = user_result.scalar_one_or_none()

    if request.action == "approve":
        subscription.status = "APPROVED"
        subscription.reviewed_by = admin.id
        if user:
            user.status = "ACTIVE"
            
            # Calculate months based on monthly_price from SystemSettings
            from app.models.models import SystemSettings
            settings_result = await db.execute(select(SystemSettings).order_by(SystemSettings.id.desc()).limit(1))
            settings = settings_result.scalar_one_or_none()
            monthly_price = float(settings.monthly_price) if settings and settings.monthly_price else 3000.0

            amount = float(subscription.amount) if subscription.amount else monthly_price
            months = max(1, int(amount // monthly_price))
            days = months * 30
            
            if user.subscription_end_date and user.subscription_end_date > datetime.now(timezone.utc).date():
                user.subscription_end_date += timedelta(days=days)
            else:
                user.subscription_end_date = datetime.now(timezone.utc).date() + timedelta(days=days)
        
        await db.commit()
        return MessageResponse(message="تم الموافقة على الاشتراك وتمديده")

    else:  # reject
        subscription.status = "REJECTED"
        subscription.rejection_reason = request.rejection_reason
        subscription.reviewed_by = admin.id
        if user and user.subscription_end_date and user.subscription_end_date < datetime.now(timezone.utc).date():
            user.status = "FROZEN"
        
        await db.commit()
        return MessageResponse(
            message="تم رفض الاشتراك",
            detail=request.rejection_reason
        )


@router.get("/my", response_model=list[SubscriptionResponse], summary="اشتراكاتي")
async def get_my_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current user's subscription history."""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/prices", summary="الحصول على أسعار الاشتراكات الحالية")
async def get_subscription_prices(
    db: AsyncSession = Depends(get_db)
):
    """Get the active subscription prices set by the admin."""
    from app.models.models import SystemSettings
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id.desc()).limit(1))
    settings = result.scalar_one_or_none()
    
    if not settings:
        # Default settings if none exist
        settings = SystemSettings(
            monthly_price=3000,
            quarterly_price=8000,
            semi_annual_price=15000
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        
    return {
        "monthly": float(settings.monthly_price),
        "quarterly": float(settings.quarterly_price),
        "semi_annual": float(settings.semi_annual_price)
    }
