from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings


class CookieJWTAuthentication(JWTAuthentication):
    """
    HttpOnly Cookie からJWTアクセストークンを読み取るカスタム認証クラス。
    Authorization ヘッダーより Cookie を優先し、Cookie がなければヘッダーにフォールバックする。
    """

    def authenticate(self, request):
        # Cookie からアクセストークンを取得
        cookie_name = getattr(settings, 'AUTH_COOKIE', 'access_token')
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token is None:
            # Cookie にない場合は親クラス（Authorization ヘッダー）にフォールバック
            return super().authenticate(request)

        # トークンを検証してユーザーを返す
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
