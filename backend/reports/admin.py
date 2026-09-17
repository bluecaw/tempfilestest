from django.contrib import admin
from .models import Report, Attachment, OperationLog

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'report_no', 'reception_no', 'date', 'title', 'created_by', 'created_at')
    search_fields = ('report_no', 'reception_no', 'title', 'address')
    list_filter = ('date', 'created_at')

@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'original_filename', 'report', 'file_size', 'uploaded_by', 'uploaded_at')
    search_fields = ('original_filename', 'r2_key')

@admin.register(OperationLog)
class OperationLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'action', 'target_model', 'target_id', 'ip_address', 'created_at')
    list_filter = ('action', 'target_model', 'created_at')
    readonly_fields = ('user', 'action', 'target_model', 'target_id', 'details', 'ip_address', 'created_at')
