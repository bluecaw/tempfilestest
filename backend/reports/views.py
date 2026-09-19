import uuid
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.http import HttpResponseRedirect, JsonResponse
from django.middleware.csrf import get_token
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from .models import Report, Attachment, OperationLog
from .serializers import ReportSerializer, AttachmentSerializer, AttachmentUploadSerializer
from .s3_utils import R2Service

def log_operation(user, action, target_model, target_id, details="", request=None):
    ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
    OperationLog.objects.create(
        user=user if user and user.is_authenticated else None,
        action=action,
        target_model=target_model,
        target_id=str(target_id),
        details=details,
        ip_address=ip
    )

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().prefetch_related('attachments', 'created_by')
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        report = serializer.save(created_by=self.request.user)
        log_operation(self.request.user, 'CREATE', 'Report', report.id, f"件名: {report.title}", self.request)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        log_operation(request.user, 'READ', 'Report', instance.id, f"閲覧件名: {instance.title}", request)
        return super().retrieve(request, *args, **kwargs)


class AttachmentUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AttachmentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        report_id = serializer.validated_data['report_id']
        file_obj = serializer.validated_data['file']
        report = get_object_or_404(Report, pk=report_id)

        # R2 保存用 Key の構築
        date_str = report.date.strftime('%Y')
        report_no_padded = str(report.report_no).zfill(4)
        unique_name = f"{uuid.uuid4().hex}_{file_obj.name}"
        r2_key = f"reports/{date_str}/{report_no_padded}/{unique_name}"

        # Cloudflare R2へアップロード
        r2_service = R2Service()
        r2_service.upload_file(
            file_obj=file_obj,
            r2_key=r2_key,
            content_type=file_obj.content_type
        )

        # Attachmentレコード作成
        attachment = Attachment.objects.create(
            report=report,
            filename=unique_name,
            original_filename=file_obj.name,
            r2_key=r2_key,
            content_type=file_obj.content_type,
            file_size=file_obj.size,
            uploaded_by=request.user
        )

        log_operation(request.user, 'CREATE', 'Attachment', attachment.id, f"ファイル: {attachment.original_filename}", request)
        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class AttachmentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        attachment = get_object_or_404(Attachment, pk=pk)
        
        r2_service = R2Service()
        download_url = r2_service.generate_presigned_url(attachment.r2_key, expires_in=300)
        
        log_operation(request.user, 'READ', 'Attachment', attachment.id, f"ダウンロードURL発行: {attachment.original_filename}", request)
        
        if download_url.startswith('/mock-download/'):
            return Response({
                'is_mock': True,
                'message': 'R2 is not configured yet (Mock Download)',
                'r2_key': attachment.r2_key,
                'filename': attachment.original_filename
            })

        return Response({
            'download_url': download_url,
            'filename': attachment.original_filename
        })

class InitAdminView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        username = 'admin'
        password = 'Admin1234!'
        email = 'admin@example.com'
        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username, email, password)
            return Response({"status": "Superuser created successfully."})
        return Response({"status": "Superuser already exists."})


def _set_auth_cookies(response, access_token, refresh_token=None):
    """レスポンスにJWT認証Cookieをセットするユーティリティ関数"""
    cookie_secure = getattr(settings, 'AUTH_COOKIE_SECURE', not settings.DEBUG)
    cookie_samesite = getattr(settings, 'AUTH_COOKIE_SAMESITE', 'Lax')
    access_cookie_name = getattr(settings, 'AUTH_COOKIE', 'access_token')
    refresh_cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH', 'refresh_token')

    # アクセストークン Cookie（セッション期間中有効）
    response.set_cookie(
        key=access_cookie_name,
        value=access_token,
        httponly=True,
        secure=cookie_secure,
        samesite=cookie_samesite,
        max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds()),
    )

    # リフレッシュトークン Cookie（オプション）
    if refresh_token is not None:
        response.set_cookie(
            key=refresh_cookie_name,
            value=refresh_token,
            httponly=True,
            secure=cookie_secure,
            samesite=cookie_samesite,
            max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds()),
        )


class CookieTokenObtainPairView(TokenObtainPairView):
    """
    ログインビュー: 認証成功時に JWT トークンを HttpOnly Cookie にセットする。
    レスポンスボディにはトークンを含まず、username と csrf_token のみ返す。
    """

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        access_token = serializer.validated_data.get('access')
        refresh_token = serializer.validated_data.get('refresh')

        # ボディにトークンを含まないレスポンスを返す
        response = Response({
            'detail': 'ログインしました。',
            'username': request.data.get('username', ''),
            'csrf_token': get_token(request),
        }, status=status.HTTP_200_OK)

        _set_auth_cookies(response, access_token, refresh_token)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    トークンリフレッシュビュー: Cookie 内のリフレッシュトークンを使って
    新しいアクセストークンを Cookie にセットする。
    """

    def post(self, request, *args, **kwargs):
        refresh_cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH', 'refresh_token')
        refresh_token = request.COOKIES.get(refresh_cookie_name)

        if not refresh_token:
            return Response(
                {'detail': 'リフレッシュトークンが見つかりません。'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # リクエストデータにCookieのリフレッシュトークンを注入
        request.data['refresh'] = refresh_token

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        access_token = serializer.validated_data.get('access')
        new_refresh = serializer.validated_data.get('refresh')

        response = Response(
            {'detail': 'トークンを更新しました。', 'csrf_token': get_token(request)},
            status=status.HTTP_200_OK
        )
        _set_auth_cookies(response, access_token, new_refresh)
        return response


class LogoutView(APIView):
    """
    ログアウトビュー: リフレッシュトークンをブラックリストに追加し、
    認証 Cookie を削除する。
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH', 'refresh_token')
        access_cookie_name = getattr(settings, 'AUTH_COOKIE', 'access_token')
        refresh_token = request.COOKIES.get(refresh_cookie_name)

        # リフレッシュトークンをブラックリストに追加（ROTATE_REFRESH_TOKENS=True の場合）
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # すでに無効なトークンは無視する

        response = Response({'detail': 'ログアウトしました。'}, status=status.HTTP_200_OK)
        # Cookie を削除する（max_age=0 で即時失効）
        response.delete_cookie(access_cookie_name)
        response.delete_cookie(refresh_cookie_name)
        return response
