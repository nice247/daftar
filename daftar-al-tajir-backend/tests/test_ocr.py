"""Tests for OCR API endpoints."""
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient
from app.schemas.schemas import OCRResult


@pytest.mark.asyncio
async def test_ocr_extract_success(client: AsyncClient, merchant_auth_headers: dict):
    """Test extracting bank transfer data from a receipt image with mock OCR."""
    mock_result = OCRResult(
        success=True,
        amount=10000.0,
        reference_number="123456789",
        date="2026-08-14"
    )

    with patch("app.api.ocr.ocr_service.extract_from_image", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = mock_result

        files = {"receipt_image": ("receipt.jpg", b"fake_image_bytes", "image/jpeg")}
        response = await client.post("/api/v1/ocr/extract", files=files, headers=merchant_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert float(data["amount"]) == 10000.0
        assert data["reference_number"] == "123456789"


@pytest.mark.asyncio
async def test_ocr_extract_invalid_file_type(client: AsyncClient, merchant_auth_headers: dict):
    """Test uploading a non-image file returns 400."""
    files = {"receipt_image": ("file.txt", b"plain text", "text/plain")}
    response = await client.post("/api/v1/ocr/extract", files=files, headers=merchant_auth_headers)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_ocr_verify_payment(client: AsyncClient, merchant_auth_headers: dict):
    """Test payment verification helper endpoint."""
    mock_result = OCRResult(
        success=True,
        amount=5000.0,
        reference_number="987654321",
        date="2026-08-14"
    )

    with patch("app.api.ocr.ocr_service.extract_from_image", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = mock_result

        files = {"receipt_image": ("receipt.png", b"fake_image_bytes", "image/png")}
        response = await client.post("/api/v1/ocr/verify", files=files, headers=merchant_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "ocr_result" in data
        assert "verification" in data
