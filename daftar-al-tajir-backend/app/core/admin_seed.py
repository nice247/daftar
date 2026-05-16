from app.core.config import ADMIN_PHONE, ADMIN_PASSWORD
from app.core.security import hash_password

# Pre-configured admin accounts (up to 3 admins allowed per SRS)
# These are seeded on first application startup
ADMIN_ACCOUNTS = [
    {
        "phone": ADMIN_PHONE,
        "password_hash": None,  # Will be set at startup
        "store_name": "مدير النظام",
        "role": "admin",
    }
]

# Default admin password for first admin
DEFAULT_ADMIN_PASSWORD = ADMIN_PASSWORD
