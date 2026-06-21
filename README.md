# PDF to Audio Converter

Django web app that converts PDFs, DOCX, and PPTX to speech with synchronized sentence highlighting, 38 edge-tts voices in 13 languages, OCR for scanned PDFs, and audiobook ZIP export.

## Quick Start (Development)

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:5000
```

Open http://localhost:5000

## Deployment (Render — Free)

1. Push this repo to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com) → New → Blueprint
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates:
   - Web service (Docker, 512MB RAM, free)
   - PostgreSQL database (1GB, free)
5. Set env vars in Render dashboard if needed:
   - `DJANGO_SECRET_KEY` (auto-generated)
   - `DJANGO_ALLOWED_HOSTS` → `.onrender.com`
   - `DJANGO_CSRF_ORIGINS` → `https://*.onrender.com`
   - `DJANGO_SSL` → `true`
6. Deploy — done

The app auto-migrates and collects static files on every deploy.

## Deployment (Docker — Any VPS)

```bash
docker-compose up --build -d
```

## Supported Formats

- `.pdf` — Text extraction + OCR fallback (pytesseract)
- `.docx` — Word documents
- `.pptx` — PowerPoint presentations

## TTS Voices

38 edge-tts profiles across 13 languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Chinese, Korean, Russian, Arabic, Hindi, Dutch). Grouped by language in the UI.

## Tech Stack

- **Backend**: Django 5.1, SQLite/PostgreSQL, gunicorn
- **TTS**: edge-tts (primary), gTTS (fallback)
- **Documents**: pypdf, PyMuPDF, python-docx, python-pptx
- **OCR**: pytesseract + Tesseract 5.4
- **Frontend**: QuickTime/iTunes dark metal UI, PDF.js viewer, vanilla JS
