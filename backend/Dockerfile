FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system dependencies (includes Tesseract for OCR)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Development target
FROM base AS development

COPY pyproject.toml .
# Install CPU-only PyTorch first (200MB vs 3GB with CUDA)
RUN pip install --timeout 300 torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --timeout 300 --retries 5 -e ".[dev]"

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production target
FROM base AS production

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY pyproject.toml .
RUN pip install --timeout 300 torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --timeout 300 --retries 5 .

COPY . .

RUN mkdir -p uploads && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
