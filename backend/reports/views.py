# backend/reports/views.py

import uuid
import json
import csv
from io import BytesIO

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
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator

# ReportLab (PDF生成用)
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from .models import Report, Attachment, OperationLog, PasswordResetOTP
from .serializers import ReportSerializer, AttachmentSerializer, AttachmentUploadSerializer
from .s3_utils import R2Service
from .utils import send_realtime_notification  # ★ 通知ヘルパーのインポート
from .slack_utils import send_slack_interactive_notification  # ★ これを追加！
from django.conf import settings  # ★ settingsを参照するため追加

# 日本語フォント登録 (ReportLab)
try:
    pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
    DEFAULT_PDF_FONT = 'HeiseiKakuGo-W5'
except Exception:
    DEFAULT_PDF_FONT = 'Helvetica'


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


# --------------------------------------------------
# 業務報告 ViewSet (ステータス管理・検索・フィルター対応)
# --------------------------------------------------
class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().prefetch_related('attachments', 'created_by')
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    # フィルター・検索・ソートの設定
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ReportFilter
    search_fields = [
        'title',
        'description',
        'report_no',
        'reception_no',
        'address',
    ]
    ordering_fields = ['date', 'created_at', 'status']

    def _notify_boss_or_all(self, report):
        """承認申請時に上司（または全体）へWebSocket通知を送信する内部ヘルパー"""
        boss = None
        user_profile = getattr(self.request.user, 'userprofile', None)
        if user_profile:
            boss = getattr(user_profile, 'boss', None) or getattr(user_profile, 'supervisor', None)

        if boss:
            send_realtime_notification(
                user_id=boss.id,
                notification_type="NEW_REPORT",
                message=f"{self.request.user.username} さんから日報「{report.title}」が提出（承認申請）されました。",
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
                        'message': f"【全体通知】{self.request.user.username} さんが日報「{report.title}」を提出しました。",
                        'report_id': report.id
                    }
                }
            )
