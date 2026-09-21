from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Report, Attachment
from .s3_utils import R2Service


class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSimpleSerializer(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            'id', 'report', 'filename', 'original_filename', 
            'r2_key', 'content_type', 'file_size', 
            'uploaded_by', 'uploaded_at', 'download_url'
        ]
        read_only_fields = ['id', 'r2_key', 'uploaded_by', 'uploaded_at', 'download_url']

    def get_download_url(self, obj):
        """Cloudflare R2 の 5分間有効な署名付きURLを発行"""
        if obj.r2_key:
            r2_service = R2Service()
            return r2_service.generate_presigned_url(obj.r2_key, expires_in=300)
        return None


class ReportSerializer(serializers.ModelSerializer):
    created_by = UserSimpleSerializer(read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = '__all__'
        # 緯度・経度はフロントから送られた値で上書きされず、models.py の save() で自動計算させる
        read_only_fields = ('latitude', 'longitude', 'created_by', 'created_at', 'updated_at')


class AttachmentUploadSerializer(serializers.Serializer):
    report_id = serializers.IntegerField(required=True)
    file = serializers.FileField(required=True)

    ALLOWED_EXTENSIONS = {
        'jpg', 'jpeg', 'png', 'gif', 'webp',   # 写真
        'pdf',                                 # PDF
        'xlsx', 'xls', 'csv',                  # Excel
        'docx', 'doc', 'txt', 'zip'            # その他
    }
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB制限

    def validate_file(self, value):
        ext = value.name.split('.')[-1].lower() if '.' in value.name else ''
        if ext not in self.ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(f"許可されていない拡張子です: .{ext}")

        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(f"ファイルサイズ制限(50MB)を超過しています: {value.size / (1024*1024):.2f}MB")

        return value