"""Reports API endpoints."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import User
from app.services.business_service import business_service
from app.api.deps import get_current_user, get_active_user
from app.schemas.schemas import ReportResponse

router = APIRouter(prefix="/reports", tags=["التقارير"])


@router.get("/", response_model=ReportResponse, summary="التقارير المالية")
async def get_report(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get financial reports including:
    - Current cycle summary (sales, expenses, net)
    - Comparison with previous cycle
    - Cycle averages
    - Total outstanding debts
    """
    report = await business_service.get_report(db, current_user.id)
    return report
