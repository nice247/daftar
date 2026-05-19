import uuid
from datetime import date, datetime
from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, Date, DateTime, Text,
    ForeignKey, CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class User(Base):
    """Users table - merchants and admins."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    store_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    status = Column(
        String(20),
        CheckConstraint("status IN ('ACTIVE','FROZEN','PENDING_VERIFICATION')"),
        default="PENDING_VERIFICATION"
    )
    role = Column(
        String(10),
        CheckConstraint("role IN ('merchant','admin')"),
        default="merchant"
    )
    subscription_end_date = Column(Date, nullable=True)
    restock_cycle_days = Column(Integer, default=7)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships - use lazy="select" (deferred) to avoid loading all data on auth
    subscriptions = relationship("Subscription", back_populates="user", lazy="select")
    customers = relationship("Customer", back_populates="user", lazy="select")
    invoices = relationship("Invoice", back_populates="user", lazy="select")
    expenses = relationship("Expense", back_populates="user", lazy="select")
    debt_payments = relationship("DebtPayment", back_populates="user", lazy="select")
    other_incomes = relationship("OtherIncome", back_populates="user", lazy="select")
    restock_cycles = relationship("RestockCycle", back_populates="user", lazy="select")
    products = relationship("Product", back_populates="user", lazy="select")
    merchant_debts = relationship("MerchantDebt", back_populates="user", lazy="select")

    def is_admin(self) -> bool:
        return self.role == "admin"

    def is_active(self) -> bool:
        return self.status == "ACTIVE"

    def is_subscription_valid(self) -> bool:
        if self.is_admin():
            return True
        if self.subscription_end_date is None:
            return False
        return date.today() <= self.subscription_end_date


class Subscription(Base):
    """Subscriptions table - payment verification via OCR."""
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan = Column(String(20), nullable=True)  # monthly, quarterly, semi-annual
    amount = Column(Numeric(15, 2), nullable=True)
    receipt_image = Column(Text, nullable=True)  # Base64 or file path
    ocr_data = Column(JSONB, nullable=True)  # Extracted OCR data
    ocr_status = Column(
        String(20),
        CheckConstraint("ocr_status IN ('PENDING','SUCCESS','FAILED','MANUAL_REVIEW')"),
        default="PENDING"
    )
    status = Column(
        String(20),
        CheckConstraint("status IN ('PENDING','APPROVED','REJECTED')"),
        default="PENDING"
    )
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="subscriptions")


class Customer(Base):
    """Customers table - merchant's clients."""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    total_debt = Column(Numeric(15, 2), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="customers")
    invoices = relationship("Invoice", back_populates="customer", lazy="select")
    debt_payments = relationship("DebtPayment", back_populates="customer", lazy="select")


class Invoice(Base):
    """Invoices table - sales and debt records."""
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    invoice_type = Column(
        String(20),
        CheckConstraint("invoice_type IN ('EOD_CASH','EOD_BANKAK','DEBT','CASH')"),
        nullable=False
    )
    total_amount = Column(Numeric(15, 2), nullable=False)
    paid_amount = Column(Numeric(15, 2), default=0)
    is_cancelled = Column(Boolean, default=False)
    local_id = Column(String(50), nullable=True)  # For offline sync
    sync_status = Column(
        String(20),
        CheckConstraint("sync_status IN ('PENDING','SYNCED','CONFLICT')"),
        default="PENDING"
    )
    description = Column(Text, nullable=True)
    created_at = Column(Date, server_default=func.current_date())

    user = relationship("User", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    debt_payments = relationship("DebtPayment", back_populates="invoice", lazy="select")


class Expense(Base):
    """Expenses table - daily expenses and restocking."""
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    category = Column(
        String(50),
        CheckConstraint("category IN ('RESTOCK','BILL','OTHER','DEBT_WAIVER')"),
        nullable=False
    )
    amount = Column(Numeric(15, 2), nullable=False)
    description = Column(Text, nullable=True)
    receipt_image = Column(Text, nullable=True)
    starts_new_cycle = Column(Boolean, default=False)
    local_id = Column(String(50), nullable=True)
    sync_status = Column(
        String(20),
        CheckConstraint("sync_status IN ('PENDING','SYNCED','CONFLICT')"),
        default="PENDING"
    )
    created_at = Column(Date, server_default=func.current_date())

    user = relationship("User", back_populates="expenses")


class DebtPayment(Base):
    """Debt payments table - customer debt repayments."""
    __tablename__ = "debt_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    payment_date = Column(Date, server_default=func.current_date())

    user = relationship("User", back_populates="debt_payments")
    customer = relationship("Customer", back_populates="debt_payments")
    invoice = relationship("Invoice", back_populates="debt_payments")


class OtherIncome(Base):
    """Other income table - additional revenue sources."""
    __tablename__ = "other_income"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=True)  # bankak_commission, balance_commission, other
    amount = Column(Numeric(15, 2), nullable=False)
    description = Column(Text, nullable=True)
    local_id = Column(String(50), nullable=True)
    sync_status = Column(
        String(20),
        CheckConstraint("sync_status IN ('PENDING','SYNCED','CONFLICT')"),
        default="PENDING"
    )
    income_date = Column(Date, server_default=func.current_date())

    user = relationship("User", back_populates="other_incomes")


