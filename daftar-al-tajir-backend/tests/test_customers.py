"""Tests for Customer and Debt management API endpoints."""
import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Customer, User, Invoice, Expense


@pytest.mark.asyncio
async def test_create_customer_success(client: AsyncClient, merchant_user: User, merchant_auth_headers: dict):
    """Test creating a new customer successfully."""
    response = await client.post(
        "/api/v1/customers/",
        json={"name": "أحمد علي", "phone": "0912345670"},
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "أحمد علي"
    assert data["phone"] == "0912345670"
    assert float(data["total_debt"]) == 0.0
    assert "id" in data


@pytest.mark.asyncio
async def test_create_customer_missing_name(client: AsyncClient, merchant_auth_headers: dict):
    """Test creating customer without name returns 422."""
    response = await client.post(
        "/api/v1/customers/",
        json={"phone": "0912345670"},
        headers=merchant_auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_customers_empty_and_populated(client: AsyncClient, merchant_auth_headers: dict):
    """Test listing customers when empty and after adding customers."""
    # 1. Empty list
    res1 = await client.get("/api/v1/customers/", headers=merchant_auth_headers)
    assert res1.status_code == 200
    assert res1.json() == []

    # 2. Add customer
    await client.post(
        "/api/v1/customers/",
        json={"name": "محمد حسن", "phone": "0911122233"},
        headers=merchant_auth_headers
    )

    # 3. Populated list
    res2 = await client.get("/api/v1/customers/", headers=merchant_auth_headers)
    assert res2.status_code == 200
    data = res2.json()
    assert len(data) == 1
    assert data[0]["name"] == "محمد حسن"


@pytest.mark.asyncio
async def test_get_customer_details_and_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test getting customer details and 404 for nonexistent customer."""
    # 1. 404 for random UUID
    random_id = str(uuid.uuid4())
    res_404 = await client.get(f"/api/v1/customers/{random_id}", headers=merchant_auth_headers)
    assert res_404.status_code == 404

    # 2. Create customer
    create_res = await client.post(
        "/api/v1/customers/",
        json={"name": "طارق محمود", "phone": "0922233344"},
        headers=merchant_auth_headers
    )
    cust_id = create_res.json()["id"]

    # 3. Get customer details
    detail_res = await client.get(f"/api/v1/customers/{cust_id}", headers=merchant_auth_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["name"] == "طارق محمود"
    assert "outstanding_invoices" in detail


@pytest.mark.asyncio
async def test_update_customer(client: AsyncClient, merchant_auth_headers: dict):
    """Test updating customer info."""
    create_res = await client.post(
        "/api/v1/customers/",
        json={"name": "عميل قبل التعديل", "phone": "0933344455"},
        headers=merchant_auth_headers
    )
    cust_id = create_res.json()["id"]

    update_res = await client.put(
        f"/api/v1/customers/{cust_id}",
        json={"name": "عميل بعد التعديل", "phone": "0999988877"},
        headers=merchant_auth_headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "عميل بعد التعديل"
    assert update_res.json()["phone"] == "0999988877"


@pytest.mark.asyncio
async def test_delete_customer_no_debt(client: AsyncClient, merchant_auth_headers: dict):
    """Test deleting customer with zero debt."""
    create_res = await client.post(
        "/api/v1/customers/",
        json={"name": "عميل للحذف", "phone": "0944455566"},
        headers=merchant_auth_headers
    )
    cust_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/customers/{cust_id}", headers=merchant_auth_headers)
    assert del_res.status_code == 200

    # Verify deleted
    get_res = await client.get(f"/api/v1/customers/{cust_id}", headers=merchant_auth_headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_customer_with_active_debt_fails(client: AsyncClient, merchant_auth_headers: dict):
    """Test deleting customer who has outstanding debt fails with 400."""
    create_res = await client.post(
        "/api/v1/customers/",
        json={"name": "عميل عليه دين", "phone": "0955566677"},
        headers=merchant_auth_headers
    )
    cust_id = create_res.json()["id"]

    # Add debt
    await client.post(
        "/api/v1/customers/debt",
        json={"customer_id": cust_id, "amount": 5000, "debt_type": "DEBT", "description": "بضاعة بالدين"},
        headers=merchant_auth_headers
    )

    # Attempt delete
    del_res = await client.delete(f"/api/v1/customers/{cust_id}", headers=merchant_auth_headers)
    assert del_res.status_code == 400
    assert "ديون" in del_res.json()["detail"]


@pytest.mark.asyncio
async def test_add_debt_success(client: AsyncClient, merchant_auth_headers: dict):
    """Test recording a new credit sale (debt)."""
    cust = await client.post(
        "/api/v1/customers/",
        json={"name": "زبون بالدين", "phone": "0966677788"},
        headers=merchant_auth_headers
    )
    cust_id = cust.json()["id"]

    debt_res = await client.post(
        "/api/v1/customers/debt",
        json={"customer_id": cust_id, "amount": 15000, "debt_type": "DEBT", "description": "سكر وزيت"},
        headers=merchant_auth_headers
    )
    assert debt_res.status_code == 200
    data = debt_res.json()
    assert "invoice_id" in data
    assert float(data["customer_debt"]) == 15000.0


@pytest.mark.asyncio
async def test_add_debt_nonexistent_customer(client: AsyncClient, merchant_auth_headers: dict):
    """Test recording debt for non-existent customer returns 404."""
    debt_res = await client.post(
        "/api/v1/customers/debt",
        json={"customer_id": str(uuid.uuid4()), "amount": 5000},
        headers=merchant_auth_headers
    )
    assert debt_res.status_code == 404


@pytest.mark.asyncio
async def test_pay_debt_success_and_overpay(client: AsyncClient, merchant_auth_headers: dict):
    """Test paying debt partially and attempting to overpay."""
    cust = await client.post(
        "/api/v1/customers/",
        json={"name": "زبون للسداد", "phone": "0977788899"},
        headers=merchant_auth_headers
    )
    cust_id = cust.json()["id"]

    # Add 10,000 debt
    await client.post(
        "/api/v1/customers/debt",
        json={"customer_id": cust_id, "amount": 10000, "debt_type": "DEBT"},
        headers=merchant_auth_headers
    )

    # Overpay 15,000 should fail
    overpay_res = await client.post(
        "/api/v1/customers/debt/pay",
        json={"customer_id": cust_id, "amount": 15000},
        headers=merchant_auth_headers
    )
    assert overpay_res.status_code == 400

    # Pay 4,000
    pay_res = await client.post(
        "/api/v1/customers/debt/pay",
        json={"customer_id": cust_id, "amount": 4000},
        headers=merchant_auth_headers
    )
    assert pay_res.status_code == 200
    assert float(pay_res.json()["remaining_debt"]) == 6000.0


@pytest.mark.asyncio
async def test_pay_debt_with_specific_invoice(client: AsyncClient, merchant_auth_headers: dict):
    """Test paying against a specific invoice."""
    cust = await client.post(
        "/api/v1/customers/",
        json={"name": "زبون الفاتورة", "phone": "0988899900"},
        headers=merchant_auth_headers
    )
    cust_id = cust.json()["id"]

    debt_res = await client.post(
        "/api/v1/customers/debt",
        json={"customer_id": cust_id, "amount": 8000, "debt_type": "DEBT"},
        headers=merchant_auth_headers
    )
    inv_id = debt_res.json()["invoice_id"]

    pay_res = await client.post(
        "/api/v1/customers/debt/pay",
        json={"customer_id": cust_id, "amount": 8000, "invoice_id": inv_id},
        headers=merchant_auth_headers
    )
    assert pay_res.status_code == 200
    assert float(pay_res.json()["remaining_debt"]) == 0.0


@pytest.mark.asyncio
async def test_waive_debt_success_and_over_waive(client: AsyncClient, merchant_auth_headers: dict):
    """Test waiving debt creates expense and reduces debt balance."""
    cust = await client.post(
        "/api/v1/customers/",
        json={"name": "زبون الإعفاء", "phone": "0911144477"},
        headers=merchant_auth_headers
    )
    cust_id = cust.json()["id"]

    # Add 5,000 debt
    await client.post(
        "/api/v1/customers/debt",
        json={"customer_id": cust_id, "amount": 5000, "debt_type": "DEBT"},
        headers=merchant_auth_headers
    )

    # Over-waiving 6,000 should fail
    over_waive = await client.post(
        "/api/v1/customers/debt/waive",
        json={"customer_id": cust_id, "amount": 6000, "reason": "خطأ"},
        headers=merchant_auth_headers
    )
    assert over_waive.status_code == 400

    # Waive 2,000
    waive_res = await client.post(
        "/api/v1/customers/debt/waive",
        json={"customer_id": cust_id, "amount": 2000, "reason": "خصم لوجه الله"},
        headers=merchant_auth_headers
    )
    assert waive_res.status_code == 200
    assert float(waive_res.json()["remaining_debt"]) == 3000.0
    assert "expense_id" in waive_res.json()


@pytest.mark.asyncio
async def test_update_customer_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test updating nonexistent customer returns 404."""
    res = await client.put(
        f"/api/v1/customers/{uuid.uuid4()}",
        json={"name": "غير موجود"},
        headers=merchant_auth_headers
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_delete_customer_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test deleting nonexistent customer returns 404."""
    res = await client.delete(
        f"/api/v1/customers/{uuid.uuid4()}",
        headers=merchant_auth_headers
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_pay_debt_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test paying debt for nonexistent customer returns 404."""
    res = await client.post(
        "/api/v1/customers/debt/pay",
        json={"customer_id": str(uuid.uuid4()), "amount": 1000},
        headers=merchant_auth_headers
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_waive_debt_not_found(client: AsyncClient, merchant_auth_headers: dict):
    """Test waiving debt for nonexistent customer returns 404."""
    res = await client.post(
        "/api/v1/customers/debt/waive",
        json={"customer_id": str(uuid.uuid4()), "amount": 1000},
        headers=merchant_auth_headers
    )
    assert res.status_code == 404

