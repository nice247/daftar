"""Telegram Bot Service for admin notifications.

The bot is SEND-ONLY — no polling, no receiving messages.
This avoids the 409 Conflict error ("terminated by other getUpdates request")
that occurs when multiple instances run polling simultaneously (e.g., during Render redeploy).

Flow:
1. User requests verification → System generates 4-digit code
2. Code is sent to admin via Telegram (using bot.send_message)
3. Admin forwards code to user via WhatsApp (inline button link)
"""
import asyncio
import logging
from typing import Optional
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.core.config import TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
from app.schemas.schemas import phone_to_whatsapp

logger = logging.getLogger(__name__)


class TelegramService:
    """Service for Telegram bot interactions — send-only, no polling."""

    def __init__(self):
        self.bot = None
        self.admin_chat_id = TELEGRAM_ADMIN_CHAT_ID
        self._initialized = False

    def initialize(self):
        """Initialize the Telegram bot (send-only, no handlers, no polling)."""
        if not TELEGRAM_BOT_TOKEN:
            logger.warning("Telegram bot token not configured. Bot features disabled.")
            return

        try:
            self.bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN, threaded=False)
            
            # Explicitly remove any webhooks just in case
            try:
                self.bot.remove_webhook()
            except Exception as e:
                logger.debug(f"Could not remove webhook (likely none existed): {e}")

            self._initialized = True
            logger.info("Telegram bot initialized (send-only mode, no polling)")
        except Exception as e:
            logger.error(f"Failed to initialize Telegram bot: {e}")

    def _send_sync(self, chat_id: str, text: str, reply_markup=None, parse_mode=None):
        """Synchronous send — called via asyncio.to_thread()."""
        if not self._initialized or not self.bot:
            logger.warning("Bot not initialized, skipping message")
            return
        try:
            self.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode=parse_mode
            )
        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")

    async def _send(self, chat_id: str, text: str, reply_markup=None, parse_mode=None):
        """Async wrapper — runs synchronous send in a thread to avoid blocking the event loop."""
        await asyncio.to_thread(
            self._send_sync, chat_id, text, reply_markup, parse_mode
        )

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

            await self._send(
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
            logger.warning("Bot not initialized, skipping OTP notification")
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

            await self._send(
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

            await self._send(
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

            await self._send(
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

            await self._send(
                chat_id=self.admin_chat_id,
                text=text
            )

        except Exception as e:
            logger.error(f"Failed to send OCR failure notification: {e}")


telegram_service = TelegramService()