# Daftar Al-Tajir Backend - دفتر التاجر

Merchant Sales, Expenses & Debt Management System Backend

## Tech Stack
- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Auth**: JWT (7-day tokens) + BCrypt password hashing
- **OCR**: Tesseract OCR for bank transfer receipt reading
- **Telegram Bot**: Admin notifications & commands
- **Migrations**: Alembic

## Quick Start

### Using Docker Compose (Recommended)
```bash
# Clone and navigate
cd daftar-al-tajir-backend

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Start all services
docker-compose up -d

# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Manual Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Set up PostgreSQL database
createdb daftar_tajir

# Configure .env file
cp .env .env.local
# Edit database URL and other settings

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new merchant |
| POST | `/api/v1/auth/login` | Login and get JWT |
| POST | `/api/v1/auth/forgot-password` | Request password reset (OTP) |
| POST | `/api/v1/auth/verify-otp` | Verify OTP code |
| POST | `/api/v1/auth/reset-password` | Reset password |

### Subscriptions & OCR
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/subscriptions/upload-receipt` | Upload bank receipt with OCR |
| GET | `/api/v1/subscriptions/my` | My subscriptions |
| GET | `/api/v1/subscriptions/pending` | Pending subscriptions (admin) |
| POST | `/api/v1/subscriptions/review` | Approve/reject subscription (admin) |

### End-of-Day
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/eod/save` | Save end-of-day data |
| GET | `/api/v1/eod/last-restock` | Last restock info |
| GET | `/api/v1/eod/cycle-status` | Current cycle status |

### Customers & Debts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/customers/` | Add customer |
| GET | `/api/v1/customers/` | List customers |
| GET | `/api/v1/customers/{id}` | Customer details |
| POST | `/api/v1/customers/debt` | Record new debt |
| POST | `/api/v1/customers/debt/pay` | Record debt payment |
| POST | `/api/v1/customers/debt/waive` | Waive (forgive) debt |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/expenses/` | List expenses |
| POST | `/api/v1/expenses/` | Add expense |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reports/` | Financial reports |

### Products & Inventory (Optional)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/products/` | Add product |
| GET | `/api/v1/products/` | List products |
| POST | `/api/v1/products/supply` | Record stock supply |

### Admin Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/users` | List all users |
| POST | `/api/v1/admin/extend-subscription` | Extend subscription |
| POST | `/api/v1/admin/toggle-user` | Freeze/activate user |
| POST | `/api/v1/admin/add-user` | Add user manually |
| GET | `/api/v1/admin/stats` | System statistics |

### OCR
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ocr/extract` | Extract data from receipt |
| POST | `/api/v1/ocr/verify` | Extract and verify payment |

## Telegram Bot Commands
- `/start` - Welcome message
- `/help` - Available commands
- `/users` - View user list
- `/pending` - View pending subscriptions
- `/stats` - System statistics

## Environment Variables
See `.env` file for all configuration options.

## Default Admin Account
- Phone: `0902642768`
- Password: `nice@247`

## Database Schema
Based on SRS document with tables:
- users, subscriptions, customers, invoices, expenses
- debt_payments, other_income, restock_cycles
- products, stock_transactions, otp_codes
