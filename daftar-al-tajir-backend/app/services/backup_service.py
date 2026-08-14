"""Backup and Restore Service for Merchant Data."""
import hashlib
import json
import logging
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    User, Customer, Invoice, Expense, DebtPayment,
    OtherIncome, RestockCycle, Product, StockTransaction,
    MerchantDebt, MerchantDebtPayment
)

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder for Decimals, Dates, Datetimes, and UUIDs."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)


class BackupService:
    """Service to handle complete merchant data export and atomic restore."""

    @staticmethod
    async def export_user_backup(db: AsyncSession, user_id: UUID) -> Dict[str, Any]:
        """Export all data belonging to the merchant into a portable structured backup."""
        # 1. Fetch User
        u_res = await db.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            raise ValueError("المستخدم غير موجود")

        # 2. Customers
        c_res = await db.execute(select(Customer).where(Customer.user_id == user_id))
        customers = c_res.scalars().all()

        # 3. Invoices
        inv_res = await db.execute(select(Invoice).where(Invoice.user_id == user_id))
        invoices = inv_res.scalars().all()

        # 4. Debt Payments
        dp_res = await db.execute(select(DebtPayment).where(DebtPayment.user_id == user_id))
        debt_payments = dp_res.scalars().all()

        # 5. Expenses
        exp_res = await db.execute(select(Expense).where(Expense.user_id == user_id))
        expenses = exp_res.scalars().all()

        # 6. Merchant Debts
        md_res = await db.execute(select(MerchantDebt).where(MerchantDebt.user_id == user_id))
        merchant_debts = md_res.scalars().all()
        md_ids = [d.id for d in merchant_debts]

        # 7. Merchant Debt Payments
        mdp_list = []
        if md_ids:
            mdp_res = await db.execute(
                select(MerchantDebtPayment).where(MerchantDebtPayment.merchant_debt_id.in_(md_ids))
            )
            mdp_list = mdp_res.scalars().all()

        # 8. Other Income
        oi_res = await db.execute(select(OtherIncome).where(OtherIncome.user_id == user_id))
        other_incomes = oi_res.scalars().all()

        # 9. Restock Cycles
        rc_res = await db.execute(select(RestockCycle).where(RestockCycle.user_id == user_id))
        restock_cycles = rc_res.scalars().all()

        # 10. Products & Stock Transactions
        prod_res = await db.execute(select(Product).where(Product.user_id == user_id))
        products = prod_res.scalars().all()
        prod_ids = [p.id for p in products]

        st_list = []
        if prod_ids:
            st_res = await db.execute(
                select(StockTransaction).where(StockTransaction.product_id.in_(prod_ids))
            )
            st_list = st_res.scalars().all()

        # Build clean JSON structures
        backup_payload: Dict[str, Any] = {
            "schema_version": "2.0",
            "app_name": "دفتر التاجر",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "user_info": {
                "store_name": user.store_name,
                "phone": user.phone,
                "email": user.email,
                "restock_cycle_days": user.restock_cycle_days,
            },
            "customers": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "phone": c.phone,
                    "total_debt": float(c.total_debt or 0),
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in customers
            ],
            "invoices": [
                {
                    "id": str(i.id),
                    "customer_id": str(i.customer_id) if i.customer_id else None,
                    "invoice_type": i.invoice_type,
                    "total_amount": float(i.total_amount),
                    "paid_amount": float(i.paid_amount or 0),
                    "is_cancelled": i.is_cancelled,
                    "description": i.description,
                    "created_at": i.created_at.isoformat() if i.created_at else None,
                }
                for i in invoices
            ],
            "debt_payments": [
                {
                    "id": str(dp.id),
                    "customer_id": str(dp.customer_id),
                    "invoice_id": str(dp.invoice_id) if dp.invoice_id else None,
                    "amount": float(dp.amount),
                    "payment_date": dp.payment_date.isoformat() if dp.payment_date else None,
                }
                for dp in debt_payments
            ],
            "expenses": [
                {
                    "id": str(e.id),
                    "category": e.category,
                    "amount": float(e.amount),
                    "description": e.description,
                    "starts_new_cycle": e.starts_new_cycle,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in expenses
            ],
            "merchant_debts": [
                {
                    "id": str(d.id),
                    "supplier_name": d.supplier_name,
                    "debt_type": d.debt_type,
                    "total_amount": float(d.total_amount),
                    "paid_amount": float(d.paid_amount or 0),
                    "status": d.status,
                    "description": d.description,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in merchant_debts
            ],
            "merchant_debt_payments": [
                {
                    "id": str(mdp.id),
                    "merchant_debt_id": str(mdp.merchant_debt_id),
                    "amount": float(mdp.amount),
                    "payment_method": mdp.payment_method,
                    "payment_date": mdp.payment_date.isoformat() if mdp.payment_date else None,
                }
                for mdp in mdp_list
            ],
            "other_incomes": [
                {
                    "id": str(oi.id),
                    "category": oi.category,
                    "amount": float(oi.amount),
                    "description": oi.description,
                    "income_date": oi.income_date.isoformat() if oi.income_date else None,
                }
                for oi in other_incomes
            ],
            "restock_cycles": [
                {
                    "id": str(rc.id),
                    "start_date": rc.start_date.isoformat() if rc.start_date else None,
                    "end_date": rc.end_date.isoformat() if rc.end_date else None,
                    "total_sales": float(rc.total_sales or 0),
                    "total_expenses": float(rc.total_expenses or 0),
                    "net_cashflow": float(rc.net_cashflow or 0),
                    "status": rc.status,
                }
                for rc in restock_cycles
            ],
            "products": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "unit": p.unit,
                    "default_sale_price": float(p.default_sale_price) if p.default_sale_price else None,
                    "current_stock": float(p.current_stock or 0),
                }
                for p in products
            ],
            "stock_transactions": [
                {
                    "id": str(st.id),
                    "product_id": str(st.product_id),
                    "quantity": float(st.quantity),
                    "purchase_price": float(st.purchase_price) if st.purchase_price else None,
                    "transaction_date": st.transaction_date.isoformat() if st.transaction_date else None,
                }
                for st in st_list
            ],
            "stats": {
                "customers_count": len(customers),
                "invoices_count": len(invoices),
                "expenses_count": len(expenses),
                "merchant_debts_count": len(merchant_debts),
                "products_count": len(products),
            }
        }

        # Calculate Checksum
        encoded_str = json.dumps(backup_payload, cls=DecimalEncoder, sort_keys=True)
        checksum = hashlib.sha256(encoded_str.encode('utf-8')).hexdigest()
        backup_payload["checksum"] = checksum

        return backup_payload

    @staticmethod
    async def restore_user_backup(
        db: AsyncSession,
        user_id: UUID,
        backup_data: Dict[str, Any],
        replace_mode: bool = False
    ) -> Dict[str, Any]:
        """
        Restore merchant data from backup atomically.
        If replace_mode is True, replaces existing user data.
        If replace_mode is False, merges missing records.
        """
        if not isinstance(backup_data, dict):
            raise ValueError("صيغة النسخة الاحتياطية غير صالحة")

        # Basic schema verification
        if "customers" not in backup_data and "expenses" not in backup_data:
            raise ValueError("الملف لا يحتوي على بيانات دفتر التاجر")

        # Map old IDs from backup to new/existing UUIDs in current DB
        customer_id_map: Dict[str, UUID] = {}
        merchant_debt_id_map: Dict[str, UUID] = {}
        product_id_map: Dict[str, UUID] = {}

        if replace_mode:
            # Clean up user's existing records in reverse dependency order
            await db.execute(delete(DebtPayment).where(DebtPayment.user_id == user_id))
            await db.execute(delete(Invoice).where(Invoice.user_id == user_id))
            await db.execute(delete(Customer).where(Customer.user_id == user_id))
            await db.execute(delete(Expense).where(Expense.user_id == user_id))
            await db.execute(delete(OtherIncome).where(OtherIncome.user_id == user_id))
            await db.execute(delete(RestockCycle).where(RestockCycle.user_id == user_id))

            # Delete Merchant Debt Payments and Debts
            md_res = await db.execute(select(MerchantDebt.id).where(MerchantDebt.user_id == user_id))
            existing_md_ids = md_res.scalars().all()
            if existing_md_ids:
                await db.execute(
                    delete(MerchantDebtPayment).where(MerchantDebtPayment.merchant_debt_id.in_(existing_md_ids))
                )
            await db.execute(delete(MerchantDebt).where(MerchantDebt.user_id == user_id))

            # Delete Products and Transactions
            prod_res = await db.execute(select(Product.id).where(Product.user_id == user_id))
            existing_prod_ids = prod_res.scalars().all()
            if existing_prod_ids:
                await db.execute(
                    delete(StockTransaction).where(StockTransaction.product_id.in_(existing_prod_ids))
                )
            await db.execute(delete(Product).where(Product.user_id == user_id))
            await db.flush()

        # 1. Restore Customers
        restored_customers = 0
        for c in backup_data.get("customers", []):
            old_id = c.get("id")
            new_id = uuid4()
            customer = Customer(
                id=new_id,
                user_id=user_id,
                name=c.get("name", "عميل"),
                phone=c.get("phone"),
                total_debt=Decimal(str(c.get("total_debt", 0))),
            )
            db.add(customer)
            if old_id:
                customer_id_map[str(old_id)] = new_id
            restored_customers += 1

        await db.flush()

        # 2. Restore Invoices
        restored_invoices = 0
        for inv in backup_data.get("invoices", []):
            old_cust_id = inv.get("customer_id")
            resolved_cust_id = customer_id_map.get(str(old_cust_id)) if old_cust_id else None

            invoice = Invoice(
                id=uuid4(),
                user_id=user_id,
                customer_id=resolved_cust_id,
                invoice_type=inv.get("invoice_type", "DEBT"),
                total_amount=Decimal(str(inv.get("total_amount", 0))),
                paid_amount=Decimal(str(inv.get("paid_amount", 0))),
                is_cancelled=bool(inv.get("is_cancelled", False)),
                description=inv.get("description"),
            )
            db.add(invoice)
            restored_invoices += 1

        # 3. Restore Debt Payments
        restored_payments = 0
        for dp in backup_data.get("debt_payments", []):
            old_cust_id = dp.get("customer_id")
            resolved_cust_id = customer_id_map.get(str(old_cust_id)) if old_cust_id else None
            if resolved_cust_id:
                debt_payment = DebtPayment(
                    id=uuid4(),
                    user_id=user_id,
                    customer_id=resolved_cust_id,
                    amount=Decimal(str(dp.get("amount", 0))),
                )
                db.add(debt_payment)
                restored_payments += 1

        # 4. Restore Expenses
        restored_expenses = 0
        for exp in backup_data.get("expenses", []):
            expense = Expense(
                id=uuid4(),
                user_id=user_id,
                category=exp.get("category", "OTHER"),
                amount=Decimal(str(exp.get("amount", 0))),
                description=exp.get("description"),
                starts_new_cycle=bool(exp.get("starts_new_cycle", False)),
            )
            db.add(expense)
            restored_expenses += 1

        # 5. Restore Merchant Debts
        restored_merchant_debts = 0
        for md in backup_data.get("merchant_debts", []):
            old_md_id = md.get("id")
            new_md_id = uuid4()
            m_debt = MerchantDebt(
                id=new_md_id,
                user_id=user_id,
                supplier_name=md.get("supplier_name", "مورد"),
                debt_type=md.get("debt_type", "goods"),
                total_amount=Decimal(str(md.get("total_amount", 0))),
                paid_amount=Decimal(str(md.get("paid_amount", 0))),
                status=md.get("status", "unpaid"),
                description=md.get("description"),
            )
            db.add(m_debt)
            if old_md_id:
                merchant_debt_id_map[str(old_md_id)] = new_md_id
            restored_merchant_debts += 1

        await db.flush()

        # 6. Restore Merchant Debt Payments
        for mdp in backup_data.get("merchant_debt_payments", []):
            old_md_id = mdp.get("merchant_debt_id")
            resolved_md_id = merchant_debt_id_map.get(str(old_md_id)) if old_md_id else None
            if resolved_md_id:
                payment = MerchantDebtPayment(
                    id=uuid4(),
                    merchant_debt_id=resolved_md_id,
                    amount=Decimal(str(mdp.get("amount", 0))),
                    payment_method=mdp.get("payment_method", "cash"),
                )
                db.add(payment)

        # 7. Restore Other Incomes
        for oi in backup_data.get("other_incomes", []):
            income = OtherIncome(
                id=uuid4(),
                user_id=user_id,
                category=oi.get("category", "other"),
                amount=Decimal(str(oi.get("amount", 0))),
                description=oi.get("description"),
            )
            db.add(income)

        # 8. Restore Products
        restored_products = 0
        for p in backup_data.get("products", []):
            old_p_id = p.get("id")
            new_p_id = uuid4()
            prod = Product(
                id=new_p_id,
                user_id=user_id,
                name=p.get("name", "منتج"),
                unit=p.get("unit", "قطعة"),
                default_sale_price=Decimal(str(p["default_sale_price"])) if p.get("default_sale_price") else None,
                current_stock=Decimal(str(p.get("current_stock", 0))),
            )
            db.add(prod)
            if old_p_id:
                product_id_map[str(old_p_id)] = new_p_id
            restored_products += 1

        await db.flush()

        # 9. Restore Stock Transactions
        for st in backup_data.get("stock_transactions", []):
            old_p_id = st.get("product_id")
            resolved_p_id = product_id_map.get(str(old_p_id)) if old_p_id else None
            if resolved_p_id:
                trans = StockTransaction(
                    id=uuid4(),
                    product_id=resolved_p_id,
                    quantity=Decimal(str(st.get("quantity", 0))),
                    purchase_price=Decimal(str(st["purchase_price"])) if st.get("purchase_price") else None,
                )
                db.add(trans)

        await db.commit()

        return {
            "message": "تمت استعادة النسخة الاحتياطية بنجاح",
            "restored_summary": {
                "customers": restored_customers,
                "invoices": restored_invoices,
                "expenses": restored_expenses,
                "debt_payments": restored_payments,
                "merchant_debts": restored_merchant_debts,
                "products": restored_products,
            }
        }

    @staticmethod
    async def get_backup_summary(db: AsyncSession, user_id: UUID) -> Dict[str, Any]:
        """Quick summary of merchant records available for backup."""
        c_count = (await db.execute(select(Customer.id).where(Customer.user_id == user_id))).scalars().all()
        inv_count = (await db.execute(select(Invoice.id).where(Invoice.user_id == user_id))).scalars().all()
        exp_count = (await db.execute(select(Expense.id).where(Expense.user_id == user_id))).scalars().all()
        md_count = (await db.execute(select(MerchantDebt.id).where(MerchantDebt.user_id == user_id))).scalars().all()
        p_count = (await db.execute(select(Product.id).where(Product.user_id == user_id))).scalars().all()

        total_records = len(c_count) + len(inv_count) + len(exp_count) + len(md_count) + len(p_count)

        return {
            "total_records": total_records,
            "customers_count": len(c_count),
            "invoices_count": len(inv_count),
            "expenses_count": len(exp_count),
            "merchant_debts_count": len(md_count),
            "products_count": len(p_count),
            "estimated_size_kb": max(1, round(total_records * 0.4, 2)),
            "last_checked": datetime.now(timezone.utc).isoformat(),
        }


backup_service = BackupService()
