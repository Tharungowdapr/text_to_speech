#!/bin/bash
set -e

mkdir -p /app/static/uploads /app/static/audio

python manage.py migrate --noinput
python manage.py createcachetable
python manage.py collectstatic --noinput --clear

exec gunicorn config.wsgi:application -c gunicorn.conf.py
