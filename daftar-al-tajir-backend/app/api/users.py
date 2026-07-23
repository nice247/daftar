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
    """Get the current logged-in user's profile."""
    from app.core.config import SUPPORT_PHONE
    user_dict = UserResponse.model_validate(current_user).model_dump()
    user_dict["support_phone"] = SUPPORT_PHONE
    return user_dict


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
    user_dict = UserResponse.model_validate(current_user).model_dump()
    user_dict["support_phone"] = SUPPORT_PHONE
    return user_dict


@router.post("/refresh-token", summary="تجديد التوكن")
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Issue a new JWT token for the current user to extend the session."""
    from datetime import timedelta
    from app.core.security import create_access_token
    from app.core.config import JWT_EXPIRATION_DAYS

    access_token = create_access_token(
        data={"sub": str(current_user.id), "role": current_user.role},
        expires_delta=timedelta(days=JWT_EXPIRATION_DAYS)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": current_user.id,
            "phone": current_user.phone,
            "store_name": current_user.store_name,
            "role": current_user.role,
            "status": current_user.status,
            "subscription_end_date": current_user.subscription_end_date.isoformat() if current_user.subscription_end_date else None,
            "support_phone": SUPPORT_PHONE
        }
    }
