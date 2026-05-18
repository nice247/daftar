import os
import json
import logging
from decimal import Decimal
import google.generativeai as genai
from app.schemas.schemas import OCRResult

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self):
        pass
        
    async def extract_from_image(self, image_bytes: bytes) -> OCRResult:
        gemini_key = os.getenv("GOOGLE_GEMINI_API_KEY")
        
        if not gemini_key:
            logger.error("Missing Google API key. Ensure GOOGLE_GEMINI_API_KEY is set.")
            return OCRResult(success=False, error="إعدادات الخادم غير مكتملة")

        # ============ Stage 1: Gemini API ============
        try:
            genai.configure(api_key=gemini_key)
            # Using gemini-1.5-flash as requested (can process images + text natively)
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            prompt = """
            أنت مساعد مالي لاستخراج البيانات من صور إشعارات الدفع البنكية أو التحويلات.
            يرجى قراءة الصورة المرفقة واستخراج الحقول التالية فقط:
            - amount: مبلغ التحويل كرقم فقط بدون أي عملة أو فواصل نصية (مثال: 1000.00).
            - reference_number: رقم العملية أو Reference Number أو Transaction ID أو أي رقم مرجعي يميز هذه العملية.
            - date: التاريخ كما هو مكتوب في الإشعار.
            
            ملاحظات هامة:
            - الإشعار قد يكون باللغة العربية أو الإنجليزية.
            - إذا لم تجد أي حقل، ضع قيمته null.
            - يجب أن ترجع النتيجة بصيغة JSON فقط، بدون أي نص إضافي أو شروحات وبدون علامات ` ```json `.
            """
            
            # Construct the multi-modal request
            image_parts = [
                {
                    "mime_type": "image/jpeg", # Gemini accepts standard image mime types. We'll use jpeg as a generic fallback, it reads bytes anyway
                    "data": image_bytes
                }
            ]
            
            gemini_response = model.generate_content([prompt, image_parts[0]])
            gemini_text = gemini_response.text.strip()
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return OCRResult(success=False, error="فشل تحليل بيانات الإشعار")
            
        # ============ Stage 2: Parse JSON ============
        try:
            # Clean markdown if present
            if gemini_text.startswith("```json"):
                gemini_text = gemini_text[7:]
            if gemini_text.startswith("```"):
                gemini_text = gemini_text[3:]
            if gemini_text.endswith("```"):
                gemini_text = gemini_text[:-3]
                
            gemini_text = gemini_text.strip()
            
            parsed_data = json.loads(gemini_text)
            
            amount_val = parsed_data.get("amount")
            amount = None
            if amount_val is not None:
                # remove any commas from the amount string
                amount_str = str(amount_val).replace(",", "").replace(" ", "")
                amount = Decimal(amount_str)
                
            reference_number = parsed_data.get("reference_number")
            date_str = parsed_data.get("date")
            
            return OCRResult(
                success=True,
                amount=amount,
                reference_number=str(reference_number) if reference_number else None,
                date=str(date_str) if date_str else None,
                raw_text=gemini_text
            )
            
        except Exception as e:
            logger.error(f"JSON Parse error: {e}. Raw output: {gemini_text}")
            return OCRResult(success=False, raw_text=gemini_text, error="البيانات المستخرجة غير صالحة")

    def verify_payment(self, ocr_result: OCRResult) -> str:
        """Fallback verifier text."""
        if not ocr_result.success:
            return "فشل التعرف على البيانات"
        return "تم استخراج البيانات، بانتظار المطابقة"

ocr_service = OCRService()
