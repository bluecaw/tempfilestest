from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

# ルートURL（/）へのアクセス時に 200 OK を返すヘルスチェック用関数
def health_check(request):
    return JsonResponse({"status": "ok", "message": "Django Backend is running"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('reports.urls')),
    path('', health_check),
]
