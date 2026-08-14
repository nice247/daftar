"""Backup & Restore API Endpoints."""
import json
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_active_user
from app.models.models import User
from app.services.backup_service import backup_service

router = APIRouter(prefix="/backup", tags=["النسخ الاحتياطي والاستعادة"])


@router.get("/export", summary="تصدير نسخة احتياطية كاملة لبيانات التاجر")
async def export_backup(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate and export a complete structured backup of the merchant's data.
    """
    try:
        backup_data = await backup_service.export_user_backup(db, current_user.id)
        filename = f"daftar_backup_{current_user.phone}_{backup_data['exported_at'][:10]}.json"
        
        return JSONResponse(
            content=backup_data,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"فشل في تصدير النسخة الاحتياطية: {str(e)}"
        )


@router.post("/restore", summary="استعادة البيانات من نسخة احتياطية")
async def restore_backup(
    backup_payload: dict,
    replace_mode: bool = Query(
        False,
        description="إذا كان صحيحاً، سيتم استبدال البيانات الحالية بالنسخة الاحتياطية بالكامل"
    ),
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Restore merchant data from an uploaded JSON backup payload.
    """
    try:
        result = await backup_service.restore_user_backup(
            db,
            current_user.id,
            backup_payload,
            replace_mode=replace_mode
        )
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"فشل في استعادة النسخة الاحتياطية: {str(e)}"
        )


@router.post("/restore-file", summary="استعادة البيانات من ملف نسخة احتياطية مرفوع")
async def restore_backup_file(
    file: UploadFile = File(..., description="ملف النسخة الاحتياطية بصيغة JSON"),
    replace_mode: bool = Query(
        False,
        description="إذا كان صحيحاً، سيتم استبدال البيانات الحالية بالنسخة الاحتياطية"
    ),
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Restore merchant data by uploading a JSON backup file.
    """
    try:
        content = await file.read()
        backup_payload = json.loads(content.decode("utf-8"))
        result = await backup_service.restore_user_backup(
            db,
            current_user.id,
            backup_payload,
            replace_mode=replace_mode
        )
        return result
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="الملف المرفوع ليس بصيغة JSON صالحة"
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"فشل في استعادة النسخة الاحتياطية: {str(e)}"
        )


@router.get("/summary", summary="ملخص حجم البيانات القابلة للنسخ الاحتياطي")
async def get_backup_summary(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about merchant data records available for backup.
    """
    try:
        return await backup_service.get_backup_summary(db, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"فشل في جلب ملخص النسخ الاحتياطي: {str(e)}"
        )
