from django.db import models
from django.contrib.auth.models import User


class UserPDF(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="pdfs")
    original_name = models.CharField(max_length=500)
    stored_path = models.CharField(max_length=500)
    file_data = models.BinaryField(null=True, blank=True, editable=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]


class SavedText(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="saved_texts")
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Bookmark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookmarks")
    pdf_file = models.ForeignKey(UserPDF, on_delete=models.CASCADE, null=True, blank=True)
    sentence_index = models.IntegerField()
    label = models.CharField(max_length=300, default="")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
