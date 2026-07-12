import os
import uuid
import json
import zipfile
import io
import logging
from datetime import datetime
from urllib.parse import unquote

logger = logging.getLogger(__name__)

from django.shortcuts import render, redirect
from django.http import JsonResponse, FileResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.conf import settings
from django_ratelimit.decorators import ratelimit

from .models import UserPDF, SavedText, Bookmark, ReadingPosition
from .utils.pdf_processor import PDFProcessor
from .utils.tts_engine import TTSEngine
from .utils.document_processor import DocumentProcessor


# ── Auth Pages ──

def login_page(request):
    if request.user.is_authenticated:
        return redirect("/")
    return render(request, "login.html")


def register_page(request):
    if request.user.is_authenticated:
        return redirect("/")
    return render(request, "register.html")


# ── Auth API ──

@csrf_exempt
@ratelimit(key='ip', rate='10/m', method='POST', block=True)
def api_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    user = authenticate(username=data.get("username"), password=data.get("password"))
    if user:
        login(request, user)
        return JsonResponse({"ok": True, "username": user.username})
    return JsonResponse({"error": "Invalid credentials"}, status=401)


@csrf_exempt
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def api_register(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return JsonResponse({"error": "Username and password required"}, status=400)
    # Validate password with Django's built-in validators
    try:
        validate_password(password)
    except ValidationError as e:
        return JsonResponse({"error": ", ".join(e.messages)}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username taken"}, status=400)
    user = User.objects.create_user(username=username, password=password)
    login(request, user)
    return JsonResponse({"ok": True, "username": user.username})


def api_logout(request):
    logout(request)
    return JsonResponse({"ok": True})


def api_me(request):
    if request.user.is_authenticated:
        return JsonResponse({"authenticated": True, "username": request.user.username})
    return JsonResponse({"authenticated": False})


# ── Page Views ──

def home(request):
    pdfs = UserPDF.objects.filter(user=request.user) if request.user.is_authenticated else []
    return render(request, "home.html", {"recent_pdfs": pdfs})


@login_required
def reader(request):
    return render(request, "reader.html")


@login_required
def text_to_speech(request):
    return render(request, "text_to_speech.html")


# ── Document Upload (PDF, DOCX, PPTX) ──

@login_required
def api_upload_pdf(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "No file"}, status=400)
    if f.size > settings.MAX_UPLOAD_SIZE:
        return JsonResponse({"error": f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB"}, status=400)

    is_valid = f.name.lower().endswith(".pdf") or DocumentProcessor.is_supported(f.name)
    if not is_valid:
        fmts = ", ".join(DocumentProcessor.supported_formats())
        return JsonResponse({"error": f"Unsupported format. Supported: .pdf, {fmts}"}, status=400)

    fid = uuid.uuid4().hex
    saved = f"{fid}_{f.name}"
    file_bytes = b"".join(f.chunks())
    path = os.path.join(settings.UPLOAD_DIR, saved)
    try:
        with open(path, "wb") as dest:
            dest.write(file_bytes)
    except OSError:
        logging.warning("Failed to write uploaded file to disk (cross-instance or read-only FS): %s", saved)

    pdf = UserPDF.objects.create(
        user=request.user,
        original_name=f.name,
        stored_path=saved,
        file_data=file_bytes
    )
    ext = os.path.splitext(f.name)[1].lower()
    return JsonResponse({"id": pdf.id, "name": f.name, "path": saved, "format": ext})


@login_required
def api_upload_batch_pdf(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    files = request.FILES.getlist("files")
    if not files:
        return JsonResponse({"error": "No files"}, status=400)
    oversized = [f.name for f in files if f.size > settings.MAX_UPLOAD_SIZE]
    if oversized:
        return JsonResponse({"error": f"Files too large ({', '.join(oversized)}). Max {settings.MAX_UPLOAD_SIZE_MB}MB each"}, status=400)

    results = []
    for f in files:
        if not f.name.lower().endswith(".pdf"):
            continue
        fid = uuid.uuid4().hex
        saved = f"{fid}_{f.name}"
        path = os.path.join(settings.UPLOAD_DIR, saved)
        file_bytes = b"".join(f.chunks())
        try:
            with open(path, "wb") as dest:
                dest.write(file_bytes)
        except OSError:
            logging.warning("Failed to write uploaded file to disk (cross-instance or read-only FS): %s", saved)
        pdf = UserPDF.objects.create(user=request.user, original_name=f.name, stored_path=saved, file_data=file_bytes)
        results.append({"id": pdf.id, "name": f.name, "path": saved})
    return JsonResponse({"files": results})


@login_required
def api_my_pdfs(request):
    pdfs = UserPDF.objects.filter(user=request.user)
    data = [
        {
            "id": p.id,
            "name": p.original_name,
            "path": p.stored_path,
            "uploadedAt": p.uploaded_at.isoformat()
        }
        for p in pdfs
    ]
    return JsonResponse(data, safe=False)


@csrf_exempt
@login_required
def api_remove_pdf(request, pdf_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE required"}, status=405)
    UserPDF.objects.filter(id=pdf_id, user=request.user).delete()
    return JsonResponse({"ok": True})


# ── Document Extraction (PDF, DOCX, PPTX) ──

@csrf_exempt
@login_required
def api_extract_text(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    path = data.get("path")
    force_ocr = data.get("forceOcr", False)
    if not path:
        return JsonResponse({"error": "No path"}, status=400)

    filepath = os.path.join(settings.UPLOAD_DIR, os.path.basename(path))
    if os.path.exists(filepath):
        with open(filepath, "rb") as fh:
            pdf_bytes = fh.read()
    else:
        pdf = UserPDF.objects.filter(stored_path=os.path.basename(path)).first()
        if pdf and pdf.file_data:
            pdf_bytes = pdf.file_data
        else:
            return JsonResponse({"error": "File not found"}, status=404)

    ext = os.path.splitext(path)[1].lower()
    doc_format = ext.lstrip(".")

    if ext == ".pdf":
        raw, sentences, num_pages, chapters = PDFProcessor.extract_text(pdf_bytes, force_ocr=force_ocr)
        return JsonResponse({
            "raw": raw,
            "sentences": sentences,
            "numPages": num_pages,
            "chapters": chapters,
            "format": "pdf",
            "ocrUsed": force_ocr or (not raw.strip())
        })
    elif ext in DocumentProcessor.supported_formats():
        content = DocumentProcessor.extract_from_bytes(pdf_bytes, ext)
        sentences = [{"text": s, "page": 0} for s in PDFProcessor._split_sentences(content) if s.strip()]
        chapters = PDFProcessor._detect_chapters(content)
        return JsonResponse({
            "raw": content,
            "sentences": sentences,
            "numPages": 0,
            "chapters": chapters,
            "format": doc_format,
            "ocrUsed": False
        })
    else:
        return JsonResponse({"error": "Unsupported format"}, status=400)


# ── Text Search ──

@csrf_exempt
@login_required
def api_search_text(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    path = data.get("path")
    query = data.get("query", "").strip()
    if not path or not query:
        return JsonResponse({"error": "path and query required"}, status=400)

    filepath = os.path.join(settings.UPLOAD_DIR, os.path.basename(path))
    if os.path.exists(filepath):
        with open(filepath, "rb") as fh:
            pdf_bytes = fh.read()
    else:
        # IDOR fix: filter by user
        pdf = UserPDF.objects.filter(stored_path=os.path.basename(path), user=request.user).first()
        if pdf and pdf.file_data:
            pdf_bytes = pdf.file_data
        else:
            return JsonResponse({"error": "File not found"}, status=404)

    text, _, _, _ = PDFProcessor.extract_text(pdf_bytes)
    results = PDFProcessor.search_text(text, query)
    return JsonResponse({"results": results, "count": len(results)})


# ── File Serving (PDF & Audio) ──

# ── Audio Generation ──

@csrf_exempt
def api_tts_stream(request):
    text = request.GET.get("text", "")
    voice = request.GET.get("voice", "en-US-JennyNeural")
    if not text.strip():
        return JsonResponse({"error": "No text"}, status=400)

    audio_bytes, error = TTSEngine.generate_audio_stream(text, voice)
    if error:
        return JsonResponse({"error": error}, status=500)
        
    size = len(audio_bytes)
    range_header = request.META.get('HTTP_RANGE', '').strip()

    if range_header.startswith('bytes='):
        import re
        try:
            match = re.match(r'bytes=(\d+)-(\d*)', range_header)
            if match:
                start = int(match.group(1))
                end = match.group(2)
                end = int(end) if end else size - 1
                length = end - start + 1
                
                response = HttpResponse(audio_bytes[start:end + 1], status=206, content_type="audio/mpeg")
                response['Content-Range'] = f'bytes {start}-{end}/{size}'
                response['Content-Length'] = str(length)
                response["Accept-Ranges"] = "bytes"
                return response
        except ValueError:
            pass

    response = HttpResponse(audio_bytes, content_type="audio/mpeg")
    response["Content-Disposition"] = 'inline; filename="tts.mp3"'
    response["Cache-Control"] = "public, max-age=31536000"
    response["Content-Length"] = str(size)
    response["Accept-Ranges"] = "bytes"
    return response


@csrf_exempt
def api_tts_timing(request):
    """Return word boundary timing data for word-level highlighting"""
    text = request.GET.get("text", "")
    voice = request.GET.get("voice", "en-US-JennyNeural")
    if not text.strip():
        return JsonResponse({"error": "No text"}, status=400)
    result, error = TTSEngine.generate_audio_stream_with_timing(text, voice)
    if error:
        return JsonResponse({"error": error}, status=500)
    return JsonResponse({"words": result.get("words", [])})


@login_required
def api_serve_audio(request, filename):
    """Serve generated audio files from AUDIO_DIR with DB fallback"""
    filename = unquote(filename)
    cache_key = filename.replace(".mp3", "")
    from tts_app.models import AudioCache

    # Try local disk first
    filepath = os.path.join(settings.AUDIO_DIR, filename)
    if os.path.exists(filepath):
        response = FileResponse(open(filepath, "rb"), content_type="audio/mpeg")
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    # Fallback to DB
    cache_obj = AudioCache.objects.filter(cache_key=cache_key).first()
    if cache_obj:
        return HttpResponse(cache_obj.audio_data, content_type="audio/mpeg")

    return JsonResponse({"error": "Audio file not found"}, status=404)


@login_required
def api_tts_batch(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    texts = data.get("texts", [])
    voice = data.get("voice", "en-US-JennyNeural")
    if not texts:
        return JsonResponse({"error": "No texts"}, status=400)
    
    texts_flat = [t["text"] if isinstance(t, dict) else t for t in texts]
    mapping = TTSEngine.generate_audio_batch(texts_flat, voice)
    return JsonResponse({"mapping": {str(k): v for k, v in mapping.items()}, "count": len(mapping)})


# ── Supported Languages & Voices ──

def api_languages(request):
    return JsonResponse({"languages": TTSEngine.supported_languages()})


def api_voices(request):
    return JsonResponse(TTSEngine.supported_voices())


# ── Saved Texts ──

@login_required
def api_save_text(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    if not title or not content:
        return JsonResponse({"error": "Title and content required"}, status=400)
    SavedText.objects.create(user=request.user, title=title, content=content)
    count = SavedText.objects.filter(user=request.user).count()
    return JsonResponse({"ok": True, "count": count})


@login_required
def api_delete_text(request, text_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE required"}, status=405)
    SavedText.objects.filter(id=text_id, user=request.user).delete()
    count = SavedText.objects.filter(user=request.user).count()
    return JsonResponse({"ok": True, "count": count})


@login_required
def api_get_texts(request):
    texts = SavedText.objects.filter(user=request.user)
    data = [
        {
            "id": t.id,
            "title": t.title,
            "content": t.content,
            "createdAt": t.created_at.isoformat()
        }
        for t in texts
    ]
    return JsonResponse(data, safe=False)


# ── Bookmarks ──

@login_required
def api_save_bookmark(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    pdf_path = data.get("pdfPath", "")
    pdf_file = None
    if pdf_path:
        pdf_file = UserPDF.objects.filter(user=request.user, stored_path=os.path.basename(pdf_path)).first()
    bm = Bookmark.objects.create(
        user=request.user,
        pdf_file=pdf_file,
        pdf_path=pdf_path,
        sentence_index=data.get("sentenceIndex", 0),
        label=data.get("label", f"Sentence {data.get('sentenceIndex', 0) + 1}")
    )
    return JsonResponse({"ok": True, "id": bm.id})


@login_required
def api_get_bookmarks(request):
    pdf_path = request.GET.get("pdfPath", "")
    bms = Bookmark.objects.filter(user=request.user)
    if pdf_path:
        bms = bms.filter(pdf_path=pdf_path)
    data = [
        {
            "id": b.id,
            "sentenceIndex": b.sentence_index,
            "label": b.label,
            "timestamp": b.timestamp.isoformat()
        }
        for b in bms
    ]
    return JsonResponse(data, safe=False)


@login_required
def api_delete_bookmark(request, bookmark_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE required"}, status=405)
    Bookmark.objects.filter(id=bookmark_id, user=request.user).delete()
    return JsonResponse({"ok": True})


# ── Reading Position (DB-persisted) ──

@login_required
def api_save_position(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    pdf_path = data.get("pdfPath", "_")
    ReadingPosition.objects.update_or_create(
        user=request.user,
        pdf_path=pdf_path,
        defaults={"sentence_index": data.get("sentenceIndex", 0)}
    )
    return JsonResponse({"ok": True})


@login_required
def api_get_position(request):
    pdf_path = request.GET.get("path", "")
    pos = ReadingPosition.objects.filter(user=request.user, pdf_path=pdf_path).first()
    if pos:
        return JsonResponse({"sentenceIndex": pos.sentence_index})
    return JsonResponse({})


# ── Reading Progress (DB-persisted) ──

@login_required
def api_save_progress(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    pdf_path = data.get("pdfPath", "_")
    ReadingPosition.objects.update_or_create(
        user=request.user,
        pdf_path=pdf_path,
        defaults={
            "completed": data.get("completed", 0),
            "total": data.get("total", 0),
        }
    )
    return JsonResponse({"ok": True})


@login_required
def api_get_progress(request):
    pdf_path = request.GET.get("path", "")
    pos = ReadingPosition.objects.filter(user=request.user, pdf_path=pdf_path).first()
    if pos:
        return JsonResponse({"completed": pos.completed, "total": pos.total})
    return JsonResponse({"completed": 0, "total": 0})


# ── Export Audiobook (ZIP with chapters + playlist) ──

@login_required
def api_export_zip(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    sentences = data.get("sentences", [])
    voice = data.get("voice", "en-US-JennyNeural")
    chapters = data.get("chapters", [])
    if not sentences:
        return JsonResponse({"error": "No sentences"}, status=400)

    texts = [s["text"] if isinstance(s, dict) else s for s in sentences]
    mapping = TTSEngine.generate_audio_batch(texts, voice)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, _ in enumerate(texts):
            fname = mapping.get(str(i), "")
            if not fname:
                continue
            apath = os.path.join(settings.AUDIO_DIR, fname)
            if os.path.exists(apath):
                zf.write(apath, f"{i+1:04d}_{fname}")

        import csv
        ch_buf = io.StringIO()
        w = csv.writer(ch_buf)
        w.writerow(["index", "title", "sentence", "file"])
        for ch in chapters:
            si = ch.get("sentenceIndex", 0)
            f = mapping.get(str(si), "")
            w.writerow([ch.get("index", 0), ch.get("title", "Chapter"), si, f])
        zf.writestr("chapters.csv", ch_buf.getvalue())

        lines = ["#EXTM3U"]
        for ch in chapters:
            si = ch.get("sentenceIndex", 0)
            f = mapping.get(str(si), "")
            if f:
                lines.append(f"#EXTINF:-1,{ch.get('title', 'Chapter')}")
                lines.append(f"{int(ch.get('index', 0)) + 1:04d}_{f}")
        zf.writestr("playlist.m3u", "\n".join(lines))

    buf.seek(0)
    return FileResponse(buf, as_attachment=True, filename="audiobook.zip",
                        content_type="application/zip")


# ── Serve PDF bytes for PDF.js ──

def api_serve_pdf(request, pdf_path):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    basename = os.path.basename(unquote(pdf_path))
    # IDOR fix: always filter by user
    pdf = UserPDF.objects.filter(stored_path=basename, user=request.user).first()
    if pdf:
        if pdf.file_data:
            return HttpResponse(pdf.file_data, content_type="application/pdf")
        filepath = os.path.join(settings.UPLOAD_DIR, basename)
        if os.path.exists(filepath):
            return FileResponse(open(filepath, "rb"), content_type="application/pdf")
    return JsonResponse({"error": "File not found"}, status=404)


# ── Health Check ──

def api_formats(request):
    return JsonResponse({"formats": [".pdf"] + DocumentProcessor.supported_formats()})


def api_health(request):
    return JsonResponse({
        "status": "ok",
        "time": datetime.now().isoformat(),
        "version": "2.0.0"
    })
