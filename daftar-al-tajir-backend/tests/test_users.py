"""Tests for User profile and session management endpoints."""
from datetime import date, timedelta
import pytest
from httpx import AsyncClient
from app.models.models import User


@pytest.mark.asyncio
async def test_get_my_profile_success(client: AsyncClient, merchant_user: User, merchant_auth_headers: dict):
    """Test retrieving current user's profile."""
    response = await client.get("/api/v1/users/me", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["phone"] == merchant_user.phone
    assert data["store_name"] == merchant_user.store_name
    assert data["role"] == "merchant"
    assert data["status"] == "ACTIVE"
    assert "support_phone" in data


@pytest.mark.asyncio
async def test_get_my_profile_unauthorized(client: AsyncClient):
    """Test retrieving profile without authorization header fails."""
    response = await client.get("/api/v1/users/me")
    assert response.status_code in (401, 422)


@pytest.mark.asyncio
async def test_get_my_profile_invalid_token(client: AsyncClient):
    """Test retrieving profile with invalid token fails with 401."""
    response = await client.get("/api/v1/users/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_profile_store_and_email(client: AsyncClient, merchant_user: User, merchant_auth_headers: dict):
    """Test updating user's store name and email."""
    response = await client.put(
        "/api/v1/users/me",
        json={"store_name": "متجر التقنية الحديث", "email": "newemail@example.com"},
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["store_name"] == "متجر التقنية الحديث"
    assert data["email"] == "newemail@example.com"


@pytest.mark.asyncio
async def test_update_profile_restock_cycle_days(client: AsyncClient, merchant_user: User, merchant_auth_headers: dict):
    """Test updating user's restock cycle length."""
    response = await client.put(
        "/api/v1/users/me",
        json={"restock_cycle_days": 14},
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["restock_cycle_days"] == 14


@pytest.mark.asyncio
async def test_update_profile_cycle_start_date(client: AsyncClient, merchant_user: User, merchant_auth_headers: dict):
    """Test updating cycle start date triggers cycle date adjustment."""
    new_start = (date.today() - timedelta(days=2)).isoformat()
    response = await client.put(
        "/api/v1/users/me",
        json={"cycle_start_date": new_start},
        headers=merchant_auth_headers
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, merchant_user: User, merchant_auth_headers: dict):
    """Test refreshing token returns a new valid JWT access token."""
    response = await client.post(
        "/api/v1/users/refresh-token",
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["phone"] == merchant_user.phone
