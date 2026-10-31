# دفتر التاجر - Daftar Al-Tajir

> نظام إدارة المبيعات والمصروفات والديون للتجار في السودان

---

## 🚀 النشر على Render + Neon PostgreSQL

### الطريقة 1: نشر تلقائي عبر render.yaml (الأسهل)

1. **ارفع المشروع على GitHub** (مجلد واحد يحتوي frontend + backend + render.yaml)

2. **اذهب إلى [Render Dashboard](https://dashboard.render.com)** ← New → Blueprint

3. **اربط مستودع GitHub** - Render سيقرأ `render.yaml` تلقائياً ويُنشئ:
   - **Neon PostgreSQL** قاعدة بيانات مجانية
   - **Backend Web Service** (FastAPI)
   - **Frontend Static Site** (React)

4. **أضف المتغيرات السرية** في إعدادات الـ Backend:
   - `TELEGRAM_BOT_TOKEN` = `توكن_بوت_تليجرام_الخاص_بك`
   - `TELEGRAM_ADMIN_CHAT_ID` = `معرف_شات_المدير`
   - `ADMIN_PASSWORD` = `كلمة_مرور_المدير_القوية`

5. **حدّث VITE_API_URL** في إعدادات الـ Frontend:
   - `VITE_API_URL` = `https://اسم-الخلفية.onrender.com/api/v1`

6. **انتظر** حتى يكتمل البناء (5-10 دقائق) ✅

### الطريقة 2: نشر يدوي خطوة بخطوة

#### الخطوة 1: إنشاء قاعدة بيانات Neon

1. اذهب إلى [neon.tech](https://neon.tech) وأنشئ حساب مجاني
2. أنشئ مشروع جديد باسم `daftar-tajir`
3. انسخ رابط الاتصال (connection string):
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/daftar_tajir?sslmode=require
   ```

#### الخطوة 2: نشر الخلفية (Backend) على Render

1. اذهب إلى [Render Dashboard](https://dashboard.render.com) ← New → Web Service
2. اربط مستودع GitHub
3. الإعدادات:
   - **Root Directory**: `daftar-al-tajir-backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. أضف متغيرات البيئة:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/daftar_tajir?sslmode=require
   APP_ENV=production
   DEBUG=False
   JWT_SECRET_KEY=مفتاح-سري-طويل-جدا
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   TELEGRAM_ADMIN_CHAT_ID=your_telegram_chat_id_here
   ADMIN_PHONE=0900000000
   ADMIN_PASSWORD=your_secure_admin_password
   CORS_ORIGINS=["https://اسم-الواجهة.onrender.com"]
   ```
5. انقر **Create Web Service**

> 💡 **ملاحظة**: النظام يحوّل تلقائياً `postgresql://` → `postgresql+asyncpg://` و `sslmode=require` → `ssl=require` لـ Neon

#### الخطوة 3: نشر الواجهة الأمامية (Frontend) على Render

1. Render Dashboard ← New → Static Site
2. اربط نفس المستودع
3. الإعدادات:
   - **Root Directory**: `daftar-al-tajir-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. أضف متغير البيئة:
   ```
   VITE_API_URL=https://اسم-الخلفية.onrender.com/api/v1
   ```
5. انقر **Create Static Site**

#### الخطوة 4: إنشاء جداول قاعدة البيانات

بعد تشغيل الخلفية، الجداول تُنشأ تلقائياً عند أول تشغيل. لكن يمكنك أيضاً تشغيل:

```bash
# محلياً (مع إعداد DATABASE_URL لـ Neon)
alembic upgrade head
```

---

## 🏗️ هيكل المشروع

```
daftar-al-tajir/
├── render.yaml                          ← إعدادات Render Blueprint
├── daftar-al-tajir-frontend/            ← الواجهة الأمامية
│   ├── public/                          ← أيقونات PWA + manifest + sw.js
│   ├── src/
│   │   ├── pages/                       ← صفحات التطبيق
│   │   ├── components/                  ← مكونات مشتركة
│   │   ├── context/                     ← Auth Context
│   │   ├── services/api.js              ← خدمة API (axios)
│   │   └── utils/                       ← أدوات مساعدة
│   ├── .env                             ← رابط API (تطوير محلي)
│   ├── .env.production                  ← رابط API (إنتاج Render)
│   ├── vite.config.js                   ← Vite + API proxy
│   └── package.json
│
├── daftar-al-tajir-backend/             ← الواجهة الخلفية
│   ├── app/
│   │   ├── api/                         ← مسارات API
│   │   ├── core/
│   │   │   ├── config.py                ← إعدادات + تحويل URL تلقائي لـ Neon
│   │   │   ├── database.py              ← محرك DB + SSL + connection pooling
│   │   │   └── security.py              ← JWT + BCrypt
│   │   ├── models/                      ← نماذج قاعدة البيانات
│   │   ├── schemas/                     ← مخططات Pydantic + التحقق من الهاتف
│   │   └── services/
│   │       ├── telegram_service.py       ← بوت تليجرام + واتساب لينك
│   │       ├── auth_service.py           ← مصادقة + OTP
│   │       ├── business_service.py       ← منطق الأعمال
│   │       └── ocr_service.py           ← OCR إيصالات بنكية
│   ├── Dockerfile                       ← Docker محلي (frontend+backend)
│   ├── Dockerfile.render                ← Docker لـ Render (backend فقط)
│   ├── docker-compose.yml               ← تشغيل محلي
│   ├── requirements.txt
│   ├── .env                             ← إعدادات تطوير
│   └── .env.example                     ← نموذج إعدادات إنتاج
└── README.md
```

---

## 🧪 اختبار محلي بدون Docker

### المتطلبات: Python 3.12+ | Node.js 20+ | PostgreSQL 16

```bash
# 1. قاعدة البيانات
createdb daftar_tajir

# 2. الخلفية
cd daftar-al-tajir-backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. الواجهة (نافذة جديدة)
cd daftar-al-tajir-frontend
npm install
npm run dev
# يفتح على: http://localhost:5173
# API proxy تلقائي → http://localhost:8000
```

## 🐳 اختبار محلي مع Docker

```bash
cd daftar-al-tajir-backend
docker-compose up --build
# يفتح على: http://localhost (منفذ 80)
```

---

## 🔐 بيانات الدخول الافتراضية

| الدور | الهاتف | كلمة المرور |
|-------|--------|-------------|
| مدير النظام | `0902642768` | `nice@247` |

## 📱 صيغة رقم الهاتف

| السياق | الصيغة | مثال |
|--------|--------|------|
| إدخال المستخدم | `0XXXXXXXXX` (10 أرقام) | `0902642768` |
| التخزين في قاعدة البيانات | `0XXXXXXXXX` | `0902642768` |
| رابط واتساب في تليجرام | `249XXXXXXXXX` | `249902642768` |

---

## 🔧 متغيرات البيئة المهمة لـ Render

| المتغير | مطلوب | الوصف |
|---------|-------|-------|
| `DATABASE_URL` | ✅ | رابط Neon (يُضاف تلقائياً من Render) |
| `JWT_SECRET_KEY` | ✅ | مفتاح تشفير JWT (استخدم `generateValue`) |
| `TELEGRAM_BOT_TOKEN` | ✅ | مفتاح بوت تليجرام |
| `TELEGRAM_ADMIN_CHAT_ID` | ✅ | معرف محادثة المدير |
| `ADMIN_PHONE` | لا | `0902642768` (افتراضي) |
| `ADMIN_PASSWORD` | لا | `nice@247` (غيّره!) |
| `CORS_ORIGINS` | ✅ | نطاق الواجهة الأمامية على Render |
| `VITE_API_URL` | ✅ | رابط الخلفية (في إعدادات Frontend) |

---

## 📋 مسارات API

| المجموعة | المسار | الوصف |
|---------|--------|-------|
| المصادقة | `POST /api/v1/auth/verify-phone` | طلب رمز تحقق |
| المصادقة | `POST /api/v1/auth/confirm-phone` | تأكيد الرمز |
| المصادقة | `POST /api/v1/auth/register` | إكمال التسجيل |
| المصادقة | `POST /api/v1/auth/login` | تسجيل الدخول |
| إغلاق يومي | `POST /api/v1/eod/save` | حفظ بيانات اليوم |
| العملاء | `GET /api/v1/customers/` | قائمة العملاء |
| العملاء | `POST /api/v1/customers/debt` | تسجيل دين |
| المصروفات | `POST /api/v1/expenses/` | إضافة مصروف |
| التقارير | `GET /api/v1/reports/` | التقارير المالية |
| الإدارة | `GET /api/v1/admin/users` | قائمة المستخدمين |

لتصفح كل المسارات: `https://اسم-الخلفية.onrender.com/docs`

---

## 🛠️ استكشاف الأخطاء

### مشكلة: خطأ اتصال بقاعدة بيانات Neon
```
تأكد من:
1. DATABASE_URL يحتوي على ?sslmode=require
2. النظام يحوّل تلقائياً sslmode → ssl لـ asyncpg
3. لا تحتاج لتعديل يدوي - config.py يتعامل مع كل شيء
```

### مشكلة: Frontend لا يتصل بـ Backend
```
تأكد من:
1. VITE_API_URL في Frontend يشير لرابط الخلفية الصحيح
2. CORS_ORIGINS في Backend يسمح بنطاق الواجهة
3. كلا الخدمتين تعملان على Render
```

### مشكلة: Telegram Bot لا يعمل
```
تأكد من:
1. TELEGRAM_BOT_TOKEN صحيح
2. TELEGRAM_ADMIN_CHAT_ID صحيح
3. البوت يعمل (اختبر /start في تليجرام)
```

### مشكلة: بطء في الاستجابة على Render (Cold Start)
```
Render Free Tier "يخلد للنوم" بعد 15 دقيقة عدم نشاط
أول طلب بعد الاستيقاظ يستغرق ~30 ثانية
```

#### الحل: إعداد Cron Job خارجي (مجاني)

لمنع الخدمة من النوم، استخدم **cron-job.org** لإرسال طلب كل **4 دقائق و 59 ثانية**:

1. اذهب إلى [cron-job.org](https://cron-job.org) وسجل حساب مجاني
2. أنشئ Cron Job جديد بالإعدادات التالية:

| الإعداد | القيمة |
|---------|--------|
| **Title** | `Daftar Tajir Keep-Alive` |
| **URL** | `https://اسم-الخلفية.onrender.com/health` |
| **Schedule** | كل 4 دقائق و 59 ثانية (Expression: `*/5 * * * *`) |
| **Request Method** | `GET` |
| **Request Timeout** | `30 seconds` |

> **ملاحظة**: الـ `/health` endpoint يرسل `SELECT 1` لقاعدة البيانات Neon أيضاً،
> مما يبقي اتصال DB حياً ويمنع Neon من إغلاق الاتصال بسبب عدم النشاط.

3. فعّل الـ Cron Job واضغط "Test Run" للتأكد
4. يجب أن تحصل على response مثل:
```json
{"status": "healthy", "db": "connected"}
```

> **لماذا 4:59؟** Render Free يغلق الخدمة بعد 15 دقيقة عدم نشاط.
> الإرسال كل ~5 دقائق يضمن عدم وصول الخدمة لحد الـ 15 دقيقة أبداً.
> التأثير يصل لقاعدة البيانات أيضاً بدون تخزين أي بيانات إضافية.
