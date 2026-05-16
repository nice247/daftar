"""Telegram Bot Service for admin notifications and commands.

The bot serves TWO purposes:
1. Send verification codes to admin for new users (admin forwards via WhatsApp)
2. Admin management notifications and commands
"""
import asyncio
import logging
from datetime import date
from typing import Optional
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.core.config import TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
from app.schemas.schemas import phone_to_whatsapp

logger = logging.getLogger(__name__)


class TelegramService:
    """Service for Telegram bot interactions."""

    def __init__(self):
        self.bot = None
        self.admin_chat_id = TELEGRAM_ADMIN_CHAT_ID
        self._initialized = False

    def initialize(self):
        """Initialize the Telegram bot."""
        if not TELEGRAM_BOT_TOKEN:
            logger.warning("Telegram bot token not configured. Bot features disabled.")
            return

        try:
            self.bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN, threaded=False)
            self._setup_handlers()
            self._initialized = True
            logger.info("Telegram bot initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Telegram bot: {e}")

    def _setup_handlers(self):
        """Set up bot command and message handlers."""

        @self.bot.message_handler(commands=['start'])
        def handle_start(message):
            if str(message.chat.id) == self.admin_chat_id:
                self.bot.reply_to(
                    message,
                    "👋 مرحباً بك في لوحة تحكم دفتر التاجر!\n\n"
                    "الأوامر المتاحة:\n"
                    "/users - عرض قائمة المستخدمين\n"
                    "/pending - عرض الاشتراكات المعلقة\n"
                    "/stats - إحصائيات النظام\n"
                    "/help - المساعدة\n\n"
                    "📩 ستصلتك رموز التحقق هنا تلقائياً\n"
                    "📱 أرسل الرمز للتاجر عبر الواتساب"
                )
            else:
                self.bot.reply_to(message, "عذراً، هذا البوت مخصص للمديرين فقط.")

        @self.bot.message_handler(commands=['help'])
        def handle_help(message):
            if str(message.chat.id) != self.admin_chat_id:
                return
            self.bot.reply_to(
                message,
                "📋 أوامر دفتر التاجر:\n\n"
                "/users - عرض قائمة المستخدمين\n"
                "/pending - عرض الاشتراكات المعلقة\n"
                "/stats - إحصائيات عامة\n"
                "/approve <user_id> - الموافقة على اشتراك\n"
                "/reject <user_id> [سبب] - رفض اشتراك\n"
                "/extend <user_id> <أيام> - تمديد اشتراك\n"
                "/freeze <user_id> - تجميد حساب\n"
                "/activate <user_id> - تنشيط حساب\n\n"
                "📩 عند تسجيل تاجر جديد أو طلب استعادة كلمة مرور:\n"
                "1. يصلك رمز التحقق هنا\n"
                "2. أرسل الرمز للتاجر عبر الواتساب\n"
                "3. التاجر يدخل الرمز في التطبيق"
            )

        @self.bot.message_handler(commands=['users'])
        def handle_users(message):
            if str(message.chat.id) != self.admin_chat_id:
                return
            self.bot.reply_to(
                message,
                "📊 للحصول على قائمة المستخدمين، يرجى استخدام لوحة التحكم على الويب.\n"
                "أو يمكنك البحث برقم الهاتف باستخدام: /search <رقم_الهاتف>"
            )

        @self.bot.message_handler(commands=['pending'])
        def handle_pending(message):
            if str(message.chat.id) != self.admin_chat_id:
                return
            self.bot.reply_to(
                message,
                "⏳ يرجى استخدام لوحة التحكم لعرض الاشتراكات المعلقة.\n"
                "أو انتظر الإشعارات التلقائية عند تسجيل تجار جدد."
            )

        @self.bot.callback_query_handler(func=lambda call: True)
        def handle_callback(call):
            """Handle inline keyboard callbacks."""
            data = call.data
            try:
                if data.startswith("approve_"):
                    user_id = data.replace("approve_", "")
                    self.bot.answer_callback_query(call.id, "تم تسجيل طلب الموافقة")
                    logger.info(f"Admin approved user: {user_id}")

                elif data.startswith("reject_"):
                    user_id = data.replace("reject_", "")
                    self.bot.answer_callback_query(call.id, "تم تسجيل طلب الرفض")
                    logger.info(f"Admin rejected user: {user_id}")

            except Exception as e:
                logger.error(f"Callback handler error: {e}")

    def run_bot(self):
        """Run the bot polling in a separate thread."""
        if self._initialized and self.bot:
            try:
                self.bot.infinity_polling(timeout=10, long_polling_timeout=5)
            except Exception as e:
                logger.error(f"Bot polling error: {e}")

    # ============ Registration Code Notification ============

    async def notify_registration_code(self, phone: str, code: str):
        """
        Send registration verification code to admin via Telegram.
        Admin will forward this code to the user via WhatsApp.
        """
        if not self._initialized:
            logger.warning("Bot not initialized, skipping registration code notification")
            return

        try:
            # Format WhatsApp link (convert 0XXXXXXXXX -> 249XXXXXXXXX)
            wa_phone = phone_to_whatsapp(phone)
            whatsapp_link = f"https://wa.me/{wa_phone}?text=رمز%20التحقق%20من%20دفتر%20التاجر%3A%20{code}"

            text = (
                f"🆕 تسجيل تاجر جديد\n\n"
                f"📱 الهاتف: {phone}\n"
                f"🔢 رمز التحقق: <code>{code}</code>\n\n"
                f"⚠️ أرسل هذا الرمز للتاجر عبر الواتساب\n"
                f"⏰ الرمز صالح لمدة 30 دقيقة\n\n"
                f"📲 اضغط لإرسال عبر واتساب مباشرة:"
            )

            markup = InlineKeyboardMarkup()
            markup.add(
                InlineKeyboardButton(
                    f"📱 إرسال عبر واتساب",
                    url=whatsapp_link
                )
            )

            self.bot.send_message(
                chat_id=self.admin_chat_id,
                text=text,
                reply_markup=markup,
                parse_mode="HTML"
            )

        except Exception as e:
            logger.error(f"Failed to send registration code notification: {e}")

    # ============ Password Reset OTP Notification ============

    async def notify_otp_request(self, phone: str, otp_code: str):
        """
        Send password reset OTP code to admin via Telegram.
        Admin will forward this code to the user via WhatsApp.
        """
        if not self._initialized:
            return

        try:
            wa_phone = phone_to_whatsapp(phone)
            whatsapp_link = f"https://wa.me/{wa_phone}?text=رمز%20استعادة%20كلمة%20المرور%20-%20دفتر%20التاجر%3A%20{otp_code}"

            text = (
                f"🔑 طلب استعادة كلمة مرور\n\n"
                f"📱 الهاتف: {phone}\n"
                f"🔢 رمز التحقق: <code>{otp_code}</code>\n\n"
                f"⚠️ أرسل هذا الرمز للتاجر عبر الواتساب\n"
                f"⏰ الرمز صالح لمدة 15 دقيقة"
            )

            markup = InlineKeyboardMarkup()
            markup.add(
                InlineKeyboardButton(
                    "📱 إرسال عبر واتساب",
                    url=whatsapp_link
                )
            )

            self.bot.send_message(
                chat_id=self.admin_chat_id,
                text=text,
                reply_markup=markup,
                parse_mode="HTML"
            )

        except Exception as e:
            logger.error(f"Failed to send OTP notification: {e}")

    # ============ New Registration Notification ============

    async def notify_new_registration(
        self,
        phone: str,
        store_name: str,
        plan: str,
        user_id: str,
        ocr_status: str = "PENDING"
    ):
        """Notify admin about a completed merchant registration."""
        if not self._initialized:
            logger.warning("Bot not initialized, skipping notification")
            return

        try:
            plan_names = {
                "monthly": "شهري",
                "quarterly": "ربع سنوي",
                "semi_annual": "نصف سنوي"
            }

            text = (
                f"✅ تم تسجيل تاجر جديد بنجاح\n\n"
                f"🏪 المتجر: {store_name}\n"
                f"📱 الهاتف: {phone}\n"
                f"📦 الباقة: {plan_names.get(plan, plan)}\n"
                f"🆔 معرف المستخدم: {user_id}\n\n"
                f"🎉 الشهر الأول مجاني"
            )

            self.bot.send_message(
                chat_id=self.admin_chat_id,
                text=text
            )

        except Exception as e:
            logger.error(f"Failed to send registration notification: {e}")

    async def notify_subscription_expired(self, phone: str, store_name: str):
        """Notify admin about an expired subscription."""
        if not self._initialized:
            return

        try:
            wa_phone = phone_to_whatsapp(phone)
            whatsapp_link = f"https://wa.me/{wa_phone}"

            text = (
                f"⚠️ انتهاء اشتراك\n\n"
                f"📱 الهاتف: {phone}\n"
                f"🏪 المتجر: {store_name}\n\n"
                f"تم تجميد الحساب تلقائياً"
            )

            markup = InlineKeyboardMarkup()
            markup.add(
                InlineKeyboardButton("📱 تواصل عبر واتساب", url=whatsapp_link)
            )

            self.bot.send_message(
                chat_id=self.admin_chat_id,
                text=text,
                reply_markup=markup
            )

        except Exception as e:
            logger.error(f"Failed to send expiration notification: {e}")

    async def notify_ocr_failure(self, phone: str, store_name: str, error: str):
        """Notify admin about OCR processing failure."""
        if not self._initialized:
            return

        try:
            text = (
                f"⚠️ فشل OCR\n\n"
                f"📱 الهاتف: {phone}\n"
                f"🏪 المتجر: {store_name}\n"
                f"❌ الخطأ: {error}\n\n"
                f"يرجى المراجعة اليدوية"
            )

            self.bot.send_message(
                chat_id=self.admin_chat_id,
                text=text
            )

        except Exception as e:
            logger.error(f"Failed to send OCR failure notification: {e}")


telegram_service = TelegramService()
