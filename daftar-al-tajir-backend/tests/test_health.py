"""Tests for health check and general system endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    """Test root GET / endpoint returns 200 and docs link."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data


@pytest.mark.asyncio
async def test_ping_endpoint(client: AsyncClient):
    """Test ping GET /ping returns 200."""
    response = await client.get("/ping")
    assert response.status_code == 200
    data = response.json()
    assert data.get("pong") is True or data.get("status") in ("ok", "awake")


@pytest.mark.asyncio
async def test_app_version_endpoint(client: AsyncClient):
    """Test app version check endpoint."""
    response = await client.get("/api/v1/app/version")
    assert response.status_code == 200
    data = response.json()
    assert "versionCode" in data
    assert "versionName" in data
    assert "downloadUrl" in data
