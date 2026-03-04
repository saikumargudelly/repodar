# 📡 Repodar

## Real-Time AI/ML Trends That Actually Matter

> Tired of GitHub Trending showing you projects that disappear in two weeks? 

Repodar watches **380+ AI/ML repos** so you don't have to. We track the ones everyone knows about (the big 123) plus the 257 hidden gems that are actually changing things. 

Real data. Real momentum. Real insights.

🚀 [Try the dashboard](http://localhost:3000) • 📊 [See what's trending](#whats-hot) • 💡 [How it works](#how-it-works)

---

## What's Hot

### 📊 Live Trending Dashboard

You get a real-time leaderboard of what's actually gaining stars. Switch between today, this week, last month — or zoom out to see the past 5 years.

Not estimates. Not guesses. **Real star counts from GitHub.** Every single day.

### ⏱️ Smart Time Windows

Confused by "trending forever"? We show you momentum across multiple timeframes:
- **Today** — what exploded in the last 24 hours
- **This Week** — sustained momentum 
- **Last Month** → **5 Years** — long-term staying power

Flip between them in one click.

### 🎁 Share Your Project's Score

Embed a live card in your GitHub README that shows:
- Your TrendScore (0–100, color-coded)
- Current stars ⭐ and this week's gains
- Sustainability rating

```html
<iframe src="http://localhost:3000/widget/repo/langchain-ai/langchain" width="380" height="200" frameborder="0"></iframe>
```

Or just use the SVG badge:
```markdown
![Repodar](https://api.repodar.app/widget/badge/langchain-ai/langchain.svg)
```

It updates automatically. Your README stays fresh.

### 🌐 Which Languages Are Winning?

See which tech stack is actually trending in AI/ML right now.

Python dominating? Yes. But is Rust catching up? Check. What about the new hotness?

We rank languages by actual momentum, not just repo count. You'll see:
- Stars per week (which language is gaining fastest?)
- Average project health (are Rust AI projects more stable?)
- The best example project in each language

Navigate to `/radar` on the dashboard to see it.

### 💡 Why Did It Trend? (Explained)

No mysterious scores here. Click any project to see exactly why it hit a 87/100:

**"This project just got 450 new stars every single day, up 35% from last week."**

And you'll see:
- 🔺 Trending up (or 🔻 down) & accelerating
- 👥 New developers joining
- 🏷️ Fresh releases = active development  
- 📊 Week-over-week changes

Real numbers. Real explanation. No black box.

### 🏁 Compare Projects Side-by-Side

Want to compare LangChain vs GPT-Engineer vs Claude? Or any 2–5 repos?

Go to `/compare`, add the project names, and you'll see:
- **Star history overlay** (who's winning this month?)
- **Radar scores** (which dimensions is each strong in?)
- **Direct numbers** (stars, forks, velocity, health)
- **Shareable link** (send to friends/team)

Example: [/compare?repos=langchain-ai/langchain,openai/gpt-engineer,anthropic/claude](http://localhost:3000/compare?repos=langchain-ai/langchain,openai/gpt-engineer,anthropic/claude)

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

## How It Works

### 🔍 Auto-Discovery (Every Day)

Repodar wakes up every 24 hours and:

1. **Finds new projects** → Searches GitHub Trending + API across AI/ML categories
2. **Tracks them** → Pulls stars, forks, contributors, release activity
3. **Scores them** → Calculates two numbers:
   - **TrendScore** (0–100) — Is it hot right now?
   - **SustainabilityScore** (0–100) — Will it last?
4. **Gets human insights** → LLM generates weekly analysis
5. **Cleans up** → Archives projects that went quiet

**Result:** Started with 123 curated repos → Found 257 more automatically → Now tracking 380 total.

All in about 3 minutes. Every day.

### 🏆 Two Scores That Matter

**TrendScore** answers: *Is everyone using this right now?*
- How many new stars per day?
- Is momentum accelerating or slowing?
- How many developers are contributing?

**SustainabilityScore** answers: *Will this still exist in 6 months?*
- Is the team actively releasing?
- Are they closing issues?
- Is the contributor base growing?

Both come out color-coded: 🟢 Green (healthy), 🟡 Yellow (okay), 🔴 Red (watch out).

### 🤖 Weekly Insights From an AI Analyst

Every week, we use Groq's AI to write a real analysis:

*"The Agent Framework category is up 45% this week. LLaMA.cpp and Ollama are accelerating together — systems builders are finally commoditizing inference. Here's what's at risk of falling behind..."*

No marketing fluff. Just data + analysis.

---

## 🚀 Get Started in 5 Minutes

```bash
# 1️⃣ Grab the code
git clone <repo-url> && cd repodar

# 2️⃣ Setup backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3️⃣ Create .env file with your API keys
cat > .env << EOF
GITHUB_TOKEN=github_pat_YOUR_TOKEN_HERE
GROQ_API_KEY=gsk_YOUR_KEY_HERE
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=sqlite:///./repodar.db
REDIS_URL=redis://localhost:6379/0
EOF

# 4️⃣ Setup the database
alembic upgrade head

# 5️⃣ Fire it up (optional - just run one manual trigger)
curl -X POST http://localhost:8000/admin/run-all

# 6️⃣ Frontend
cd ../frontend && npm install && npm run dev
```

Then open **[http://localhost:3000](http://localhost:3000)** and start exploring.

---

## 🏗 What Powers It

**Frontend:** Next.js 15 + React (real-time charts with TanStack Query)  
**Backend:** FastAPI (fast Python API) + Celery (background jobs)  
**Database:** SQLite (simple & reliable)  
**AI:** Groq's LLama (for weekly insights)  

We grab data from GitHub's API every day, score it, analyze it, and serve it up fresh.

---

## 📊 Dashboard at a Glance

**Quick Stats** at the top show what's happening:
- 380 repos being tracked
- What category is hottest
- Today's #1 trending project
- Overall ecosystem health

**Charts** show momentum across categories and time periods.

**Leaderboard** — Pick a time window (today, this week, last month, last year) and see what's trending with real numbers, not guesses.

Click any project to see detailed scores and breakdowns.

---

## 📡 API Endpoints (For Builders)

```bash
# Get dashboard overview
GET /dashboard/overview
→ Overview stats + top trends

# Get trending repos for a time period
GET /dashboard/leaderboard?period=7d&limit=30
→ List of trending repos with scores

# Get a single repo's data
GET /repos/{owner}/{name}
→ Full profile with history & scores

# Widget embed data (what your README card uses)
GET /widget/repo/{owner}/{name}
→ Compact data for badges/embeds

# Compare multiple repos
GET /repos/compare?ids=owner1/name1,owner2/name2
→ Side-by-side comparison data

# Manually run the discovery pipeline
POST /admin/run-all
→ Trigger a full refresh

# Check GitHub API status
GET /admin/github-status
→ Rate limits + token health
```

---

## � You'll Need These API Keys

Get them free (both have generous free tiers):

**GitHub Token** → https://github.com/settings/tokens
- Create a "Personal Access Token" with `repo` + `read:user` scope
- Get 5,000 requests/hour (vs 60/hour without it)

**Groq API Key** → https://console.groq.com
- Grab your free API key
- Model: `llama-3.3-70b-versatile`
- Free tier: plenty for weekly reports

Then create `backend/.env`:
```env
GITHUB_TOKEN=github_pat_YOUR_TOKEN
GROQ_API_KEY=gsk_YOUR_KEY
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=sqlite:///./repodar.db
REDIS_URL=redis://localhost:6379/0
APP_ENV=development
```

---

## 🤔 Stuck? Common Issues

| Problem | Fix |
|---------|-----|
| "Using REST fallback..." | GitHub GraphQL timed out. Normal. It retries. |
| "HTTP 403" | You hit GitHub rate limit. Wait an hour or upgrade token scope. |
| "404 on seed repos" | Repository was deleted on GitHub. Remove from `repos.yaml`. |
| No data after running | Check GitHub token is valid: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user` |
| Celery not running | Not needed for dev. Use `curl -X POST http://localhost:8000/admin/run-all` instead. |

---

## 🎓 Want to Understand the Magic?

Dive into the code:
- [Scoring logic](./backend/app/services/scoring.py) — How TrendScore & SustainabilityScore work
- [Auto-discovery](./backend/app/services/ingestion.py) — How we find new projects
- [Dashboard](./frontend/app/page.tsx) — Chart rendering & real-time updates

---

## 📝 License

**GNU Affero General Public License v3.0 (AGPL-3.0)**

- ✅ Use it for research, personal projects, open-source work
- ✅ Modify and customize as needed
- ✅ Share improvements back with the community
- ⚠️ If you deploy it as a service, you must open-source your changes

See [LICENSE](./LICENSE) for full details.

---

## 🤝 Contributing

Have an idea? Found a bug? Want to help?

1. Check [Contributing Guide](./CONTRIBUTING.md) for setup + standards
2. Fork the repo
3. Create a feature branch
4. Commit & push
5. Open a PR

We follow the [Contributor Covenant](./CODE_OF_CONDUCT.md) — be kind, be respectful.

---

## ✨ Made for the AI/ML Community

Repodar exists to help you stay ahead of the curve. No hype. No noise. Just real signals. Real trends. Real insights.

🚀 [Try it now](http://localhost:3000)
