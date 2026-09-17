import uuid
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import HttpResponseRedirect, JsonResponse
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