# 2. ★★★ ここを追加！ Slack通知の呼び出し ★★★
        webhook_url = getattr(settings, 'SLACK_WEBHOOK_URL', None)
        if webhook_url:
            try:
                send_slack_interactive_notification(webhook_url, report)
            except Exception as e:
                # Slack送信が失敗しても画面側の処理（日報作成）を止めないようログ出力のみにとどめる
                print(f"Slack Notification Error: {e}")
    def perform_create(self, serializer):
        report = serializer.save(created_by=self.request.user)
        log_operation(
            self.request.user, 
            'CREATE', 
            'Report', 
            report.id, 
            f"新規作成 (件名: {report.title}, ステータス: {report.get_status_display()})", 
            self.request
        )

        # ステータスが「承認待ち (Pending)」の場合のみ通知を発行
        if report.status == Report.Status.PENDING:
            self._notify_boss_or_all(report)

    def perform_update(self, serializer):
        old_status = self.get_object().status
        report = serializer.save()
        log_operation(
            self.request.user, 
            'UPDATE', 
            'Report', 
            report.id, 
            f"更新 (件名: {report.title}, ステータス: {report.get_status_display()})", 
            self.request
        )

        # 「下書き」等から「承認待ち (Pending)」に移行した場合に通知
        if old_status != Report.Status.PENDING and report.status == Report.Status.PENDING:
            self._notify_boss_or_all(report)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        log_operation(request.user, 'READ', 'Report', instance.id, f"閲覧件名: {instance.title}", request)
        return super().retrieve(request, *args, **kwargs)

    # -------------------------------------------------------------
    # 汎用ステータス変更アクション (PATCH /api/reports/{id}/change_status/)
    # -------------------------------------------------------------
    @action(detail=True, methods=['patch'], url_path='change_status')
    def change_status(self, request, pk=None):
        report = self.get_object()
        new_status = request.data.get('status')

        valid_statuses = [choice[0] for choice in Report.Status.choices]
        if new_status not in valid_statuses:
            return Response(
                {'error': f'無効なステータスです。選択可能値: {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = report.status
        report.status = new_status
        report.save()

        log_operation(
            request.user, 
            'UPDATE', 
            'Report', 
            report.id, 
            f"ステータス変更: {old_status} -> {new_status}", 
            request
        )

        # 「承認待ち」に変更された場合は上司へ通知
        if new_status == Report.Status.PENDING and old_status != Report.Status.PENDING:
            self._notify_boss_or_all(report)

        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # -------------------------------------------------------------
    # 差し戻しアクション (POST /api/reports/{id}/remand/)
    # -------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='remand')
    def remand_report(self, request, pk=None):
        """上司による差し戻し（Rejected）アクション"""
        report = self.get_object()
        comment = request.data.get('comment', '')

        report.status = Report.Status.REJECTED
        report.save()

        log_operation(request.user, 'UPDATE', 'Report', report.id, f"差し戻し: {report.title} (コメント: {comment})", request)

        send_realtime_notification(
            user_id=report.created_by.id,
            notification_type="REPORT_REMANDED",
            message=f"日報「{report.title}」が差し戻されました。コメント: {comment}",
            report_id=report.id
        )

        return Response({"detail": "日報を差し戻しました。"}, status=status.HTTP_200_OK)

    # -------------------------------------------------------------
    # 承認アクション (POST /api/reports/{id}/approve/)
    # -------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='approve')
    def approve_report(self, request, pk=None):
        """上司による承認（Approved）アクション"""
        report = self.get_object()

        report.status = Report.Status.APPROVED
        report.save()

        log_operation(request.user, 'UPDATE', 'Report', report.id, f"承認: {report.title}", request)

        send_realtime_notification(
            user_id=report.created_by.id,
            notification_type="REPORT_APPROVED",
            message=f"日報「{report.title}」が承認されました。",
            report_id=report.id
        )

        return Response({"detail": "日報を承認しました。"}, status=status.HTTP_200_OK)

    # -------------------------------------------------------------
    # 添付ファイル一括アップロード (POST /api/reports/{id}/bulk_upload/)
    # -------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='bulk_upload')
    def bulk_upload(self, request, pk=None):
        report = self.get_object()
        files = request.FILES.getlist('files')

        if not files:
            return Response({'detail': 'ファイルが添付されていません。'}, status=status.HTTP_400_BAD_REQUEST)

        created_attachments = []
        r2_service = R2Service()

        date_str = report.date.strftime('%Y')
        report_no_padded = str(report.report_no).zfill(4)

        for file_obj in files:
            unique_name = f"{uuid.uuid4().hex}_{file_obj.name}"
            r2_key = f"reports/{date_str}/{report_no_padded}/{unique_name}"

            # Cloudflare R2へアップロード
            r2_service.upload_file(
                file_obj=file_obj,
                r2_key=r2_key,
                content_type=file_obj.content_type
            )

            # DB保存
            attachment = Attachment.objects.create(
                report=report,
                filename=unique_name,
                original_filename=file_obj.name,
                r2_key=r2_key,
                content_type=file_obj.content_type,
                file_size=file_obj.size,
                uploaded_by=request.user
            )
            created_attachments.append(attachment)
            log_operation(request.user, 'CREATE', 'Attachment', attachment.id, f"一括アップロード: {attachment.original_filename}", request)

        serializer = AttachmentSerializer(created_attachments, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # -------------------------------------------------------------
    # ★ 新規追加: CSV 一括出力 (GET /api/reports/export_csv/)
    # -------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='export_csv')
    def export_csv(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        # UTF-8 with BOM でExcel文字化けを防ぐ
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="reports.csv"'

        writer = csv.writer(response)
        writer.writerow(['ID', '日付', '件名番号', '受付番号', '件名', '住所', '詳細内容', 'ステータス', '作成者'])

        for r in queryset:
            status_text = r.get_status_display() if hasattr(r, 'get_status_display') else r.status
            creator_text = r.created_by.username if r.created_by else ''

            writer.writerow([
                r.id,
                r.date,
                r.report_no,
                r.reception_no,
                r.title,
                r.address or '',
                r.description,
                status_text,
                creator_text
            ])

        log_operation(request.user, 'READ', 'Report', 'ALL', f"CSVエクスポート (件数: {queryset.count()})", request)
        return response

    # -------------------------------------------------------------
    # ★ 新規追加: PDF 個別出力 (GET /api/reports/{id}/export_pdf/)
    # -------------------------------------------------------------
    @action(detail=True, methods=['get'], url_path='export_pdf')
    def export_pdf(self, request, pk=None):
        report = self.get_object()

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # タイトル
        p.setFont(DEFAULT_PDF_FONT, 16)
        p.drawString(50, height - 50, f"業務報告書 (件名番号: {report.report_no})")

        # 基本情報
        p.setFont(DEFAULT_PDF_FONT, 10)
        p.drawString(50, height - 85, f"報告日付: {report.date}")
        p.drawString(250, height - 85, f"受付番号: {report.reception_no}")
        p.drawString(50, height - 105, f"件名: {report.title}")
        p.drawString(50, height - 125, f"住所: {report.address or '未設定'}")
        p.drawString(50, height - 145, f"担当者: {report.created_by.username if report.created_by else '未設定'}")

        # 区切り線
        p.line(50, height - 155, width - 50, height - 155)

        # 詳細テキスト
        p.drawString(50, height - 175, "【業務内容詳細】")
        text_obj = p.beginText(50, height - 195)
        text_obj.setFont(DEFAULT_PDF_FONT, 10)

        description_lines = report.description.splitlines() if report.description else []
        for line in description_lines:
            text_obj.textLine(line)

        p.drawText(text_obj)
        p.showPage()
        p.save()

        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="report_{report.id}.pdf"'

        log_operation(request.user, 'READ', 'Report', report.id, f"PDFエクスポート: {report.title}", request)
        return response


# ==========================================
# 添付ファイル個別管理ビュー
# ==========================================

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
# WebSocket動作検証用テストAPI
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


class SlackActionWebhookView(APIView):
    """
    Slackのボタン操作（Interactivity）を受け取る公開エンドポイント
    """
    permission_classes = [AllowAny]  # SlackからのWebhookを受け取るため認証を解除

    def post(self, request, *args, **kwargs):
        # Slackからのペイロードは `payload` パラメータにフォームデータ形式で届く
        payload_raw = request.POST.get('payload')
        if not payload_raw:
            return HttpResponse("No payload", status=400)

        payload = json.loads(payload_raw)

        # アクション情報の取得
        actions = payload.get('actions', [])
        if not actions:
            return HttpResponse(status=200)

        action = actions[0]
        action_id = action.get('action_id')  # 'approve_report' または 'reject_report'
        report_id = action.get('value')      # ボタンに埋め込んだ Report ID
        user_info = payload.get('user', {})
        slack_username = user_info.get('username', 'Slackユーザー')

        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return JsonResponse({"text": "⚠️ 対象の報告書が見つかりませんでした。"}, status=200)

        # ステータス変更ロジック
        if action_id == 'approve_report':
            report.status = Report.Status.APPROVED
            report.save()
            status_text = "✅ 承認されました"
            
            # WebSocketリアルタイム通知
            send_realtime_notification(
                user_id=report.created_by.id,
                notification_type="REPORT_APPROVED",
                message=f"Slack経由で日報「{report.title}」が承認されました。（操作者: {slack_username}）",
                report_id=report.id
            )

        elif action_id == 'reject_report':
            report.status = Report.Status.REJECTED
            report.save()
            status_text = "❌ 差し戻されました"

            send_realtime_notification(
                user_id=report.created_by.id,
                notification_type="REPORT_REMANDED",
                message=f"Slack経由で日報「{report.title}」が差し戻されました。（操作者: {slack_username}）",
                report_id=report.id
            )

        # Slackの元メッセージを書き換えるレスポンス（ボタンを消して完了ステータスを表示）
        updated_blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{status_text}* (操作者: @{slack_username})\n*件名:* {report.title}\n*提出者:* {report.created_by.username if report.created_by else '未設定'}"
                }
            }
        ]

        # Slackメッセージを書き換えるデータを返却
        return JsonResponse({
            "replace_original": True,  # 元のメッセージを置き換えるフラグ
            "blocks": updated_blocks
        })