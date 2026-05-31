# 📡 Repodar

**GitHub's trending page shows you what already peaked. Repodar shows you what's about to.**

It tracks hundreds of repos across AI/ML, infra, devtools, and more — scoring them on momentum and health every few hours. So when something starts exploding, you see it first.

🚀 **[Live demo](https://repodar.vercel.app/)** &nbsp;·&nbsp; ⚡ [Run locally](#run-locally) &nbsp;·&nbsp; 📖 [API docs](#api)

---

## What it does

- **Scores every repo on two things** — how hot it is *right now* (TrendScore) and whether it'll survive long-term (SustainabilityScore)
- **Runs every 2 hours** — auto-discovers new repos from GitHub Trending + keyword search, scores everything fresh, fires alerts on momentum spikes
- **30+ pages of tooling** — leaderboard, radar, deep-dives, org health, side-by-side compare, NL search, topic momentum, contributor network, AI research workspace
- **No stale data** — delta-sync means re-runs never inflate numbers; each repo gets one data point per day

---

## The two scores

**TrendScore** — momentum right now
- 7-day star velocity (40%) · 30-day acceleration (20%) · contributor growth (20%) · release activity (10%) · issue spike (10%)

**SustainabilityScore** — will it still be alive in 6 months?
- Issue close rate · fork-to-star ratio · release cadence · contributor trajectory · fork growth

🟢 Top tier &nbsp;·&nbsp; 🟡 Watch it &nbsp;·&nbsp; 🔴 Declining

---

## Pages at a glance

| Page | What it shows |
|---|---|
| `/overview` | Ecosystem KPIs, category heatmap, sustainability rankings |
| `/radar` + `/early-radar` | All tracked repos sortable by any signal |
| `/leaderboard` | Period-based rankings across verticals |
| `/topics` | Topic momentum + drill-down repo lists |
| `/compare` | Side-by-side repo scorecards and star history |
| `/orgs` | Portfolio health for any GitHub org |
| `/search` | Natural-language query → filtered results |
| `/research` | Multi-session AI research workspace with streaming |
| `/repo/{owner}/{name}` | Full deep-dive: history, velocity, commits, releases, mentions |
| `/watchlist` + `/alerts` | Pin repos, get notified on momentum spikes |
| `/collections` | Community-curated repo sets with voting |

---

## Run locally

**You'll need:** Python 3.11+, Node 20+, a [GitHub token](https://github.com/settings/tokens), a [Groq API key](https://console.groq.com), and a [Clerk](https://clerk.com) account.

```bash
# Backend
git clone https://github.com/saikumargudelly/repodar.git
cd repodar/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
GITHUB_TOKEN=github_pat_...
GROQ_API_KEY=gsk_...
DATABASE_URL=sqlite:///./repodar.db
ALLOWED_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Seed data (first run takes 2–5 min)
curl -X POST http://localhost:8000/admin/run-all-sync
```

```bash
# Frontend (new terminal)
cd ../frontend
cp .env.example .env.local   # fill in Clerk keys + NEXT_PUBLIC_API_URL
npm install && npm run dev
```

Open **http://localhost:3000**, sign up, and you're in.

---

## Stack

| | |
|---|---|
| Frontend | Next.js · React 19 · Recharts · TanStack Query |
| Backend | FastAPI · SQLAlchemy 2.0 · Alembic · Pydantic v2 |
| Database | PostgreSQL (prod) / SQLite (local) · DuckDB for analytics |
| AI | Groq — search parsing, summaries, research assistant, STT |
| Auth | Clerk |
| Scheduling | APScheduler embedded in FastAPI (no separate worker) |
| Deploy | Vercel (frontend) · Railway (backend) |

---

## Key env variables

**Backend** — `backend/.env`

| Variable | Notes |
|---|---|
| `GITHUB_TOKEN` | Required. PAT with `repo` + `read:user` |
| `DATABASE_URL` | SQLite locally, PostgreSQL in prod |
| `GROQ_API_KEY` | Needed for search, summaries, research |
| `ADMIN_SECRET_KEY` | Protects `/admin/*` endpoints in prod |
| `REDIS_URL` | Optional — enables response caching |
| `RESEND_API_KEY` | Optional — for email digests |

**Frontend** — `frontend/.env.local`

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk dashboard |
| `CLERK_SECRET_KEY` | From Clerk dashboard |

---

## Common issues

| Problem | Fix |
|---|---|
| Empty dashboard | Run `POST /admin/run-all-sync` — first seed takes ~5 min |
| GitHub 403 errors | Check token scopes at `GET /admin/github-status` |
| NL search not working | `GROQ_API_KEY` must be set in the backend |
| Auth keeps redirecting | Check both Clerk keys are in `frontend/.env.local` |
| Charts broken after deploy | Clear cache: `rm -rf frontend/.next` |

---

## API

Full interactive docs at `/docs`. A few highlights:

```bash
GET  /dashboard/overview
GET  /dashboard/leaderboard?period=7d&vertical=ai_ml
GET  /repos/{owner}/{name}
GET  /search?query=fast+inference+engines
GET  /topics/momentum
POST /admin/run-all          # async trigger
POST /admin/run-all-sync     # wait for completion
```

---

## License

AGPL-3.0 — free for personal and open-source use. If you run it as a public service, open-source your changes too.

---

*Built because GitHub Trending is always a week late.*
