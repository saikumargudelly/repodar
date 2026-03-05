# 📡 Repodar

### Real-time GitHub AI/ML radar — discover what's actually gaining momentum before everyone else knows about it

> Tired of GitHub Trending showing you projects from last week? 
> Repodar continuously tracks 500+ AI/ML repositories every 4 hours, scores them on momentum and health, and surfaces what's actually gaining traction — while everyone else is still catching up.

🚀 **[Live demo](https://repodar.vercel.app/)** &nbsp;·&nbsp; 📂 **[GitHub repo](https://github.com/saikumargudelly/repodar)** &nbsp;·&nbsp; 📊 [What's on the dashboard](#-whats-on-the-dashboard) &nbsp;·&nbsp; ⚡ [Run it yourself](#-get-started-in-5-minutes)

---

## Why Repodar exists

GitHub Trending is great for a morning scroll. It's not great for spotting the next wave before it peaks.

The problem is that by the time something hits GitHub Trending, it's already been discovered. The real signal is *rate of change* — a project gaining 500 stars per day this week versus only 50 last week is far more interesting than a project with 50,000 stars that's plateaued.

Repodar tracks momentum. It wakes up every 4 hours, fetches fresh data on hundreds of repositories, computes two scores (trend momentum + long-term sustainability), and updates the dashboard. Everything is stored as time series so you see not just where things stand, but where they're going.

---

## 📊 What's on the dashboard

### Overview page — the first thing you see

Four quick stats at the top: total repos tracked, hottest category right now, today's #1 by your chosen time window, and how many projects are scoring "healthy" on the sustainability scale.

Below that, it gets more interesting:

**Category Trend Heatmap** — categories ranked by composite trend score. LLM Models, Agent Frameworks, Inference Engines, Vector Databases, and more — see at a glance which space is accelerating and which is cooling off. Pick any time window (Today → 5 Years) and the chart updates instantly.

**Stars Distribution** — Donut chart showing how total GitHub star count splits across categories. Hover any slice to see the exact number and percentage. Large slices show their percentage inline. A side legend lists every category and its share.

**PR Activity** — Which categories have the most active development? Merged PRs and open PRs side by side, so you can see where people are actually shipping vs just starring.

**AI Ecosystem Map** — A scatter plot placing every tracked repository at its (Trend Score, Sustainability Score) coordinate. Quadrants tell the story: Rising Stars (high trend + high sustainability), Breakouts (high trend, watch the health), Established pillars (lower trend but solid), and ones to Watch.

**Leaderboard** — Pick any time window (today → 5 years) and any vertical, and see the top repos with real numbers: stars, star gain for that period, forks, open issues, project age. Pin any repo to your watchlist. Select 2–5 for side-by-side comparison.

---

### Breakout Radar (`/radar`)

Every tracked repo in one sortable table. Sort by trend score, acceleration, star velocity, sustainability, or age. Filter by category or toggle "new only" to surface repos under 180 days old that are already making noise.

Below the main table: the **Language Radar** — which programming languages are gaining the most traction in AI/ML right now, ranked by combined weekly star velocity.

---

### Compare (`/compare`)

Drop in any 2–5 GitHub repos as `owner/name` and get:

- **Star history chart** — overlaid growth curves so you can see who's accelerating
- **Score radar** — spider chart normalising 7 metrics across all selected repos
- **Metrics breakdown table** — every signal side by side, with each winner highlighted
- **Shareable URL** — the URL encodes the full selection, send it to your team

Works with any GitHub repo, tracked or not.

---

### Org Portfolio Health (`/orgs`)

Type any GitHub organisation name and get an instant health snapshot: total public repos, combined star count, top language, how many are tracked by Repodar, and the average sustainability score. Includes a full sortable repo table with Repodar scores where available.

---

### Repo Deep-Dive (`/repo/{owner}/{name}`)

Click any repo anywhere and land here. You get the full picture:

- Star history as an area chart with release event markers
- Daily star delta as a bar chart (easy to spot traffic spikes)
- Contributor growth line over time
- Velocity vs acceleration overlay — is momentum building or fading?
- Trend score timeline — the score's own history over 60 days
- **Signal Explainer** — plain-English breakdown of exactly *why* this repo scored what it did, with week-over-week changes for each signal

---

## 🏆 The two scores

Every tracked repo gets two numbers every time the pipeline runs.

**TrendScore** — how hot is it *right now?*

Built from five signals:
- 7-day star velocity (40%) — raw momentum
- 30-day acceleration (20%) — speeding up or slowing down?
- Contributor growth rate (20%) — are more developers joining?
- Release frequency (10%) — active shipping is a positive signal
- Issue spike factor (10%) — sudden attention, good or bad

**SustainabilityScore** — will it still exist in 6 months?

Built from health signals:
- Issue close rate — are maintainers actually responding?
- Fork-to-star ratio — how many people are building on it vs just starring?
- Release cadence consistency — irregular releases are a yellow flag
- Contributor growth trajectory — a growing team is a healthy team
- Fork growth rate — ecosystem formation signal

Both scores come colour-coded: 🟢 **GREEN** (top tier) · 🟡 **YELLOW** (watch) · 🔴 **RED** (declining)

---

## ⚡ Auto-discovery engine

Repodar doesn't work from a fixed list. Every pipeline run it:

1. Scrapes GitHub Trending (daily, weekly, monthly views) in parallel
2. Searches the GitHub API across 6 verticals and dozens of topic keywords simultaneously
3. Finds new breakout repos and starts tracking them immediately
4. Runs delta-sync ingestion — **INSERT** if this is the first data point today, **UPDATE** if it's a later run the same day, so re-runs never inflate numbers
5. Scores everything fresh
6. Generates trend alerts for repos with sudden momentum spikes
7. Retires repos that haven't trended in 60 days (history is always preserved)

The pipeline runs **every 4 hours** via APScheduler, embedded directly in the FastAPI process. No separate worker, no Redis, no Celery — it just runs as part of the app.

---

## 🎨 Three themes, works on any screen

**Dark** (default) · **Semi-dark** (navy/indigo) · **Light** — pick from the nav. Your choice is saved and applied instantly.

Fully responsive: stat cards flow from 4 columns → 2 → 1 on smaller screens. Charts scale intelligently. Selectors scroll horizontally on mobile. Tables scroll instead of squishing. Works great at 375px and at 4K.

---

## 🔌 Embed a live badge in your README

```html
<!-- Replace owner/repo-name with your actual GitHub repository -->
<!-- Updates automatically every 4 hours when the pipeline runs -->
<iframe
  src="https://repodar.up.railway.app/widget/repo/owner/repo-name"
  width="380" height="200" frameborder="0">
</iframe>
```

When someone opens your README they'll see a live TrendScore, current star count, and sustainability label. No stale screenshots.

---

## 🚀 Get started in 5 minutes

### What you'll need

- Python 3.11+
- Node.js 18+
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (5,000 API calls/hour instead of 60)
- A [Groq API key](https://console.groq.com) (free tier covers weekly reports)

### 1. Clone the repo

```bash
git clone https://github.com/saikumargudelly/repodar.git
cd repodar/backend

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Create a `.env` file in the backend directory

Create `backend/.env` with your API keys:

```env
GITHUB_TOKEN=github_pat_YOUR_TOKEN_HERE
GROQ_API_KEY=gsk_YOUR_KEY_HERE
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=sqlite:///./repodar.db
APP_ENV=development
```

**For production:** Replace `DATABASE_URL` with a PostgreSQL connection string.

### 3. Create the database

```bash
alembic upgrade head
```

### 4. Start the backend

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Seed the database with repos

```bash
curl -X POST http://localhost:8000/admin/run-all-sync
```

Fetches live GitHub data and computes scores. First run takes 2–5 minutes. Then it runs automatically every 4 hours.

### 6. Start the frontend

Open a second terminal:

```bash
cd ../frontend
npm install
npm run dev
```

### 7. Open the dashboard

Go to **[http://localhost:3000](http://localhost:3000)**. You'll see the live dashboard with charts and repos. If the dashboard is empty, the sync from step 5 is still running — it takes 2–5 minutes on first run.

---

## 🏗️ What's under the hood

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) · React 19 · Recharts · TanStack Query v5 · Tailwind CSS v4 |
| Backend | FastAPI 0.135 · SQLAlchemy 2.0 · Alembic · Pydantic v2 |
| Database | PostgreSQL (production) / SQLite (local dev) · DuckDB for time-series analytics |
| Scheduling | APScheduler 3.10 — in-process every 4 hours, **no Redis or Celery needed** |
| AI insights | Groq LLaMA 3.3 70B via the `groq` Python SDK |
| Deployment | Railway (push-to-deploy) |

---

## 📡 API quick reference

Full interactive docs are at `/docs` once the backend is running.

```bash
# Dashboard overview
GET /dashboard/overview

# Leaderboard — period: 1d | 7d | 30d | 90d | 365d | 3y | 5y
GET /dashboard/leaderboard?period=7d&limit=30&vertical=ai_ml

# All repos (Breakout Radar page)
GET /dashboard/radar?new_only=false

# Single repo + history
GET /repos/{owner}/{name}
GET /repos/{owner}/{name}/daily-metrics?days=60
GET /repos/{owner}/{name}/computed-scores?days=60

# Side-by-side comparison
GET /repos/compare?ids=owner1/name1,owner2/name2

# Org health
GET /orgs/{org}/health

# Trend alerts
GET /dashboard/alerts?unread_only=false&limit=20

# Manual sync — waits for completion, returns full stats
POST /admin/run-all-sync

# Background sync — returns immediately
POST /admin/run-all

# GitHub API health check + rate limits
GET /admin/github-status
```

---

## � Production Deployment

### Database: SQLite → PostgreSQL

**Local development** works with SQLite (zero setup, no database server needed):
```env
DATABASE_URL=sqlite:///./repodar.db
```

**Production** requires PostgreSQL for concurrency, durability, and multi-instance scaling:
```env
DATABASE_URL=postgresql://username:password@host:5432/repodar
```

Get PostgreSQL either way:
- **Railway:** Add PostgreSQL service, Railway creates the connection string automatically
- **Self-hosted:** Use Supabase (PostgreSQL as a service) or run PostgreSQL locally: `docker run -e POSTGRES_PASSWORD=pwd -p 5432:5432 postgres`

After setting `DATABASE_URL`, run:
```bash
alembic upgrade head
```

### Scheduling: No Redis Required ✅

Repodar uses **APScheduler embedded in the FastAPI process**. Every 4 hours it wakes up, discovers new repos, scores them, and updates the database — all without needing Redis, Celery, or any external queue.

Local development: No Redis needed.  
Production on Railway: No Redis needed.  
Just keep the backend process running.

---

## �🔑 Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `repo` + `read:user` scopes |
| `DATABASE_URL` | ✅ | SQLite path for local dev, PostgreSQL URL for production |
| `GROQ_API_KEY` | Recommended | Enables weekly AI-generated insights |
| `GROQ_MODEL` | No | Defaults to `llama-3.3-70b-versatile` |
| `APP_ENV` | No | Set to `production` on Railway |
| `DUCKDB_EXTENSION_DIRECTORY` | No | Override extension cache path (useful in write-restricted environments) |

---

## 🤔 Common issues

| Symptom | What to do |
|---------|-----------|
| Empty dashboard, no repos showing | Run the first sync: `curl -X POST http://localhost:8000/admin/run-all-sync` |
| GitHub 403 errors | Your token hit rate limits or is missing scopes — check with `GET /admin/github-status` |
| `schema "np" does not exist` | Pull the latest code — this was a numpy/DuckDB type mapping bug, already fixed |
| Backend startup fails in production | Check `DATABASE_URL` is set correctly and points to a reachable database |
| Charts show empty area but tooltip still works | Clear the Next.js cache: `rm -rf frontend/.next` and redeploy |
| Pipeline not running automatically | APScheduler is embedded in the app process — ensure the backend is running continuously |

---

## 🎓 Want to dig into the code?

The interesting parts:

- [Scoring logic](https://github.com/saikumargudelly/repodar/blob/main/backend/app/services/scoring.py) — exactly how TrendScore and SustainabilityScore are computed from raw GitHub data
- [Discovery + delta ingestion](https://github.com/saikumargudelly/repodar/blob/main/backend/app/services/ingestion.py) — how repos are found and how re-runs avoid inflating numbers
- [APScheduler setup](https://github.com/saikumargudelly/repodar/blob/main/backend/app/main.py) — the 4-hour scheduler wired into FastAPI's lifespan context
- [Dashboard page](https://github.com/saikumargudelly/repodar/blob/main/frontend/app/page.tsx) — Recharts, responsive layout, leaderboard, and all the chart components
- [Radar page](https://github.com/saikumargudelly/repodar/blob/main/frontend/app/radar/page.tsx) — sortable repo table and language rankings

---

## 📝 License

**GNU Affero General Public License v3.0 (AGPL-3.0)**

Use it freely for personal projects, research, and open-source work. If you run it as a public service, the AGPL requires you to open-source your modifications too. See [LICENSE](https://github.com/saikumargudelly/repodar/blob/main/LICENSE) for details.

---

## 🤝 Contributing

Found a bug? Have an idea for a new signal or vertical? Want to improve the scoring model?

1. Read the [Contributing Guide](https://github.com/saikumargudelly/repodar/blob/main/CONTRIBUTING.md) for setup and conventions
2. Fork, branch, build, test
3. Open a PR with a clear description of what changed and why

We follow the [Contributor Covenant](https://github.com/saikumargudelly/repodar/blob/main/CODE_OF_CONDUCT.md). Be good to each other.

---

*Built for people who want to know what's actually happening in open-source AI — not what was happening two weeks ago.*
