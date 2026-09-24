from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Report, Attachment, OperationLog, PasswordResetOTP, UserProfile

# ==========================================
# 1. ユーザー管理（UserProfileをインライン追加）
# ==========================================
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    fk_name = "user"
    can_delete = False
    verbose_name_plural = 'プロフィール情報（役割・上司）'


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)


# 標準のUser管理画面をアン登録して再登録
admin.site.unregister(User)
admin.site.register(User, UserAdmin)
@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'report_no', 'reception_no', 'date', 'title', 'created_by', 'created_at')
    search_fields = ('report_no', 'reception_no', 'title', 'address')
    list_filter = ('date', 'created_at')
    
    # 緯度・経度および日時フィールドを読み取り専用に設定
    readonly_fields = ('latitude', 'longitude', 'created_at', 'updated_at')

@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'original_filename', 'report', 'file_size', 'uploaded_by', 'uploaded_at')
    search_fields = ('original_filename', 'r2_key')

@admin.register(OperationLog)
class OperationLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'action', 'target_model', 'target_id', 'ip_address', 'created_at')
    list_filter = ('action', 'target_model', 'created_at')
    readonly_fields = ('user', 'action', 'target_model', 'target_id', 'details', 'ip_address', 'created_at')
