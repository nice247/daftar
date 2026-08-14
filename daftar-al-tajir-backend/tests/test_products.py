"""Tests for Products and Stock Supply API endpoints."""
import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_product_success(client: AsyncClient, merchant_auth_headers: dict):
    """Test creating a new inventory product."""
    response = await client.post(
        "/api/v1/products/",
        json={
            "name": "سكر كنانة 10 كيلو",
            "unit": "كيس",
            "default_sale_price": 18000.0
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "سكر كنانة 10 كيلو"
    assert data["unit"] == "كيس"
    assert float(data["default_sale_price"]) == 18000.0
    assert float(data["current_stock"]) == 0.0
    assert "id" in data


@pytest.mark.asyncio
async def test_create_product_missing_name(client: AsyncClient, merchant_auth_headers: dict):
    """Test creating product without name returns 422."""
    response = await client.post(
        "/api/v1/products/",
        json={"unit": "قطعة"},
        headers=merchant_auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_products_list(client: AsyncClient, merchant_auth_headers: dict):
    """Test listing products with stock and profit calculations."""
    # Add product
    await client.post(
        "/api/v1/products/",
        json={"name": "زيت صباح 1 لتر", "unit": "حبة", "default_sale_price": 3500.0},
        headers=merchant_auth_headers
    )

    response = await client.get("/api/v1/products/", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "زيت صباح 1 لتر"


@pytest.mark.asyncio
async def test_supply_stock_success(client: AsyncClient, merchant_auth_headers: dict):
    """Test recording a stock replenishment for a product."""
    prod = await client.post(
        "/api/v1/products/",
        json={"name": "صابون غسيل", "unit": "كرتونة", "default_sale_price": 12000.0},
        headers=merchant_auth_headers
    )
    prod_id = prod.json()["id"]

    supply_res = await client.post(
        "/api/v1/products/supply",
        json={
            "product_id": prod_id,
            "quantity": 50,
            "purchase_price": 9500.0
        },
        headers=merchant_auth_headers
    )
    assert supply_res.status_code == 200
    assert "transaction_id" in supply_res.json()

    # Check updated stock in list
    list_res = await client.get("/api/v1/products/", headers=merchant_auth_headers)
    prods = list_res.json()
    matched = [p for p in prods if p["id"] == prod_id]
    assert len(matched) == 1
    assert float(matched[0]["current_stock"]) == 50.0
    assert float(matched[0]["last_purchase_price"]) == 9500.0
    assert float(matched[0]["profit_per_unit"]) == 2500.0


@pytest.mark.asyncio
async def test_supply_stock_nonexistent_product(client: AsyncClient, merchant_auth_headers: dict):
    """Test supplying stock to nonexistent product returns 404."""
    response = await client.post(
        "/api/v1/products/supply",
        json={
            "product_id": str(uuid.uuid4()),
            "quantity": 10,
            "purchase_price": 5000.0
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 404
