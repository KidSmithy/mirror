# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the FastAPI backend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app
COPY backend/app ./app
COPY backend/mock_db.json ./mock_db.json

# Copy frontend static build from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Run FastAPI using uvicorn, reading dynamically assigned GCP port
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
