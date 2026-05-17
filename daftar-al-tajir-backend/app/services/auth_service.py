"""Authentication Service."""
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import OAuth2PasswordRequestForm

from app.models.models import User, OTPCode
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.schemas.schemas import TokenResponse
from app.services.telegram_service import telegram_service


class AuthService:
    """Service handling all authentication and registration logic."""

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Ensure phone number starts with 0 and remove spaces."""
        phone = phone.replace(" ", "")
        if phone.startswith("249"):
            phone = "0" + phone[3:]
        elif phone.startswith("+249"):
            phone = "0" + phone[4:]
        return phone

    @staticmethod
    def _generate_code() -> str:
        """Generate a random 4-digit code."""
        return "".join(random.choices(string.digits, k=4))

    # ============ Registration Flow ============

    @staticmethod
    async def request_phone_verification(db: AsyncSession, phone: str) -> str:
        """
        Step 1: Check if phone exists, generate code, save it, and send to admin.
        """
        phone = AuthService._normalize_phone(phone)

        # Check if phone is already registered and active
        result = await db.execute(select(User).where(User.phone == phone))
        existing_user = result.scalar_one_or_none()
        
        if existing_user and existing_user.status == "ACTIVE":
            raise ValueError("رقم الهاتف مسجل ومفعل مسبقاً. الرجاء تسجيل الدخول.")

        # Generate a new 4-digit code
        code = AuthService._generate_code()

        # Invalidate any old unused codes for this phone
        await db.execute(
            OTPCode.__table__.update()
            .where(OTPCode.phone == phone)
            .where(OTPCode.is_used == False)
            .values(is_used=True)
        )

        # Save new code (expires in 30 minutes)
        otp = OTPCode(
            phone=phone,
            code=code,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)
        )
        db.add(otp)
        await db.flush()

        # Send to admin via Telegram
        await telegram_service.notify_registration_code(phone, code)

        return code

    @staticmethod
    async def verify_phone_code(db: AsyncSession, phone: str, code: str, mark_used: bool = True) -> bool:
        """
        Step 2: Verify the code that was sent to user via WhatsApp.
        This is used both for registration and password reset.
        If mark_used is False, it just checks validity without invalidating the code.
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

        if mark_used:
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

        # Verify the code first, and mark it as used NOW (it was only checked in Step 2)
        await AuthService.verify_phone_code(db, phone, verification_code, mark_used=True)

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
            status="ACTIVE",
            subscription_end_date=datetime.now(timezone.utc).date() + timedelta(days=30)
        )
        
        db.add(user)
        await db.flush()

        # Notify admin of successful registration
        await telegram_service.notify_new_registration(
            phone=user.phone,
            store_name=user.store_name,
            plan=user.subscription_plan,
            user_id=str(user.id)
        )

        return user

    # ============ Login Flow ============

    @staticmethod
    async def login(db: AsyncSession, phone: str, password: str) -> TokenResponse:
        """Authenticate user and return JWT token."""
        phone = AuthService._normalize_phone(phone)

        # Find user
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise ValueError("رقم الهاتف أو كلمة المرور غير صحيحة")

        # Check status
        if user.status == "PENDING":
            raise ValueError("حسابك قيد المراجعة")
        elif user.status == "FROZEN":
            raise ValueError("حسابك مجمد بسبب انتهاء الاشتراك")
        elif user.status == "BANNED":
            raise ValueError("حسابك محظور. يرجى التواصل مع الإدارة")

        # Generate token
        access_token_expires = timedelta(days=7)
        access_token = create_access_token(
            data={"sub": str(user.id), "role": user.role},
            expires_delta=access_token_expires
        )

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        await db.commit()

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": user.id,
                "phone": user.phone,
                "store_name": user.store_name,
                "role": user.role,
                "status": user.status,
                "subscription_end_date": user.subscription_end_date.isoformat() if user.subscription_end_date else None
            }
        )

    # ============ Authorization ============

    @staticmethod
    async def get_current_user(db: AsyncSession, token: str) -> User:
        """Validate token and get the user from the database."""
        token_data = decode_access_token(token)
        if not token_data or not token_data.get("sub"):
            raise ValueError("توكن المصادقة غير صالح أو منتهي الصلاحية")

        result = await db.execute(select(User).where(User.id == token_data.get("sub")))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("المستخدم غير موجود")

        return user

    # ============ Password Reset Flow ============

    @staticmethod
    async def generate_otp(db: AsyncSession, phone: str) -> str:
        """Generate and send an OTP for password reset."""
        phone = AuthService._normalize_phone(phone)

        # Verify user exists
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("رقم الهاتف غير مسجل")

        # Generate new 4-digit code
        code = AuthService._generate_code()

        # Invalidate old codes
        await db.execute(
            OTPCode.__table__.update()
            .where(OTPCode.phone == phone)
            .where(OTPCode.is_used == False)
            .values(is_used=True)
        )

        # Save new code (expires in 15 mins)
        otp = OTPCode(
            phone=phone,
            code=code,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15)
        )
        db.add(otp)
        await db.flush()

        # Send OTP to admin via Telegram
        await telegram_service.notify_otp_request(phone, code)

        return code

    @staticmethod
    async def verify_otp(db: AsyncSession, phone: str, code: str) -> bool:
        """Verify the password reset OTP."""
        return await AuthService.verify_phone_code(db, phone, code, mark_used=True)

    @staticmethod
    async def reset_password(db: AsyncSession, phone: str, new_password: str) -> bool:
        """Reset the user's password."""
        phone = AuthService._normalize_phone(phone)

        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("المستخدم غير موجود")

        user.password_hash = hash_password(new_password)
        await db.flush()

        return True