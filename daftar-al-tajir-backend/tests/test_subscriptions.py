"""Tests for Subscriptions API endpoints."""
import uuid
from decimal import Decimal
from datetime import date, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User, Subscription, SystemSettings


@pytest.mark.asyncio
async def test_get_my_subscriptions(client: AsyncClient, merchant_user: User, merchant_auth_headers: dict, db_session: AsyncSession):
    """Test retrieving user's subscription history."""
    sub = Subscription(
        user_id=merchant_user.id,
        amount=Decimal("10000.00"),
        status="APPROVED",
        ocr_status="SUCCESS"
    )
    db_session.add(sub)
    await db_session.commit()

    response = await client.get("/api/v1/subscriptions/my", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_get_subscription_prices(client: AsyncClient):
    """Test getting public subscription prices."""
    response = await client.get("/api/v1/subscriptions/prices")
    assert response.status_code == 200
    data = response.json()
    assert "monthly" in data
    assert "quarterly" in data
    assert "semi_annual" in data


@pytest.mark.asyncio
async def test_get_pending_subscriptions_admin_only(
    client: AsyncClient,
    merchant_user: User,
    admin_auth_headers: dict,
    merchant_auth_headers: dict,
    db_session: AsyncSession
):
    """Test pending subscriptions access (admin allowed, merchant forbidden)."""
    # Create pending subscription
    sub = Subscription(
        user_id=merchant_user.id,
        amount=Decimal("10000.00"),
        status="PENDING",
        ocr_status="PENDING"
    )
    db_session.add(sub)
    await db_session.commit()

    # 1. Merchant access should be forbidden (403)
    merchant_res = await client.get("/api/v1/subscriptions/pending", headers=merchant_auth_headers)
    assert merchant_res.status_code == 403

    # 2. Admin access should succeed (200)
    admin_res = await client.get("/api/v1/subscriptions/pending", headers=admin_auth_headers)
    assert admin_res.status_code == 200
    assert len(admin_res.json()) >= 1


@pytest.mark.asyncio
async def test_review_subscription_approve(
    client: AsyncClient,
    merchant_user: User,
    admin_auth_headers: dict,
    db_session: AsyncSession
):
    """Test admin approving a pending subscription extends end date."""
    sub = Subscription(
        user_id=merchant_user.id,
        amount=Decimal("3000.00"),
        status="PENDING",
        ocr_status="SUCCESS"
    )
    db_session.add(sub)
    await db_session.commit()
    await db_session.refresh(sub)

    response = await client.post(
        "/api/v1/subscriptions/review",
        json={
            "subscription_id": str(sub.id),
            "action": "approve"
        },
        headers=admin_auth_headers
    )
    assert response.status_code == 200
    assert "الموافقة" in response.json()["message"]


@pytest.mark.asyncio
async def test_review_subscription_reject(
    client: AsyncClient,
    merchant_user: User,
    admin_auth_headers: dict,
    db_session: AsyncSession
):
    """Test admin rejecting a pending subscription."""
    sub = Subscription(
        user_id=merchant_user.id,
        amount=Decimal("3000.00"),
        status="PENDING",
        ocr_status="FAILED"
    )
    db_session.add(sub)
    await db_session.commit()
    await db_session.refresh(sub)

    response = await client.post(
        "/api/v1/subscriptions/review",
        json={
            "subscription_id": str(sub.id),
            "action": "reject",
            "rejection_reason": "صورة التحويل غير واضحة"
        },
        headers=admin_auth_headers
    )
    assert response.status_code == 200
    assert "رفض" in response.json()["message"]


@pytest.mark.asyncio
async def test_review_nonexistent_subscription(client: AsyncClient, admin_auth_headers: dict):
    """Test reviewing nonexistent subscription returns 404."""
    response = await client.post(
        "/api/v1/subscriptions/review",
        json={
            "subscription_id": str(uuid.uuid4()),
            "action": "approve"
        },
        headers=admin_auth_headers
    )
    assert response.status_code == 404
