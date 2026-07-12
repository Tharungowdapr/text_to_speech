import os
import sys
import mimetypes

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", ".vercel.app")
os.environ["DJANGO_CSRF_ORIGINS"] = "https://texttospeech-omega.vercel.app,https://text-to-speech-pg8k.onrender.com"
os.environ.setdefault("DJANGO_SSL", "true")
os.environ["DJANGO_DEBUG"] = "false"
os.environ.setdefault("DJANGO_UPLOAD_DIR", "/tmp/uploads")
os.environ.setdefault("DJANGO_AUDIO_DIR", "/tmp/audio")

import django
django.setup()

# Auto-migrate on cold start
from django.core.management import call_command
call_command("migrate", "--noinput")

static_root = os.path.join(project_root, "static")


class StaticFileHandler:
    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "/")
        if path.startswith("/static/"):
            file_path = os.path.join(static_root, path[len("/static/"):])
            file_path = os.path.normpath(file_path)
            if file_path.startswith(static_root) and os.path.isfile(file_path):
                content_type, _ = mimetypes.guess_type(file_path)
                if content_type is None:
                    content_type = "application/octet-stream"
                try:
                    with open(file_path, "rb") as f:
                        data = f.read()
                    headers = [
                        ("Content-Type", content_type),
                        ("Content-Length", str(len(data))),
                        ("Cache-Control", "public, max-age=31536000"),
                    ]
                    start_response("200 OK", headers)
                    return [data]
                except Exception:
                    pass

        from django.core.wsgi import get_wsgi_application
        return get_wsgi_application()(environ, start_response)


app = StaticFileHandler()
