# The wardrobe server (FastAPI + the in-process AI worker) for a hosted beta.
# Account mode only: set WARDROBE_AUTH=on and the secrets below at the host, never in this image.
#   GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLIC_URL (+ the WARDROBE_* controls in .env.example)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    U2NET_HOME=/opt/models WARDROBE_AUTH=on PORT=8000

# tesseract: the printed-text check in stage5_verify. curl: the health check.
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY pipeline ./pipeline
RUN pip install .

# The background-removal model is downloaded at build time, so the first job doesn't wait for it.
RUN python -c "from rembg import new_session; new_session('isnet-general-use')"

COPY api ./api
COPY scripts ./scripts
COPY cli.py ./

RUN useradd --create-home --uid 10001 wardrobe && chown -R wardrobe /opt/models
USER wardrobe

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/healthz" || exit 1
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
