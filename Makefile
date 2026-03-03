.PHONY: dev-backend dev-frontend seed ingest score worker beat install-backend install-frontend

# --- Backend ---
dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

install-backend:
	cd backend && pip install -r requirements.txt

seed:
	cd backend && python -m app.seed.seeder

ingest:
	cd backend && python -c "import asyncio; from app.services.ingestion import run_daily_ingestion; asyncio.run(run_daily_ingestion())"

score:
	cd backend && python -c "from app.services.scoring import run_daily_scoring; run_daily_scoring()"

# --- Celery ---
worker:
	cd backend && celery -A app.celery_worker worker --loglevel=info --concurrency=4

beat:
	cd backend && celery -A app.celery_worker beat --loglevel=info

flower:
	cd backend && celery -A app.celery_worker flower --port=5555

# --- Frontend ---
dev-frontend:
	cd frontend && npm run dev

install-frontend:
	cd frontend && npm install

# --- DB ---
migrate:
	cd backend && alembic upgrade head

migration:
	cd backend && alembic revision --autogenerate -m "$(msg)"

# --- Full Dev Start ---
dev:
	make dev-backend &
	make worker &
	make beat &
	make dev-frontend
