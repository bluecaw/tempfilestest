# backend/config/asgi.py

import os
from urllib.parse import parse_qs
from django.core.asgi import get_asgi_application
from django.contrib.auth.models import AnonymousUser

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async
import reports.routing

User = get_user_model()

@sync_to_async
def get_user_from_token(token_key):
    try:
        access_token = AccessToken(token_key)
        user_id = access_token['user_id']
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

class JwtAuthMiddleware:
    """
    WebSocket接続時のURLクエリパラメータから `token` を取得し認証するミドルウェア
    例: ws://domain/ws/notifications/?token=<JWT_ACCESS_TOKEN>
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JwtAuthMiddleware(
        URLRouter(
            reports.routing.websocket_urlpatterns
        )
    ),
})

# backend/config/asgi.py

@sync_to_async
def get_user_from_token(token_key):
    try:
        access_token = AccessToken(token_key)
        user_id = access_token['user_id']
        user = User.objects.get(id=user_id)
        print(f"DEBUG: 認証成功 - ユーザー: {user.username} (ID: {user_id})")
        return user
    except Exception as e:
        # ★ エラー内容をログに出力
        print(f"DEBUG: トークン認証エラー - 理由: {type(e).__name__}: {e}")
        return AnonymousUser()

class JwtAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        print(f"DEBUG: 取得したトークン: {token[:15]}..." if token else "DEBUG: トークンなし")

        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)