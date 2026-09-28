#!/usr/bin/env bash
# Render Build Script for Django Backend

set -o errexit  # エラー発生時に即座に停止

echo "=== Build Script Started ==="

# requirements.txt の場所を正確に判定
if [ -f "requirements.txt" ]; then
  REQUIREMENTS_PATH="requirements.txt"
elif [ -f "../requirements.txt" ]; then
  REQUIREMENTS_PATH="../requirements.txt"
else
  echo "ERROR: requirements.txt not found!"
  exit 1
fi

echo "--- Upgrading pip and installing dependencies ---"
python -m pip install --upgrade pip
pip install --default-timeout=100 -r "$REQUIREMENTS_PATH"

echo "--- Collecting static files ---"
python manage.py collectstatic --no-input

echo "--- Running migrations ---"
python manage.py migrate

echo "--- Creating superuser ---"
if [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py shell -c "
import os
from django.contrib.auth import get_user_model

User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
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