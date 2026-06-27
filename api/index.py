import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", ".vercel.app")
os.environ.setdefault("DJANGO_CSRF_ORIGINS", "https://*.vercel.app")
os.environ.setdefault("DJANGO_SSL", "false")

from django.core.wsgi import get_wsgi_application
from django.conf import settings
from django.contrib.staticfiles.handlers import StaticFilesHandler

app = StaticFilesHandler(get_wsgi_application())