class RestockCycle(Base):
    """Restock cycles table - tracks business cycles."""
    __tablename__ = "restock_cycles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    total_sales = Column(Numeric(15, 2), default=0)
    total_expenses = Column(Numeric(15, 2), default=0)
    net_cashflow = Column(Numeric(15, 2), default=0)
    status = Column(
        String(20),
        CheckConstraint("status IN ('ACTIVE','CLOSED')"),
        default="ACTIVE"
    )

    user = relationship("User", back_populates="restock_cycles")


class Product(Base):
    """Products table (optional) - for merchants who want detailed tracking."""
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    unit = Column(String(20), default="قطعة")
    default_sale_price = Column(Numeric(15, 2), nullable=True)
    current_stock = Column(Numeric(15, 2), default=0)

    user = relationship("User", back_populates="products")
    stock_transactions = relationship("StockTransaction", back_populates="product", lazy="select")


class StockTransaction(Base):
    """Stock transactions table (optional) - supply and purchase records."""
    __tablename__ = "stock_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    purchase_price = Column(Numeric(15, 2), nullable=True)
    transaction_date = Column(Date, server_default=func.current_date())

    product = relationship("Product", back_populates="stock_transactions")


class OTPCode(Base):
    """OTP codes for phone verification and password reset."""
    __tablename__ = "otp_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    is_used = Column(Boolean, default=False)
    purpose = Column(
        String(20),
        CheckConstraint("purpose IN ('registration','password_reset')"),
        default="registration"
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MerchantDebt(Base):
    """Merchant debts table - debts the merchant owes to suppliers."""
    __tablename__ = "merchant_debts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    supplier_name = Column(String(255), nullable=False)  # اسم المورد
    debt_type = Column(
        String(20),
        CheckConstraint("debt_type IN ('cash','bank','goods')"),
        nullable=False
    )  # كاش / بنكك / بضاعة
    total_amount = Column(Numeric(15, 2), nullable=False)
    paid_amount = Column(Numeric(15, 2), default=0)
    status = Column(
        String(20),
        CheckConstraint("status IN ('unpaid','partial','paid')"),
        default="unpaid"
    )  # غير مسدد / جزئي / مسدد
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="merchant_debts")
    payments = relationship("MerchantDebtPayment", back_populates="merchant_debt", lazy="select")


class MerchantDebtPayment(Base):
    """Payments on merchant debts to suppliers."""
    __tablename__ = "merchant_debt_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_debt_id = Column(UUID(as_uuid=True), ForeignKey("merchant_debts.id"), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    payment_method = Column(String(20), default="cash")  # cash / bank
    description = Column(Text, nullable=True)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())

    merchant_debt = relationship("MerchantDebt", back_populates="payments")


class SystemSettings(Base):
    """Global system settings, e.g., subscription prices."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    monthly_price = Column(Numeric(10, 2), default=3000)
    quarterly_price = Column(Numeric(10, 2), default=8000)
    semi_annual_price = Column(Numeric(10, 2), default=15000)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
