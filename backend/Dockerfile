FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app code and mock database
COPY app ./app
COPY mock_db.json ./mock_db.json

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Run FastAPI using uvicorn, reading dynamically assigned GCP port
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
