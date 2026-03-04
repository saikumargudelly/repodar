# 📡 Repodar

## The Real-Time AI/ML Ecosystem Radar

> **Stop scrolling GitHub trending. Start understanding what's *actually* moving the needle.**

Repodar surfaces **380+ live AI/ML repos** — from the canonical 123 you should know, to the 257 breakthrough projects GitHub doesn't highlight. Real stars. Real trends. Real insights.

[![Live Dashboard](https://img.shields.io/badge/live-dashboard-blue?style=flat&logo=github)](http://localhost:3000)
[![Auto-Discovery](https://img.shields.io/badge/🔍-auto%20discovery-green?style=flat)](#auto-discovery)
[![LLM Reports](https://img.shields.io/badge/🤖-groq%20powered-orange?style=flat)](#ai-powered-insights)
[![100+ Categories](https://img.shields.io/badge/📊-13%20categories-purple?style=flat)](#ecosystem-tracking)

---

## 🎯 What Problem Does It Solve?

| Problem | Repodar Answer |
|---------|---|
| **Info overload** | GitHub Trending shows 30 repos/day. Which matter in 6 months? | **Trending + 90d/365d/3y windows** + momentum scoring |
| **Noise** | Popular != Sustainable. Popular != Active. | **TrendScore + SustainabilityScore** — dual signals |
| **Manual tracking** | Adding 123 repos to favorites? Checking each daily? | **Auto-discovery** — system finds trending ones for you |
| **Missing emerging trends** | Only track known repos? Miss the next LLaMA. | **Daily GitHub Trending scrape + Search API** across 13 verticals |
| **No context** | Why is repo X trending? Is it here to stay? | **Analyst-grade insights** via Groq LLM (weekly reports) |

---

## ✨ Core Features

### 📊 Real-Time Trending Leaderboard
- **Live GitHub Trending** — daily/weekly/monthly star gains (actual data, not estimates)
- **Long-range windows** — 90d, 1y, 3y, 5y search API queries for sustained momentum
- **Instant period switching** — toggle between Today → 5 years in one click
- **Per-repo deep dives** — time-series charts with daily snapshots

### 🔍 Auto-Discovery Engine
**The game-changer:** Every 24 hours, Repodar automatically:
1. Queries GitHub Trending (1d, 7d, 30d)
2. Searches across 6 verticals (AI/ML, DevTools, Web, Security, Data Engineering, Blockchain)
3. **Discovers new repos** → upserts to DB (source="auto_discovered")
4. **Tracks everything** → ingests daily metrics for all repos
5. **Prunes stale** → deactivates after 60 days of no trending signals (preserves history)

**Result:** Grew from 123 curated repos → **380 live tracked** in one run (257 auto-discovered).

### 🏆 Dual-Signal Scoring
**TrendScore (0–100)** — Is it hot *right now*?
- 7-day star velocity + 30-day acceleration
- Fork-to-star ratio + contributor momentum  
- Issue resolution speed

**SustainabilityScore (0–100)** — Will it last?
- Active contributor growth rate
- Release cadence consistency
- Issue close rate velocity
- Age-weighted stability bonus

**Labels:** 🟢 GREEN (70+) | 🟡 YELLOW (40–69) | 🔴 RED (<40)

### 📈 Ecosystem Radar
**Category-level analytics** across 13 AI/ML verticals:
- LLM Models | Agent Frameworks | Inference Engines | Vector Databases  
- Model Serving | Distributed Compute | Evaluation Frameworks | Fine-tuning  
- DevTools | Web Frameworks | Security | Data Engineering | Blockchain

Each category gets:
- Composite trend score (heatmap visualization)
- Total stars & month-over-month growth
- Tech stack breakdown (languages, frameworks)

### 🤖 AI-Powered Insights
**Weekly + Monthly reports** via Groq LLama-3.2-70B:
- Strategic ecosystem narrative
- Top breakouts & momentum signals
- Category trends & tech stack evolution
- Sustainability watchlist (repos at risk)

**Human-grade analysis.** Machine speed.

### 📊 Full time-series tracking
- Daily ingestion for all active repos (stars, forks, watchers, issues, PRs, commits)
- Incremental fetching (80-90% fewer API calls after first snapshot)
- Contributor count tracking
- Language breakdown per repo

---

## 🚀 Quick Start

### Zero to Dashboard in 5 Minutes

```bash
# Clone & enter
git clone <repo-url> && cd repodar

# Backend setup
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure .env
cat > .env << EOF
GITHUB_TOKEN=github_pat_YOUR_TOKEN_HERE
GROQ_API_KEY=gsk_YOUR_KEY_HERE
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=sqlite:///./repodar.db
REDIS_URL=redis://localhost:6379/0
EOF

# Migrate & populate
alembic upgrade head

# One command: discover → ingest → score → explain
curl -X POST http://localhost:8000/admin/run-all

# Frontend
cd ../frontend && npm install && npm run dev
```

**Open [http://localhost:3000](http://localhost:3000)** ✨

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Repodar Stack                         │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  📱 Frontend                    🔌 Backend                │
│  ┌─────────────────────┐       ┌──────────────────────┐  │
│  │ Next.js 15          │       │ FastAPI + async      │  │
│  │ TanStack Query      │       │ Celery + Redis       │  │
│  │ Recharts (7 charts) │       │ SQLAlchemy + SQLite  │  │
│  └─────────────────────┘       │ DuckDB (analytics)   │  │
│                                 └──────────────────────┘  │
│  📡 Data Pipeline                                         │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 1. Auto-discovery  → GitHub Trending + Search API   ││
│  │ 2. Ingestion       → GraphQL batch + REST fallback  ││
│  │ 3. Scoring         → TrendScore + SustainabilityScore││
│  │ 4. LLM Insights    → Groq weekly/monthly reports    ││
│  │ 5. Deactivation    → Mark stale repos (60d cutoff)  ││
│  └──────────────────────────────────────────────────────┘│
│                                                            │
│  💾 Data                                                   │
│  ┌──────────────────────────────────────────────────────┐│
│  │ SQLite: 380 repos × ~1000 days of metrics            ││
│  │ Historical trend tracking + score evolution          ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| **Frontend** | Next.js 15 + TypeScript | Fast, modern, typed |
| **API** | FastAPI (async) | High concurrency for GitHub API calls |
| **Database** | SQLite + DuckDB | Embedded, ACID, analytical queries |
| **Migrations** | Alembic | Version control for schema changes |
| **Background Jobs** | Celery + Redis | Scheduled daily ingestion at scale |
| **Scraping** | GitHub Trending | Real star-gain data since API doesn't expose it |
| **API Client** | GitHub GraphQL + REST | Batch queries (25 repos/query) + incremental fetching |
| **LLM** | Groq (llama-3.3-70b) | Fast inference, free tier, analyst-grade output |

---

## 📊 Dashboard Walkthrough

### Stat Cards
- **Repos Tracked** — live count (now showing +257 auto-discovered)
- **Top Category** — highest total stars
- **#1 Trending** — today's top repo
- **Sustainability** — % of repos with GREEN label

### Charts
1. **Category Trend Heatmap** — 7d/30d/90d momentum per vertical
2. **Top Category by Stars** — ecosystem weight distribution
3. **Category PRs** — development activity per vertical
4. **Top Breakouts** — top 10 repos by TrendScore
5. **Sustainability Ranking** — repos sorted by health
6. **Weekly vs Monthly** — trend acceleration over periods

### Leaderboard
- Click any period (Today, 7D, 30D, 90D, 1Y, 3Y, 5Y)
- See real star gains + Repodar scores for tracked repos
- Time-series chart for each repo

---

## API Endpoints

```bash
# Ecosystem overview (what you see on dashboard)
GET /dashboard/overview
→ total_repos | discovered_repos | top_breakout | category_growth

# Real-time trending (live GitHub data)
GET /dashboard/leaderboard?period=7d&limit=30
→ Latest trending repos with momentum signals

# Repo deep dive
GET /repos/{owner}/{name}
→ Full 1-year time series with TrendScore history

# Weekly analyst report
GET /reports/weekly
→ LLM-generated strategic insights

# Check GitHub API health
GET /admin/github-status
→ Rate limit remaining | Token validity

# Manually trigger pipeline
POST /admin/run-all
→ Full cycle: discover → ingest → score → explain (3 min)

# Auto-discovery only
POST /admin/discover
→ Find trending repos + deactivate stale (30 sec)
```

---

## 🔄 How Auto-Discovery Works

### Every 24h:
1. **Discover Phase** (30 sec)
   - Scrape GitHub Trending (1d, 7d, 30d)
   - Search API across 6 verticals
   - Deduplicate 350+ results → ~50 net new repos
   - Upsert with `source="auto_discovered"`

2. **Ingest Phase** (2 min)
   - GraphQL batch fetch (25 repos/query) for all 380 active repos
   - REST fallback if GraphQL times out
   - Store daily metrics (stars, forks, contributors, commits, etc.)

3. **Score Phase** (10 sec)
   - Compute TrendScore + SustainabilityScore for each repo
   - Calculate category-level growth metrics
   - Generate alerts for momentum spikes

4. **LLM Phase** (20 sec)
   - Groq generates weekly analyst report
   - Top-20 repo explanations

5. **Cleanup Phase** (5 sec)
   - Deactivate auto-discovered repos inactive >60 days
   - (Never deactivates seed repos — they're foundational)

**Total time:** ~3.5 minutes | **API cost:** ~200-300 GitHub calls | **Data freshness:** <24h

---

## 🎯 Key Insights You Get

✅ **Which AI frameworks are rising fastest this week?**  
→ Agent Frameworks up 45% WoW momentum

✅ **Is LLama.cpp still relevant or aging out?**  
→ SustainabilityScore 85% + new releases weekly → Still hot

✅ **What new LLM inference engine should I watch?**  
→ ExLlama2 discovered 8 days ago + 2000 stars/day → Breakout signal

✅ **Category breakdown of the ecosystem?**  
→ 18% LLM Models | 15% Infra | 12% Agents | 55% tooling/other

✅ **Which repos are sustainable vs hype?**  
→ RED flag repos (inactive, no releases) automatically marked

---

## 🛠 Advanced Usage

### Run pipeline manually
```bash
curl -X POST http://localhost:8000/admin/run-all
```

### Check GitHub API rate limit
```bash
curl http://localhost:8000/admin/github-status
# Returns: {token_valid, rate_limit_remaining, rate_limit_reset}
```

### Query specific discovered repos
```bash
sqlite3 backend/repodar.db \
  "SELECT owner, name, source, discovered_at FROM repositories WHERE source='auto_discovered' LIMIT 10"
```

### Get repo metrics for a specific date
```bash
curl "http://localhost:8000/metrics/{repo_id}/daily?date=2026-03-04"
```

---

## 📋 Environment Setup

Create `backend/.env`:

```env
# Required
GITHUB_TOKEN=github_pat_XXXXXXX        # From https://github.com/settings/tokens
GROQ_API_KEY=gsk_XXXXXXX              # From https://console.groq.com
GROQ_MODEL=llama-3.3-70b-versatile

# Database
DATABASE_URL=sqlite:///./repodar.db

# Background jobs (Celery)
REDIS_URL=redis://localhost:6379/0

# Debug
APP_ENV=development  # or production
```

---

## 🚨 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Using REST fallback for..." | Normal — GraphQL timed out, retrying with REST API |
| "HTTP 403" warnings | GitHub rate limit hit — check `/admin/github-status` |
| "HTTP 404" on seed repos | Repo deleted on GitHub — remove from `repos.yaml` |
| Celery not running | Not needed for dev — use `/admin/run-all` instead of cron |
| No data after run | Check backend logs — may need GITHUB_TOKEN validation |

---

## 🎓 Learning Resources

- **[./backend/app/services/scoring.py](./backend/app/services/scoring.py)** — TrendScore + SustainabilityScore algorithms
- **[./backend/app/services/ingestion.py](./backend/app/services/ingestion.py)** — Auto-discovery + incremental fetching logic
- **[./frontend/app/page.tsx](./frontend/app/page.tsx)** — Dashboard charts & real-time updates

---

## 📝 License

MIT — Use freely for research, personal projects, and commercial products. Just credit Repodar.

---

## 🤝 Contributing

Found a bug? Want to add a new vertical? Have ideas for scoring signals?

1. Fork the repo
2. Create a feature branch
3. Submit a PR with clear title + description

---

## 🔗 What's Next?

- [ ] Public leaderboard embeds (iframe widgets)
- [ ] API rate limit optimization (cache more queries)
- [ ] Export reports to PDF/email
- [ ] Slack integration for alerts
- [ ] GitOps deployment guide

---

**Built with ❤️ for the AI/ML community. Stay updated. Stay ahead.**


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
