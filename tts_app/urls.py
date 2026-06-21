from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("reader/", views.reader, name="reader"),
    path("text-to-speech/", views.text_to_speech, name="text_to_speech"),
    path("login/", views.login_page, name="login"),
    path("register/", views.register_page, name="register"),

    # Auth API
    path("api/login/", views.api_login, name="api_login"),
    path("api/register/", views.api_register, name="api_register"),
    path("api/logout/", views.api_logout, name="api_logout"),
    path("api/me/", views.api_me, name="api_me"),

    # PDF API
    path("api/upload-pdf/", views.api_upload_pdf, name="api_upload_pdf"),
    path("api/upload-batch-pdf/", views.api_upload_batch_pdf, name="api_upload_batch_pdf"),
    path("api/my-pdfs/", views.api_my_pdfs, name="api_my_pdfs"),
    path("api/remove-pdf/<pdf_id>/", views.api_remove_pdf, name="api_remove_pdf"),
    path("api/extract-text/", views.api_extract_text, name="api_extract_text"),
    path("api/search-text/", views.api_search_text, name="api_search_text"),

    # Audio API
    path("api/tts-stream/", views.api_tts_stream, name="api_tts_stream"),
    path("api/tts-batch/", views.api_tts_batch, name="api_tts_batch"),
    path("api/languages/", views.api_languages, name="api_languages"),
    path("api/voices/", views.api_voices, name="api_voices"),

    # Saved texts
    path("api/save-text/", views.api_save_text, name="api_save_text"),
    path("api/delete-text/<text_id>/", views.api_delete_text, name="api_delete_text"),
    path("api/get-texts/", views.api_get_texts, name="api_get_texts"),

    # Bookmarks
    path("api/save-bookmark/", views.api_save_bookmark, name="api_save_bookmark"),
    path("api/get-bookmarks/", views.api_get_bookmarks, name="api_get_bookmarks"),
    path("api/delete-bookmark/<bookmark_id>/", views.api_delete_bookmark, name="api_delete_bookmark"),

    # Reading position / progress
    path("api/save-position/", views.api_save_position, name="api_save_position"),
    path("api/get-position/", views.api_get_position, name="api_get_position"),
    path("api/save-progress/", views.api_save_progress, name="api_save_progress"),
    path("api/get-progress/", views.api_get_progress, name="api_get_progress"),

    # Export audiobook
    path("api/export-zip/", views.api_export_zip, name="api_export_zip"),

    # Supported formats
    path("api/formats/", views.api_formats, name="api_formats"),

    # Serve + health
    path("api/serve-pdf/<path:pdf_path>/", views.api_serve_pdf, name="api_serve_pdf"),
    path("api/health/", views.api_health, name="api_health"),
]
