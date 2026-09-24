import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse  # ★ 追加
import dj_database_url
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file if present
load_dotenv(os.path.join(BASE_DIR.parent, '.env'))

# Security Middleware Class
class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # 管理画面 (/admin/) の場合は CSS や JS、画像の読み込みを許可する
        if request.path.startswith('/admin/'):
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "img-src 'self' data:; "
                "font-src 'self' data:;"
            )
        else:
            # API 用の厳格な CSP ヘッダー
            response['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none';"
        return response


# 1. DEBUG モードの判定（SECRET_KEY より前に定義）
DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 't')

# 2. SECRET_KEY は環境変数から取得
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'COo-I9kH5ewDEGjI0gQ1ZueYhQ2QK7j93R4Wb7ntEgi42wml1j_fGwTep90jFAqm614'
    else:
        raise ValueError("SECRET_KEY 環境変数が設定されていません。")

# 3. 本番環境（DEBUG=False）の時のみ、クッキーの HTTPS 限定化を有効にする
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # Mozilla Observatory 用のセキュリティヘッダー設定
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000  # 1年間
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# 4. 許可するホスト名を明示
ALLOWED_HOSTS = [
    'report-django-backend.onrender.com',  # RenderのバックエンドURL
    'localhost',
    '127.0.0.1',
]

# --------------------------------------------------
# INSTALLED_APPS (Daphne & Channels を追加)
# --------------------------------------------------
INSTALLED_APPS = [
    'daphne',  # django-channels v4以降、ASGI起動サポートに必要（最上部指定）
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'channels',  # ★ 追加
    
    # Local apps
    'reports.apps.ReportsConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'config.settings.SecurityHeadersMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

# --------------------------------------------------
# ASGI / Channel Layer 設定 (★ 追加)
# --------------------------------------------------
ASGI_APPLICATION = 'config.asgi.application'

REDIS_URL = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/0')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [REDIS_URL],
        },
    },
}

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database Configuration
_DB_URL = os.environ.get('DATABASE_URL', f'sqlite:///{BASE_DIR / "db.sqlite3"}')
DATABASES = {
    'default': dj_database_url.config(
        default=_DB_URL,
        conn_max_age=600,
        ssl_require=not DEBUG and not _DB_URL.startswith('sqlite')
    )
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'ja-jp'
TIME_ZONE = 'Asia/Tokyo'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10/minute',
        'user': '120/minute',
    }
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# --------------------------------------------------
# CORS 設定の強化
# --------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = False

_DEFAULT_ALLOWED_ORIGINS = [
    "https://report-react-frontend.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

_ENV_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if origin.strip()
]

CORS_ALLOWED_ORIGINS = list(set(_DEFAULT_ALLOWED_ORIGINS + _ENV_ALLOWED_ORIGINS))
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
CORS_ALLOW_CREDENTIALS = True

# --------------------------------------------------
# セキュリティヘッダーの設定
# --------------------------------------------------
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Cloudflare R2 Credentials
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET = os.environ.get('R2_BUCKET', 'business-report-files')

# --------------------------------------------------
# メール送信設定
# --------------------------------------------------
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'sandbox.smtp.mailtrap.io')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 2525))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'no-reply@example.com')

# Google Maps API Key
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')

# 環境変数から REDIS_URL を取得 (Render / Upstash 用)
REDIS_URL = os.environ.get('REDIS_URL')

if REDIS_URL:
    url = urlparse(REDIS_URL)
    
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [{
                    "address": REDIS_URL,
                    # Upstash等の TLS接続 (rediss://) の場合に必要な暗号化オプション
                    "ssl_cert_reqs": None if url.scheme == 'rediss' else 'required',
                }],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }