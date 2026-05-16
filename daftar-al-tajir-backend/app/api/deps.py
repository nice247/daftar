"""Dependency injection for API endpoints."""
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User
from app.services.auth_service import AuthService


async def get_current_user(
    authorization: str = Header(..., description="Bearer token"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and validate the current user from the Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="تنسيق المصادقة غير صالح. استخدم: Bearer <token>"
        )

    token = authorization.replace("Bearer ", "")
    try:
        user = await AuthService.get_current_user(db, token)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure the current user is an admin."""
    if not current_user.is_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="هذا الإجراء يتطلب صلاحيات المدير"
        )
    return current_user


async def get_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure the current user has an active account and valid subscription."""
    if not current_user.is_active():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="الحساب غير مفعل. تواصل مع الدعم"
        )
    if not current_user.is_subscription_valid():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="انتهت صلاحية الاشتراك. يرجى التجديد"
        )
    return current_user
