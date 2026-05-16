"""Subscription API endpoints - registration with OCR verification."""
import base64
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


@router.post("/upload-receipt", summary="رفع إشعار تحويل بنكي مع OCR")
async def upload_receipt(
    phone: str = Form(..., description="رقم الهاتف"),
    store_name: str = Form(..., description="اسم المتجر"),
    password: str = Form(..., description="كلمة المرور"),
    plan: str = Form(..., description="الباقة"),
    email: str = Form(None, description="البريد الإلكتروني"),
    receipt: UploadFile = File(..., description="صورة إشعار التحويل"),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a bank transfer receipt for subscription verification.
    OCR will extract: account number, amount, transaction ID.
    """
    from app.services.auth_service import AuthService

    # Read image data
    image_data = await receipt.read()

    # Run OCR on the receipt
    ocr_result = await ocr_service.extract_from_image(image_data)

    # Verify payment details
    verification = ocr_service.verify_payment(ocr_result)

    # Create user first
    try:
        user = await AuthService.register_user(
            db=db,
            phone=phone,
            store_name=store_name,
            password=password,
            plan=plan,
            email=email
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Create subscription record
    subscription = Subscription(
        user_id=user.id,
        plan=plan,
        amount=ocr_result.amount,
        receipt_image=base64.b64encode(image_data).decode('utf-8')[:50000],  # Truncate for storage
        ocr_data={
            "recipient_number": ocr_result.recipient_number,
            "amount": str(ocr_result.amount) if ocr_result.amount else None,
            "transaction_id": ocr_result.transaction_id,
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
            phone=phone,
            store_name=store_name,
            error=ocr_result.error or "فشل في قراءة الصورة"
        )

    db.add(subscription)
    await db.flush()

    # Notify admin via Telegram about new registration
    await telegram_service.notify_new_registration(
        phone=phone,
        store_name=store_name,
        plan=plan,
        user_id=str(user.id),
        ocr_status=subscription.ocr_status
    )

    return {
        "message": "تم استلام طلبك وهو قيد المراجعة" if ocr_result.success else "لم يتم التعرف على الصورة بوضوح، سيتم المراجعة يدوياً",
        "user_id": str(user.id),
        "subscription_id": str(subscription.id),
        "ocr_status": subscription.ocr_status,
        "verification": verification
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
        from datetime import datetime, timedelta, timezone
        if user:
            user.status = "ACTIVE"
            # Set subscription end date based on plan
            plan_days = {
                "monthly": 30,
                "quarterly": 90,
                "semi_annual": 180
            }
            days = plan_days.get(subscription.plan or "monthly", 30)
            if user.subscription_end_date and user.subscription_end_date > datetime.now(timezone.utc).date():
                user.subscription_end_date += timedelta(days=days)
            else:
                user.subscription_end_date = datetime.now(timezone.utc).date() + timedelta(days=days)
        return MessageResponse(message="تم الموافقة على الاشتراك")

    else:  # reject
        subscription.status = "REJECTED"
        subscription.rejection_reason = request.rejection_reason
        subscription.reviewed_by = admin.id
        if user:
            user.status = "PENDING_VERIFICATION"
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
