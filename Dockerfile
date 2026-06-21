FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/static/uploads /app/static/audio /app/staticfiles \
    && python manage.py collectstatic --noinput

RUN addgroup --system --gid 1001 app \
    && adduser --system --uid 1001 --gid 1001 app \
    && chown -R app:app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

CMD ["gunicorn", "config.wsgi:application", "-c", "gunicorn.conf.py"]
