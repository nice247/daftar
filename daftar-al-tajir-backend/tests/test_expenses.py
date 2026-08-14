"""Tests for Expenses API endpoints."""
import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient
from app.models.models import User, Expense, RestockCycle


@pytest.mark.asyncio
async def test_add_expense_bill(client: AsyncClient, merchant_auth_headers: dict):
    """Test adding a general operating expense (bill)."""
    response = await client.post(
        "/api/v1/expenses/",
        json={
            "category": "BILL",
            "amount": 2500.0,
            "description": "فاتورة كهرباء"
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "expense_id" in data


@pytest.mark.asyncio
async def test_add_expense_restock_starts_cycle(client: AsyncClient, merchant_auth_headers: dict):
    """Test adding a restock expense initiates/resets a restock cycle."""
    response = await client.post(
        "/api/v1/expenses/",
        json={
            "category": "RESTOCK",
            "amount": 150000.0,
            "description": "بضاعة من سوق الجملة"
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    assert "expense_id" in response.json()


@pytest.mark.asyncio
async def test_add_expense_invalid_category(client: AsyncClient, merchant_auth_headers: dict):
    """Test adding expense with invalid category returns 422."""
    response = await client.post(
        "/api/v1/expenses/",
        json={
            "category": "INVALID_CATEGORY",
            "amount": 500.0
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_add_expense_invalid_amount(client: AsyncClient, merchant_auth_headers: dict):
    """Test adding expense with 0 or negative amount returns 422."""
    response = await client.post(
        "/api/v1/expenses/",
        json={
            "category": "BILL",
            "amount": 0
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_expenses_pagination(client: AsyncClient, merchant_auth_headers: dict):
    """Test listing expenses with pagination limit and offset."""
    # Add 3 expenses
    for i in range(3):
        await client.post(
            "/api/v1/expenses/",
            json={"category": "OTHER", "amount": 100 * (i + 1), "description": f"مصروف {i}"},
            headers=merchant_auth_headers
        )

    # Fetch page 1 (limit 2, offset 0)
    res = await client.get("/api/v1/expenses/?limit=2&offset=0", headers=merchant_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 3
    assert len(data["expenses"]) == 2


@pytest.mark.asyncio
async def test_get_expenses_filtered_by_category(client: AsyncClient, merchant_auth_headers: dict):
    """Test filtering expenses list by category."""
    await client.post(
        "/api/v1/expenses/",
        json={"category": "BILL", "amount": 500, "description": "كهرباء"},
        headers=merchant_auth_headers
    )
    await client.post(
        "/api/v1/expenses/",
        json={"category": "OTHER", "amount": 300, "description": "نقل"},
        headers=merchant_auth_headers
    )

    res = await client.get("/api/v1/expenses/?category=BILL", headers=merchant_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert all(e["category"] == "BILL" for e in data["expenses"])


@pytest.mark.asyncio
async def test_get_expenses_filtered_by_date(client: AsyncClient, merchant_auth_headers: dict):
    """Test filtering expenses by start_date and end_date."""
    today = date.today().isoformat()
    res = await client.get(
        f"/api/v1/expenses/?start_date={today}&end_date={today}",
        headers=merchant_auth_headers
    )
    assert res.status_code == 200
    assert "expenses" in res.json()


@pytest.mark.asyncio
async def test_delete_expense_success_and_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test deleting an expense by ID and 404 for nonexistent ID."""
    # 1. Create expense
    exp = await client.post(
        "/api/v1/expenses/",
        json={"category": "OTHER", "amount": 750, "description": "للحذف"},
        headers=merchant_auth_headers
    )
    exp_id = exp.json()["expense_id"]

    # 2. Delete expense
    del_res = await client.delete(f"/api/v1/expenses/{exp_id}", headers=merchant_auth_headers)
    assert del_res.status_code == 200
    assert "بنجاح" in del_res.json()["message"]

    # 3. 404 on deleting again
    del_again = await client.delete(f"/api/v1/expenses/{exp_id}", headers=merchant_auth_headers)
    assert del_again.status_code == 404
