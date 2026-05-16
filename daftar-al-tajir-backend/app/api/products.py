"""Products and Inventory API endpoints (optional feature)."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import User
from app.services.business_service import business_service
from app.api.deps import get_current_user, get_active_user
from app.schemas.schemas import (
    ProductCreate, ProductResponse, StockSupplyRequest, MessageResponse
)

router = APIRouter(prefix="/products", tags=["الأصناف والمخزون"])


@router.post("/", summary="إضافة منتج جديد")
async def create_product(
    request: ProductCreate,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a new product (optional feature for detailed tracking)."""
    product = await business_service.create_product(
        db, current_user.id, request.name, request.unit, request.default_sale_price
    )
    return {
        "id": str(product.id),
        "name": product.name,
        "unit": product.unit,
        "default_sale_price": product.default_sale_price,
        "current_stock": product.current_stock,
        "message": "تم إضافة المنتج بنجاح"
    }


@router.get("/", summary="قائمة المنتجات")
async def get_products(
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all products for the current merchant."""
    products = await business_service.get_products(db, current_user.id)

    result = []
    for p in products:
        # Calculate last purchase price and profit per unit
        last_price = None
        profit = None
        if p.stock_transactions:
            last_txn = sorted(p.stock_transactions, key=lambda t: t.transaction_date, reverse=True)
            if last_txn:
                last_price = last_txn[0].purchase_price
                if last_price and p.default_sale_price:
                    profit = p.default_sale_price - last_price

        result.append({
            "id": str(p.id),
            "name": p.name,
            "unit": p.unit,
            "default_sale_price": p.default_sale_price,
            "current_stock": p.current_stock,
            "last_purchase_price": last_price,
            "profit_per_unit": profit
        })

    return result


@router.post("/supply", summary="توريد مخزون")
async def supply_stock(
    request: StockSupplyRequest,
    current_user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a stock supply with purchase price."""
    transaction = await business_service.supply_stock(
        db, request.product_id, request.quantity, request.purchase_price
    )
    return {
        "message": "تم تسجيل التوريد بنجاح",
        "transaction_id": str(transaction.id)
    }
