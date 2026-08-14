"""Tests for Authentication API endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta

from app.models.models import User, OTPCode
from app.core.security import hash_password


@pytest.mark.asyncio
async def test_verify_phone_success(client: AsyncClient, db_session: AsyncSession):
    """Test requesting verification code for a new phone."""
    response = await client.post("/api/v1/auth/verify-phone", json={"phone": "0900000001"})
    assert response.status_code == 200
    data = response.json()
    assert "message" in data

    # Verify code was saved in database
    result = await db_session.execute(select(OTPCode).where(OTPCode.phone == "0900000001"))
    otp = result.scalar_one_or_none()
    assert otp is not None
    assert len(otp.code) == 4
    assert otp.is_used is False


@pytest.mark.asyncio
async def test_verify_phone_already_registered_active(client: AsyncClient, merchant_user: User):
    """Test verify phone for an already active registered merchant."""
    response = await client.post("/api/v1/auth/verify-phone", json={"phone": merchant_user.phone})
    assert response.status_code == 400
    assert "مسجل" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_phone_invalid_format(client: AsyncClient):
    """Test verify phone with invalid format fails validation."""
    response = await client.post("/api/v1/auth/verify-phone", json={"phone": "12345"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_confirm_phone_success(client: AsyncClient, db_session: AsyncSession):
    """Test confirming valid verification code."""
    # First request phone verification
    await client.post("/api/v1/auth/verify-phone", json={"phone": "0900000002"})
    result = await db_session.execute(select(OTPCode).where(OTPCode.phone == "0900000002"))
    otp = result.scalar_one_or_none()

    response = await client.post("/api/v1/auth/confirm-phone", json={
        "phone": "0900000002",
        "code": otp.code
    })
    assert response.status_code == 200
    assert "بنجاح" in response.json()["message"]


@pytest.mark.asyncio
async def test_confirm_phone_invalid_code(client: AsyncClient, db_session: AsyncSession):
    """Test confirming with wrong verification code fails."""
    await client.post("/api/v1/auth/verify-phone", json={"phone": "0900000003"})

    response = await client.post("/api/v1/auth/confirm-phone", json={
        "phone": "0900000003",
        "code": "0000"
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_confirm_phone_expired_code(client: AsyncClient, db_session: AsyncSession):
    """Test confirming with an expired verification code fails."""
    expired_otp = OTPCode(
        phone="0900000004",
        code="9999",
        is_used=False,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=5)
    )
    db_session.add(expired_otp)
    await db_session.commit()

    response = await client.post("/api/v1/auth/confirm-phone", json={
        "phone": "0900000004",
        "code": "9999"
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient, db_session: AsyncSession):
    """Test full successful registration flow."""
    # 1. Request verification
    await client.post("/api/v1/auth/verify-phone", json={"phone": "0900000005"})
    result = await db_session.execute(select(OTPCode).where(OTPCode.phone == "0900000005"))
    otp = result.scalar_one_or_none()

    # 2. Register
    response = await client.post("/api/v1/auth/register", json={
        "phone": "0900000005",
        "store_name": "سوبرماركت النور",
        "password": "Password123",
        "verification_code": otp.code,
        "email": "nour@example.com"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["phone"] == "0900000005"
    assert data["user"]["store_name"] == "سوبرماركت النور"
    assert data["user"]["role"] == "merchant"
    assert data["user"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_register_weak_password_length(client: AsyncClient):
    """Test registration fails with short password (< 6 chars)."""
    response = await client.post("/api/v1/auth/register", json={
        "phone": "0900000006",
        "store_name": "متجر",
        "password": "123",
        "verification_code": "1234"
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_password_no_digits(client: AsyncClient):
    """Test registration fails when password has no digits."""
    response = await client.post("/api/v1/auth/register", json={
        "phone": "0900000007",
        "store_name": "متجر",
        "password": "abcdefgh",
        "verification_code": "1234"
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_password_no_letters(client: AsyncClient):
    """Test registration fails when password has no letters."""
    response = await client.post("/api/v1/auth/register", json={
        "phone": "0900000008",
        "store_name": "متجر",
        "password": "12345678",
        "verification_code": "1234"
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_duplicate_phone(client: AsyncClient, merchant_user: User, db_session: AsyncSession):
    """Test registration fails when phone already exists."""
    otp = OTPCode(
        phone=merchant_user.phone,
        code="1234",
        is_used=False,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db_session.add(otp)
    await db_session.commit()

    response = await client.post("/api/v1/auth/register", json={
        "phone": merchant_user.phone,
        "store_name": "متجر مكرر",
        "password": "Password123",
        "verification_code": "1234"
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, merchant_user: User):
    """Test successful login returns access token and user info."""
    response = await client.post("/api/v1/auth/login", json={
        "phone": merchant_user.phone,
        "password": "Pass1234"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["phone"] == merchant_user.phone
    assert data["user"]["store_name"] == merchant_user.store_name


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, merchant_user: User):
    """Test login with wrong password returns 401."""
    response = await client.post("/api/v1/auth/login", json={
        "phone": merchant_user.phone,
        "password": "WrongPassword123"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Test login with unregistered phone returns 401."""
    response = await client.post("/api/v1/auth/login", json={
        "phone": "0911111111",
        "password": "Password123"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_frozen_user(client: AsyncClient, frozen_user: User):
    """Test login with frozen account returns 401 with appropriate message."""
    response = await client.post("/api/v1/auth/login", json={
        "phone": frozen_user.phone,
        "password": "Pass1234"
    })
    assert response.status_code == 401
    assert "مجمد" in response.json()["detail"]


@pytest.mark.asyncio
async def test_forgot_password_success(client: AsyncClient, merchant_user: User, db_session: AsyncSession):
    """Test requesting password reset OTP."""
    response = await client.post("/api/v1/auth/forgot-password", json={
        "phone": merchant_user.phone
    })
    assert response.status_code == 200
    assert "message" in response.json()

    # Check OTP created in DB
    result = await db_session.execute(
        select(OTPCode)
        .where(OTPCode.phone == merchant_user.phone, OTPCode.is_used == False)
    )
    otp = result.scalar_one_or_none()
    assert otp is not None
    assert len(otp.code) == 4


@pytest.mark.asyncio
async def test_forgot_password_nonexistent_user(client: AsyncClient):
    """Test requesting password reset for non-existent user returns 404."""
    response = await client.post("/api/v1/auth/forgot-password", json={
        "phone": "0977777777"
    })
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_reset_password_flow(client: AsyncClient, merchant_user: User, db_session: AsyncSession):
    """Test verifying OTP and resetting password completely."""
    # 1. Generate OTP
    await client.post("/api/v1/auth/forgot-password", json={"phone": merchant_user.phone})
    result = await db_session.execute(
        select(OTPCode)
        .where(OTPCode.phone == merchant_user.phone, OTPCode.is_used == False)
    )
    otp = result.scalar_one_or_none()

    # 2. Verify OTP step
    verify_res = await client.post("/api/v1/auth/verify-otp", json={
        "phone": merchant_user.phone,
        "code": otp.code
    })
    assert verify_res.status_code == 200

    # 3. Reset password
    reset_res = await client.post("/api/v1/auth/reset-password", json={
        "phone": merchant_user.phone,
        "code": otp.code,
        "new_password": "NewSecretPassword123"
    })
    assert reset_res.status_code == 200

    # 4. Try logging in with the new password
    login_res = await client.post("/api/v1/auth/login", json={
        "phone": merchant_user.phone,
        "password": "NewSecretPassword123"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()
