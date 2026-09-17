from django.db import models
from django.contrib.auth.models import User

class Report(models.Model):
    report_no = models.CharField("件名番号", max_length=50, db_index=True)
    reception_no = models.CharField("受付番号", max_length=50, db_index=True)
    date = models.DateField("報告日付", db_index=True)
    title = models.CharField("件名", max_length=200)
    address = models.CharField("住所", max_length=300, blank=True, default="")
    description = models.TextField("業務内容")
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="reports", verbose_name="作成者")
    created_at = models.DateTimeField("作成日時", auto_now_add=True)
    updated_at = models.DateTimeField("更新日時", auto_now=True)

    class Meta:
        verbose_name = "業務報告"
        verbose_name_plural = "業務報告一覧"
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"[{self.report_no}] {self.title}"


class Attachment(models.Model):
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="attachments", verbose_name="対象報告")
    filename = models.CharField("保存ファイル名", max_length=255)
    original_filename = models.CharField("オリジナルファイル名", max_length=255)
    r2_key = models.CharField("R2オブジェクトキー", max_length=500, unique=True)
    content_type = models.CharField("Content-Type", max_length=100)
    file_size = models.BigIntegerField("ファイルサイズ(Bytes)")
    uploaded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="uploaded_attachments", verbose_name="アップロード者")
    uploaded_at = models.DateTimeField("アップロード日時", auto_now_add=True)

    class Meta:
        verbose_name = "添付ファイル"
        verbose_name_plural = "添付ファイル一覧"

    def __str__(self):
        return f"{self.original_filename} ({self.report.report_no})"


class OperationLog(models.Model):
    ACTION_CHOICES = (
        ('CREATE', '作成'),
        ('READ', '閲覧/ダウンロード'),
        ('UPDATE', '更新'),
        ('DELETE', '削除'),
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name="操作ユーザー")
    action = models.CharField("操作種別", max_length=20, choices=ACTION_CHOICES)
    target_model = models.CharField("対象モデル", max_length=50)
    target_id = models.CharField("対象ID", max_length=50)
    details = models.TextField("詳細情報", blank=True, default="")
    ip_address = models.GenericIPAddressField("IPアドレス", null=True, blank=True)
    created_at = models.DateTimeField("操作日時", auto_now_add=True)

    class Meta:
        verbose_name = "操作ログ"
        verbose_name_plural = "操作ログ一覧"
        ordering = ['-created_at']
