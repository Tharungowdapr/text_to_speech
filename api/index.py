import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", ".vercel.app")
os.environ.setdefault("DJANGO_CSRF_ORIGINS", "https://*.vercel.app")
os.environ.setdefault("DJANGO_SSL", "false")

# Apply pending migrations on cold start (idempotent)
import django
django.setup()
from django.core.management import call_command
try:
    call_command("migrate", "--noinput")
except Exception:
    pass  # fail silently if DB not available

from django.core.wsgi import get_wsgi_application
from django.contrib.staticfiles.handlers import StaticFilesHandler

app = StaticFilesHandler(get_wsgi_application())
