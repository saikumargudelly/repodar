/**
 * Typed API client for all Repodar backend endpoints.
 * Uses NEXT_PUBLIC_API_URL from .env.local.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    // Try to extract the real error message from the FastAPI response body
    // before falling back to the generic status string.
    let detail = `API ${res.status}: ${path}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body?.detail)) {
        // Pydantic validation errors come back as an array of {msg, loc}
        detail = body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join("; ");
      } else if (typeof body?.message === "string") {
        detail = body.message;
      } else if (typeof body?.error === "string") {
        detail = body.error;
      }
    } catch {
      // response body is not JSON — keep the generic message
    }
    throw new Error(detail);
  }
  if (res.status === 204) {
    return {} as T;
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
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
  // AI-generated plain-English summary (Feature 1)
  repo_summary: string | null;
  repo_summary_generated_at: string | null;
}

export interface ContributorInfo {
  login: string;
  avatar_url: string;
  contributions: number;
  profile_url: string;
}

export interface DeepSummary {
  repo_id: string;
  owner: string;
  name: string;
  what: string;
  why: string;
  how: string;
  tech_stack: string[];
  use_cases: string[];
  contributors: ContributorInfo[];
  languages: Record<string, number>;
  generated_at: string;
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
  total_contributors: number;
  total_merged_prs: number;
  weekly_velocity: number;
  mom_growth_pct: number;
  repo_count: number;
  period_star_gain: number;
  period_pr_gain: number;
  avg_open_prs: number;
  trend_composite: number;
}

export interface AlertResponse {
  id: string;
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  alert_type: "star_spike_24h" | "star_spike_48h" | "momentum_surge" | "pr_surge" | "new_breakout" | string;
  window_days: number;
  headline: string;
  metric_value: number;
  threshold: number;
  baseline_mean?: number | null;
  baseline_stddev?: number | null;
  z_score?: number | null;
  percentile?: number | null;
  is_sustained?: boolean;
  momentum_direction?: string | null;
  triggered_at: string;  // ISO-8601
  is_read: boolean;
}

export interface OverviewResponse {
  as_of: string;
  total_repos: number;       // active repos only
  discovered_repos: number;  // auto-discovered subset
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
  stars: number;
  topics: string[] | null;
  primary_language: string | null;
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

export type Vertical =
  | "ai_ml"
  | "devtools"
  | "web_frameworks"
  | "security"
  | "data_engineering"
  | "blockchain"
  | "oss_tools";

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

// ─── Compare ─────────────────────────────────────────────────────────────────

export interface CompareEntry {
  repo_id: string;
  owner: string;
  name: string;
  description: string | null;
  github_url: string;
  primary_language: string | null;
  current_stars: number;
  current_forks: number;
  age_days: number;
  trend_score: number | null;
  sustainability_score: number | null;
  sustainability_label: "GREEN" | "YELLOW" | "RED" | null;
  star_velocity_7d: number | null;
  acceleration: number | null;
  contributor_growth_rate: number | null;
  fork_to_star_ratio: number | null;
  issue_close_rate: number | null;
  is_tracked: boolean;
}

// ─── Org Health ───────────────────────────────────────────────────────────────

export interface OrgRepoHealth {
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  open_issues: number;
  age_days: number;
  github_url: string;
  pushed_at: string | null;
  trend_score: number | null;
  sustainability_score: number | null;
  sustainability_label: "GREEN" | "YELLOW" | "RED" | null;
  is_tracked: boolean;
}

export interface OrgHealthResponse {
  org: string;
  total_repos: number;
  total_stars: number;
  top_language: string | null;
  tracked_repos: number;
  avg_sustainability_score: number | null;
  repos: OrgRepoHealth[];
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export interface WidgetData {
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  language: string | null;
  github_url: string;
  trend_score: number | null;
  trend_score_pct: number | null;   // 0-100 normalised display value
  sustainability_score: number | null;
  sustainability_label: "GREEN" | "YELLOW" | "RED" | null;
  star_velocity_7d: number | null;
  acceleration: number | null;
  contributor_growth_rate: number | null;
  is_tracked: boolean;
}

// ─── Language & Tech Stack Radar ─────────────────────────────────────────────

export interface LanguageStat {
  language: string;
  repo_count: number;
  total_stars: number;
  avg_trend_score: number;
  avg_sustainability_score: number;
  weekly_star_velocity: number;
  growth_rank: number;
  categories: string[];
  top_repo: string | null;
}

// ─── Compare history ─────────────────────────────────────────────────────────

export interface RepoHistoryPoint {
  date: string;
  stars: number;
  daily_star_delta: number;
}

export interface RepoHistory {
  repo_id: string;
  owner: string;
  name: string;
  color_index: number;
  history: RepoHistoryPoint[];
}

// ─── Early Radar ─────────────────────────────────────────────────────────────

export interface EarlyRadarRepo {
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  primary_language: string | null;
  age_days: number;
  stars: number;
  trend_score: number;
  sustainability_label: string;
  acceleration: number;
  star_velocity_7d: number;
  topics: string[] | null;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export interface WatchlistItemOut {
  id: string;
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  primary_language: string | null;
  age_days: number;
  stars: number;
  trend_score: number | null;
  sustainability_label: string | null;
  acceleration: number | null;
  alert_threshold: number | null;
  notify_email: string | null;
  notify_webhook: string | null;
  created_at: string;
}

export interface WatchlistAddBody {
  repo_id: string;
  alert_threshold?: number | null;
  notify_email?: string | null;
  notify_webhook?: string | null;
}

export interface WatchlistPatchBody {
  alert_threshold?: number | null;
  notify_email?: string | null;
  notify_webhook?: string | null;
}

// ─── Topic Intelligence ───────────────────────────────────────────────────────

export interface TopicRepo {
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  primary_language: string | null;
  age_days: number;
  stars: number;
  trend_score: number;
  acceleration: number;
  sustainability_label: string;
  topics: string[] | null;
}

export interface TopicMomentum {
  topic: string;
  repo_count: number;
  avg_trend_score: number;
  total_star_velocity: number;
  avg_acceleration: number;
  top_repos: TopicRepo[];
}

// ─── Contributor Network ──────────────────────────────────────────────────────

export interface ContributorRepoEntry {
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  primary_language: string | null;
  trend_score: number;
  stars: number;
  contributions: number;
}

export interface CrossRepoContributor {
  login: string;
  avatar_url: string | null;
  repo_count: number;
  total_contributions: number;
  repos: ContributorRepoEntry[];
}

// ─── Fork Intelligence ────────────────────────────────────────────────────────

export interface NotableFork {
  fork_owner: string;
  fork_name: string;
  fork_full_name: string;
  github_url: string;
  stars: number;
  forks: number;
  open_issues: number;
  primary_language: string | null;
  last_push_at: string | null;
  parent_owner: string;
  parent_name: string;
  parent_trend_score: number | null;
  snapshot_date: string;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKeyOut {
  id: string;
  name: string;
  tier: string;
  calls_today: number;
  calls_this_month: number;
  calls_total: number;
  day_limit: number;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  raw_key?: string;
}

export interface CreateApiKeyBody {
  name: string;
}

export type DigestFrequency = "realtime" | "daily" | "weekly" | "monthly" | "off";

export interface OnboardingStatus {
  user_id: string;
  current_step: "interests" | "watchlist" | "alerts" | "tour" | "complete" | string;
  onboarding_completed: boolean;
  selected_verticals: string[];
  steps_completed: {
    interests: boolean;
    watchlist: boolean;
    alerts: boolean;
    tour: boolean;
  };
}

export interface ProfilePreferences {
  user_id: string;
  email: string | null;
  digest_frequency: DigestFrequency;
  verticals: string[];
  is_confirmed: boolean;
}

export interface ProfilePreferencesPatchBody {
  email?: string;
  digest_frequency?: DigestFrequency;
  verticals?: string[];
}

// ─── A2A Service Catalog ─────────────────────────────────────────────────────

export interface A2ACapability {
  id: string;
  service_id: string;
  name: string;
  method: string;
  path: string;
  description: string | null;
}

export interface A2AService {
  id: string;
  name: string;
  provider: string | null;
  base_url: string;
  description: string | null;
  version: string | null;
  categories: string[] | null;
  status: "active" | "unreachable" | "invalid" | "no_card" | "auth_required" | "rate_limited" | "sleeping" | string;
  response_latency_ms: number | null;
  created_at: string | null;
  last_checked_at: string | null;
  last_seen_at: string | null;
  capabilities: A2ACapability[];
  capability_count: number;
  // Rich metadata
  auth_schemes: string[] | null;
  input_modes: string[] | null;
  output_modes: string[] | null;
  documentation_url: string | null;
  supports_streaming: boolean | null;
}

export interface RegisterServiceResponse {
  message: string;
  service_id: string | null;
  status: string;
}

// ─── Report History ───────────────────────────────────────────────────────────

export interface ReportSummary {
  id: number;
  period_type: string;
  period_label: string;
  generated_at: string;
}

// ─── Feature 7: Releases ─────────────────────────────────────────────────────

export interface ReleaseItem {
  id: string;
  tag_name: string;
  name: string | null;
  body_truncated: string | null;
  published_at: string;
  is_prerelease: boolean;
  html_url: string | null;
}

// ─── Feature 6: Social Mentions ──────────────────────────────────────────────

export interface SocialMentionItem {
  id: string;
  platform: "hn" | "reddit" | string;
  post_title: string | null;
  post_url: string;
  upvotes: number;
  comment_count: number;
  subreddit: string | null;
  posted_at: string;
}

// ─── Feature 8: Commit Activity ──────────────────────────────────────────────

export interface CommitActivityPoint {
  date: string;  // YYYY-MM-DD
  count: number;
}

// ─── Feature 5: NL Search ────────────────────────────────────────────────────

export interface ParsedFilters {
  vertical: string | null;
  min_trend_score: number | null;
  max_age_days: number | null;
  min_stars: number | null;
  sort_by: string | null;
  time_window: string | null;
  language: string | null;
  min_sustainability: number | null;
  keywords: string[];
  github_search_query: string | null;
  query_understood: string;
  raw_query: string;
}

export interface NLSearchRepo {
  repo_id: string | number;
  owner: string;
  name: string;
  category: string;
  github_url: string;
  primary_language: string | null;
  age_days: number | null;
  stars: number | null;
  trend_score: number | null;
  sustainability_score: number | null;
  sustainability_label: string | null;
  star_velocity_7d: number | null;
  acceleration: number | null;
  description: string | null;
  topics: string[] | null;
  forks?: number | null;
  open_issues?: number | null;
  source: "internal" | "github";
}

export interface NLSearchResult {
  filters: ParsedFilters;
  repos: NLSearchRepo[];
  total: number;
}

// ─── Feature 12: Weekly Snapshots ────────────────────────────────────────────

export interface SnapshotSummary {
  week_id: string;
  published_at: string;
  repo_count: number;
}

export interface SnapshotDetail {
  week_id: string;
  published_at: string;
  repos: Array<{
    rank: number;
    repo_id: string;
    owner: string;
    name: string;
    category: string;
    github_url: string;
    primary_language: string | null;
    description: string | null;
    trend_score: number;
    sustainability_score: number;
    sustainability_label: string;
    star_velocity_7d: number;
    acceleration: number;
    stars: number;
    age_days: number;
  }>;
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
  getDeepSummary: (owner: string, name: string) =>
    apiFetch<DeepSummary>(`/repos/${owner}/${name}/deep-summary`),

  // Metrics
  getDailyMetrics: (id: string, days = 30) =>
    apiFetch<DailyMetricPoint[]>(`/repos/${id}/metrics?days=${days}`),
  getComputedScores: (id: string, days = 30) =>
    apiFetch<ComputedMetricPoint[]>(`/repos/${id}/scores?days=${days}`),

  // Dashboard
  getOverview: () => apiFetch<OverviewResponse>("/dashboard/overview"),
  getRadar: (newOnly = false) =>
    apiFetch<RadarRepo[]>(`/dashboard/radar?new_only=${newOnly}`),
  getCategories: (period: Period = "7d") => apiFetch<CategoryMetrics[]>(`/dashboard/categories?period=${period}`),  
  getLeaderboard: (period: Period, category?: string, limit = 20, vertical: Vertical = "ai_ml") => {
    const qs = new URLSearchParams({ period, limit: String(limit), vertical });
    if (category) qs.set("category", category);
    return apiFetch<LeaderboardResponse>(`/dashboard/leaderboard?${qs}`);
  },

  // Compare
  compareRepos: (ids: string[]) =>
    apiFetch<CompareEntry[]>(`/repos/compare?ids=${ids.join(",")}`),

  compareHistory: (ids: string[], days = 30) =>
    apiFetch<RepoHistory[]>(`/repos/compare/history?ids=${ids.join(",")}&days=${days}`),

  // Language radar
  getLanguageRadar: (minRepos = 2) =>
    apiFetch<LanguageStat[]>(`/dashboard/languages?min_repos=${minRepos}`),

  // Org health
  getOrgHealth: (org: string, limit = 25) =>
    apiFetch<OrgHealthResponse>(`/orgs/${org}/oss-health?limit=${limit}`),

  // Widget
  getWidgetData: (owner: string, name: string) =>
    apiFetch<WidgetData>(`/widget/repo/${owner}/${name}`),

  // Reports
  getWeeklyReport: () => apiFetch<WeeklyReport>("/reports/weekly"),

  // Admin
  triggerFullPipeline: () =>
    apiFetch<PipelineStatus>("/admin/run-all", { method: "POST" }),
  triggerFullPipelineSync: () =>
    apiFetch<Record<string, unknown>>("/admin/run-all-sync", { method: "POST" }),
  getPipelineStatus: () => apiFetch<Record<string, unknown>>("/admin/status"),

  // Alerts
  getAlerts: (unreadOnly = false, limit = 20) =>
    apiFetch<AlertResponse[]>(`/dashboard/alerts?unread_only=${unreadOnly}&limit=${limit}`),
  markAlertRead: (alertId: string) =>
    apiFetch<AlertResponse>(`/dashboard/alerts/${alertId}/read`, { method: "PATCH" }),
  markAllAlertsRead: () =>
    apiFetch<{ dismissed: boolean }>(`/dashboard/alerts/read-all`, { method: "PATCH" }),

  // Early Radar
  getEarlyRadar: (params?: { max_age_days?: number; max_stars?: number; min_acceleration?: number; category?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.max_age_days !== undefined) qs.set("max_age_days", String(params.max_age_days));
    if (params?.max_stars !== undefined) qs.set("max_stars", String(params.max_stars));
    if (params?.min_acceleration !== undefined) qs.set("min_acceleration", String(params.min_acceleration));
    if (params?.category) qs.set("category", params.category);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    return apiFetch<EarlyRadarRepo[]>(`/dashboard/early-radar?${qs}`);
  },

  // Watchlist
  getWatchlist: (userId: string) =>
    apiFetch<WatchlistItemOut[]>("/watchlist", { headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  addToWatchlist: (userId: string, body: WatchlistAddBody) =>
    apiFetch<WatchlistItemOut>("/watchlist", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  updateWatchlistItem: (userId: string, id: string, body: WatchlistPatchBody) =>
    apiFetch<WatchlistItemOut>(`/watchlist/${id}`, { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  removeFromWatchlist: (userId: string, id: string) =>
    apiFetch<{ ok: boolean }>(`/watchlist/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  checkWatchlist: (userId: string, repoId: string) =>
    apiFetch<{ watching: boolean; item: WatchlistItemOut | null }>(`/watchlist/check/${repoId}`, { headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),

  // Profile
  getProfilePreferences: (userId: string) =>
    apiFetch<ProfilePreferences>("/profile/preferences", { headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  updateProfilePreferences: (userId: string, body: ProfilePreferencesPatchBody) =>
    apiFetch<ProfilePreferences>("/profile/preferences", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId },
    }),

  // Topic Intelligence
  getTopicMomentum: (params?: { min_repos?: number; limit?: number; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.min_repos !== undefined) qs.set("min_repos", String(params.min_repos));
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    if (params?.category) qs.set("category", params.category);
    return apiFetch<TopicMomentum[]>(`/topics/momentum?${qs}`);
  },
  getReposByTopic: (topic: string, limit = 20) =>
    apiFetch<TopicRepo[]>(`/topics/${encodeURIComponent(topic)}/repos?limit=${limit}`),

  // Contributor Network
  getContributorNetwork: (minRepos = 2) =>
    apiFetch<CrossRepoContributor[]>(`/contributors/network?min_repos=${minRepos}`),
  getContributorRepos: (login: string) =>
    apiFetch<ContributorRepoEntry[]>(`/contributors/repos-by-contributor/${encodeURIComponent(login)}`),

  // Fork Intelligence
  getNotableForks: (owner: string, name: string, minStars = 20) =>
    apiFetch<NotableFork[]>(`/forks/repo/${owner}/${name}?min_stars=${minStars}`),
  getForkLeaderboard: (minStars = 50, limit = 30) =>
    apiFetch<NotableFork[]>(`/forks/leaderboard?min_stars=${minStars}&limit=${limit}`),

  // API Keys
  createApiKey: (userId: string, body: CreateApiKeyBody) =>
    apiFetch<ApiKeyOut>("/dev/keys", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  ensureApiKey: (userId: string) =>
    apiFetch<ApiKeyOut>("/dev/keys/ensure", { method: "POST", headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  listApiKeys: (userId: string) =>
    apiFetch<ApiKeyOut[]>("/dev/keys", { headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  revokeApiKey: (userId: string, keyId: string) =>
    apiFetch<{ ok: boolean }>(`/dev/keys/${keyId}`, { method: "DELETE", headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  getApiKeyStatus: (userId: string, keyId: string) =>
    apiFetch<ApiKeyOut>(`/dev/keys/${keyId}/status`, { headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),

  // Onboarding
  getOnboardingStatus: (userId: string) =>
    apiFetch<OnboardingStatus>("/onboarding/status", { headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId } }),
  saveOnboardingInterests: (userId: string, verticals: string[]) =>
    apiFetch<OnboardingStatus>("/onboarding/interests", {
      method: "POST",
      body: JSON.stringify({ verticals }),
      headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId },
    }),
  saveOnboardingWatchlist: (userId: string, repos: string[]) =>
    apiFetch<{ created: number; current_step: string }>("/onboarding/watchlist", {
      method: "POST",
      body: JSON.stringify({ repos }),
      headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId },
    }),
  saveOnboardingAlerts: (userId: string, body: { email: string; frequency: DigestFrequency }) =>
    apiFetch<{ saved: boolean; current_step: string }>("/onboarding/alerts", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId },
    }),
  completeOnboarding: (userId: string) =>
    apiFetch<OnboardingStatus>("/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId },
    }),
  skipOnboarding: (userId: string) =>
    apiFetch<OnboardingStatus>("/onboarding/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Clerk-User-Id": userId },
    }),

  // Report History
  getReportHistory: (periodType?: string) => {
    const qs = periodType ? `?period_type=${periodType}` : "";
    return apiFetch<ReportSummary[]>(`/reports/history${qs}`);
  },
  getReportById: (id: number) =>
    apiFetch<Record<string, unknown>>(`/reports/history/${id}`),

  // A2A Services
  getServices: (params?: { category?: string; provider?: string; status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    return apiFetch<A2AService[]>(`/services?${qs}`);
  },
  getService: (id: string) => apiFetch<A2AService>(`/services/${id}`),
  registerService: (url: string) =>
    apiFetch<RegisterServiceResponse>("/services/register", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  searchServices: (capability: string, limit = 20) =>
    apiFetch<A2AService[]>(`/services/search?capability=${encodeURIComponent(capability)}&limit=${limit}`),

  // Releases (Feature 7)
  getReleases: (repoId: string, limit = 10) =>
    apiFetch<ReleaseItem[]>(`/repos/${repoId}/releases?limit=${limit}`),

  // Social Mentions (Feature 6)
  getSocialMentions: (repoId: string, limit = 20) =>
    apiFetch<SocialMentionItem[]>(`/repos/${repoId}/mentions?limit=${limit}`),

  // Commit Activity / Heatmap (Feature 8)
  getCommitActivity: (repoId: string) =>
    apiFetch<CommitActivityPoint[]>(`/repos/${repoId}/commit-activity`),

  // Natural Language Search (Feature 5)
  nlSearch: (query: string, limit = 30) =>
    apiFetch<NLSearchResult>(`/search?query=${encodeURIComponent(query)}&limit=${limit}`),
  parseSearchQuery: (query: string) =>
    apiFetch<ParsedFilters>(`/search/parse?query=${encodeURIComponent(query)}`),

  // Weekly Snapshots (Feature 12)
  listSnapshots: () => apiFetch<SnapshotSummary[]>("/snapshots"),
  getSnapshot: (weekId: string) => apiFetch<SnapshotDetail>(`/snapshots/${weekId}`),

  // Email Subscribe (Feature 4)
  subscribe: (email: string, verticals?: string[]) =>
    apiFetch<{ message: string; confirmed: boolean }>("/subscribe", {
      method: "POST",
      body: JSON.stringify({ email, verticals }),
    }),
};
