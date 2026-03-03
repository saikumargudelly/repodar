/**
 * Typed API client for all Repodar backend endpoints.
 * Uses NEXT_PUBLIC_API_URL from .env.local.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RepoSummary {
  id: string;
  owner: string;
  name: string;
  category: string;
  description: string | null;
  github_url: string;
  primary_language: string | null;
  age_days: number;
  trend_score: number | null;
  sustainability_score: number | null;
  sustainability_label: "GREEN" | "YELLOW" | "RED" | null;
  star_velocity_7d: number | null;
  acceleration: number | null;
}

export interface RepoDetail extends RepoSummary {
  star_velocity_30d: number | null;
  contributor_growth_rate: number | null;
  fork_to_star_ratio: number | null;
  issue_close_rate: number | null;
  explanation: string | null;
}

export interface DailyMetricPoint {
  date: string;
  stars: number;
  forks: number;
  contributors: number;
  open_issues: number;
  merged_prs: number;
  releases: number;
  daily_star_delta: number;
}

export interface ComputedMetricPoint {
  date: string;
  trend_score: number;
  sustainability_score: number;
  sustainability_label: string;
  star_velocity_7d: number;
  star_velocity_30d: number;
  acceleration: number;
  contributor_growth_rate: number;
  fork_to_star_ratio: number;
  issue_close_rate: number;
}

export interface BreakoutRepo {
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  trend_score: number;
  acceleration: number;
  star_velocity_7d: number;
  sustainability_label: string;
  age_days: number;
  primary_language: string | null;
}

export interface CategoryMetrics {
  category: string;
  total_stars: number;
  weekly_velocity: number;
  mom_growth_pct: number;
  repo_count: number;
}

export interface OverviewResponse {
  as_of: string;
  total_repos: number;
  top_breakout: BreakoutRepo[];
  sustainability_ranking: SustainabilityEntry[];
  category_growth: CategoryMetrics[];
}

export interface SustainabilityEntry {
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  sustainability_score: number;
  sustainability_label: string;
  trend_score: number;
}

export interface RadarRepo {
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  trend_score: number;
  acceleration: number;
  star_velocity_7d: number;
  sustainability_label: string;
  sustainability_score: number;
  age_days: number;
}

export interface WeeklyReport {
  week_ending: string;
  generated_at: string;
  top_breakout_repos: BreakoutEntry[];
  category_momentum: CategoryShift[];
  tech_stack_trends: { language: string; repo_count: number }[];
  sustainability_watchlist: SustainabilityWatch[];
  strategic_insight: string;
}

export interface BreakoutEntry {
  rank: number;
  owner: string;
  name: string;
  category: string;
  trend_score: number;
  star_velocity_7d: number;
  acceleration: number;
  sustainability_label: string;
  explanation: string | null;
}

export interface CategoryShift {
  category: string;
  weekly_velocity: number;
  mom_growth_pct: number;
  signal: string;
}

export interface SustainabilityWatch {
  owner: string;
  name: string;
  category: string;
  sustainability_label: string;
  sustainability_score: number;
  trend_score: number;
  note: string;
}

export interface PipelineStatus {
  status: string;
  detail: string;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export type Period = "1d" | "7d" | "30d" | "90d" | "365d" | "3y" | "5y";

export interface LeaderboardEntry {
  rank: number;
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  primary_language: string | null;
  age_days: number;
  current_stars: number;
  star_gain: number;
  star_gain_pct: number;
  current_forks: number;
  sustainability_label: string;
  sustainability_score: number;
  trend_score: number;
  // GitHub Search enrichment (optional — present for github_search source)
  description?: string | null;
  open_issues?: number | null;
  watchers?: number | null;
  topics?: string[] | null;
  created_at?: string | null;
  pushed_at?: string | null;
  star_gain_label?: string | null;  // e.g. "4,557 stars today" from GitHub Trending
}

export interface LeaderboardResponse {
  period: Period;
  period_days: number;
  as_of: string;
  has_history: boolean;
  source: "github_search" | "db";
  entries: LeaderboardEntry[];
}

// ─── API functions ───────────────────────────────────────────────────────────

export const api = {
  // Repos
  listRepos: (params?: { category?: string; sort_by?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.sort_by) qs.set("sort_by", params.sort_by);
    return apiFetch<RepoSummary[]>(`/repos?${qs}`);
  },
  getRepo: (id: string) => apiFetch<RepoDetail>(`/repos/${id}`),

  // Metrics
  getDailyMetrics: (id: string, days = 30) =>
    apiFetch<DailyMetricPoint[]>(`/repos/${id}/metrics?days=${days}`),
  getComputedScores: (id: string, days = 30) =>
    apiFetch<ComputedMetricPoint[]>(`/repos/${id}/scores?days=${days}`),

  // Dashboard
  getOverview: () => apiFetch<OverviewResponse>("/dashboard/overview"),
  getRadar: (newOnly = false) =>
    apiFetch<RadarRepo[]>(`/dashboard/radar?new_only=${newOnly}`),
  getCategories: () => apiFetch<CategoryMetrics[]>("/dashboard/categories"),
  getLeaderboard: (period: Period, category?: string, limit = 20) => {
    const qs = new URLSearchParams({ period, limit: String(limit) });
    if (category) qs.set("category", category);
    return apiFetch<LeaderboardResponse>(`/dashboard/leaderboard?${qs}`);
  },

  // Reports
  getWeeklyReport: () => apiFetch<WeeklyReport>("/reports/weekly"),

  // Admin
  triggerFullPipeline: () =>
    apiFetch<PipelineStatus>("/admin/run-all", { method: "POST" }),
  getPipelineStatus: () => apiFetch<Record<string, unknown>>("/admin/status"),
};
