# Repodar — Frontend

Next.js 15 frontend for [Repodar](../README.md), the Real-time GitHub AI Ecosystem Radar.

## Stack

- **Next.js 15** (App Router)
- **TanStack Query** — server state, caching, auto-refresh
- **Recharts** — star-velocity sparklines, ecosystem radar chart
- **TypeScript**
- **Tailwind CSS**

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Requires the backend running on `http://localhost:8000`. See the [root README](../README.md) for full setup instructions.

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — period selector, trending leaderboard, radar overview |
| `/radar` | Full-page ecosystem radar chart by AI/ML category |
| `/repo/[id]` | Individual repo deep-dive — star velocity, sustainability score, metrics history |

## Environment

No `.env` needed for local development — the API base URL defaults to `http://localhost:8000`.
