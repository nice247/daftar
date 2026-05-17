from datetime import date, datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
import re


# ============ Phone Validation ============

SUDAN_COUNTRY_CODE = "249"

def validate_sudan_phone(v: str) -> str:
    """Validate and normalize a Sudan phone number.
    User enters local format: 0XXXXXXXXX (10 digits starting with 0)
    System stores local format: 0XXXXXXXXX
    WhatsApp links use international: 249XXXXXXXXX
    """
    # Remove spaces and dashes
    cleaned = v.replace(" ", "").replace("-", "").replace("+", "")
    
    # Accept local format: 0XXXXXXXXX (10 digits)
    if cleaned.startswith("0") and len(cleaned) == 10 and cleaned[1:].isdigit():
        return cleaned
    
    # Also accept international format: 249XXXXXXXXX
    if cleaned.startswith(SUDAN_COUNTRY_CODE) and len(cleaned) == 12 and cleaned[3:].isdigit():
        # Convert to local: 249902642768 -> 0902642768
        return "0" + cleaned[3:]
    
    raise ValueError("رقم الهاتف يجب أن يكون 10 أرقام تبدأ بـ 0 (مثال: 0902642768)")


def phone_to_whatsapp(phone: str) -> str:
    """Convert local phone (0XXXXXXXXX) to WhatsApp international format (249XXXXXXXXX)."""
    cleaned = phone.replace(" ", "").replace("-", "").replace("+", "")
    if cleaned.startswith("0"):
        return SUDAN_COUNTRY_CODE + cleaned[1:]
    if cleaned.startswith(SUDAN_COUNTRY_CODE):
        return cleaned
    return SUDAN_COUNTRY_CODE + cleaned


# ============ Auth Schemas ============

class PhoneVerificationRequest(BaseModel):
    """Step 1: User enters phone number to get verification code."""
    phone: str = Field(..., min_length=10, max_length=13, description="رقم الهاتف (10 أرقام تبدأ بـ 0)")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        return validate_sudan_phone(v)


class PhoneVerificationConfirm(BaseModel):
    """Step 2: User enters the verification code received via WhatsApp."""
    phone: str = Field(..., description="رقم الواتساب")
    code: str = Field(..., min_length=4, max_length=6, description="رمز التحقق")


class RegisterRequest(BaseModel):
    """Step 3: After phone verified, user completes registration."""
    phone: str = Field(..., min_length=10, max_length=13, description="رقم الهاتف (10 أرقام تبدأ بـ 0)")
    store_name: str = Field(..., min_length=1, max_length=255, description="اسم المتجر")
    email: Optional[str] = Field(None, description="البريد الإلكتروني")
    password: str = Field(..., min_length=6, description="كلمة المرور")
    verification_code: str = Field(..., description="رمز التحقق من الواتساب")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        return validate_sudan_phone(v)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("كلمة المرور يجب أن تكون 6 خانات على الأقل")
        if not re.search(r'[A-Za-z]', v) or not re.search(r'\d', v):
            raise ValueError("كلمة المرور يجب أن تحتوي على حروف وأرقام")
        return v


class LoginRequest(BaseModel):
    phone: str = Field(..., description="رقم الهاتف")
    password: str = Field(..., description="كلمة المرور")


class TokenUser(BaseModel):
    id: UUID
    phone: str
    store_name: str
    role: str
    status: str
    subscription_end_date: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: TokenUser


class OTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=13, description="رقم الهاتف (10 أرقام تبدأ بـ 0)")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        return validate_sudan_phone(v)


class OTPVerifyRequest(BaseModel):
    phone: str = Field(..., description="رقم الهاتف")
    code: str = Field(..., min_length=4, max_length=6, description="رمز التحقق")


class ResetPasswordRequest(BaseModel):
    phone: str = Field(..., description="رقم الهاتف")
    code: str = Field(..., min_length=4, max_length=6, description="رمز التحقق")
    new_password: str = Field(..., min_length=6, description="كلمة المرور الجديدة")


# ============ User Schemas ============

class UserResponse(BaseModel):
    id: UUID
    phone: str
    store_name: str
    email: Optional[str]
    status: str
    role: str
    subscription_end_date: Optional[date]
    restock_cycle_days: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    store_name: Optional[str] = None
    email: Optional[str] = None
    restock_cycle_days: Optional[int] = Field(None, ge=1, le=365)
    cycle_start_date: Optional[date] = None


# ============ Subscription Schemas ============

class SubscriptionResponse(BaseModel):
    id: UUID
    user_id: UUID
    amount: Optional[Decimal]
    ocr_status: str
    status: str
    rejection_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionReviewRequest(BaseModel):
    subscription_id: UUID
    action: str = Field(..., description="approve or reject")
    rejection_reason: Optional[str] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v):
        if v not in ("approve", "reject"):
            raise ValueError("الإجراء يجب أن يكون approve أو reject")
        return v


# ============ End-of-Day Schemas ============

class EODSales(BaseModel):
    cash_sales: Decimal = Field(0, description="المبيعات النقدية")
    bankak_sales: Decimal = Field(0, description="مبيعات بنكك")


