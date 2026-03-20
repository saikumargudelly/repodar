# 📡 Repodar

### Real-time GitHub radar — discover what's actually gaining momentum before everyone else knows about it

> Tired of GitHub Trending showing you projects from last week? 
> Repodar continuously tracks all different domain repositories every 4 hours, scores them on momentum and health, and surfaces what's actually gaining traction — while everyone else is still catching up.

🚀 **[Live demo](https://repodar.vercel.app/)** &nbsp;·&nbsp; 📂 **[GitHub repo](https://github.com/saikumargudelly/repodar)** &nbsp;·&nbsp; 📊 [What's on the dashboard](#-whats-on-the-dashboard) &nbsp;·&nbsp; ⚡ [Run it yourself](#-get-started-in-5-minutes)

---

## Why Repodar exists

GitHub Trending is great for a morning scroll. It's not great for spotting the next wave before it peaks.

The problem is that by the time something hits GitHub Trending, it's already been discovered. The real signal is *rate of change* — a project gaining 500 stars per day this week versus only 50 last week is far more interesting than a project with 50,000 stars that's plateaued.

Repodar tracks momentum. It wakes up every 4 hours, fetches fresh data on hundreds of repositories, computes two scores (trend momentum + long-term sustainability), and updates the dashboard. Everything is stored as time series so you see not just where things stand, but where they're going.

---

## 📊 What's in the product today

Repodar has moved well beyond the earlier v2 dashboard snapshot. The current app includes authenticated workflows, public sharing paths, AI-assisted research flows, and 30+ routed frontend pages.

---

### Discovery + analysis

- **Overview (`/overview`)** — ecosystem KPIs, category trend heatmap, stars distribution, PR activity, sustainability rankings, and an ecosystem map.
- **Explore (`/explore`)** — paginated repository browser with quick filtering and sorting.
- **Insights (`/insights`)** — early-stage and established breakout slices.
- **Leaderboard (`/leaderboard`)** — period + vertical rankings from live GitHub search.
- **Radar (`/radar`)** and **Early Radar (`/early-radar`)** — sortable repo radar plus newer-repo breakout scanning.
- **Topics (`/topics`)** — topic momentum plus drill-down repo lists.
- **Network (`/network`)** — cross-repo contributor network view.
- **Compare (`/compare`)** — side-by-side repo scorecards and history overlays.
- **Org Health (`/orgs`)** — portfolio health for any GitHub organization.
- **NL Search (`/search`)** — natural-language query parsing + blended tracked/live results.

---

### Personalization + workflow

- **Watchlist (`/watchlist`)** — pin repos and configure notification preferences per item.
- **Alerts (`/alerts`)** — momentum alerts with unread tracking.
- **Collections (`/collections`)** — community-curated repo sets with voting.
- **Onboarding (`/onboarding`)** — guided setup for interests, watchlist, and digest preferences.
- **Profile (`/profile`)** and **Settings (`/settings`)** — account-level preferences and digest controls.
- **Weekly Snapshots (`/weekly`, `/weekly/{weekId}`)** — historical weekly top-repo archives.

---

### Repo intelligence

**Repo Deep-Dive (`/repo/{owner}/{name}`)** now includes:

- Star history and daily delta trends
- Velocity vs acceleration and trend timeline
- Commit activity heatmap
- Recent release timeline
- Social mentions (HN/Reddit)
- Signal explainer + AI deep summary

---

### AI research workspace

- **Research (`/research`, `/research/{id}`)** — multi-session assistant workflow.
- Streaming agent responses (SSE), pinboards, and structured repo shortlisting.
- Session-level report generation and share links (`/research/share/{token}`).
- Speech-to-text input via Groq Whisper (`/research/stt/transcribe`).
- Blog/social draft generation from research context.

---

### Developer + integration surfaces

- **Dev API (`/dev`)** — per-user API key management and usage status.
- **A2A Service Catalog (`/services`, `/services/{id}`)** — register/search service capabilities.
- **Widgets** — embeddable JSON/SVG repo badges (`/widget/...`).
- **Public API v1 (`/api/v1/*`)** — key-protected public endpoints.
- **RSS + subscriptions** — `/feed.xml`, `/feed/{vertical}.xml`, and `/subscribe`.

---

## 🔐 Authentication

Repodar uses **Clerk** for authentication. Sign up, sign in, and manage profile/digest preferences from the in-app user menu.

Public paths include the landing/auth flow and repo pages (`/repo/*`). Main product routes require login and redirect to `/sign-in` when unauthenticated.

---

## 🎨 Three themes, works on any screen

Pick from the theme switcher in the top nav bar — preference is saved to `localStorage`:

| Theme | Name | Accent |
|-------|------|--------|
| `dark` | **Ice** | Blue `#58a6ff` |
| `fire` | **Ember** | Orange `#d4713a` |
| `matrix` | **Indigo** | Indigo `#818cf8` |

Fully responsive: the sidebar collapses to icons on desktop (click to toggle), and slides in as a drawer on mobile via the ☰ hamburger. Charts scale intelligently. Tables scroll instead of squishing. Works great at 375px and at 4K.

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
8. Runs daily enrichment jobs for social mentions, releases, and commit activity
9. Triggers digest delivery jobs (daily/weekly/monthly)

The core pipeline runs **every 4 hours** via APScheduler, embedded directly in the FastAPI process. No separate queue worker is required. Redis is optional and used for HTTP response caching when available.

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
- Node.js 20+
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (5,000 API calls/hour instead of 60)
- A [Groq API key](https://console.groq.com) (used by NL Search, research assistant, summaries, and STT)
- A [Clerk](https://clerk.com) account (free tier — for authentication)
- Optional: Redis (for response cache) and Resend (for email digests/notifications)

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
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
RESEND_API_KEY=re_xxx_optional
RESEND_FROM_EMAIL=noreply@example.com
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

### 6. Configure the frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_KEY
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/overview
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### 7. Start the frontend

Open a second terminal:

```bash
cd ../frontend
npm install
npm run dev
```

### 8. Open the dashboard

Go to **[http://localhost:3000](http://localhost:3000)**. Sign up for an account and you'll land on the Overview dashboard. If the dashboard is empty, the sync from step 5 is still running — it takes 2–5 minutes on first run.

---

## 🏗️ What's under the hood

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) · React 19.2 · Recharts · TanStack Query v5 · Tailwind CSS v4 |
| Auth | Clerk (sign-up, sign-in, user profiles, session management) |
| Backend | FastAPI 0.135.1 · SQLAlchemy 2.0 · Alembic · Pydantic v2 |
| Database | PostgreSQL (production) / SQLite (local dev) · DuckDB for time-series analytics |
| Scheduling | APScheduler 3.10 — in-process jobs (4h pipeline + daily/weekly/monthly jobs) |
| Caching | `fastapi-cache2` with Redis backend (optional, auto-initialized when `REDIS_URL` is available) |
| AI insights & Search | Groq (query parsing, reports, deep summaries, research assistant, STT) |
| Deployment | Vercel (frontend) · Railway (backend) |

---

## 📡 API quick reference

Full interactive docs are at `/docs` once the backend is running.

```bash
# Core dashboard
GET /dashboard/overview
GET /dashboard/categories?period=7d
GET /dashboard/languages?min_repos=2

# Leaderboard — period: 1d | 7d | 30d | 90d | 365d | 3y | 5y
GET /dashboard/leaderboard?period=7d&limit=30&vertical=ai_ml

# All repos (Breakout Radar page)
GET /dashboard/radar?new_only=false

# Early-stage radar
GET /dashboard/early-radar?max_age_days=90&max_stars=1000&limit=50

# Natural-language search
GET /search?query=fast+inference+engines+with+high+momentum&limit=30
POST /search/parse?query=fast+inference+engines+with+high+momentum

# Repositories + history
GET /repos?page=1&per_page=50
GET /repos/{owner}/{name}
GET /repos/{owner}/{name}/deep-summary
POST /repos/{owner}/{name}/delta-run
GET /repos/{repo_id:path}/metrics?days=60
GET /repos/{repo_id:path}/scores?days=60
GET /repos/{repo_id:path}/releases?limit=10
GET /repos/{repo_id:path}/mentions?limit=20
GET /repos/{repo_id:path}/commit-activity

# Side-by-side comparison
GET /repos/compare?ids=owner1/name1,owner2/name2
GET /repos/compare/history?ids=owner1/name1,owner2/name2&days=60

# Org health
GET /orgs/{org}/oss-health

# Alerts + watchlist (auth headers required)
GET /dashboard/alerts?unread_only=false&limit=20
PATCH /dashboard/alerts/{alert_id}/read
GET  /watchlist
POST /watchlist
PATCH /watchlist/{item_id}
DELETE /watchlist/{item_id}

# Topic/contributor/fork intelligence
GET /topics/momentum
GET /topics/{topic}/repos
GET /contributors/network
GET /forks/leaderboard

# Filtering, forecasting, export, recommendations
POST /filters/repos
GET  /filters/repos
GET  /filters/presets
POST /filters/presets
GET /forecast/{owner}/{name}
GET /forecast/bulk/batch?ids=owner1/name1,owner2/name2
GET /export/repos?format=csv
GET /export/metrics/{owner}/{name}?format=json&days=90
GET /recommendations?user_id=clerk_user_id
GET /recommendations/similar/{owner}/{name}

# Collections, alert rules, services
GET  /collections/trending
POST /collections
PATCH /collections/{collection_id}
POST /collections/{collection_id}/vote
GET  /alerts/rules
POST /alerts/rules
GET  /services
POST /services/register
GET  /services/search?capability=streaming

# Research workspace
POST /research/sessions
POST /research/sessions/{session_id}/message
GET  /research/sessions/{session_id}/stream
POST /research/sessions/{session_id}/report
POST /research/sessions/{session_id}/share
POST /research/stt/transcribe

# Weekly snapshots
GET /snapshots
GET /snapshots/{week_id}
GET /reports/weekly
GET /reports/monthly
GET /reports/history

# Dev + public API + feeds
POST /dev/keys
GET  /dev/keys
GET  /api/v1/repos
GET  /api/v1/scores
GET /feed.xml
GET /feed/{vertical}.xml
POST /subscribe

# Manual sync — waits for completion, returns full stats
POST /admin/run-all-sync

# Background sync — returns immediately
POST /admin/run-all

# GitHub API health check + rate limits
GET /admin/github-status
```

---

## 🚢 Production Deployment

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
- **Self-hosted:** Use Supabase or run PostgreSQL locally: `docker run -e POSTGRES_PASSWORD=pwd -p 5432:5432 postgres`

After setting `DATABASE_URL`, run:
```bash
alembic upgrade head
```

### Scheduling and Cache

Repodar uses **APScheduler embedded in the FastAPI process**.

- Every 4 hours: ingest + score pipeline
- Daily: A2A service discovery, social/release/commit enrichment, digest dispatch
- Weekly: snapshots and weekly digest
- Monthly: monthly digest

No separate queue worker is required. Redis is optional; when `REDIS_URL` is set, the API enables response caching automatically.

---

## 🔑 Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `repo` + `read:user` scopes |
| `DATABASE_URL` | ✅ | SQLite path for local dev, PostgreSQL URL for production |
| `GROQ_API_KEY` | Recommended | Enables NL Search, research mode, summaries, and report generation |
| `GROQ_MODEL` | No | Defaults to `llama-3.3-70b-versatile` |
| `GROQ_STT_MODEL` | No | Default speech-to-text model for `/research/stt/transcribe` |
| `GROQ_STT_MAX_BYTES` | No | Max audio upload size for STT (default 25 MB) |
| `REDIS_URL` | No | Optional Redis URL for FastAPI response cache |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS allow-list |
| `FRONTEND_URL` | Recommended | Base URL used in RSS/email links |
| `RESEND_API_KEY` | No | Enables outbound email notifications/digests |
| `RESEND_FROM_EMAIL` | No | Sender address for Resend emails |
| `ADMIN_SECRET_KEY` | Recommended (prod) | Protects admin endpoints |
| `DUCKDB_EXTENSION_DIRECTORY` | No | Override extension cache path (useful in write-restricted environments) |
| `SPIKE_Z_THRESHOLD` | No | Alert spike detection tuning |
| `SPIKE_SUSTAINED_Z_THRESHOLD` | No | Sustained spike tuning |
| `SPIKE_MIN_HISTORY_DAYS` | No | Minimum history required for spike calculations |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL, e.g. `http://localhost:8000` |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical frontend URL for metadata/share cards |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | No | `/overview` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | No | `/onboarding` |

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
| Auth redirects to `/sign-in` unexpectedly | Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in `frontend/.env.local` |
| NL Search returns no results | `GROQ_API_KEY` must be set in the backend — NL Search uses the Groq API to parse queries |
| `FastAPI-Cache initialized` warning appears | Set `REDIS_URL` if you want caching, or ignore the warning for local no-Redis runs |
| Email subscription/digest doesn't send | Configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `FRONTEND_URL` |

---

## 🎓 Want to dig into the code?

The interesting parts:

- [Scoring logic](https://github.com/saikumargudelly/repodar/blob/main/backend/app/services/scoring.py) — exactly how TrendScore and SustainabilityScore are computed from raw GitHub data
- [Discovery + delta ingestion](https://github.com/saikumargudelly/repodar/blob/main/backend/app/services/ingestion.py) — how repos are found and how re-runs avoid inflating numbers
- [APScheduler setup](https://github.com/saikumargudelly/repodar/blob/main/backend/app/main.py) — the 4-hour scheduler wired into FastAPI's lifespan context
- [NL Search router](https://github.com/saikumargudelly/repodar/blob/main/backend/app/routers/search.py) — how plain English is turned into structured filters via Groq
- [Research router](https://github.com/saikumargudelly/repodar/blob/main/backend/app/routers/research.py) — sessions, streaming, reports, sharing, and speech-to-text
- [Service catalog router](https://github.com/saikumargudelly/repodar/blob/main/backend/app/routers/services.py) — A2A service registration and capability discovery
- [Dashboard page](https://github.com/saikumargudelly/repodar/blob/main/frontend/app/overview/page.tsx) — Recharts, responsive layout, leaderboard, and all the chart components
- [Radar page](https://github.com/saikumargudelly/repodar/blob/main/frontend/app/radar/page.tsx) — sortable repo table and language rankings
- [Research UI](https://github.com/saikumargudelly/repodar/blob/main/frontend/app/research/%5Bid%5D/page.tsx) — interactive research workspace and export/share flows
- [Sidebar](https://github.com/saikumargudelly/repodar/blob/main/frontend/components/Sidebar.tsx) — collapsible desktop nav + mobile drawer

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
