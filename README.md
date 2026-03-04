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

### 🎁 Embeddable Widgets
**Share live TrendScore badges in your repo README** — viral growth loop for devs:
```html
<iframe src="https://repodar.io/widget/repo/langchain-ai/langchain" width="380" height="200" frameborder="0"></iframe>
```
- **SVG Circular TrendScore gauge** (0–100) color-coded by sustainability
- **Live metrics** — stars, forks, weekly star velocity, acceleration arrows
- **Markdown badge** — `![Repodar](https://api.repodar.app/widget/badge/{owner}/{name}.svg)`
- **Auto-update** — reflects latest Repodar scores in real-time

**Access:** Navigate to `/widget/repo/{owner}/{name}` → Copy embed code | Example: [/widget/repo/langchain-ai/langchain](http://localhost:3000/widget/repo/langchain-ai/langchain)

### 🌐 Language & Tech Stack Radar
**Track which programming languages are growing fastest across AI/ML repos:**
- **Rankings by velocity** — Python vs Rust vs Go in inference engines
- **Per-language stats** — repo count, weekly star velocity, avg trend score, sustainability
- **Top repo per language** — best-in-class example for each tech stack
- **Categories** — linked categories (LLM Models, Inference Engines, etc.)

**Access:** Dashboard → `/radar` page, scroll to "Language & Tech Stack Radar" section

**Unique angle:** No competitor tracks language-level ecosystem momentum.

### 💡 Signal Explainer
**Click any repo → see why it scored 87/100 in plain English:**
```
⭐ 7-day star velocity: +450/day (+35% vs prior week)
🚀 Momentum: Accelerating (+0.0234)
👥 Contributor growth (7d): +12 new devs (+18% change)
🏷️ Release boost: 2 releases in last 7 days
📊 Trend score: +45% vs prior snapshot
```
- **Color-coded signals** — Green for positive, red for negative
- **Real metrics** — computed from daily ingestion data
- **Human-readable breakdown** — no black boxes

**Access:** `/repo/{id}` page → Scroll past LLM Insight to "Signal Explainer" card

### 🏁 Competitor Comparison Mode
**Side-by-side analysis for 2–5 repos with star history overlay:**
- **Multi-line star history chart** — last 60 days, each repo in unique color
- **Radar score comparison** — normalized metrics across all dimensions
- **Metrics table** — direct numbers (stars, forks, velocity, sustainability)
- **Shareable URL** — `https://repodar.io/compare?repos=vllm,sglang,ollama`

**Access:** `/compare` page | Add repos in search box | URL updates automatically

**Example comparison:** [/compare?repos=langchain-ai/langchain,openai/gpt-engineer,anthropic/claude](http://localhost:3000/compare?repos=langchain-ai/langchain,openai/gpt-engineer,anthropic/claude)

---

## 🔍 Auto-Discovery Engine
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

### Dashboard & Leaderboard
```bash
# Ecosystem overview (what you see on dashboard)
GET /dashboard/overview
→ total_repos | discovered_repos | top_breakout | category_growth

# Real-time trending (live GitHub data)
GET /dashboard/leaderboard?period=7d&limit=30
→ Latest trending repos with momentum signals

# Language & Tech Stack Radar
GET /dashboard/languages?min_repos=2
→ Languages ranked by weekly_star_velocity, with repo stats per language
```

### Repo Deep Dive
```bash
# Full repo profile with time-series data
GET /repos/{owner}/{name}
→ Full 1-year time series with TrendScore history, daily metrics, computed scores

# Repo widget data (compact, for embeds)
GET /widget/repo/{owner}/{name}
→ {owner, name, stars, forks, trend_score_pct, acceleration, velocity_7d, ...}

# Repo signal explainer (computed metrics breakdown)
GET /repos/{repo_id}/computed-scores?days=60
→ Time-series of TrendScore, SustainabilityScore, acceleration, velocity
```

### Comparison & Analytics
```bash
# Compare multiple repos side-by-side
GET /repos/compare?ids=owner1/name1,owner2/name2,owner3/name3
→ Normalized metrics across all repos for radar chart

# Star history for comparison charts
GET /repos/compare/history?ids=owner1/name1,owner2/name2&days=60
→ Daily star counts for each repo, merged by date for LineChart overlay
```

### Admin & Maintenance
```bash
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

## 🎯 Feature Usage Guide

### 1️⃣ Using Embeddable Widgets

**Share TrendScore in your README:**

1. Navigate to `/widget/repo/{owner}/{name}`
   ```
   http://localhost:3000/widget/repo/langchain-ai/langchain
   ```

2. Copy the iframe code from the embed panel:
   ```html
   <iframe src="http://localhost:3000/widget/repo/langchain-ai/langchain" width="380" height="200" frameborder="0"></iframe>
   ```

3. Paste into your GitHub README.md

4. **Or use the SVG badge:**
   ```markdown
   ![Repodar TrendScore](https://api.repodar.app/widget/badge/langchain-ai/langchain.svg)
   ```

The widget displays:
- ✅ Live TrendScore (0–100) as circular gauge
- ✅ Current stars ⭐
- ✅ Weekly star velocity (+N stars)
- ✅ Sustainability score (%)
- ✅ Auto-updates as Repodar rescores

---

### 2️⃣ Language & Tech Stack Radar

**Discover fastest-growing languages in the AI/ML ecosystem:**

1. Open dashboard → Click **"Breakout Radar"** → Scroll to **"Language & Tech Stack Radar"**
   ```
   http://localhost:3000/radar
   ```

2. Table shows:
   - **#** — ranking by velocity
   - **Language** — Python, Rust, Go, etc.
   - **Repos** — how many tracked repos use it
   - **Weekly Star Velocity** — +450 ⭐/week (color-coded)
   - **Avg Trend Score** — average momentum for repos in this language
   - **Avg Sustainability** — health % for this tech stack
   - **Top Repo** — best example repo in this language
   - **Categories** — LLM Models, Inference, Agent Frameworks, etc.

3. **Insights you get:**
   - Python dominance in data science? ✅ See velocity metrics
   - Rust emerging in systems? ✅ Check % growth vs Python
   - New language on the rise? ✅ Identified automatically

---

### 3️⃣ Signal Explainer

**Understand why a repo scored 87/100:**

1. Click any repo from the radar table (or navigate directly):
   ```
   http://localhost:3000/repo/{repo_uuid}
   ```

2. Scroll past the **"Analyst Insight"** section to **"Signal Explainer"**

3. You'll see 5 human-readable signals:

   ```
   ⭐ 7-day star velocity: +450/day (+35% vs prior week)
      ↳ This repo gained 450 stars EACH DAY last week
      ↳ Up 35% compared to the week before → momentum is accelerating
   
   🚀 Momentum: Accelerating (accel: +0.0234)
      ↳ Acceleration is positive → gaining speed
      ↳ Would be 📉 Decelerating if trending downward
   
   👥 Contributor growth (7d): +12 new devs (+18% change)
      ↳ 12 new developers joined in the last week
      ↳ Up 18% from the prior week
   
   🏷️ Release boost: 2 releases in last 7 days
      ↳ Active development signal
      ↳ Fresh features/fixes being pushed
   
   📊 Trend score: 0.001234 (+45% vs prior snapshot)
      ↳ TrendScore increased 45% since last scoring run
      ↳ Momentum is strong & accelerating
   ```

4. **Why this matters:**
   - No black boxes — you see exactly what's driving the score
   - Compare signals across repos (Repo A has ↑ velocity but ↓ contributors)
   - Make informed decisions (Strong trend + new releases? Worth watching)

---

### 4️⃣ Competitor Comparison Mode

**Compare 2–5 repos side-by-side with shared URL:**

1. Open comparison page:
   ```
   http://localhost:3000/compare
   ```

2. Add repos in the search box:
   ```
   langchain-ai/langchain
   openai/gpt-engineer
   anthropic/claude
   ```

3. URL auto-updates to shareable link:
   ```
   http://localhost:3000/compare?repos=langchain-ai/langchain,openai/gpt-engineer,anthropic/claude
   ```

4. You'll see:
   - ✅ **Star History Chart** (60-day overlay)
     - Each repo in unique color
     - See absolute growth trajectories
     - Hover for exact star counts on each date
   
   - ✅ **Radar Chart** (normalized scores)
     - All 6 dimensions: Trend | Sustainability | Velocity | Acceleration | Contributors | Fork/Star
     - Visually compare repo profiles
   
   - ✅ **Metrics Table** (detailed breakdown)
     - Stars, forks, age, trend score, sustainability, velocity, etc.
     - Cell highlighting for top performer in each metric

5. **Share the URL:**
   - Copy from browser → Share on Slack, Discord, Twitter
   - Recipients see live comparison (auto-updates)
   - Useful for: investment decisions, tech selection, ecosystem tracking

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

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### What This Means

- ✅ **Free to use** for research, personal projects, and open-source deployments
- ✅ **Free to modify** — fork and customize the code
- ✅ **Free to distribute** — share improvements with the community
- ⚠️ **Network clause** — if you run a modified version as a service accessible over the network, you **must make your modifications available** to users under the same AGPL-3.0 license

### Commercial Use

- **Cloud/SaaS deployment?** Contact maintainers for alternative licensing options
- **Internal enterprise use** of unmodified code is permitted
- **Attribution required** — must credit Repodar in any distribution

### Details

See the full [LICENSE](./LICENSE) file for complete terms. For a summary, visit [GNU Affero GPL v3.0](https://www.gnu.org/licenses/agpl-3.0.html).

---

## 🤝 Contributing

Found a bug? Want to add a new category? Have ideas for scoring improvements?

Please read our [Contributing Guide](./CONTRIBUTING.md) for:
- How to set up development environment
- Contribution workflow
- Code standards (Python & TypeScript)
- Testing requirements

Summary:
1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with clear messages
4. Submit a PR with description of changes

By contributing, you agree your work will be licensed under AGPL-3.0. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for community guidelines.

---

## 🔗 What's Next?

- [x] **Public leaderboard embeds** — iframe widgets ✅ Live on `/widget/repo/{owner}/{name}`
- [x] **Language & Tech Stack Radar** ✅ New section on `/radar` page
- [x] **Signal Explainer** ✅ Human-readable score breakdown on `/repo/{id}`
- [x] **Competitor Comparison Mode** ✅ Multi-repo analysis on `/compare?repos=...`
- [ ] API rate limit optimization (cache more queries)
- [ ] Export reports to PDF/email
- [ ] Slack integration for alerts
- [ ] GitOps deployment guide
- [ ] Mobile-responsive widget design

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
