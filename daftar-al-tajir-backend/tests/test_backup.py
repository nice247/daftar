"""Tests for Backup and Restore API endpoints."""
import json
import pytest
from httpx import AsyncClient
from app.models.models import User, Customer, Invoice


@pytest.mark.asyncio
async def test_export_backup(client: AsyncClient, merchant_auth_headers: dict):
    """Test generating and exporting a full structured JSON backup."""
    # Add some data first
    await client.post(
        "/api/v1/customers/",
        json={"name": "زبون النسخ الاحتياطي", "phone": "0912121212"},
        headers=merchant_auth_headers
    )

    response = await client.get("/api/v1/backup/export", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "schema_version" in data
    assert "customers" in data
    assert len(data["customers"]) == 1
    assert "checksum" in data


@pytest.mark.asyncio
async def test_restore_backup_merge_mode(client: AsyncClient, merchant_auth_headers: dict):
    """Test restoring data in merge mode (replace_mode=False)."""
    payload = {
        "schema_version": "2.0",
        "exported_at": "2026-08-14T10:00:00Z",
        "customers": [
            {"name": "زبون مستعاد 1", "phone": "0913131313", "total_debt": 5000}
        ],
        "invoices": [],
        "expenses": [],
        "debt_payments": [],
        "other_incomes": [],
        "merchant_debts": [],
        "products": []
    }

    response = await client.post(
        "/api/v1/backup/restore?replace_mode=false",
        json=payload,
        headers=merchant_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "restored_summary" in data
    assert data["restored_summary"]["customers"] == 1


@pytest.mark.asyncio
async def test_restore_backup_replace_mode(client: AsyncClient, merchant_auth_headers: dict):
    """Test restoring data in replace mode (replace_mode=True)."""
    # 1. Create an existing customer
    await client.post(
        "/api/v1/customers/",
        json={"name": "زبون قديم سيتم استبداله", "phone": "0900000000"},
        headers=merchant_auth_headers
    )

    payload = {
        "schema_version": "2.0",
        "exported_at": "2026-08-14T10:00:00Z",
        "customers": [
            {"name": "زبون جديد بالكامل", "phone": "0914141414", "total_debt": 0}
        ],
        "invoices": [],
        "expenses": [],
        "debt_payments": [],
        "other_incomes": [],
        "merchant_debts": [],
        "products": []
    }

    response = await client.post(
        "/api/v1/backup/restore?replace_mode=true",
        json=payload,
        headers=merchant_auth_headers
    )
    assert response.status_code == 200

    # Verify only new customer remains
    cust_res = await client.get("/api/v1/customers/", headers=merchant_auth_headers)
    custs = cust_res.json()
    assert len(custs) == 1
    assert custs[0]["name"] == "زبون جديد بالكامل"


@pytest.mark.asyncio
async def test_restore_backup_invalid_data(client: AsyncClient, merchant_auth_headers: dict):
    """Test restoring with invalid payload returns 400."""
    response = await client.post(
        "/api/v1/backup/restore",
        json={"invalid": "payload"},
        headers=merchant_auth_headers
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_backup_summary(client: AsyncClient, merchant_auth_headers: dict):
    """Test retrieving backup record summary counts."""
    response = await client.get("/api/v1/backup/summary", headers=merchant_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_records" in data
    assert "customers_count" in data
    assert "invoices_count" in data
