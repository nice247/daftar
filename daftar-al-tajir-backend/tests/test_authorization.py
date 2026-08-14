"""Tests for Authorization, Security, Role Permissions, and Multi-tenancy Isolation."""
import uuid
from datetime import date, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User, Customer
from app.core.security import create_access_token, hash_password


@pytest.mark.asyncio
async def test_unauthorized_access_without_token(client: AsyncClient):
    """Test accessing protected endpoints without authorization header returns 401 or 422."""
    endpoints = [
        ("GET", "/api/v1/users/me"),
        ("GET", "/api/v1/customers/"),
        ("GET", "/api/v1/expenses/"),
        ("GET", "/api/v1/eod/today"),
        ("GET", "/api/v1/merchant-debts/"),
        ("GET", "/api/v1/reports/"),
        ("GET", "/api/v1/backup/export"),
        ("GET", "/api/v1/admin/users"),
    ]
    for method, path in endpoints:
        if method == "GET":
            response = await client.get(path)
        else:
            response = await client.post(path, json={})
        assert response.status_code in (401, 422), f"Failed on {method} {path}"


@pytest.mark.asyncio
async def test_invalid_authorization_header_format(client: AsyncClient):
    """Test header not starting with 'Bearer ' returns 401 with informative error."""
    response = await client.get("/api/v1/users/me", headers={"Authorization": "Basic 123456"})
    assert response.status_code == 401
    assert "Bearer" in response.json()["detail"]


@pytest.mark.asyncio
async def test_forged_jwt_token(client: AsyncClient):
    """Test accessing with forged JWT token signature returns 401."""
    response = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_jwt_token(client: AsyncClient, merchant_user: User):
    """Test accessing with an expired JWT access token returns 401."""
    expired_token = create_access_token(
        data={"sub": str(merchant_user.id), "role": merchant_user.role},
        expires_delta=timedelta(seconds=-10)
    )
    response = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_merchant_forbidden_from_admin_routes(client: AsyncClient, merchant_auth_headers: dict):
    """Test standard merchant is strictly forbidden (403) from admin endpoints."""
    admin_routes = [
        ("GET", "/api/v1/admin/settings"),
        ("GET", "/api/v1/admin/users"),
        ("GET", "/api/v1/admin/stats"),
        ("GET", "/api/v1/subscriptions/pending"),
    ]
    for method, path in admin_routes:
        res = await client.get(path, headers=merchant_auth_headers)
        assert res.status_code == 403, f"Expected 403 on {path}, got {res.status_code}"


@pytest.mark.asyncio
async def test_frozen_user_forbidden_from_active_routes(client: AsyncClient, frozen_auth_headers: dict):
    """Test frozen user cannot access ledger operations."""
    response = await client.get("/api/v1/customers/", headers=frozen_auth_headers)
    assert response.status_code == 403
    assert "غير مفعل" in response.json()["detail"]


@pytest.mark.asyncio
async def test_expired_subscription_forbidden_from_active_routes(client: AsyncClient, expired_auth_headers: dict):
    """Test active user with expired subscription is blocked with 403."""
    response = await client.get("/api/v1/customers/", headers=expired_auth_headers)
    assert response.status_code == 403
    assert "الاشتراك" in response.json()["detail"]


@pytest.mark.asyncio
async def test_tenant_data_isolation(
    client: AsyncClient,
    merchant_auth_headers: dict,
    db_session: AsyncSession
):
    """Test Merchant A cannot access or manipulate Merchant B's customer data."""
    # Create Merchant B
    user_b = User(
        id=uuid.uuid4(),
        phone="0922222222",
        store_name="متجر التاجر ب",
        password_hash=hash_password("Pass1234"),
        status="ACTIVE",
        role="merchant",
        subscription_end_date=date.today() + timedelta(days=30),
    )
    db_session.add(user_b)

    # Create Customer for Merchant B
    cust_b = Customer(
        id=uuid.uuid4(),
        user_id=user_b.id,
        name="عميل التاجر ب",
        phone="0933333333",
        total_debt=0
    )
    db_session.add(cust_b)
    await db_session.commit()

    # Merchant A attempts to access Merchant B's customer -> 404
    get_res = await client.get(f"/api/v1/customers/{cust_b.id}", headers=merchant_auth_headers)
    assert get_res.status_code == 404

    # Merchant A attempts to delete Merchant B's customer -> 404
    del_res = await client.delete(f"/api/v1/customers/{cust_b.id}", headers=merchant_auth_headers)
    assert del_res.status_code == 404


@pytest.mark.asyncio
async def test_sql_injection_safe_search(client: AsyncClient, admin_auth_headers: dict):
    """Test passing SQL injection payloads to search parameter is handled safely."""
    payloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "admin'--",
    ]
    for sqli in payloads:
        res = await client.get(f"/api/v1/admin/users?search={sqli}", headers=admin_auth_headers)
        assert res.status_code == 200
        # No crash and database remains intact


@pytest.mark.asyncio
async def test_xss_payload_in_user_data(client: AsyncClient, merchant_auth_headers: dict):
    """Test storing special characters / script tags is handled as raw text without execution."""
    xss = "<script>alert('xss')</script>"
    res = await client.post(
        "/api/v1/customers/",
        json={"name": xss, "phone": "0919999999"},
        headers=merchant_auth_headers
    )
    assert res.status_code == 200
    assert res.json()["name"] == xss
