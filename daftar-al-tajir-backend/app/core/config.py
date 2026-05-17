import os
import ssl
from typing import List
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

def _convert_db_url_for_async(url: str) -> str:
    """Convert a standard PostgreSQL URL for use with asyncpg.
    
    Handles Neon PostgreSQL URLs:
    - postgresql:// → postgresql+asyncpg://
    - sslmode=require → ssl=require (asyncpg uses 'ssl' not 'sslmode')
    - Adds ssl=require if not present and URL looks like Neon
    """
    if not url:
        return url
    
    parsed = urlparse(url)
    
    # Replace scheme
    scheme = parsed.scheme
    if scheme == "postgresql":
        scheme = "postgresql+asyncpg"
    elif scheme == "postgres":
        scheme = "postgresql+asyncpg"
    
    # Parse query params
    query_params = parse_qs(parsed.query)
    
    # Convert sslmode to ssl for asyncpg
    if "sslmode" in query_params:
        ssl_value = query_params.pop("sslmode")[0]
        # Remove channel_binding (asyncpg doesn't support it)
        if "channel_binding" in query_params:
            del query_params["channel_binding"]

    # If it's a Neon/external database and no SSL, add ssl=require
    hostname = parsed.hostname or ""
    is_external = not hostname.startswith("localhost") and not hostname.startswith("127.")
    if is_external and "ssl" not in query_params:
        query_params["ssl"] = ["require"]
    
    # Rebuild query string
    new_query = urlencode({k: v[0] for k, v in query_params.items()})
    
    return urlunparse((
        scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))


def _convert_db_url_for_sync(url: str) -> str:
    """Convert a PostgreSQL URL for use with psycopg2 (sync, for Alembic).
    
    Ensures sslmode=require for external databases.
    """
    if not url:
        return url
    
    parsed = urlparse(url)
    
    # Keep as postgresql:// for psycopg2
    scheme = parsed.scheme
    if "+" in scheme:
        scheme = scheme.split("+")[0]
    if scheme == "postgres":
        scheme = "postgresql"
    
    # Parse query params
    query_params = parse_qs(parsed.query)
    
    # Convert ssl to sslmode for psycopg2
    if "ssl" in query_params:
        ssl_value = query_params.pop("ssl")[0]
        # Remove channel_binding (not needed for psycopg2 either)
        if "channel_binding" in query_params:
            del query_params["channel_binding"]
    # If it's a Neon/external database and no sslmode, add it
    hostname = parsed.hostname or ""
    is_external = not hostname.startswith("localhost") and not hostname.startswith("127.")
    if is_external and "sslmode" not in query_params:
        query_params["sslmode"] = ["require"]
    
    # Rebuild query string
    new_query = urlencode({k: v[0] for k, v in query_params.items()})
    
    return urlunparse((
        scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))


# ============ Application ============
APP_NAME: str = os.getenv("APP_NAME", "Daftar-Al-Tajir")
APP_ENV: str = os.getenv("APP_ENV", "development")
DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
PORT: int = int(os.getenv("PORT", "8000"))

# ============ Database ============
# Render auto-provides DATABASE_URL for Neon PostgreSQL
# Format: postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
# We auto-convert to asyncpg format
_raw_database_url: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/daftar_tajir"
)

# If the raw URL doesn't already have +asyncpg, convert it
if "+asyncpg" not in _raw_database_url:
    DATABASE_URL: str = _convert_db_url_for_async(_raw_database_url)
else:
    DATABASE_URL: str = _raw_database_url

# Sync URL for Alembic migrations
_raw_sync_url: str = os.getenv("DATABASE_URL_SYNC", "")
if not _raw_sync_url:
    # Derive sync URL from the async URL
    DATABASE_URL_SYNC: str = _convert_db_url_for_sync(
        _raw_database_url.replace("+asyncpg", "") if "+asyncpg" in _raw_database_url else _raw_database_url
    )
else:
    DATABASE_URL_SYNC: str = _convert_db_url_for_sync(_raw_sync_url)

# ============ JWT ============
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "daftar-tajir-super-secret-key-change-in-production-2024")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_DAYS: int = int(os.getenv("JWT_EXPIRATION_DAYS", "7"))

# ============ Telegram Bot ============
TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_CHAT_ID: str = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
ADMIN_PHONE: str = os.getenv("ADMIN_PHONE", "0902642768")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "nice@247")

# ============ Google Cloud APIs ============
GOOGLE_GEMINI_API_KEY: str = os.getenv("GOOGLE_GEMINI_API_KEY", "")

# ============ Bank Account Info ============
BANK_ACCOUNT_NUMBER: str = os.getenv("BANK_ACCOUNT_NUMBER", "7712964")
BANK_ACCOUNT_NAME: str = os.getenv("BANK_ACCOUNT_NAME", "بهاء الدين عثمان اسحق محمد")

# ============ Subscription ============
SUBSCRIPTION_PRICE_PER_MONTH: int = int(os.getenv("SUBSCRIPTION_PRICE_PER_MONTH", "10000"))
FIRST_MONTH_FREE: bool = os.getenv("FIRST_MONTH_FREE", "True").lower() == "true"

# ============ CORS ============
CORS_ORIGINS: List[str] = os.getenv(
    "CORS_ORIGINS",
    '["http://localhost:3000","http://localhost:8000","http://localhost:5173"]'
)

# ============ Upload ============
UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads/receipts")
MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
