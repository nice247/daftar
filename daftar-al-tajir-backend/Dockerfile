FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY daftar-al-tajir-frontend/package*.json ./
RUN npm install
COPY daftar-al-tajir-frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-ara \
    libpq-dev \
    gcc \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY daftar-al-tajir-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY daftar-al-tajir-backend/ .

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist /app/static

# Nginx configuration for serving frontend + proxying API
RUN echo 'server {\n\
    listen 80;\n\
    server_name _;\n\
\n\
    # Frontend static files\n\
    location / {\n\
        root /app/static;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # API proxy\n\
    location /api/ {\n\
        proxy_pass http://127.0.0.1:8000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
    }\n\
\n\
    # Docs proxy\n\
    location /docs {\n\
        proxy_pass http://127.0.0.1:8000;\n\
    }\n\
\n\
    location /openapi.json {\n\
        proxy_pass http://127.0.0.1:8000;\n\
    }\n\
\n\
    # Health check\n\
    location /health {\n\
        proxy_pass http://127.0.0.1:8000;\n\
    }\n\
}' > /etc/nginx/sites-available/default

# Startup script
RUN echo '#!/bin/bash\n\
nginx\n\
uvicorn app.main:app --host 0.0.0.0 --port 8000' > /app/start.sh && chmod +x /app/start.sh

# Create uploads directory
RUN mkdir -p uploads/receipts

EXPOSE 80

CMD ["/app/start.sh"]
