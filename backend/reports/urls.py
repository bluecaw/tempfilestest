from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import ReportViewSet, AttachmentUploadView, AttachmentDownloadView

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
]
