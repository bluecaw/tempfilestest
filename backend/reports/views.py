# backend/reports/views.py

import uuid
import json
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .filters import ReportFilter
from django.shortcuts import get_object_or_404
from django.http import HttpResponseRedirect, JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator

from .models import Report, Attachment, OperationLog, PasswordResetOTP
from .serializers import ReportSerializer, AttachmentSerializer, AttachmentUploadSerializer
from .s3_utils import R2Service
from .utils import send_realtime_notification  # ★ 通知ヘルパーのインポート


# --------------------------------------------------
# ログイン専用の厳密なレートリミット（1分間に5回まで）
# --------------------------------------------------
class LoginAnonRateThrottle(AnonRateThrottle):
    rate = '5/minute'


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


# backend/reports/views.py

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().prefetch_related('attachments', 'created_by')
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    # ★ 1. フィルターバックエンドを追加
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # ★ 2. 作成した FilterSet を指定（日付・作成者・ステータス用）
    filterset_class = ReportFilter

    # ★ 3. あいまい検索 (?search=...) 対象のフィールドを指定
    search_fields = [
        'title',
        'description',
        'report_no',
        'reception_no',
        'address',
    ]

    # ★ 4. ソート対象フィールドを指定
    ordering_fields = ['date', 'created_at', 'status']

    def perform_create(self, serializer):
        report = serializer.save(created_by=self.request.user)
        log_operation(self.request.user, 'CREATE', 'Report', report.id, f"件名: {report.title}", self.request)

        # ★ 1. 上司（boss）の判定
        boss = None
        if hasattr(self.request.user, 'userprofile') and hasattr(self.request.user.userprofile, 'boss'):
            boss = self.request.user.userprofile.boss

        # ★ 2. 上司が設定されていれば上司へ、設定されていなければテスト/全体用に全ユーザー通知
        if boss:
            send_realtime_notification(
                user_id=boss.id,
                notification_type="NEW_REPORT",
                message=f"{self.request.user.username} さんから新しい日報が提出されました。",
                report_id=report.id
            )
        else:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'notifications_all',
                {
                    'type': 'send_notification',
                    'message': {
                        'notification_type': 'NEW_REPORT',
                        'message': f"【全体通知】{self.request.user.username} さんが日報「{report.title}」を作成しました。",
                        'report_id': report.id
                    }
                }
            )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        log_operation(request.user, 'READ', 'Report', instance.id, f"閲覧件名: {instance.title}", request)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='remand')
    def remand_report(self, request, pk=None):
        """★ 上司による差し戻しアクション"""
        report = self.get_object()
        comment = request.data.get('comment', '')

        if hasattr(report, 'status'):
            report.status = 'REMANDED'
            report.save()

        log_operation(request.user, 'UPDATE', 'Report', report.id, f"差し戻し: {report.title}", request)

        send_realtime_notification(
            user_id=report.created_by.id,
            notification_type="REPORT_REMANDED",
            message=f"日報「{report.title}」が差し戻されました。コメント: {comment}",
            report_id=report.id
        )

        return Response({"detail": "日報を差し戻しました。"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve_report(self, request, pk=None):
        """★ 上司による承認アクション"""
        report = self.get_object()

        if hasattr(report, 'status'):
            report.status = 'APPROVED'
            report.save()

        log_operation(request.user, 'UPDATE', 'Report', report.id, f"承認: {report.title}", request)

        send_realtime_notification(
            user_id=report.created_by.id,
            notification_type="REPORT_APPROVED",
            message=f"日報「{report.title}」が承認されました。",
            report_id=report.id
        )

        return Response({"detail": "日報を承認しました。"}, status=status.HTTP_200_OK)


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


# ==========================================
# 認証関連のビュー（セキュリティ強化適用）
# ==========================================

class GetCSRFTokenView(APIView):
    """起動時に呼び出し、CSRFクッキーを付与するビュー"""
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({'message': 'CSRF cookie set'})


class LoginView(APIView):
    """ログイン認証ビュー（試行回数を厳格に制限）"""
    permission_classes = [AllowAny]
    throttle_classes = [LoginAnonRateThrottle]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            log_operation(user, 'LOGIN', 'User', user.id, f"ログイン成功: {user.username}", request)
            return Response({
                'message': 'Login successful',
                'username': user.username
            })
        else:
            return Response({'error': 'ユーザー名またはパスワードが違います'}, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """ログアウトビュー"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        log_operation(user, 'LOGOUT', 'User', user.id, f"ログアウト: {user.username}", request)
        logout(request)
        return Response({'message': 'Logout successful'})


class UserView(APIView):
    """ユーザー情報取得ビュー（セッションチェック）"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'username': request.user.username,
            'email': request.user.email,
        })


# --------------------------------------------------
# パスワードリセット専用レートリミット（1分間に3回まで）
# --------------------------------------------------
class PasswordResetAnonRateThrottle(AnonRateThrottle):
    rate = '3/minute'


class RequestPasswordResetOTPView(APIView):
    """パスワードリセット用OTP（6桁コード）発行・メール送信API"""
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetAnonRateThrottle]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'detail': 'メールアドレスを入力してください。'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            otp = PasswordResetOTP.generate_otp(user)

            try:
                send_mail(
                    subject='【認証コード】パスワード再設定手続き',
                    message=f'{user.username} 様\n\nパスワード再設定用の認証コードは [{otp}] です。\n有効期限は10分間です。',
                    from_email=None,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                log_operation(user, 'OTP_REQUEST', 'User', user.id, f"OTP送信成功: {user.email}", request)
            except Exception as e:
                print(f"Mail Send Error: {e}")

        return Response({'detail': '入力されたメールアドレス宛に認証コードを送信しました。'})


class ConfirmPasswordResetOTPView(APIView):
    """OTP検証＆パスワード変更API"""
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetAnonRateThrottle]

    def post(self, request):
        email = request.data.get('email', '').strip()
        otp = request.data.get('otp', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not all([email, otp, new_password]):
            return Response({'detail': 'すべての項目を入力してください。'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            return Response({'detail': '認証コードが無効または期限切れです。'}, status=status.HTTP_400_BAD_REQUEST)

        reset_obj = PasswordResetOTP.objects.filter(user=user, is_used=False).order_by('-created_at').first()

        if reset_obj and reset_obj.is_valid(otp):
            user.set_password(new_password)
            user.save()

            reset_obj.is_used = True
            reset_obj.save()

            log_operation(user, 'PASSWORD_RESET', 'User', user.id, f"パスワード再設定完了: {user.username}", request)
            return Response({'detail': 'パスワードの再設定が完了しました。'})
        else:
            return Response({'detail': '認証コードが無効、誤っているか、有効期限が切れています。'}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# ★ WebSocket動作検証用テストAPI（末尾に追加）
# ==========================================
class TestNotificationView(APIView):
    """ログイン中の自身に対してWebSocket通知を即時発行するテストAPI"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        send_realtime_notification(
            user_id=request.user.id,
            notification_type="TEST_NOTIFICATION",
            message=f"API経由でのテスト通知です！（送信先ID: {request.user.id}）",
            report_id=999
        )
        return Response({
            "detail": f"ユーザーID: {request.user.id} 宛てにリアルタイム通知を送信しました。"
        }, status=status.HTTP_200_OK)