"""Authentication service - JWT, password hashing, OTP generation.

Registration Flow:
1. User enters phone (0XXXXXXXXX, 10 digits) → System generates OTP → Admin gets code via Telegram
2. Admin sends OTP to user via WhatsApp (link uses 249XXXXXXXXX format)
3. User enters OTP → Phone verified
4. User completes registration (store name, password, plan)

Phone format:
- User enters & system stores: 0XXXXXXXXX (local Sudan format, 10 digits)
- WhatsApp links in Telegram: 249XXXXXXXXX (international format, without leading 0)
"""
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.models.models import User, OTPCode
from app.schemas.schemas import TokenResponse, SUDAN_COUNTRY_CODE, validate_sudan_phone
from app.services.telegram_service import telegram_service


class AuthService:
    """Authentication and authorization service."""

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Normalize phone to local format: 0XXXXXXXXX"""
        return validate_sudan_phone(phone)

    @staticmethod
    async def request_phone_verification(db: AsyncSession, phone: str) -> str:
        """
        Step 1: User requests phone verification.
        Generates a 4-digit code and sends it to admin via Telegram.
        Admin will forward it to the user via WhatsApp.
        """
        # Normalize to local format
        phone = AuthService._normalize_phone(phone)

        # Check if phone already registered
        result = await db.execute(select(User).where(User.phone == phone))
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("رقم الهاتف مسجل مسبقاً")

        # Generate 4-digit verification code
        code = ''.join(random.choices(string.digits, k=4))

        # Save OTP with purpose "registration"
        otp = OTPCode(
            phone=phone,
            code=code,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
            purpose="registration"
        )
        db.add(otp)
        await db.flush()

        # Send code to admin via Telegram (admin forwards to user via WhatsApp)
        await telegram_service.notify_registration_code(phone, code)

        return code

    @staticmethod
    async def verify_phone_code(db: AsyncSession, phone: str, code: str) -> bool:
        """
        Step 2: Verify the code that was sent to user via WhatsApp.
        This is used both for registration and password reset.
        """
        # Normalize phone
        phone = AuthService._normalize_phone(phone)

        result = await db.execute(
            select(OTPCode)
            .where(
                OTPCode.phone == phone,
                OTPCode.code == code,
                OTPCode.is_used == False,
                OTPCode.expires_at > datetime.now(timezone.utc)
            )
            .order_by(OTPCode.created_at.desc())
        )
        otp = result.scalar_one_or_none()

        if not otp:
            raise ValueError("رمز التحقق غير صالح أو منتهي الصلاحية")

        # Mark OTP as used
        otp.is_used = True
        await db.flush()

        return True

    @staticmethod
    async def register_user(
        db: AsyncSession,
        phone: str,
        store_name: str,
        password: str,
        plan: str,
        verification_code: str,
        email: Optional[str] = None
    ) -> User:
        """
        Step 3: Complete registration after phone verification.
        The verification code must have been validated.
        """
        # Normalize phone
        phone = AuthService._normalize_phone(phone)

        # Verify the code first
        await AuthService.verify_phone_code(db, phone, verification_code)

        # Check if phone already exists (double check)
        result = await db.execute(select(User).where(User.phone == phone))
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("رقم الهاتف مسجل مسبقاً")

        # Create user - first month is free
        user = User(
            phone=phone,
            store_name=store_name,
            email=email,
            password_hash=hash_password(password),
            status="ACTIVE",  # Activate immediately for free first month
            role="merchant",
            subscription_end_date=(datetime.now(timezone.utc) + timedelta(days=30)).date(),
        )

        db.add(user)
        await db.flush()

        # Notify admin about new registration
        await telegram_service.notify_new_registration(
            phone=phone,
            store_name=store_name,
            plan=plan,
            user_id=str(user.id)
        )

        return user

    @staticmethod
    async def login(db: AsyncSession, phone: str, password: str) -> TokenResponse:
        """Authenticate user and return JWT token."""
        # Normalize phone to local format for lookup
        try:
            phone = AuthService._normalize_phone(phone)
        except ValueError:
            pass  # Allow non-standard formats for existing accounts

        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("بيانات الدخول غير صحيحة")

        if not verify_password(password, user.password_hash):
            raise ValueError("بيانات الدخول غير صحيحة")

        if user.status == "FROZEN":
            raise ValueError("الحساب مجمد. تواصل مع الدعم")

        if user.status == "PENDING_VERIFICATION":
            raise ValueError("الحساب قيد المراجعة")

        # Generate JWT token
        token = create_access_token(data={
            "sub": str(user.id),
            "phone": user.phone,
            "role": user.role
        })

        return TokenResponse(
            access_token=token,
            user_id=user.id,
            phone=user.phone,
            store_name=user.store_name,
            role=user.role,
            status=user.status
        )

    @staticmethod
    async def get_current_user(db: AsyncSession, token: str) -> User:
        """Get the current user from a JWT token."""
        payload = decode_access_token(token)
        if not payload:
            raise ValueError("رمز المصادقة غير صالح أو منتهي الصلاحية")

        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("رمز المصادقة غير صالح")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("المستخدم غير موجود")

        return user

    @staticmethod
    async def generate_otp(db: AsyncSession, phone: str, purpose: str = "password_reset") -> str:
        """
        Generate a 4-digit OTP code for password reset.
        Code is sent to admin via Telegram, who forwards it to user via WhatsApp.
        """
        # Normalize phone
        phone = AuthService._normalize_phone(phone)

        # Check if user exists
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("رقم الهاتف غير مسجل")

        # Generate OTP
        code = ''.join(random.choices(string.digits, k=4))

        # Save OTP
        otp = OTPCode(
            phone=phone,
            code=code,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
            purpose=purpose
        )
        db.add(otp)
        await db.flush()

        # Notify admin via Telegram
        await telegram_service.notify_otp_request(phone, code)

        return code

    @staticmethod
    async def verify_otp(db: AsyncSession, phone: str, code: str) -> bool:
        """Verify an OTP code."""
        # Normalize phone
        try:
            phone = AuthService._normalize_phone(phone)
        except ValueError:
            pass

        result = await db.execute(
            select(OTPCode)
            .where(
                OTPCode.phone == phone,
                OTPCode.code == code,
                OTPCode.is_used == False,
                OTPCode.expires_at > datetime.now(timezone.utc)
            )
            .order_by(OTPCode.created_at.desc())
        )
        otp = result.scalar_one_or_none()

        if not otp:
            raise ValueError("رمز التحقق غير صالح أو منتهي الصلاحية")

        # Mark OTP as used
        otp.is_used = True
        await db.flush()

        return True

    @staticmethod
    async def reset_password(db: AsyncSession, phone: str, new_password: str) -> None:
        """Reset a user's password after OTP verification."""
        # Normalize phone
        try:
            phone = AuthService._normalize_phone(phone)
        except ValueError:
            pass

        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("المستخدم غير موجود")

        user.password_hash = hash_password(new_password)
        await db.flush()
