from django.urls import path, include
from django.http import HttpResponse

def empty_favicon(request):
    return HttpResponse(status=204)

urlpatterns = [
    path("favicon.ico", empty_favicon),
    path("favicon.png", empty_favicon),
    path("", include("tts_app.urls")),
]
