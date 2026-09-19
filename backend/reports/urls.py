from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReportViewSet,
    AttachmentUploadView,
    AttachmentDownloadView,
    InitAdminView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    LogoutView,
)

router = DefaultRouter()
router.register(r'reports', ReportViewSet, basename='report')

urlpatterns = [
    # --- Cookie ベース JWT 認証（推奨） ---
    path('auth/login/', CookieTokenObtainPairView.as_view(), name='cookie_token_obtain_pair'),
    path('auth/refresh/', CookieTokenRefreshView.as_view(), name='cookie_token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    # 管理者初期化
    path('init-admin/', InitAdminView.as_view(), name='init_admin'),

    # API Router
    path('', include(router.urls)),

    # Attachment APIs
    path('attachments/', AttachmentUploadView.as_view(), name='attachment-upload'),
    path('attachments/<int:pk>/download/', AttachmentDownloadView.as_view(), name='attachment-download'),
]
