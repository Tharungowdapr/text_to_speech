from django.urls import path, include

urlpatterns = [
    path("", include("tts_app.urls")),
]
