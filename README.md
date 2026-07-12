# PDF to Audio Converter

Django web app that converts PDFs, DOCX, and PPTX to speech with synchronized word-level highlighting, 38 edge-tts voices in 13 languages, OCR for scanned PDFs, pronunciation rules, chapter navigation, and audiobook ZIP export.

**Live:** [texttospeech-omega.vercel.app](https://texttospeech-omega.vercel.app)

## Features

- **PDF Reader** — Render PDFs with PDF.js viewer, extract text, play audio synced to each sentence
- **Word-level highlighting** — Each word highlights in real-time as it's spoken (purple = active, green = completed)
- **Text to Speech** — Paste any text, split into sentences, generate audio with 38 neural voices
- **Chapter navigation** — Auto-detected chapters in a collapsible sidebar, click to jump
- **Pronunciation rules** — Custom word→replacement mappings applied before TTS
- **Speed trainer** — Gradually increases playback speed for comprehension training
- **OCR** — Scanned PDF support via pytesseract
- **Audiobook export** — ZIP with chapter-organized MP3s + M3U playlist
- **PWA** — Installable on mobile, offline page caching via service worker
- **Cross-device sync** — Reading positions and progress saved to DB per user
- **Dark mode** — System-following with manual toggle

## Quick Start (Development)

```bash
git clone https://github.com/Tharungowdapr/text_to_speech.git
cd text_to_speech
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:5000
```

Open [http://localhost:5000](http://localhost:5000)

## Deployment (Vercel — Primary)

1. Push to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import Git Repository
3. Connect your GitHub repo
4. Framework: **Other**
5. Root Directory: `text_to_speech`
6. Build Command: _(leave empty)_
7. Output Directory: _(leave empty)_
8. Add env vars in Vercel dashboard:
   - `DJANGO_SECRET_KEY` — random 50-char string
   - `DATABASE_URL` — your Neon/Postgres connection string
9. Deploy — done

The app auto-migrates on cold start via `api/index.py`. Static files served by the WSGI handler.

## Deployment (Render — Free)

1. Push this repo to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com) → New → Blueprint
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates:
   - Web service (Docker, 512MB RAM, free)
   - PostgreSQL database (1GB, free)
5. Set env vars in Render dashboard:
   - `DJANGO_SECRET_KEY` (auto-generated)
   - `DJANGO_ALLOWED_HOSTS` → `.onrender.com`
   - `DJANGO_CSRF_ORIGINS` → `https://*.onrender.com`
   - `DJANGO_SSL` → `true`
6. Deploy — done

## Deployment (Docker — Any VPS)

```bash
docker-compose up --build -d
```

## TTS Engine (100% Free, Zero API Keys)

The TTS stack requires **no API keys, no accounts, and no paid services**:

| Engine | Quality | Internet | Use |
|---|---|---|---|
| [edge-tts](https://github.com/rany2/edge-tts) | Excellent (Microsoft Neural) | Yes | Primary |
| [gTTS](https://github.com/pndurette/gTTS) | Good (Google Translate) | Yes | Fallback |
| espeak-ng | Basic (robotic) | No | Offline last resort |

**Fallback chain:** edge-tts → gTTS → espeak-ng

### Supported Voices

38 edge-tts profiles across 13 languages: English, Spanish, French, German, Italian, Portuguese, Dutch, Japanese, Chinese, Korean, Russian, Arabic, Hindi.

## Supported Document Formats

| Format | Library | Notes |
|---|---|---|
| `.pdf` | [pypdf](https://github.com/py-pdf/pypdf) + [PyMuPDF](https://github.com/pymupdf/PyMuPDF) | Text extraction + OCR fallback |
| `.docx` | [python-docx](https://github.com/python-openxml/python-docx) | Word documents |
| `.pptx` | [python-pptx](https://github.com/scanny/python-pptx) | PowerPoint presentations |

## Tech Stack

- **Backend:** [Django 5.1](https://www.djangoproject.com/), PostgreSQL ([Neon](https://neon.tech/)), gunicorn
- **TTS:** [edge-tts](https://github.com/rany2/edge-tts), [gTTS](https://github.com/pndurette/gTTS), espeak-ng
- **Documents:** [pypdf](https://github.com/py-pdf/pypdf), [PyMuPDF](https://github.com/pymupdf/PyMuPDF), [python-docx](https://github.com/python-openxml/python-docx), [python-pptx](https://github.com/scanny/python-pptx)
- **OCR:** [pytesseract](https://github.com/madmaze/pytesseract) + Tesseract 5.4
- **Frontend:** PDF.js 3.11, vanilla JS, CSS glassmorphism (QuickTime/iTunes aesthetic)
- **Deploy:** [Vercel](https://vercel.com) (primary), [Render](https://render.com) (free tier), Docker

## Project Structure

```
text_to_speech/
├── api/index.py              # Vercel WSGI entrypoint
├── config/
│   ├── settings.py           # Django settings
│   ├── urls.py               # Root URL config
│   └── wsgi.py               # WSGI application
├── tts_app/
│   ├── models.py             # UserPDF, SavedText, Bookmark, AudioCache, ReadingPosition, PronunciationRule
│   ├── views.py              # All API endpoints
│   ├── urls.py               # URL routing
│   └── utils/
│       ├── tts_engine.py     # TTS generation (edge-tts + gTTS + espeak-ng)
│       ├── pdf_processor.py  # PDF text extraction + OCR
│       └── document_processor.py  # DOCX/PPTX extraction
├── static/
│   ├── css/style.css         # Global styles (glassmorphism dark theme)
│   ├── js/
│   │   ├── main.js           # Shared utilities (CSRF, toast, voice select)
│   │   ├── reader.js         # PDF reader audio playback
│   │   ├── tts.js            # Text-to-speech page
│   │   └── sw.js             # PWA service worker
│   ├── manifest.json         # PWA manifest
│   └── icons/                # PWA icons (192px, 512px)
├── templates/
│   ├── base.html             # Base template with theme + auth
│   ├── home.html             # Landing page
│   ├── reader.html           # PDF reader with transport bar
│   ├── text_to_speech.html   # TTS page with pronunciation rules
│   ├── login.html / register.html
│   └── _sidebar.html         # Navigation sidebar
├── requirements.txt          # Python dependencies
├── vercel.json               # Vercel deployment config
├── render.yaml               # Render deployment config
└── Dockerfile                # Docker deployment
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | Yes | _(insecure default)_ | Django secret key |
| `DATABASE_URL` | Yes | SQLite | PostgreSQL connection string |
| `DJANGO_ALLOWED_HOSTS` | No | `*` | Comma-separated allowed hosts |
| `DJANGO_CSRF_ORIGINS` | No | localhost | Comma-separated CSRF origins |
| `DJANGO_SSL` | No | `false` | Enable HTTPS settings |
| `DJANGO_UPLOAD_DIR` | No | `./uploads` | Upload directory path |
| `DJANGO_AUDIO_DIR` | No | `./audio_cache` | Audio cache directory |
| `MAX_UPLOAD_SIZE_MB` | No | `50` | Max file upload size |