class ExpenseItem(BaseModel):
    category: str = Field(..., description="RESTOCK, BILL, OTHER, DEBT_WAIVER")
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None
    receipt_image: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v not in ("RESTOCK", "BILL", "OTHER", "DEBT_WAIVER"):
            raise ValueError("فئة غير صالحة")
        return v


class DebtPaymentItem(BaseModel):
    customer_id: UUID
    amount: Decimal = Field(..., gt=0)
    invoice_id: Optional[UUID] = None


class OtherIncomeItem(BaseModel):
    category: str = Field(..., description="bankak_commission, balance_commission, other")
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None


class EODRequest(BaseModel):
    eod_date: date = Field(..., description="تاريخ اليوم")
    sales: EODSales
    expenses: List[ExpenseItem] = []
    debt_payments: List[DebtPaymentItem] = []
    other_incomes: List[OtherIncomeItem] = []


class EODSummary(BaseModel):
    total_sales: Decimal
    total_expenses: Decimal
    net_new_debts: Decimal
    total_other_income: Decimal
    net_cashflow: Decimal


class EODResponse(BaseModel):
    message: str
    summary: EODSummary


# ============ Customer Schemas ============

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="اسم العميل")
    phone: Optional[str] = Field(None, max_length=20, description="هاتف العميل")


class CustomerResponse(BaseModel):
    id: UUID
    name: str
    phone: Optional[str]
    total_debt: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerWithDebtResponse(CustomerResponse):
    outstanding_invoices: List["InvoiceResponse"] = []


# ============ Invoice Schemas ============

class InvoiceCreate(BaseModel):
    customer_id: Optional[UUID] = None
    invoice_type: str = Field(..., description="EOD_CASH, EOD_BANKAK, DEBT, CASH")
    total_amount: Decimal = Field(..., gt=0)
    paid_amount: Decimal = Field(0)
    description: Optional[str] = None
    local_id: Optional[str] = None

    @field_validator("invoice_type")
    @classmethod
    def validate_type(cls, v):
        if v not in ("EOD_CASH", "EOD_BANKAK", "DEBT", "CASH"):
            raise ValueError("نوع فاتورة غير صالح")
        return v


class InvoiceResponse(BaseModel):
    id: UUID
    customer_id: Optional[UUID]
    invoice_type: str
    total_amount: Decimal
    paid_amount: Decimal
    is_cancelled: bool
    created_at: date
    description: Optional[str]

    model_config = {"from_attributes": True}


# ============ Debt Schemas ============

class DebtCreate(BaseModel):
    customer_id: UUID
    amount: Decimal = Field(..., gt=0)
    debt_type: str = Field("DEBT", description="DEBT for cash debt, CASH for bankak debt")
    description: Optional[str] = None


class DebtPaymentCreate(BaseModel):
    customer_id: UUID
    amount: Decimal = Field(..., gt=0)
    invoice_id: Optional[UUID] = None


class DebtWaiverRequest(BaseModel):
    customer_id: UUID
    amount: Decimal = Field(..., gt=0)
    invoice_id: Optional[UUID] = None
    reason: Optional[str] = None


# ============ Report Schemas ============

class CycleSummary(BaseModel):
    cycle_id: Optional[UUID]
    start_date: Optional[date]
    end_date: Optional[date]
    total_sales: Decimal
    total_expenses: Decimal
    net_cashflow: Decimal
    total_debts_outstanding: Decimal


class CycleComparison(BaseModel):
    current_cycle: CycleSummary
    previous_cycle: Optional[CycleSummary]
    average_sales: Decimal
    average_expenses: Decimal


class ReportResponse(BaseModel):
    current_cycle: CycleSummary
    comparison: Optional[CycleComparison]
    total_debts_outstanding: Decimal


# ============ Product Schemas ============

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    unit: str = Field("قطعة")
    default_sale_price: Optional[Decimal] = None


class ProductResponse(BaseModel):
    id: UUID
    name: str
    unit: str
    default_sale_price: Optional[Decimal]
    current_stock: Decimal
    last_purchase_price: Optional[Decimal] = None
    profit_per_unit: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class StockSupplyRequest(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(..., gt=0)
    purchase_price: Optional[Decimal] = None


# ============ Admin Schemas ============

class AdminUserListResponse(BaseModel):
    id: UUID
    phone: str
    store_name: str
    status: str
    role: str
    subscription_end_date: Optional[date]
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminExtendSubscription(BaseModel):
    user_id: UUID
    days: int = Field(..., gt=0, description="عدد الأيام للتمديد")


class AdminToggleUser(BaseModel):
    user_id: UUID
    action: str = Field(..., description="activate or freeze")


class AdminAddUser(BaseModel):
    phone: str
    store_name: str
    password: str = Field(..., min_length=6)
    role: str = Field("merchant", description="admin or merchant")
    subscription_days: int = 30


# ============ OCR Schema ============

class OCRResult(BaseModel):
    success: bool
    recipient_number: Optional[str] = None
    amount: Optional[Decimal] = None
    transaction_id: Optional[str] = None
    raw_text: Optional[str] = None
    error: Optional[str] = None


# ============ Message Schemas ============

class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None