#!/usr/bin/env bash
# Render Build Script for Django Backend

set -e  # エラー発生時に即座に停止

echo "=== Build Script Started ==="

cd backend

echo "--- Installing dependencies ---"
pip install -r requirements.txt

echo "--- Collecting static files ---"
python manage.py collectstatic --no-input

echo "--- Running migrations ---"
python manage.py migrate

echo "--- Creating superuser ---"
python create_admin.py

echo "=== Build Script Completed ==="
