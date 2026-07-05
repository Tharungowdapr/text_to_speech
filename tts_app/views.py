import os
import uuid
import json
import zipfile
import io
from datetime import datetime

from django.shortcuts import render, redirect
from django.http import JsonResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.conf import settings

from .models import UserPDF, SavedText, Bookmark
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
def api_register(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return JsonResponse({"error": "Username and password required"}, status=400)
    if len(password) < 4:
        return JsonResponse({"error": "Password too short"}, status=400)
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

@csrf_exempt
@login_required
def api_upload_pdf(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "No file"}, status=400)

    is_valid = f.name.lower().endswith(".pdf") or DocumentProcessor.is_supported(f.name)
    if not is_valid:
        fmts = ", ".join(DocumentProcessor.supported_formats())
        return JsonResponse({"error": f"Unsupported format. Supported: .pdf, {fmts}"}, status=400)

    fid = uuid.uuid4().hex
    saved = f"{fid}_{f.name}"
    path = os.path.join(settings.UPLOAD_DIR, saved)
    with open(path, "wb") as dest:
        for chunk in f.chunks():
            dest.write(chunk)

    pdf = UserPDF.objects.create(
        user=request.user,
        original_name=f.name,
        stored_path=saved
    )
    ext = os.path.splitext(f.name)[1].lower()
    return JsonResponse({"id": pdf.id, "name": f.name, "path": saved, "format": ext})


@csrf_exempt
@login_required
def api_upload_batch_pdf(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    files = request.FILES.getlist("files")
    if not files:
        return JsonResponse({"error": "No files"}, status=400)

    results = []
    for f in files:
        if not f.name.lower().endswith(".pdf"):
            continue
        fid = uuid.uuid4().hex
        saved = f"{fid}_{f.name}"
        path = os.path.join(settings.UPLOAD_DIR, saved)
        with open(path, "wb") as dest:
            for chunk in f.chunks():
                dest.write(chunk)
        pdf = UserPDF.objects.create(user=request.user, original_name=f.name, stored_path=saved)
        results.append({"id": pdf.id, "name": f.name, "path": saved})
    return JsonResponse({"files": results})


@login_required
def api_my_pdfs(request):
    pdfs = UserPDF.objects.filter(user=request.user)
    return JsonResponse([{"id": p.id, "name": p.original_name, "path": p.stored_path, "uploadedAt": p.uploaded_at.isoformat()} for p in pdfs], safe=False)


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
    if not os.path.exists(filepath):
        return JsonResponse({"error": "File not found"}, status=404)

    ext = os.path.splitext(path)[1].lower()
    doc_format = ext.lstrip(".")

    if ext == ".pdf":
        with open(filepath, "rb") as fh:
            pdf_bytes = fh.read()
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
        content = DocumentProcessor.extract(filepath)
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
    if not os.path.exists(filepath):
        return JsonResponse({"error": "File not found"}, status=404)

    with open(filepath, "rb") as fh:
        text, _, _, _ = PDFProcessor.extract_text(fh.read())

    results = PDFProcessor.search_text(text, query)
    return JsonResponse({"results": results, "count": len(results)})


# ── Audio Generation ──

@login_required
def api_tts_stream(request):
    text = request.GET.get("text", "")
    voice = request.GET.get("voice", "en-US-JennyNeural")
    if not text.strip():
        return JsonResponse({"error": "No text"}, status=400)

    filename, error = TTSEngine.generate_audio(text, voice)
    if error:
        return JsonResponse({"error": error}, status=500)
    return JsonResponse({"file": filename})


@login_required
def api_serve_audio(request, filename):
    """Serve generated audio files from AUDIO_DIR"""
    filepath = os.path.join(settings.AUDIO_DIR, filename)
    if not os.path.exists(filepath):
        return JsonResponse({"error": "Not found"}, status=404)
    response = FileResponse(open(filepath, "rb"), content_type="audio/mpeg")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response


@csrf_exempt
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

@csrf_exempt
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
    return JsonResponse({"ok": True})


@csrf_exempt
@login_required
def api_delete_text(request, text_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE required"}, status=405)
    SavedText.objects.filter(id=text_id, user=request.user).delete()
    return JsonResponse({"ok": True})


@login_required
def api_get_texts(request):
    texts = SavedText.objects.filter(user=request.user)
    return JsonResponse([{"id": t.id, "title": t.title, "content": t.content, "createdAt": t.created_at.isoformat()} for t in texts], safe=False)


# ── Bookmarks ──

@csrf_exempt
@login_required
def api_save_bookmark(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    bm = Bookmark.objects.create(
        user=request.user,
        sentence_index=data.get("sentenceIndex", 0),
        label=data.get("label", f"Sentence {data.get('sentenceIndex', 0) + 1}")
    )
    return JsonResponse({"ok": True, "id": bm.id})


@login_required
def api_get_bookmarks(request):
    bms = Bookmark.objects.filter(user=request.user)
    return JsonResponse([{"id": b.id, "sentenceIndex": b.sentence_index, "label": b.label, "timestamp": b.timestamp.isoformat()} for b in bms], safe=False)


@csrf_exempt
@login_required
def api_delete_bookmark(request, bookmark_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE required"}, status=405)
    Bookmark.objects.filter(id=bookmark_id, user=request.user).delete()
    return JsonResponse({"ok": True})


# ── Reading Position ──

@csrf_exempt
@login_required
def api_save_position(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    positions = request.session.get("reading_positions", {})
    positions[data.get("pdfPath", "_")] = {
        "sentenceIndex": data.get("sentenceIndex", 0),
        "timestamp": datetime.now().isoformat()
    }
    request.session["reading_positions"] = positions
    return JsonResponse({"ok": True})


@login_required
def api_get_position(request):
    pdf_path = request.GET.get("path", "")
    positions = request.session.get("reading_positions", {})
    return JsonResponse(positions.get(pdf_path, {}))


# ── Reading Progress ──

@csrf_exempt
@login_required
def api_save_progress(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    data = json.loads(request.body)
    progress = request.session.get("reading_progress", {})
    key = data.get("pdfPath", "_")
    entry = progress.get(key, {"completed": 0, "total": 0})
    entry["completed"] = data.get("completed", entry["completed"])
    entry["total"] = data.get("total", entry["total"])
    entry["timestamp"] = datetime.now().isoformat()
    progress[key] = entry
    request.session["reading_progress"] = progress
    return JsonResponse({"ok": True})


@login_required
def api_get_progress(request):
    pdf_path = request.GET.get("path", "")
    progress = request.session.get("reading_progress", {})
    return JsonResponse(progress.get(pdf_path, {"completed": 0, "total": 0}))


# ── Export Audiobook (ZIP with chapters + playlist) ──

@csrf_exempt
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
    filepath = os.path.join(settings.UPLOAD_DIR, os.path.basename(pdf_path))
    if not os.path.exists(filepath):
        return JsonResponse({"error": "File not found"}, status=404)
    return FileResponse(open(filepath, "rb"), content_type="application/pdf")


# ── Health Check ──

def api_formats(request):
    return JsonResponse({"formats": [".pdf"] + DocumentProcessor.supported_formats()})


def api_health(request):
    return JsonResponse({
        "status": "ok",
        "time": datetime.now().isoformat(),
        "version": "2.0.0"
    })
