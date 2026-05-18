"""User API endpoints - profile management."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User, RestockCycle
from app.services.auth_service import AuthService
from app.services.business_service import business_service
from app.schemas.schemas import UserResponse, UserUpdateRequest, MessageResponse
from app.api.deps import get_current_user
from app.core.config import SUPPORT_PHONE

router = APIRouter(prefix="/users", tags=["المستخدمين"])


@router.get("/me", response_model=UserResponse, summary="بيانات المستخدم الحالي")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    user_data = UserResponse.from_orm(current_user).dict()
    user_data["support_phone"] = SUPPORT_PHONE
    return user_data


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

    if request.cycle_start_date:
        # Update the active cycle's start date
        current_cycle = await business_service.get_current_cycle(db, current_user.id)
        if current_cycle:
            current_cycle.start_date = request.cycle_start_date
            await db.flush()
            # Recalculate totals based on the new start date
            await business_service._update_cycle_totals(db, current_user.id)
        else:
            # Create a new cycle with the specified start date if none exists
            new_cycle = RestockCycle(
                user_id=current_user.id,
                start_date=request.cycle_start_date,
                status="ACTIVE"
            )
            db.add(new_cycle)
            await db.flush()
            await business_service._update_cycle_totals(db, current_user.id)

    await db.commit()
    return current_user
