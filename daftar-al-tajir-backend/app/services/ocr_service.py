import os
import re
import json
import logging
from decimal import Decimal
import google.generativeai as genai
from app.schemas.schemas import OCRResult

logger = logging.getLogger(__name__)

def _normalize_arabic_numbers(text: str) -> str:
    """Convert Eastern Arabic and Persian numerals to Western digits."""
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    persian_digits = "۰۱۲۳۴۵۶۷۸۹"
    for i in range(10):
        text = text.replace(arabic_digits[i], str(i)).replace(persian_digits[i], str(i))
    return text

class OCRService:
    def __init__(self):
        pass

    async def extract_from_image(self, image_bytes: bytes) -> OCRResult:
        gemini_key = os.getenv("GOOGLE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")

        if not gemini_key:
            logger.error("Missing Google Gemini API key. Ensure GOOGLE_GEMINI_API_KEY is set.")
            return OCRResult(success=False, error="مفتاح الذكاء الاصطناعي (Gemini API) غير متوفر في الخادم")

        # ============ Stage 1: Gemini API ============
        genai.configure(api_key=gemini_key)
        
        # Supported Google free-tier vision models in order of priority
        supported_models = [
            'gemini-1.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-pro'
        ]

        prompt = """
        أنت محلل مالي ذكي متخصص في استخراج البيانات من إشعارات التحويلات البنكية (مثل بنكك Bankak، فوري Fawry، أو غيرها).
        يرجى قراءة الصورة المرفقة واستخراج الحقول التالية بدقة بصيغة JSON:
        {
          "amount": 10000.00,
          "reference_number": "123456789",
          "date": "2024-08-14",
          "sender_name": "اسم المحول إن وجد",
          "recipient_account": "رقم الحساب المحول إليه إن وجد"
        }

        قواعد هامة:
        1. amount: قيمة المبلغ كرقم إنجليزي فقط بدون فواصل وبدون كلمة SDG أو ج.س.
        2. reference_number: ابحث عن (رقم العملية، الرقم المرجعي، Transaction ID، Ref No، Trx ID). استخرج الأرقام فقط.
        3. date: تاريخ العملية بصيغة YYYY-MM-DD أو بالشكل الواضح في الإشعار.
        4. أرجع JSON فقط بدون أي علامات markdown إضافية أو شروحات.
        """

        image_part = {
            "mime_type": "image/jpeg",
            "data": image_bytes
        }

        gemini_text = None
        last_error = None

        for model_name in supported_models:
            try:
                model = genai.GenerativeModel(model_name)
                gemini_response = model.generate_content(
                    [prompt, image_part],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=800,
                    )
                )
                if gemini_response and gemini_response.text:
                    gemini_text = gemini_response.text.strip()
                    logger.info(f"Successfully processed image using model: {model_name}")
                    break
            except Exception as e:
                logger.warning(f"Failed with model {model_name}: {e}")
                last_error = e

        if not gemini_text:
            logger.error(f"All Gemini models failed: {last_error}")
            return OCRResult(success=False, error="فشل في قراءة الإشعار، تأكد من وضوح الصورة وصلاحية مفتاح Gemini API")

        # ============ Stage 2: Parse JSON / Regex Extract ============
        try:
            # Clean markdown formatting
            cleaned = gemini_text
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = _normalize_arabic_numbers(cleaned.strip())

            # Attempt JSON parse
            parsed_data = {}
            try:
                parsed_data = json.loads(cleaned)
            except Exception:
                # Try regex extract if JSON block had trailing text
                json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
                if json_match:
                    parsed_data = json.loads(json_match.group(0))

            amount_val = parsed_data.get("amount")
            amount = None
            if amount_val is not None:
                amount_str = re.sub(r'[^\d.]', '', str(amount_val))
                if amount_str:
                    amount = Decimal(amount_str)

            reference_number = parsed_data.get("reference_number")
            if reference_number:
                ref_str = re.sub(r'[^\d]', '', str(reference_number))
                if ref_str:
                    reference_number = ref_str

            date_str = parsed_data.get("date")

            return OCRResult(
                success=True,
                amount=amount,
                reference_number=str(reference_number) if reference_number else None,
                date=str(date_str) if date_str else None,
                raw_text=gemini_text
            )

        except Exception as e:
            logger.error(f"JSON Parse error: {e}. Raw text: {gemini_text}")
            return OCRResult(success=False, raw_text=gemini_text, error="تمت قراءة الصورة ولكن لم نتمكن من مطابقة الحقول")

    def verify_payment(self, ocr_result: OCRResult) -> str:
        """Helper to format status text."""
        if not ocr_result.success:
            return "فشل التعرف على البيانات"
        return "تم استخراج البيانات، بانتظار مراجعة الإدارة"

ocr_service = OCRService()
