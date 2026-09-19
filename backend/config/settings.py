import os
from pathlib import Path
from datetime import timedelta
import dj_database_url
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file if present
load_dotenv(os.path.join(BASE_DIR.parent, '.env'))

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-default-key-change-this!')

DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 't')

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    
    # Local apps
    'reports.apps.ReportsConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
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

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # Cookie 内の JWT を優先し、なければ Authorization ヘッダーにフォールバック
        'reports.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# JWT Cookie Settings
AUTH_COOKIE = 'access_token'          # アクセストークンの Cookie 名
AUTH_COOKIE_REFRESH = 'refresh_token'  # リフレッシュトークンの Cookie 名
AUTH_COOKIE_SECURE = not DEBUG         # HTTPS時のみ送信（本番璲境で True）
AUTH_COOKIE_HTTP_ONLY = True           # JavaScript からアクセス不可
AUTH_COOKIE_SAMESITE = 'Lax'           # CSRF 対策：SameOrigin のリクエストのみ Cookie を送信

# --------------------------------
# Cookie ・セッション セキュリティ設定
# --------------------------------

# セッション Cookie
SESSION_COOKIE_HTTPONLY = True           # JavaScript からセッション Cookie へアクセス不可
SESSION_COOKIE_SECURE = not DEBUG        # 本番璲境では HTTPS のみ
SESSION_COOKIE_SAMESITE = 'Lax'         # CSRF 対策
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7   # 7日間

# CSRF Cookie
CSRF_COOKIE_HTTPONLY = False    # フロントエンドが JavaScript で読み取れるよう False
CSRF_COOKIE_SECURE = not DEBUG  # 本番璲境では HTTPS のみ
CSRF_COOKIE_SAMESITE = 'Lax'   # CSRF 対策

# X-Frame-Options ヘッダー（クリックジャッキング対策）
X_FRAME_OPTIONS = 'DENY'

# HTTP Strict Transport Security （本番璲境のみ有効化）
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000      # 1年
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True          # HTTP → HTTPS リダイレクト
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')  # Render でのプロキシ対応

# CORS Settings
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True  # Cookie を含むクロスオリジンリクエストを許可
if not CORS_ALLOW_ALL_ORIGINS:
    allowed_origins = [origin.strip() for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if origin.strip()]
    
    # RenderのフロントエンドURLを追加（環境変数が未設定の場合のフォールバック）
    if 'https://report-react-frontend.onrender.com' not in allowed_origins:
        allowed_origins.append('https://report-react-frontend.onrender.com')
        
    CORS_ALLOWED_ORIGINS = allowed_origins
    # Django 4.x の CSRF 対策として信頼するオリジンを設定
    CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# Cloudflare R2 Credentials
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET = os.environ.get('R2_BUCKET', 'business-report-files')
