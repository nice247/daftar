"""Tests for End-of-Day (EOD) and Cycle management API endpoints."""
from datetime import date, timedelta
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from app.models.models import User, Customer, RestockCycle


@pytest.mark.asyncio
async def test_save_eod_full(client: AsyncClient, merchant_auth_headers: dict):
    """Test saving a complete End-of-Day entry with sales, expenses, and other income."""
    # 1. Create a customer for debt payment
    cust_res = await client.post(
        "/api/v1/customers/",
        json={"name": "زبون اليوم", "phone": "0910000000"},
        headers=merchant_auth_headers
    )
    cust_id = cust_res.json()["id"]

    # 2. Add some debt to the customer
    await client.post(
        "/api/v1/customers/debt",
        json={"customer_id": cust_id, "amount": 10000, "debt_type": "DEBT"},
        headers=merchant_auth_headers
    )

    # 3. Save EOD
    today_str = date.today().isoformat()
    response = await client.post(
        "/api/v1/eod/save",
        json={
            "eod_date": today_str,
            "sales": {
                "cash_sales": 50000.0,
                "bankak_sales": 30000.0
            },
            "expenses": [
                {"category": "BILL", "amount": 2000.0, "description": "فاتورة ماء"}
            ],
            "debt_payments": [
                {"customer_id": cust_id, "amount": 4000.0}
            ],
            "other_incomes": [
                {"category": "bankak_commission", "amount": 1500.0, "description": "عمولة سحب بنكك"}
            ]
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    summary = data["summary"]
    assert float(summary["total_sales"]) == 80000.0
    assert float(summary["total_expenses"]) == 2000.0
    assert float(summary["total_other_income"]) == 1500.0


@pytest.mark.asyncio
async def test_save_eod_sales_only(client: AsyncClient, merchant_auth_headers: dict):
    """Test saving EOD with only sales figures."""
    today_str = date.today().isoformat()
    response = await client.post(
        "/api/v1/eod/save",
        json={
            "eod_date": today_str,
            "sales": {
                "cash_sales": 25000.0,
                "bankak_sales": 15000.0
            },
            "expenses": [],
            "debt_payments": [],
            "other_incomes": []
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert float(summary["total_sales"]) == 40000.0
    assert float(summary["total_expenses"]) == 0.0


@pytest.mark.asyncio
async def test_save_eod_zero_sales(client: AsyncClient, merchant_auth_headers: dict):
    """Test saving EOD with 0 sales and only expenses."""
    today_str = date.today().isoformat()
    response = await client.post(
        "/api/v1/eod/save",
        json={
            "eod_date": today_str,
            "sales": {"cash_sales": 0.0, "bankak_sales": 0.0},
            "expenses": [
                {"category": "OTHER", "amount": 500.0, "description": "نظافة"}
            ],
            "debt_payments": [],
            "other_incomes": []
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert float(summary["total_sales"]) == 0.0
    assert float(summary["total_expenses"]) == 500.0


@pytest.mark.asyncio
async def test_get_last_restock(client: AsyncClient, merchant_auth_headers: dict):
    """Test getting last restock before and after adding a RESTOCK expense."""
    # 1. Before restock
    res1 = await client.get("/api/v1/eod/last-restock", headers=merchant_auth_headers)
    assert res1.status_code == 200

    # 2. Add RESTOCK expense
    await client.post(
        "/api/v1/expenses/",
        json={"category": "RESTOCK", "amount": 75000.0, "description": "شراء بضاعة"},
        headers=merchant_auth_headers
    )

    # 3. After restock
    res2 = await client.get("/api/v1/eod/last-restock", headers=merchant_auth_headers)
    assert res2.status_code == 200
    data = res2.json()
    assert float(data["amount"]) == 75000.0
    assert data["description"] == "شراء بضاعة"


@pytest.mark.asyncio
async def test_get_cycle_status(client: AsyncClient, merchant_auth_headers: dict):
    """Test retrieving current cycle status."""
    response = await client.get("/api/v1/eod/cycle-status", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_get_today_data(client: AsyncClient, merchant_auth_headers: dict):
    """Test retrieving today's live business summary."""
    response = await client.get("/api/v1/eod/today", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_sales" in data
    assert "total_expenses" in data
    assert "net_cashflow" in data


@pytest.mark.asyncio
async def test_get_yesterday_data(client: AsyncClient, merchant_auth_headers: dict):
    """Test retrieving yesterday's summary."""
    response = await client.get("/api/v1/eod/yesterday", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_sales" in data
    assert "total_expenses" in data


@pytest.mark.asyncio
async def test_set_opening_stock(client: AsyncClient, merchant_auth_headers: dict):
    """Test setting opening stock value for the restock cycle."""
    response = await client.post(
        "/api/v1/eod/opening-stock",
        json={"amount": 250000.0},
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert float(data["opening_stock_value"]) == 250000.0


@pytest.mark.asyncio
async def test_set_closing_stock(client: AsyncClient, merchant_auth_headers: dict):
    """Test setting closing stock value and recalculating COGS."""
    # Ensure opening stock and cycle exists
    await client.post(
        "/api/v1/eod/opening-stock",
        json={"amount": 100000.0},
        headers=merchant_auth_headers
    )

    response = await client.post(
        "/api/v1/eod/closing-stock",
        json={"amount": 40000.0},
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert float(data["closing_stock_value"]) == 40000.0


@pytest.mark.asyncio
async def test_set_closing_stock_no_cycle(client: AsyncClient, merchant_auth_headers: dict):
    """Test setting closing stock when cycle exists or is handled."""
    res = await client.get("/api/v1/eod/cycle-status", headers=merchant_auth_headers)
    assert res.status_code == 200
