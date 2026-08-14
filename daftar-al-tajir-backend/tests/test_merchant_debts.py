"""Tests for Merchant Debts (Supplier Debts) API endpoints."""
import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_merchant_debt_success(client: AsyncClient, merchant_auth_headers: dict):
    """Test creating a new merchant debt owed to a supplier."""
    response = await client.post(
        "/api/v1/merchant-debts/",
        json={
            "supplier_name": "شركة سكر كنانة",
            "debt_type": "goods",
            "total_amount": 500000.0,
            "description": "شراء 50 شوال سكر بالأجل"
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "debt_id" in data


@pytest.mark.asyncio
async def test_create_merchant_debt_invalid_type(client: AsyncClient, merchant_auth_headers: dict):
    """Test creating debt with invalid debt_type returns 422."""
    response = await client.post(
        "/api/v1/merchant-debts/",
        json={
            "supplier_name": "مورد",
            "debt_type": "invalid_type",
            "total_amount": 5000.0
        },
        headers=merchant_auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_merchant_debts_and_filter(client: AsyncClient, merchant_auth_headers: dict):
    """Test listing merchant debts with status filter."""
    # Create debt 1
    await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد 1", "debt_type": "cash", "total_amount": 10000.0},
        headers=merchant_auth_headers
    )
    # Create debt 2
    await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد 2", "debt_type": "bank", "total_amount": 20000.0},
        headers=merchant_auth_headers
    )

    # List all
    all_res = await client.get("/api/v1/merchant-debts/", headers=merchant_auth_headers)
    assert all_res.status_code == 200
    assert len(all_res.json()) == 2

    # Filter unpaid
    unpaid_res = await client.get("/api/v1/merchant-debts/?status_filter=unpaid", headers=merchant_auth_headers)
    assert unpaid_res.status_code == 200
    assert len(unpaid_res.json()) == 2


@pytest.mark.asyncio
async def test_pay_merchant_debt_partial_and_overpay(client: AsyncClient, merchant_auth_headers: dict):
    """Test paying part of debt and attempting to pay more than total."""
    create_res = await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد الحبوب", "debt_type": "goods", "total_amount": 100000.0},
        headers=merchant_auth_headers
    )
    debt_id = create_res.json()["debt_id"]

    # Overpay 120,000 should fail with 400
    overpay_res = await client.post(
        "/api/v1/merchant-debts/pay",
        json={"merchant_debt_id": debt_id, "amount": 120000.0},
        headers=merchant_auth_headers
    )
    assert overpay_res.status_code == 400

    # Pay 40,000
    pay_res = await client.post(
        "/api/v1/merchant-debts/pay",
        json={"merchant_debt_id": debt_id, "amount": 40000.0, "payment_method": "cash"},
        headers=merchant_auth_headers
    )
    assert pay_res.status_code == 200
    data = pay_res.json()
    assert float(data["remaining"]) == 60000.0
    assert data["status"] == "partial"


@pytest.mark.asyncio
async def test_pay_merchant_debt_full(client: AsyncClient, merchant_auth_headers: dict):
    """Test paying full merchant debt changes status to paid."""
    create_res = await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد الألبان", "debt_type": "bank", "total_amount": 30000.0},
        headers=merchant_auth_headers
    )
    debt_id = create_res.json()["debt_id"]

    pay_res = await client.post(
        "/api/v1/merchant-debts/pay",
        json={"merchant_debt_id": debt_id, "amount": 30000.0, "payment_method": "bank"},
        headers=merchant_auth_headers
    )
    assert pay_res.status_code == 200
    data = pay_res.json()
    assert float(data["remaining"]) == 0.0
    assert data["status"] == "paid"


@pytest.mark.asyncio
async def test_get_merchant_debt_payments(client: AsyncClient, merchant_auth_headers: dict):
    """Test retrieving payments list for a specific debt."""
    create_res = await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد المشروبات", "debt_type": "cash", "total_amount": 50000.0},
        headers=merchant_auth_headers
    )
    debt_id = create_res.json()["debt_id"]

    # Make a payment
    await client.post(
        "/api/v1/merchant-debts/pay",
        json={"merchant_debt_id": debt_id, "amount": 20000.0},
        headers=merchant_auth_headers
    )

    payments_res = await client.get(f"/api/v1/merchant-debts/{debt_id}/payments", headers=merchant_auth_headers)
    assert payments_res.status_code == 200
    data = payments_res.json()
    assert "debt" in data
    assert "payments" in data
    assert len(data["payments"]) == 1


@pytest.mark.asyncio
async def test_get_merchant_debt_payments_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test retrieving payments for nonexistent debt returns 404."""
    res = await client.get(f"/api/v1/merchant-debts/{uuid.uuid4()}/payments", headers=merchant_auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_delete_merchant_debt_success_and_blocked(client: AsyncClient, merchant_auth_headers: dict):
    """Test deleting debt with 0 payments succeeds, but fails if payments exist."""
    # 1. Debt without payments
    res1 = await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد للحذف", "debt_type": "goods", "total_amount": 10000.0},
        headers=merchant_auth_headers
    )
    debt1_id = res1.json()["debt_id"]

    del_res = await client.delete(f"/api/v1/merchant-debts/{debt1_id}", headers=merchant_auth_headers)
    assert del_res.status_code == 200

    # 2. Debt with payments
    res2 = await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد لا يحذف", "debt_type": "goods", "total_amount": 20000.0},
        headers=merchant_auth_headers
    )
    debt2_id = res2.json()["debt_id"]
    await client.post(
        "/api/v1/merchant-debts/pay",
        json={"merchant_debt_id": debt2_id, "amount": 5000.0},
        headers=merchant_auth_headers
    )

    del_blocked = await client.delete(f"/api/v1/merchant-debts/{debt2_id}", headers=merchant_auth_headers)
    assert del_blocked.status_code == 400


@pytest.mark.asyncio
async def test_delete_merchant_debt_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test deleting nonexistent merchant debt returns 404."""
    res = await client.delete(f"/api/v1/merchant-debts/{uuid.uuid4()}", headers=merchant_auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_merchant_debts_summary(client: AsyncClient, merchant_auth_headers: dict):
    """Test merchant debts summary statistics."""
    # Add an unpaid debt
    await client.post(
        "/api/v1/merchant-debts/",
        json={"supplier_name": "مورد الإحصاء 1", "debt_type": "cash", "total_amount": 70000.0},
        headers=merchant_auth_headers
    )

    summary_res = await client.get("/api/v1/merchant-debts/summary", headers=merchant_auth_headers)
    assert summary_res.status_code == 200
    data = summary_res.json()
    assert float(data["total_outstanding"]) == 70000.0
    assert data["unpaid_count"] >= 1
