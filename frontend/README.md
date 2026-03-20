# Repodar — Frontend

Next.js 16 frontend for [Repodar](../README.md), the Real-time GitHub ecosystem radar and research workspace.

## Stack

- **Next.js 16** (App Router)
- **React 19.2**
- **TanStack Query** — server state, caching, auto-refresh
- **Recharts + lightweight-charts** — trend visualizations
- **Clerk** — authentication and session handling
- **TypeScript**
- **Tailwind CSS v4**

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
| `/` | Auth-aware redirect to `/overview` (signed in) or `/landing` (signed out) |
| `/overview` | Main analytics dashboard with heatmaps, KPIs, and ecosystem map |
| `/explore` | Paginated repository exploration with filter controls |
| `/leaderboard` | Time-window and vertical leaderboard |
| `/radar` + `/early-radar` | Breakout radar and early-stage discovery views |
| `/search` | Natural-language search UI |
| `/repo/[...id]` | Repo deep-dive: metrics, releases, mentions, commit activity |
| `/research` + `/research/[id]` | AI research sessions with streaming responses and report generation |
| `/services` | A2A service catalog and registration UI |
| `/watchlist`, `/collections`, `/alerts`, `/profile`, `/settings` | Personalization and workflow surfaces |

## Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/overview
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000`, but Clerk variables are required for authenticated routes.
