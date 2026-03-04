# Railway Deployment Guide for Repodar

## Current Architecture
- **Frontend**: Next.js (already deployed)
- **Backend**: FastAPI + SQLAlchemy
- **Database**: PostgreSQL (recommended for production)
- **Cache/Tasks**: Redis
- **Task Queue**: Celery with Beat scheduler

## Prerequisites
- Railway account with active project `charming-alignment`
- GitHub Personal Access Token (for data ingestion)

## Step 1: Add PostgreSQL Plugin

1. Go to Railway dashboard → `charming-alignment` project
2. Click **+ Add** button → **Add from Marketplace**
3. Search for **PostgreSQL** and add it
4. Railway will automatically inject `DATABASE_URL` env var

## Step 2: Verify Redis Plugin

1. Check that **Redis** plugin exists (it should - visible in your architecture)
2. Verify Redis is showing as **Online**
3. Railway will automatically inject `REDIS_URL` env var

## Step 3: Create Backend Service

1. In Railway, click **+ Add** → **GitHub Repo**
2. Select your repo: `tool-github-monitor`
3. Configure:
   - **Root Directory**: `/backend`
   - **Start Command**: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Build Command**: (leave empty - auto-detected)
   - **Name**: `repodar-api`

## Step 4: Set Environment Variables for Backend

In Railway backend service settings, add:

```
GITHUB_TOKEN=ghp_your_actual_token_here
LOG_LEVEL=INFO
PYTHONUNBUFFERED=1
```

**Database & Redis URLs are auto-injected** by Railway plugins.

## Step 5: Update Frontend Service

In Railway frontend service settings (`terrific-vitality`), update:

```
NEXT_PUBLIC_API_URL=https://repodar-api-production-xxxx.up.railway.app
```

(Replace with your actual backend service URL from Railway dashboard)

## Step 6: Initialize Database

After backend deployment, run migrations:

```bash
# SSH into backend service from Railway CLI
railway shell

# Run Alembic migrations
alembic upgrade head

# Seed initial repos
python -c "from app.seed.seeder import seed_repos; print(seed_repos())"
```

## Step 7: Trigger Initial Data Ingestion

```bash
# Via curl (replace with your backend URL)
curl -s -X POST https://repodar-api-production-xxxx.up.railway.app/admin/run-all \
  | python3 -m json.tool

# Check ingestion status
curl -s https://repodar-api-production-xxxx.up.railway.app/admin/status \
  | python3 -m json.tool
```

## Step 8: Set Up Celery Beat (Scheduled Tasks)

**Option A: Separate Celery Beat Service (Recommended)**

1. Add another service via GitHub repo pointing to `/backend`
2. **Start Command**: `celery -A app.celery_worker beat --loglevel=info`
3. **Name**: `repodar-beat`

**Option B: Embedded in Backend (Simpler)**

Add to backend environment:
```
CELERY_BROKER_URL=${{ RedisPlugin.URL }}
CELERY_RESULT_BACKEND=${{ RedisPlugin.URL }}
```

Then modify startup to also launch Beat.

## Scheduled Tasks

Once Celery Beat is running:

- **00:00 UTC**: Auto-discover trending repos, fetch metrics
- **00:30 UTC**: Compute trend/sustainability scores
- **01:00 UTC**: Generate AI explanations via Groq

## Common Issues & Fixes

### ✅ PostgreSQL Connection Errors
**Cause**: Pool exhaustion or stale connections
**Fix**: Already configured with `pool_pre_ping=True` and `pool_recycle=3600`

### ✅ SQLite "disk I/O error" (Fixed)
**Old**: WAL mode failed on Railway file system
**New**: Graceful fallback to DELETE mode + recommends PostgreSQL

### ✅ Redis Connection Issues
**Check**: 
```bash
# From backend container
redis-cli -u $REDIS_URL ping  # Should return PONG
```

### ✅ Database Not Initialized
**Fix**:
```bash
# Run migrations
alembic upgrade head

# Seed repos
python -c "from app.seed.seeder import seed_repos; print(seed_repos())"
```

## Monitoring

- **Backend Logs**: Railway dashboard → Backend service → Logs
- **Redis Health**: Railway dashboard → Redis plugin → Logs
- **Celery Tasks**: Access Flower (if running): `http://localhost:5555`
- **DB Connections**: PostgreSQL dashboard shows active connections

## Environment Variables Reference

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | PostgreSQL plugin | SQLAlchemy connection string |
| `REDIS_URL` | Redis plugin | Celery broker & result backend |
| `GITHUB_TOKEN` | Manual | API access for repo discovery |
| `PYTHONUNBUFFERED` | Manual | Immediate log output to Railway console |

## Next Steps

1. Add PostgreSQL plugin ✓
2. Deploy backend service ✓
3. Set `GITHUB_TOKEN` ✓
4. Update frontend `NEXT_PUBLIC_API_URL` ✓
5. Trigger `/admin/run-all` ✓
6. Set up Celery Beat for auto-ingestion ✓
7. Monitor logs and verify data population ✓
