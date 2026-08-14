"""Tests for Financial Reports API endpoints."""
from datetime import date
from decimal import Decimal
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_financial_report_with_data(client: AsyncClient, merchant_auth_headers: dict):
    """Test generating financial report when merchant has sales and expenses."""
    # 1. Add EOD sales
    today_str = date.today().isoformat()
    await client.post(
        "/api/v1/eod/save",
        json={
            "eod_date": today_str,
            "sales": {"cash_sales": 100000.0, "bankak_sales": 50000.0},
            "expenses": [
                {"category": "RESTOCK", "amount": 60000.0, "description": "بضاعة"},
                {"category": "BILL", "amount": 5000.0, "description": "كهرباء"}
            ],
            "debt_payments": [],
            "other_incomes": []
        },
        headers=merchant_auth_headers
    )

    # 2. Get report
    response = await client.get("/api/v1/reports/", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "current_cycle" in data
    assert "total_debts_outstanding" in data
    cycle = data["current_cycle"]
    assert float(cycle["total_sales"]) >= 150000.0


@pytest.mark.asyncio
async def test_get_financial_report_empty(client: AsyncClient, merchant_auth_headers: dict):
    """Test generating financial report for a new merchant with no transactions."""
    response = await client.get("/api/v1/reports/", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "current_cycle" in data
    assert "total_debts_outstanding" in data
    assert float(data["total_debts_outstanding"]) == 0.0
