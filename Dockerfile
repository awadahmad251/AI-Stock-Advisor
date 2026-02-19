# ─── Backend ───
FROM python:3.11-slim AS backend

WORKDIR /app

# Install system deps for faiss-cpu
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY .env .env
COPY rag/ ./rag/
COPY data/ ./data/

WORKDIR /app/backend
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


# ─── Frontend build ───
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Build with backend URL pointing to /api (served via nginx proxy)
RUN npm run build


# ─── Production (Nginx serves frontend + proxies API) ───
FROM nginx:alpine AS production

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
