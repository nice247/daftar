"""OCR API endpoints."""
import base64
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from app.services.ocr_service import ocr_service
from app.schemas.schemas import OCRResult
from app.models.models import User
from app.api.deps import get_active_user

router = APIRouter(prefix="/ocr", tags=["التعرف الضوئي"])


@router.post("/extract", response_model=OCRResult, summary="استخراج بيانات من صورة إشعار تحويل")
async def extract_receipt_data(
    receipt_image: UploadFile = File(..., description="صورة إشعار التحويل البنكي"),
    current_user: User = Depends(get_active_user)
):
    """
    Extract bank transfer information from a receipt image using OCR.
    Returns: amount, reference_number, date.
    """
    # Validate file type
    if not receipt_image.content_type or not receipt_image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يجب رفع ملف صورة"
        )

    # Read image
    image_data = await receipt_image.read()

    # Check size (max 10MB)
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="حجم الصورة يجب أن يكون أقل من 10 ميجابايت"
        )

    # Process with OCR
    result = await ocr_service.extract_from_image(image_data)
    return result


@router.post("/verify", summary="التحقق من بيانات التحويل")
async def verify_payment(
    receipt_image: UploadFile = File(..., description="صورة إشعار التحويل"),
    current_user: User = Depends(get_active_user)
):
    """Extract and verify bank transfer data from receipt."""
    if not receipt_image.content_type or not receipt_image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يجب رفع ملف صورة"
        )

    image_data = await receipt_image.read()
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="حجم الصورة يجب أن يكون أقل من 10 ميجابايت"
        )

    ocr_result = await ocr_service.extract_from_image(image_data)
    verification = ocr_service.verify_payment(ocr_result)

    return {
        "ocr_result": ocr_result,
        "verification": verification
    }
