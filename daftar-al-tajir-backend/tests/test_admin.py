"""Tests for Admin dashboard and management API endpoints."""
import uuid
from decimal import Decimal
from datetime import date, timedelta
import pytest
from httpx import AsyncClient
from app.models.models import User, SystemSettings


@pytest.mark.asyncio
async def test_get_system_settings_admin(client: AsyncClient, admin_auth_headers: dict):
    """Test admin fetching system settings."""
    response = await client.get("/api/v1/admin/settings", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "monthly_price" in data
    assert "quarterly_price" in data
    assert "semi_annual_price" in data


@pytest.mark.asyncio
async def test_get_system_settings_forbidden_for_merchant(client: AsyncClient, merchant_auth_headers: dict):
    """Test regular merchant is forbidden from admin settings."""
    response = await client.get("/api/v1/admin/settings", headers=merchant_auth_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_system_settings(client: AsyncClient, admin_auth_headers: dict):
    """Test admin updating system prices."""
    response = await client.put(
        "/api/v1/admin/settings",
        json={
            "monthly_price": 5000.0,
            "quarterly_price": 13500.0,
            "semi_annual_price": 25000.0
        },
        headers=admin_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert float(data["monthly_price"]) == 5000.0
    assert float(data["quarterly_price"]) == 13500.0


@pytest.mark.asyncio
async def test_admin_list_users(client: AsyncClient, admin_auth_headers: dict, merchant_user: User):
    """Test admin listing all users."""
    response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 2  # admin + merchant


@pytest.mark.asyncio
async def test_admin_search_users_by_phone(client: AsyncClient, admin_auth_headers: dict, merchant_user: User):
    """Test searching users by phone."""
    response = await client.get(f"/api/v1/admin/users?search={merchant_user.phone}", headers=admin_auth_headers)
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 1
    assert users[0]["phone"] == merchant_user.phone


@pytest.mark.asyncio
async def test_admin_search_users_by_name(client: AsyncClient, admin_auth_headers: dict, merchant_user: User):
    """Test searching users by store name."""
    response = await client.get(f"/api/v1/admin/users?search={merchant_user.store_name}", headers=admin_auth_headers)
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 1


@pytest.mark.asyncio
async def test_admin_filter_users_by_status(client: AsyncClient, admin_auth_headers: dict, merchant_user: User):
    """Test filtering users by status ACTIVE."""
    response = await client.get("/api/v1/admin/users?status_filter=ACTIVE", headers=admin_auth_headers)
    assert response.status_code == 200
    users = response.json()
    assert all(u["status"] == "ACTIVE" for u in users)


@pytest.mark.asyncio
async def test_admin_extend_subscription(client: AsyncClient, admin_auth_headers: dict, merchant_user: User):
    """Test admin extending a merchant's subscription."""
    response = await client.post(
        "/api/v1/admin/extend-subscription",
        json={"user_id": str(merchant_user.id), "days": 60},
        headers=admin_auth_headers
    )
    assert response.status_code == 200
    assert "60" in response.json()["message"]


@pytest.mark.asyncio
async def test_admin_extend_subscription_not_found(client: AsyncClient, admin_auth_headers: dict):
    """Test extending subscription for nonexistent user returns 404."""
    response = await client.post(
        "/api/v1/admin/extend-subscription",
        json={"user_id": str(uuid.uuid4()), "days": 30},
        headers=admin_auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_toggle_user_freeze_and_activate(client: AsyncClient, admin_auth_headers: dict, merchant_user: User):
    """Test freezing and reactivating a user account."""
    # 1. Freeze
    freeze_res = await client.post(
        "/api/v1/admin/toggle-user",
        json={"user_id": str(merchant_user.id), "action": "freeze"},
        headers=admin_auth_headers
    )
    assert freeze_res.status_code == 200
    assert "تجميد" in freeze_res.json()["message"]

    # 2. Activate
    activate_res = await client.post(
        "/api/v1/admin/toggle-user",
        json={"user_id": str(merchant_user.id), "action": "activate"},
        headers=admin_auth_headers
    )
    assert activate_res.status_code == 200
    assert "تنشيط" in activate_res.json()["message"]


@pytest.mark.asyncio
async def test_admin_add_user_manually(client: AsyncClient, admin_auth_headers: dict):
    """Test manually adding a user from admin panel."""
    response = await client.post(
        "/api/v1/admin/add-user",
        json={
            "phone": "0911223344",
            "store_name": "متجر مضاف يدوياً",
            "password": "Password123",
            "role": "merchant",
            "subscription_days": 45
        },
        headers=admin_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert "subscription_end_date" in data


@pytest.mark.asyncio
async def test_admin_add_user_duplicate_phone(client: AsyncClient, admin_auth_headers: dict, merchant_user: User):
    """Test manually adding user with duplicate phone returns 400."""
    response = await client.post(
        "/api/v1/admin/add-user",
        json={
            "phone": merchant_user.phone,
            "store_name": "مكرر",
            "password": "Password123"
        },
        headers=admin_auth_headers
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_get_system_stats(client: AsyncClient, admin_auth_headers: dict):
    """Test admin fetching dashboard statistics."""
    response = await client.get("/api/v1/admin/stats", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "active_users" in data
    assert "frozen_users" in data
    assert "pending_subscriptions" in data
