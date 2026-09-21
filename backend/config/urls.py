from django.urls import path, include
from django.http import JsonResponse
from django.contrib import admin  # ← これを追加
from django.contrib.auth.models import User  # ← セットアップ用に追加

# ルートURL（/）へのアクセス時に 200 OK を返すヘルスチェック用関数
def health_check(request):
    return JsonResponse({"status": "ok", "message": "Django Backend is running"})

# Render 上の DB にテスト用ユーザーを作成・更新する一時的なビュー
# def setup_test_user(request):
#     user, created = User.objects.get_or_create(username='test')
#     user.email = 'test@example.com'  # Mailtrapで受信したいアドレス
#     user.set_password('testpassword123')  # パスワード設定
#     user.save()
    
#     return JsonResponse({
#         'status': 'success',
#         'created': created,
#         'username': user.username,
#         'email': user.email
#     })

urlpatterns = [
    path('admin/', admin.site.urls),
    # path('setup-test-user/', setup_test_user),  # ← 一時的なセットアップURL
    path('api/', include('reports.urls')),
    path('', health_check),
]