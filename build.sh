#!/usr/bin/env bash
# Render Build Script for Django Backend

set -e  # エラー発生時に即座に停止

echo "=== Build Script Started ==="

# render.yaml 側ですでに cd backend されている場合のエラーを防ぐチェック
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
# create_admin.py の代わりに Django の標準 shell を使って安全に作成
if [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
username = '$DJANGO_SUPERUSER_USERNAME' if '$DJANGO_SUPERUSER_USERNAME' else 'admin'
email = '$DJANGO_SUPERUSER_EMAIL' if '$DJANGO_SUPERUSER_EMAIL' else 'admin@example.com'
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, '$DJANGO_SUPERUSER_PASSWORD')
    print('Superuser created.')
else:
    print('Superuser already exists.')
"
else
  echo "DJANGO_SUPERUSER_PASSWORD is not set. Skipping superuser creation."
fi

echo "=== Build Script Completed ==="