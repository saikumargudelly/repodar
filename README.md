# Repodar

**Real-time GitHub AI/ML Ecosystem Radar**

Repodar surfaces the most starred, most trending, and most actively developed AI/ML repositories across all of GitHub — updated live, filterable by time period, with sustainability scoring and analyst-grade insights.

---

## What it does

| Feature | Description |
|---|---|
| **Trending Leaderboard** | GitHub's own Trending data (daily / weekly / monthly) showing real star gains in the period |
| **Long-range Search** | GitHub Search API for 90d / 1y / 3y / 5y windows — most starred active AI repos |
| **Period Selector** | Switch between Today, 7D, 1M, 3M, 1Y, 3Y, 5Y — leaderboard updates instantly |
| **Sustainability Scores** | Composite score (trend velocity, contributor growth, fork ratio, issue close rate) |
| **Radar Chart** | Category-level ecosystem radar across 8 AI/ML verticals |
| **Weekly Reports** | LLM-generated strategic analyst report via Groq |
| **Repo Deep-dive** | Full time-series charts for any tracked repo |

---

## Tech Stack

### Backend
- **FastAPI** — REST API, async endpoints
- **SQLAlchemy + SQLite** — repo & metrics storage (`repodar.db`)
- **DuckDB** — analytical queries over SQLite (star velocity, category growth)
- **Alembic** — database migrations
- **GitHub GraphQL API** — batch repo metadata (stars, forks, watchers, issues, releases)
- **GitHub REST API** — contributor counts, merged PR counts
- **GitHub Trending scraper** — BeautifulSoup4 scrape of `github.com/trending` for real star gains
- **Groq (llama-3.3-70b-versatile)** — weekly/monthly analyst report generation
- **Celery + Redis** — scheduled background ingestion tasks
- **aiohttp** — async GitHub API calls

### Frontend
- **Next.js 15** (App Router)
- **TanStack Query** — data fetching & caching
- **Recharts** — time-series charts and radar
- **TypeScript**

---

## Project Structure

```
repodar/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── database.py          # SQLAlchemy engine & session
│   │   ├── celery_worker.py     # Celery app & scheduled tasks
│   │   ├── models/              # SQLAlchemy models (Repository, DailyMetric, ComputedMetric)
│   │   ├── routers/
│   │   │   ├── dashboard.py     # Overview, radar, leaderboard endpoints
│   │   │   ├── repositories.py  # Repo list & detail
│   │   │   ├── metrics.py       # Daily & computed metrics
│   │   │   ├── reports.py       # Weekly & monthly analyst reports
│   │   │   └── admin.py         # Manual ingestion trigger
│   │   ├── services/
│   │   │   ├── github_client.py # GraphQL batch + REST enrichment
│   │   │   ├── github_search.py # Trending scraper + Search API for leaderboard
│   │   │   ├── ingestion.py     # Full pipeline: fetch → store → score
│   │   │   ├── scoring.py       # TrendScore, SustainabilityScore, category growth
│   │   │   └── explanation.py   # Groq LLM repo explanations
│   │   └── seed/
│   │       ├── repos.yaml       # 80 curated AI/ML repos (tracked universe)
│   │       └── seeder.py        # Idempotent DB seeder
│   ├── alembic/                 # DB migrations
│   ├── requirements.txt
│   └── .env                     # Secrets (see below)
│
└── frontend/
    ├── app/
    │   ├── page.tsx             # Dashboard: period selector + leaderboard + radar
    │   ├── radar/page.tsx       # Ecosystem radar page
    │   └── repo/[id]/page.tsx   # Individual repo deep-dive
    ├── components/
    │   ├── Nav.tsx              # Top nav + weekly report modal
    │   └── Providers.tsx        # TanStack Query provider
    └── lib/
        └── api.ts               # Typed API client
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A GitHub Personal Access Token (PAT) with `public_repo` scope
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Clone & configure

```bash
git clone <repo-url>
cd repodar
```

Create `backend/.env`:

```env
GITHUB_TOKEN=github_pat_...
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=sqlite:///./repodar.db
REDIS_URL=redis://localhost:6379/0
APP_ENV=development
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### 3. Seed & ingest data

```bash
# Trigger a full ingestion run (fetches live GitHub data for all 80 tracked repos)
curl -X POST http://localhost:8000/admin/run-all
```

This populates `DailyMetrics` and `ComputedMetrics`. Takes ~60 seconds on first run.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/overview` | Ecosystem stats, category growth, sustainability ranking |
| `GET` | `/dashboard/leaderboard?period=7d&limit=30` | Top trending repos for the period (live GitHub data) |
| `GET` | `/dashboard/radar` | Category-level radar scores |
| `GET` | `/repos` | All tracked repos with latest scores |
| `GET` | `/repos/{id}` | Single repo detail |
| `GET` | `/metrics/{repo_id}/daily` | Daily metrics time-series |
| `GET` | `/metrics/{repo_id}/computed` | Computed score history |
| `GET` | `/reports/weekly` | Latest weekly analyst report |
| `GET` | `/reports/monthly` | Monthly ecosystem summary |
| `POST` | `/admin/run-all` | Manually trigger full ingestion + scoring |

### Leaderboard periods

| Period | Data Source | Logic |
|---|---|---|
| `1d` | GitHub Trending (`since=daily`) | Repos with most star gains today |
| `7d` | GitHub Trending (`since=weekly`) | Repos with most star gains this week |
| `30d` | GitHub Trending (`since=monthly`) | Repos with most star gains this month |
| `90d` | GitHub Search API | Most starred repos pushed in last 90 days |
| `365d` | GitHub Search API | Most starred repos pushed in last year |
| `3y` | GitHub Search API | All-time top AI repos (≥15k stars) |
| `5y` | GitHub Search API | All-time top AI repos (≥30k stars) |

---

## Scoring

**TrendScore** (0–100) — momentum signal:
- Star velocity (7d and 30d)
- Star acceleration (is velocity increasing?)
- Fork-to-star ratio
- Issue close rate

**SustainabilityScore** (0–100) — project health signal:
- Active contributor growth rate
- Consistent release cadence
- Issue resolution velocity
- Age-weighted stability

Labels: `GREEN` (≥70), `YELLOW` (40–69), `RED` (<40)

---

## Scheduled Ingestion

Celery + Redis handles nightly ingestion when running in production. To start workers locally:

```bash
# In a separate terminal (requires Redis running)
cd backend
celery -A app.celery_worker worker --loglevel=info
celery -A app.celery_worker beat --loglevel=info
```

For development, use `POST /admin/run-all` instead.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | GitHub PAT — raises rate limit to 5000 req/hr |
| `GROQ_API_KEY` | ✅ | Groq API key for LLM report generation |
| `GROQ_MODEL` | ✅ | Model ID (e.g. `llama-3.3-70b-versatile`) |
| `DATABASE_URL` | ✅ | SQLite path (default: `sqlite:///./repodar.db`) |
| `REDIS_URL` | ⚠️ | Required only for Celery workers |
| `APP_ENV` | — | `development` or `production` |
