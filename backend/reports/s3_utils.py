import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError  # ★ 追加
from django.conf import settings

class R2Service:
    def __init__(self):
        self.account_id = getattr(settings, 'R2_ACCOUNT_ID', '') or os.environ.get('R2_ACCOUNT_ID', '')
        self.access_key = getattr(settings, 'R2_ACCESS_KEY_ID', '') or os.environ.get('R2_ACCESS_KEY_ID', '')
        self.secret_key = getattr(settings, 'R2_SECRET_ACCESS_KEY', '') or os.environ.get('R2_SECRET_ACCESS_KEY', '')
        self.bucket_name = getattr(settings, 'R2_BUCKET', '') or os.environ.get('R2_BUCKET', 'business-report-files')
        
        self.is_configured = bool(self.account_id and self.access_key and self.secret_key)

        if self.is_configured:
            self.endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(signature_version='s3v4'),
                region_name='auto'
            )
        else:
            self.s3_client = None

    def upload_file(self, file_obj, r2_key, content_type):
        """ファイルをCloudflare R2にアップロード"""
        if not self.is_configured:
            print(f"[R2 Mock Upload] File '{file_obj.name}' mapped to key: {r2_key}")
            return
        
        self.s3_client.upload_fileobj(
            file_obj,
            self.bucket_name,
            r2_key,
            ExtraArgs={'ContentType': content_type}
        )

    def generate_presigned_url(self, r2_key, expires_in=300):
        """期限付きダウンロードURL（Pre-signed URL）を発行（デフォルト5分）"""
        if not self.is_configured:
            return f"/mock-download/{r2_key}"

        # ★ try-except を追加して例外発生時に安全に空文字または None を返すように保護
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': r2_key
                },
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            print(f"[R2 Presigned URL Error]: {e}")
            return ""

    def delete_file(self, r2_key):
        """R2上のオブジェクトを削除"""
        if not self.is_configured:
            print(f"[R2 Mock Delete] Key: {r2_key}")
            return

        self.s3_client.delete_object(
            Bucket=self.bucket_name,
            Key=r2_key
        )