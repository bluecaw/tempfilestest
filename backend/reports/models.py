import secrets
import hashlib
from datetime import timedelta
import requests
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings


class Report(models.Model):
    report_no = models.CharField("件名番号", max_length=50, db_index=True)
    reception_no = models.CharField("受付番号", max_length=50, db_index=True)
    date = models.DateField("報告日付", db_index=True)
    title = models.CharField("件名", max_length=200)
    address = models.CharField("住所", max_length=300, blank=True, default="")
    latitude = models.FloatField("緯度", null=True, blank=True)
    longitude = models.FloatField("経度", null=True, blank=True)
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

    def save(self, *args, **kwargs):
        # 既存データ更新時：DB上の変更前の住所と比較
        if self.pk:
            old_instance = Report.objects.filter(pk=self.pk).first()
            # 住所が変更された場合は、緯度経度を一旦クリアして再取得させる
            if old_instance and old_instance.address != self.address:
                self.latitude = None
                self.longitude = None

        # 住所が入力されており、かつ緯度または経度が未設定（または上記でクリアされた場合）に座標を取得
        if self.address and (self.latitude is None or self.longitude is None):
            api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
            if api_key:
                url = "https://maps.googleapis.com/maps/api/geocode/json"
                params = {
                    'address': self.address,
                    'key': api_key,
                    'language': 'ja',
                }
                try:
                    response = requests.get(url, params=params, timeout=5)
                    data = response.json()
                    if data.get('status') == 'OK':
                        location = data['results'][0]['geometry']['location']
                        self.latitude = location['lat']
                        self.longitude = location['lng']
                except Exception as e:
                    print(f"Geocoding API Error: {e}")

        super().save(*args, **kwargs)


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


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_otps')
    otp_hash = models.CharField(max_length=64)  # 6桁コードのハッシュ値（生コードは保存しない）
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)  # 試行失敗回数

    @classmethod
    def generate_otp(cls, user):
        # 6桁のランダム数字を生成（例: "048291"）
        raw_otp = f"{secrets.randbelow(1000000):06d}"
        otp_hash = hashlib.sha256(raw_otp.encode()).hexdigest()
        
        # 該当ユーザーの過去の未使用コードをすべて無効化
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        
        # 新しいOTPレコードを保存
        cls.objects.create(user=user, otp_hash=otp_hash)
        
        # メール送信用に平文の6桁コードを返す
        return raw_otp

    def is_valid(self, raw_otp):
        if self.is_used:
            return False
            
        # 有効期限: 10分
        if timezone.now() > self.created_at + timedelta(minutes=10):
            return False
            
        # 試行回数上限: 3回失敗したら無効化
        if self.attempts >= 3:
            self.is_used = True
            self.save()
            return False

        # ハッシュ値を検証
        input_hash = hashlib.sha256(raw_otp.encode()).hexdigest()
        if secrets.compare_digest(self.otp_hash, input_hash):
            return True
        else:
            self.attempts += 1
            self.save()
            return False