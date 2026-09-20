#!/usr/bin/env bash
# Render Build Script for Django Backend

set -e  # エラー発生時に即座に停止

echo "=== Build Script Started ==="

# カレントディレクトリに backend フォルダが存在する場合のみ移動
if [ -d "backend" ]; then
  cd backend
fi

echo "--- Installing dependencies ---"
pip install -r requirements.txt

echo "--- Collecting static files ---"
python manage.py collectstatic --no-input

echo "--- Running migrations ---"
python manage.py migrate

echo "--- Creating superuser ---"
# 環境変数 DJANGO_SUPERUSER_PASSWORD が設定されている場合のみスーパーユーザーを作成
if [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py shell -c "
import os
from django.contrib.auth import get_user_model

User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME') or 'admin'
email = os.environ.get('DJANGO_SUPERUSER_EMAIL') or 'admin@example.com'
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f'Superuser \"{username}\" created.')
else:
    print(f'Superuser \"{username}\" already exists.')
"
else
  echo "DJANGO_SUPERUSER_PASSWORD is not set. Skipping superuser creation."
fi

echo "=== Build Script Completed ==="