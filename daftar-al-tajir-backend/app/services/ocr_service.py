"""OCR Service for reading bank transfer receipts using Tesseract."""
import io
import re
import logging
from decimal import Decimal, InvalidOperation
from typing import Optional
from PIL import Image
import pytesseract
from app.core.config import BANK_ACCOUNT_NUMBER, TESSERACT_LANG
from app.schemas.schemas import OCRResult

logger = logging.getLogger(__name__)


class OCRService:
    """Service to extract bank transfer information from receipt images."""

    def __init__(self):
        self.bank_account = BANK_ACCOUNT_NUMBER
        self.lang = TESSERACT_LANG

    async def extract_from_image(self, image_data: bytes) -> OCRResult:
        """
        Extract bank transfer details from a receipt image.
        Looks for: recipient account number, amount, transaction ID.
        """
        try:
            image = Image.open(io.BytesIO(image_data))

            # Pre-process image for better OCR
            image = self._preprocess_image(image)

            # Run OCR with Arabic+English support
            text = pytesseract.image_to_string(image, lang=self.lang)

            logger.info(f"OCR raw text: {text[:500]}")

            # Extract information
            recipient_number = self._extract_account_number(text)
            amount = self._extract_amount(text)
            transaction_id = self._extract_transaction_id(text)

            success = recipient_number is not None or amount is not None

            return OCRResult(
                success=success,
                recipient_number=recipient_number,
                amount=amount,
                transaction_id=transaction_id,
                raw_text=text,
                error=None if success else "لم يتم التعرف على بيانات كافية في الصورة"
            )

        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            return OCRResult(
                success=False,
                error=f"فشل في قراءة الصورة: {str(e)}"
            )

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Pre-process image to improve OCR accuracy."""
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')

        # Resize if too small
        width, height = image.size
        if width < 1000:
            scale_factor = 1000 / width
            image = image.resize(
                (int(width * scale_factor), int(height * scale_factor)),
                Image.Resampling.LANCZOS
            )

        # Apply threshold for better contrast
        image = image.point(lambda x: 0 if x < 128 else 255, '1')
        image = image.convert('L')

        return image

    def _extract_account_number(self, text: str) -> Optional[str]:
        """Extract bank account number from OCR text."""
        # Look for patterns like account numbers (7-10 digits)
        patterns = [
            r'7712964',  # Exact bank account
            r'(?:account|حساب|رقم\s*الحساب)[:\s]*(\d{7,10})',
            r'(?:إلى|الى|to)[:\s]*(\d{7,10})',
            r'\b(\d{7,10})\b',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                number = match.group(1) if match.lastindex else match.group(0)
                if number == self.bank_account or len(number) >= 7:
                    return number

        return None

    def _extract_amount(self, text: str) -> Optional[Decimal]:
        """Extract monetary amount from OCR text."""
        # Look for patterns indicating amounts
        patterns = [
            r'(?:amount|المبلغ|مبلغ|قيمة|value)[:\s]*([\d,]+\.?\d*)',
            r'(?:SDG|جنيه|ج\.س)[:\s]*([\d,]+\.?\d*)',
            r'([\d,]+\.?\d*)\s*(?:SDG|جنيه|ج\.س)',
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '')
                try:
                    amount = Decimal(amount_str)
                    if amount > 0:
                        return amount
                except InvalidOperation:
                    continue

        return None

    def _extract_transaction_id(self, text: str) -> Optional[str]:
        """Extract transaction/reference ID from OCR text."""
        patterns = [
            r'(?:ref|reference|رقم\s*العملية|رقم\s*المرجع|operation)[:\s#]*(\w+)',
            r'(?:TXN|txn|ID|id)[:\s]*(\w+)',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    def verify_payment(self, ocr_result: OCRResult) -> dict:
        """Verify if the OCR extracted data matches expected payment details."""
        verification = {
            "account_matches": False,
            "amount_found": ocr_result.amount is not None,
            "transaction_found": ocr_result.transaction_id is not None,
            "overall_valid": False,
        }

        if ocr_result.recipient_number:
            verification["account_matches"] = (
                ocr_result.recipient_number == self.bank_account
            )

        verification["overall_valid"] = (
            verification["account_matches"] and verification["amount_found"]
        )

        return verification


ocr_service = OCRService()
