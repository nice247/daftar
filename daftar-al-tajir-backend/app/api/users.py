"""User API endpoints - profile management."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User
from app.services.auth_service import AuthService
from app.schemas.schemas import UserResponse, UserUpdateRequest, MessageResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["المستخدمين"])


@router.get("/me", response_model=UserResponse, summary="بيانات المستخدم الحالي")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return current_user


@router.put("/me", response_model=UserResponse, summary="تحديث بيانات المستخدم")
async def update_my_profile(
    request: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update the current user's profile information."""
    if request.store_name:
        current_user.store_name = request.store_name
    if request.email is not None:
        current_user.email = request.email
    if request.restock_cycle_days:
        current_user.restock_cycle_days = request.restock_cycle_days

    await db.flush()
    return current_user
