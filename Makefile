.PHONY: help install run dev docker-build docker-up lint clean test migrate

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  install       Install Python dependencies"
	@echo "  run           Run production server with gunicorn"
	@echo "  dev           Run development server"
	@echo "  docker-build  Build Docker image"
	@echo "  docker-up     Start all services via docker-compose"
	@echo "  lint          Run flake8 linting"
	@echo "  clean         Remove cache files and audio/uploads"
	@echo "  test          Run Django checks"
	@echo "  migrate       Run database migrations"

install:
	pip install -r requirements.txt

run:
	gunicorn config.wsgi:application -c gunicorn.conf.py

dev:
	python manage.py runserver 0.0.0.0:8000

docker-build:
	docker build -t pdf-to-audio:latest .

docker-up:
	docker-compose up --build -d

docker-down:
	docker-compose down

lint:
	flake8 tts_app/ config/ --max-line-length=120

clean:
	rm -rf static/uploads/* static/audio/* __pycache__ */__pycache__ .pytest_cache
	rm -f *.pyc */*.pyc

test:
	python manage.py check

migrate:
	python manage.py migrate
