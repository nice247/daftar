"""Authentication API endpoints.

Registration Flow:
1. POST /auth/verify-phone  → User enters phone (249xxx), gets code via Telegram→WhatsApp
2. POST /auth/confirm-phone → User enters code to verify phone
3. POST /auth/register      → User completes registration (store name, password)

Password Reset Flow:
1. POST /auth/forgot-password → User enters phone, gets OTP via Telegram→WhatsApp
2. POST /auth/verify-otp      → User enters OTP
3. POST /auth/reset-password  → User sets new password
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.auth_service import AuthService
from app.schemas.schemas import (
    PhoneVerificationRequest, PhoneVerificationConfirm,
    RegisterRequest, LoginRequest, TokenResponse,
    OTPRequest, OTPVerifyRequest, ResetPasswordRequest,
    MessageResponse
)

router = APIRouter(prefix="/auth", tags=["المصادقة"])


# ============ Registration Flow ============

@router.post("/verify-phone", response_model=MessageResponse, summary="طلب رمز تحقق الرقم")
async def verify_phone(
    request: PhoneVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 1 of registration: User enters their WhatsApp number (249xxx).
    A 4-digit verification code is generated and sent to the admin via Telegram.
    The admin then sends the code to the user via WhatsApp.
    """
    try:
        await AuthService.request_phone_verification(db, request.phone)
        return MessageResponse(
            message="تم إرسال رمز التحقق. سيصلك الرمز عبر الواتساب خلال دقائق."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/confirm-phone", response_model=MessageResponse, summary="تأكيد رمز التحقق")
async def confirm_phone(
    request: PhoneVerificationConfirm,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 2 of registration: User enters the verification code
    they received via WhatsApp from the admin.
    """
    try:
        # Check if valid but do NOT mark as used yet. We need it for the final registration step.
        await AuthService.verify_phone_code(db, request.phone, request.code, mark_used=False)
        return MessageResponse(message="تم التحقق من الرقم بنجاح")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/register", response_model=TokenResponse, summary="إكمال التسجيل")
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 3 of registration: After phone is verified, user completes
    their profile with store name, password.
    The verification code must match the one sent earlier.
    First month is free.
    """
    try:
        user = await AuthService.register_user(
            db=db,
            phone=request.phone,
            store_name=request.store_name,
            password=request.password,
            verification_code=request.verification_code,
            email=request.email
        )
        await db.flush()

        # Auto-login after registration
        token_response = await AuthService.login(db, request.phone, request.password)
        return token_response

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============ Login ============

@router.post("/login", response_model=TokenResponse, summary="تسجيل الدخول")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and get JWT token valid for 7 days."""
    try:
        return await AuthService.login(db, request.phone, request.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


# ============ Password Reset Flow ============

@router.post("/forgot-password", response_model=MessageResponse, summary="طلب استعادة كلمة المرور")
async def forgot_password(request: OTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Request a password reset. A 4-digit OTP code will be generated
    and sent to the admin via Telegram. Admin forwards it to user via WhatsApp.
    """
    try:
        await AuthService.generate_otp(db, request.phone)
        return MessageResponse(
            message="تم تسجيل طلبكم، سيتم التواصل معكم على الواتساب"
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/verify-otp", response_model=MessageResponse, summary="التحقق من رمز OTP")
async def verify_otp(request: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify the OTP code sent for password reset."""
    try:
        # Check if valid but do NOT mark as used yet. We need it for the final reset password step.
        await AuthService.verify_phone_code(db, request.phone, request.code, mark_used=False)
        return MessageResponse(message="تم التحقق بنجاح")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/reset-password", response_model=MessageResponse, summary="إعادة تعيين كلمة المرور")
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password after OTP verification."""
    try:
        # Verify OTP and mark it as used NOW
        await AuthService.verify_otp(db, request.phone, request.code)
        # Reset password
        await AuthService.reset_password(db, request.phone, request.new_password)
        return MessageResponse(message="تم تغيير كلمة المرور بنجاح")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
