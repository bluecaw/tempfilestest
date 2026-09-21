from . import views
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import ReportViewSet, AttachmentUploadView, AttachmentDownloadView, GetCSRFTokenView, LoginView, LogoutView, UserView, RequestPasswordResetOTPView, ConfirmPasswordResetOTPView

router = DefaultRouter()
router.register(r'reports', ReportViewSet, basename='report')

urlpatterns = [
    # JWT Auth
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API Router
    path('', include(router.urls)),
    
    # Attachment APIs
    path('attachments/', AttachmentUploadView.as_view(), name='attachment-upload'),
    path('attachments/<int:pk>/download/', AttachmentDownloadView.as_view(), name='attachment-download'),
    path('get-csrf/', GetCSRFTokenView.as_view(), name='get_csrf'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('user/', UserView.as_view(), name='user'),
    # ★ パスワードリセット用 API
    path('auth/password-reset/request/', RequestPasswordResetOTPView.as_view(), name='password_reset_request'),
    path('auth/password-reset/confirm/', ConfirmPasswordResetOTPView.as_view(), name='password_reset_confirm'),
]
