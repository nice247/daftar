import os
import json
import logging
import base64
import requests
from decimal import Decimal
import google.generativeai as genai
from app.schemas.schemas import OCRResult

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self):
        pass
        
    async def extract_from_image(self, image_bytes: bytes) -> OCRResult:
        vision_key = os.getenv("GOOGLE_VISION_API_KEY")
        gemini_key = os.getenv("GOOGLE_GEMINI_API_KEY")
        
        if not vision_key or not gemini_key:
            logger.error("Missing Google API keys. Ensure GOOGLE_VISION_API_KEY and GOOGLE_GEMINI_API_KEY are set.")
            return OCRResult(success=False, error="إعدادات الخادم غير مكتملة")

        # ============ Stage 1: Vision API ============
        try:
            base64_image = base64.b64encode(image_bytes).decode("utf-8")
            url = f"https://vision.googleapis.com/v1/images:annotate?key={vision_key}"
            payload = {
                "requests": [
                    {
                        "image": {"content": base64_image},
                        "features": [{"type": "TEXT_DETECTION"}]
                    }
                ]
            }
            
            response = requests.post(url, json=payload)
            response.raise_for_status()
            vision_data = response.json()
            
            responses = vision_data.get("responses", [])
            if not responses or not responses[0].get("fullTextAnnotation"):
                logger.error("Vision API returned empty text or no fullTextAnnotation.")
                return OCRResult(success=False, error="فشل استخراج النص من الصورة")
                
            raw_text = responses[0]["fullTextAnnotation"]["text"]
            
            if not raw_text.strip():
                 return OCRResult(success=False, error="فشل استخراج النص من الصورة")
                 
        except Exception as e:
            logger.error(f"Vision API error: {e}")
            return OCRResult(success=False, error="فشل استخراج النص من الصورة")
            
        # ============ Stage 2: Gemini API ============
        try:
            genai.configure(api_key=gemini_key)
            # Using gemini-1.5-flash as it's the current flash model
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            prompt = f"""
            أنت مساعد لاستخراج البيانات. الإدخال التالي هو نص مستخرج من إشعار دفع بنكي.
            قد يكون الإشعار باللغة العربية أو الإنجليزية.
            قم باستخراج الحقول التالية فقط:
            - amount: مبلغ التحويل كرقم فقط بدون أي عملة أو فواصل نصية (مثال: 1000.00).
            - reference_number: رقم العملية أو Reference Number أو Transaction ID.
            - date: التاريخ كما هو مكتوب في الإشعار.
            
            إذا لم تجد أي حقل، ضع قيمته null.
            يجب أن ترجع النتيجة بصيغة JSON فقط، بدون أي نص إضافي أو شروحات وبدون علامات ` ```json `.
            
            النص المستخرج:
            {raw_text}
            """
            
            gemini_response = model.generate_content(prompt)
            gemini_text = gemini_response.text.strip()
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return OCRResult(success=False, raw_text=raw_text, error="فشل تحليل بيانات الإشعار")
            
        # ============ Stage 3: Parse ============
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
                raw_text=raw_text
            )
            
        except Exception as e:
            logger.error(f"JSON Parse error: {e}. Raw output: {gemini_text}")
            return OCRResult(success=False, raw_text=raw_text, error="البيانات المستخرجة غير صالحة")

    def verify_payment(self, ocr_result: OCRResult) -> str:
        """Fallback verifier text."""
        if not ocr_result.success:
            return "فشل التعرف على البيانات"
        return "تم استخراج البيانات، بانتظار المطابقة"

ocr_service = OCRService()
