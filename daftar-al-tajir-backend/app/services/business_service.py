"""Business logic service for End-of-Day, customers, debts, expenses, reports."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.models import (
    User, Customer, Invoice, Expense, DebtPayment,
    OtherIncome, RestockCycle, Product, StockTransaction
)
from app.schemas.schemas import (
    EODRequest, EODSummary, EODResponse, CycleSummary, CycleComparison, ReportResponse
)


class BusinessService:
    """Core business logic service for the merchant ledger system."""

    # ============ End-of-Day Operations ============

    @staticmethod
    async def save_eod(db: AsyncSession, user_id: UUID, eod: EODRequest) -> EODResponse:
        """Save all end-of-day data atomically."""
        total_sales = eod.sales.cash_sales + eod.sales.bankak_sales
        total_expenses = sum(e.amount for e in eod.expenses)
        total_other_income = sum(oi.amount for oi in eod.other_incomes)

        # Calculate net new debts (from debt invoices created today)
        net_new_debts = Decimal(0)

        # 1. Save cash sales invoice
        if eod.sales.cash_sales > 0:
            cash_invoice = Invoice(
                user_id=user_id,
                invoice_type="EOD_CASH",
                total_amount=eod.sales.cash_sales,
                paid_amount=eod.sales.cash_sales,
                created_at=eod.eod_date
            )
            db.add(cash_invoice)

        # 2. Save bankak sales invoice
        if eod.sales.bankak_sales > 0:
            bankak_invoice = Invoice(
                user_id=user_id,
                invoice_type="EOD_BANKAK",
                total_amount=eod.sales.bankak_sales,
                paid_amount=eod.sales.bankak_sales,
                created_at=eod.eod_date
            )
            db.add(bankak_invoice)

        # 3. Save expenses
        for exp in eod.expenses:
            starts_new = exp.category == "RESTOCK"
            expense = Expense(
                user_id=user_id,
                category=exp.category,
                amount=exp.amount,
                description=exp.description,
                receipt_image=exp.receipt_image,
                starts_new_cycle=starts_new,
                created_at=eod.eod_date
            )
            db.add(expense)

            # If restock, start a new cycle
            if starts_new:
                await BusinessService._start_new_cycle(db, user_id, eod.eod_date)

        # 4. Save debt payments
        for dp in eod.debt_payments:
            payment = DebtPayment(
                user_id=user_id,
                customer_id=dp.customer_id,
                invoice_id=dp.invoice_id,
                amount=dp.amount,
                payment_date=eod.eod_date
            )
            db.add(payment)

            # Update customer total debt
            result = await db.execute(
                select(Customer).where(Customer.id == dp.customer_id)
            )
            customer = result.scalar_one_or_none()
            if customer:
                customer.total_debt -= dp.amount
                if customer.total_debt < 0:
                    customer.total_debt = Decimal(0)

            # Update invoice paid amount
            if dp.invoice_id:
                inv_result = await db.execute(
                    select(Invoice).where(Invoice.id == dp.invoice_id)
                )
                invoice = inv_result.scalar_one_or_none()
                if invoice:
                    invoice.paid_amount += dp.amount

        # 5. Save other incomes
        for oi in eod.other_incomes:
            income = OtherIncome(
                user_id=user_id,
                category=oi.category,
                amount=oi.amount,
                description=oi.description,
                income_date=eod.eod_date
            )
            db.add(income)

        # 6. Update current cycle totals
        await BusinessService._update_cycle_totals(db, user_id)

        # Calculate net cashflow
        net_cashflow = total_sales - total_expenses - net_new_debts + total_other_income

        summary = EODSummary(
            total_sales=total_sales,
            total_expenses=total_expenses,
            net_new_debts=net_new_debts,
            total_other_income=total_other_income,
            net_cashflow=net_cashflow
        )

        return EODResponse(
            message="تم حفظ إغلاق اليوم بنجاح",
            summary=summary
        )

    # ============ Customer Management ============

    @staticmethod
    async def create_customer(
        db: AsyncSession, user_id: UUID, name: str, phone: Optional[str] = None
    ) -> Customer:
        """Create a new customer for the merchant."""
        customer = Customer(
            user_id=user_id,
            name=name,
            phone=phone,
            total_debt=Decimal(0)
        )
        db.add(customer)
        await db.flush()
        return customer

    @staticmethod
    async def get_customers(db: AsyncSession, user_id: UUID) -> List[Customer]:
        """Get all customers for a merchant."""
        result = await db.execute(
            select(Customer)
            .where(Customer.user_id == user_id)
            .order_by(Customer.name)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_customer(db: AsyncSession, customer_id: UUID, user_id: UUID) -> Optional[Customer]:
        """Get a specific customer."""
        result = await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    # ============ Debt Management ============

    @staticmethod
    async def add_debt(
        db: AsyncSession,
        user_id: UUID,
        customer_id: UUID,
        amount: Decimal,
        debt_type: str = "DEBT",
        description: Optional[str] = None
    ) -> Invoice:
        """Add a debt (credit sale) for a customer."""
        # Create debt invoice
        invoice = Invoice(
            user_id=user_id,
            customer_id=customer_id,
            invoice_type=debt_type,  # DEBT or CASH
            total_amount=amount,
            paid_amount=Decimal(0),
            description=description
        )
        db.add(invoice)

        # Update customer total debt
        result = await db.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            customer.total_debt += amount

        await db.flush()

        # Update current cycle totals since new debt doesn't add to cash immediately
        # But we want to ensure any changes trigger a cycle update
        await BusinessService._update_cycle_totals(db, user_id)

        return invoice

    @staticmethod
    async def pay_debt(
        db: AsyncSession,
        user_id: UUID,
        customer_id: UUID,
        amount: Decimal,
        invoice_id: Optional[UUID] = None
    ) -> DebtPayment:
        """Record a debt payment from a customer."""
        # If no specific invoice, distribute to oldest outstanding debts
        if not invoice_id:
            result = await db.execute(
                select(Invoice).where(
                    Invoice.user_id == user_id,
                    Invoice.customer_id == customer_id,
                    Invoice.invoice_type.in_(["DEBT", "CASH"]),
                    Invoice.is_cancelled == False,
                    Invoice.paid_amount < Invoice.total_amount
                ).order_by(Invoice.created_at)
            )
            outstanding = list(result.scalars().all())

            remaining = amount
            for inv in outstanding:
                owed = inv.total_amount - inv.paid_amount
                if remaining <= 0:
                    break
                payment_amount = min(remaining, owed)
                inv.paid_amount += payment_amount
                remaining -= payment_amount
                if remaining <= 0:
                    invoice_id = inv.id
                    break

        payment = DebtPayment(
            user_id=user_id,
            customer_id=customer_id,
            invoice_id=invoice_id,
            amount=amount
        )
        db.add(payment)

        # Update customer total debt
        result = await db.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            customer.total_debt -= amount
            if customer.total_debt < 0:
                customer.total_debt = Decimal(0)

        await db.flush()

        # Update cycle totals because debt payment is REVENUE
        await BusinessService._update_cycle_totals(db, user_id)

        return payment

    @staticmethod
    async def waive_debt(
        db: AsyncSession,
        user_id: UUID,
        customer_id: UUID,
        amount: Decimal,
        reason: Optional[str] = None
    ) -> Expense:
        """Waive (forgive) a debt - recorded as an expense."""
        # Create debt waiver expense
        expense = Expense(
            user_id=user_id,
            category="DEBT_WAIVER",
            amount=amount,
            description=f"إعفاء دين - {reason or 'بدون سبب'}"
        )
        db.add(expense)

        # Update customer total debt
        result = await db.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            customer.total_debt -= amount
            if customer.total_debt < 0:
                customer.total_debt = Decimal(0)

        await db.flush()

        # Update cycle totals because waiver is EXPENSE
        await BusinessService._update_cycle_totals(db, user_id)

        return expense

    # ============ Expense Management ============

    @staticmethod
    async def get_expenses(
        db: AsyncSession,
        user_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        category: Optional[str] = None
    ) -> List[Expense]:
        """Get expenses for a merchant with optional filters."""
        query = select(Expense).where(Expense.user_id == user_id)

        if start_date:
            query = query.where(Expense.created_at >= start_date)
        if end_date:
            query = query.where(Expense.created_at <= end_date)
        if category:
            query = query.where(Expense.category == category)

        query = query.order_by(Expense.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_last_restock(db: AsyncSession, user_id: UUID) -> Optional[Expense]:
        """Get the last restock expense (for 'last purchase' card)."""
        result = await db.execute(
            select(Expense).where(
                Expense.user_id == user_id,
                Expense.category == "RESTOCK"
            ).order_by(Expense.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    # ============ Cycle Management ============

    @staticmethod
    async def _start_new_cycle(db: AsyncSession, user_id: UUID, start_date: date):
        """Close current cycle and start a new one."""
        # Close current active cycle
        result = await db.execute(
            select(RestockCycle).where(
                RestockCycle.user_id == user_id,
                RestockCycle.status == "ACTIVE"
            )
        )
        current_cycle = result.scalar_one_or_none()

        if current_cycle:
            current_cycle.status = "CLOSED"
            current_cycle.end_date = start_date
            # Update totals
            await BusinessService._calculate_cycle_totals(db, current_cycle)

        # Start new cycle
        new_cycle = RestockCycle(
            user_id=user_id,
            start_date=start_date,
            status="ACTIVE"
        )
        db.add(new_cycle)
        await db.flush()

    @staticmethod
    async def _calculate_cycle_totals(db: AsyncSession, cycle: RestockCycle):
        """Calculate and update cycle totals."""
        # Base Sales (EOD Cash + Bankak)
        sales_result = await db.execute(
            select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
                Invoice.user_id == cycle.user_id,
                Invoice.created_at >= cycle.start_date,
                Invoice.created_at <= (cycle.end_date or date.max),
                Invoice.is_cancelled == False,
                Invoice.invoice_type.in_(["EOD_CASH", "EOD_BANKAK"])
            )
        )
        base_sales = sales_result.scalar() or Decimal(0)

        # Debt Payments (Revenue)
        payments_result = await db.execute(
            select(func.coalesce(func.sum(DebtPayment.amount), 0)).where(
                DebtPayment.user_id == cycle.user_id,
                DebtPayment.payment_date >= cycle.start_date,
                DebtPayment.payment_date <= (cycle.end_date or date.max)
            )
        )
        debt_payments = payments_result.scalar() or Decimal(0)

        # Other Incomes (Revenue)
        incomes_result = await db.execute(
            select(func.coalesce(func.sum(OtherIncome.amount), 0)).where(
                OtherIncome.user_id == cycle.user_id,
                OtherIncome.income_date >= cycle.start_date,
                OtherIncome.income_date <= (cycle.end_date or date.max)
            )
        )
        other_incomes = incomes_result.scalar() or Decimal(0)

        # Total Sales / Revenues
        cycle.total_sales = base_sales + debt_payments + other_incomes

        # Expenses (includes DEBT_WAIVER automatically since it's an Expense)
        expenses_result = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.user_id == cycle.user_id,
                Expense.created_at >= cycle.start_date,
                Expense.created_at <= (cycle.end_date or date.max)
            )
        )
        cycle.total_expenses = expenses_result.scalar() or Decimal(0)

        # Net Profit
        cycle.net_cashflow = cycle.total_sales - cycle.total_expenses

    @staticmethod
    async def _update_cycle_totals(db: AsyncSession, user_id: UUID):
        """Update the current active cycle totals."""
        result = await db.execute(
            select(RestockCycle).where(
                RestockCycle.user_id == user_id,
                RestockCycle.status == "ACTIVE"
            )
        )
        cycle = result.scalar_one_or_none()

        if cycle:
            await BusinessService._calculate_cycle_totals(db, cycle)

    @staticmethod
    async def get_current_cycle(db: AsyncSession, user_id: UUID) -> Optional[RestockCycle]:
        """Get the current active cycle for a merchant."""
        result = await db.execute(
            select(RestockCycle).where(
                RestockCycle.user_id == user_id,
                RestockCycle.status == "ACTIVE"
            ).order_by(RestockCycle.start_date.desc())
        )
        return result.scalar_one_or_none()

    # ============ Reports ============

    @staticmethod
    async def get_report(db: AsyncSession, user_id: UUID) -> ReportResponse:
        """Generate financial report for the merchant."""
        # Current cycle
        current = await BusinessService.get_current_cycle(db, user_id)

        if not current:
            # Create default cycle if none exists
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            start = user.created_at.date() if user else date.today()
            current = RestockCycle(
                user_id=user_id,
                start_date=start,
                status="ACTIVE",
                total_sales=Decimal(0),
                total_expenses=Decimal(0),
                net_cashflow=Decimal(0)
            )
            db.add(current)
            await db.flush()
            await BusinessService._calculate_cycle_totals(db, current)

        current_summary = CycleSummary(
            cycle_id=current.id,
            start_date=current.start_date,
            end_date=current.end_date,
            total_sales=current.total_sales,
            total_expenses=current.total_expenses,
            net_cashflow=current.net_cashflow,
            total_debts_outstanding=Decimal(0)
        )

        # Total debts outstanding
        debts_result = await db.execute(
            select(func.coalesce(func.sum(Customer.total_debt), 0)).where(
                Customer.user_id == user_id
            )
        )
        total_debts = debts_result.scalar() or Decimal(0)
        current_summary.total_debts_outstanding = total_debts

        # Previous cycle
        prev_result = await db.execute(
            select(RestockCycle).where(
                RestockCycle.user_id == user_id,
                RestockCycle.status == "CLOSED"
            ).order_by(RestockCycle.end_date.desc()).limit(1)
        )
        prev_cycle = prev_result.scalar_one_or_none()

        previous_summary = None
        if prev_cycle:
            previous_summary = CycleSummary(
                cycle_id=prev_cycle.id,
                start_date=prev_cycle.start_date,
                end_date=prev_cycle.end_date,
                total_sales=prev_cycle.total_sales,
                total_expenses=prev_cycle.total_expenses,
                net_cashflow=prev_cycle.net_cashflow,
                total_debts_outstanding=Decimal(0)
            )

        # Average calculations
        avg_result = await db.execute(
            select(
                func.avg(RestockCycle.total_sales),
                func.avg(RestockCycle.total_expenses)
            ).where(
                RestockCycle.user_id == user_id,
                RestockCycle.status == "CLOSED"
            )
        )
        avg_row = avg_result.one()
        avg_sales = Decimal(str(avg_row[0] or 0))
        avg_expenses = Decimal(str(avg_row[1] or 0))

        comparison = None
        if previous_summary:
            comparison = CycleComparison(
                current_cycle=current_summary,
                previous_cycle=previous_summary,
                average_sales=avg_sales,
                average_expenses=avg_expenses
            )

        return ReportResponse(
            current_cycle=current_summary,
            comparison=comparison,
            total_debts_outstanding=total_debts
        )

    # ============ Product Management (Optional) ============

    @staticmethod
    async def create_product(
        db: AsyncSession,
        user_id: UUID,
        name: str,
        unit: str = "قطعة",
        default_sale_price: Optional[Decimal] = None
    ) -> Product:
        """Create a new product."""
        product = Product(
            user_id=user_id,
            name=name,
            unit=unit,
            default_sale_price=default_sale_price
        )
        db.add(product)
        await db.flush()
        return product

    @staticmethod
    async def get_products(db: AsyncSession, user_id: UUID) -> List[Product]:
        """Get all products for a merchant."""
        result = await db.execute(
            select(Product).where(Product.user_id == user_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def supply_stock(
        db: AsyncSession,
        product_id: UUID,
        quantity: Decimal,
        purchase_price: Optional[Decimal] = None
    ) -> StockTransaction:
        """Record a stock supply (restock)."""
        transaction = StockTransaction(
            product_id=product_id,
            quantity=quantity,
            purchase_price=purchase_price
        )
        db.add(transaction)

        # Update product stock
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()
        if product:
            product.current_stock += quantity

        await db.flush()
        return transaction

    # ============ Today's Summary ============

    @staticmethod
    async def get_today_summary(db: AsyncSession, user_id: UUID) -> dict:
        """Get all of today's transactions (persists until midnight)."""
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
        today_end = datetime.combine(date.today(), datetime.max.time()).replace(tzinfo=timezone.utc)

        # Today's cash sales
        cash_result = await db.execute(
            select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
                Invoice.user_id == user_id,
                Invoice.invoice_type == "EOD_CASH",
                Invoice.created_at >= today_start,
                Invoice.created_at <= today_end,
            )
        )
        cash_sales = cash_result.scalar() or Decimal(0)

        # Today's bankak sales
        bankak_result = await db.execute(
            select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
                Invoice.user_id == user_id,
                Invoice.invoice_type == "EOD_BANKAK",
                Invoice.created_at >= today_start,
                Invoice.created_at <= today_end,
            )
        )
        bankak_sales = bankak_result.scalar() or Decimal(0)

        # Today's expenses
        expenses_result = await db.execute(
            select(Expense).where(
                Expense.user_id == user_id,
                Expense.created_at >= today_start,
                Expense.created_at <= today_end,
            ).order_by(Expense.created_at)
        )
        expenses = [
            {
                "category": e.category,
                "amount": e.amount,
                "description": e.description,
            }
            for e in expenses_result.scalars().all()
        ]
        total_expenses = sum(e["amount"] for e in expenses)

        # Today's debt payments received
        debt_pay_result = await db.execute(
            select(func.coalesce(func.sum(DebtPayment.amount), 0)).where(
                DebtPayment.user_id == user_id,
                DebtPayment.payment_date >= today_start,
                DebtPayment.payment_date <= today_end,
            )
        )
        total_debt_payments = debt_pay_result.scalar() or Decimal(0)

        # Today's other income
        other_result = await db.execute(
            select(func.coalesce(func.sum(OtherIncome.amount), 0)).where(
                OtherIncome.user_id == user_id,
                OtherIncome.income_date >= today_start.date(),
                OtherIncome.income_date <= today_end.date(),
            )
        )
        total_other_income = other_result.scalar() or Decimal(0)

        total_sales = cash_sales + bankak_sales
        net = total_sales + total_debt_payments + total_other_income - total_expenses

        return {
            "date": str(date.today()),
            "cash_sales": cash_sales,
            "bankak_sales": bankak_sales,
            "total_sales": total_sales,
            "expenses": expenses,
            "total_expenses": total_expenses,
            "total_debt_payments": total_debt_payments,
            "total_other_income": total_other_income,
            "net": net,
            "has_data": total_sales > 0 or total_expenses > 0 or total_debt_payments > 0 or total_other_income > 0,
        }


business_service = BusinessService()