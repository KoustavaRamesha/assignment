# Multi-stage Dockerfile: builds React frontend and serves via Python FastAPI backend
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /repo
COPY package*.json ./
COPY apps/wind-forecast-check/package*.json apps/wind-forecast-check/
COPY packages/components/package*.json packages/components/
RUN npm install --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

# Stage 2: Python FastAPI backend serving API and static SPA
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /repo/apps/wind-forecast-check/dist /app/dist

ENV STATIC_DIR=/app/dist
ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
