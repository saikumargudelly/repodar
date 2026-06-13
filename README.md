# 📡 Repodar

**GitHub's trending page shows you what has already peaked. Repodar shows you what is about to.**

Repodar tracks hundreds of repositories across AI/ML, developer tools, databases, and infrastructure. It scores them daily on momentum and community health to help you discover breakout open-source projects before they go viral.

🚀 **[Live Demo](https://repodar.vercel.app/)** &nbsp;·&nbsp; ⚡ [Local Setup](#local-setup) &nbsp;·&nbsp; 📖 [API Endpoints](#api-endpoints)

---

## How It Works

Repodar scores and tracks repositories using two composite indicators:

1. **TrendScore (Current Momentum)**: Measures short-term trajectory. Raw signal is log-damped by repository age so explosive early-stage repos surface alongside mature ones.
   * *Weights*: 7-day star velocity (30%), star acceleration (20%), commit frequency (15%), contributor growth (10%), PR activity (10%), fork growth (10%), release boost (3%), and issue spike (2%).
2. **SustainabilityScore (Project Health)**: Measures likelihood of long-term survival.
   * *Signals*: Issue resolution rate, fork-to-star ratio, release cadence, and contributor retention.
   * *Labels*: 🟢 Healthy &nbsp;·&nbsp; 🟡 Caution &nbsp;·&nbsp; 🔴 Critical

---

## Features

* **Breakout Radar**: Sort and filter early-stage projects (e.g., `< 1,000` stars) projecting viral growth.
* **Ecosystem Overview**: Visualizes growth heatmap metrics and sustainability rankings.
* **Ecosystem Leaderboard**: Sort and filter trending repos across 9 major tech verticals.
* **Natural-Language Search**: Search the internal DB and GitHub API using natural language (e.g., *"fast Go security scanners under 1 year old"*).
* **AI Research Workspace**: Stream responses, pin telemetry cards, and compile markdown intelligence digests.
* **Watchlist & Alerts**: Monitor repositories and trigger webhook notifications on sudden star or activity surges.
* **Weekly Ecosystem Digests**: Automatically generates editorial newsletter-style reports of ecosystem shifts.
* **A2A Service Registry**: Discover and catalog AI agents exposing capability cards (A2A v1/v0.3, OpenAI plugin, MCP).

---

## Tech Stack

* **Frontend**: Next.js 16 (Turbopack) · React 19 · Recharts · TanStack Query
* **Backend**: FastAPI · SQLAlchemy 2.0 · Alembic · Pydantic v2
* **Database**: PostgreSQL (Production) / SQLite (Local)
* **AI/LLM**: Groq (Llama 3.3) for search intent parsing, analytical summaries, and research agent
* **Auth**: Clerk
* **Deployment**: Vercel (Frontend) · Railway (Backend)

---

## Performance Highlights

* **~6x DB query speedup** — replaced expensive `row_number() OVER (PARTITION BY)` window functions with pre-fetched scalar date joins on indexed columns.
* **80–90% fewer GitHub API calls** — incremental delta fetching uses `?since=<cursor>` + HTTP `Link` header pagination, skipping already-seen commit data after the first run.
* **Sub-2ms query latency** — column-projection queries bypass full ORM model instantiation; topic filtering runs SQL-side instead of in-memory JSON loops.
* **Multi-layer caching** — server-side TTL cache (`@cache(expire=300)`) on all heavy endpoints + client-side self-invalidating `sessionStorage` cache (2-min TTL, auto-cleared on any mutation).
* **SSRF-protected webhooks** — all outgoing webhook and A2A card URLs are DNS-resolved and checked against private/loopback IP ranges before execution.

---

## Local Setup

### 1. Spin up the Backend
You'll need Python 3.11+, a GitHub Personal Access Token (PAT), and a Groq API Key.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `backend/.env` file:
```env
GITHUB_TOKEN=your_github_pat
GROQ_API_KEY=your_groq_key
DATABASE_URL=sqlite:///./repodar.db
FRONTEND_URL=http://localhost:3000
```

Initialize the database and run the FastAPI server:
```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Seed the database (takes 2–3 minutes for initial ingestion and scoring):
```bash
curl -X POST http://localhost:8000/admin/run-all-sync
```

### 2. Run the Frontend
You'll need Node 20+ and a Clerk account.

```bash
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Configure your Clerk API keys in `frontend/.env.local` and open **http://localhost:3000**.

---

## API Endpoints

Interactive documentation is available at `http://localhost:8000/docs`. Major endpoints:

```bash
GET  /dashboard/overview                     # Main ecosystem metrics and heatmaps
GET  /dashboard/radar?vertical=ai_ml         # Breakout radar feed
GET  /dashboard/early-radar                  # Pre-viral early-stage repos
GET  /dashboard/leaderboard?period=30d       # Leaderboard by time window
GET  /search?query=agent+frameworks          # NL LLM-parsed query
GET  /topics/momentum                        # Topic velocity and trending tags
GET  /repos/{owner}/{name}                   # Full historical charts and AI summary
GET  /snapshots/weekly                       # Weekly ecosystem digest archive
POST /admin/run-all                          # Trigger ingestion & scoring pipeline
POST /services/register                      # Register an external A2A agent service
```

---

## License

AGPL-3.0. Built because GitHub Trending is always a week late.
