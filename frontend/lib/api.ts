/**
 * Typed API client for all Repodar backend endpoints.
 * Uses NEXT_PUBLIC_API_URL from .env.local.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit, retries = 3): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  
  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
      });
      
      if (!res.ok) {
        // Retry on 5XX errors if we haven't maxed out attempts
        if (res.status >= 500 && attempt < retries - 1) {
          attempt++;
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }

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
      return await res.json() as T;
    } catch (error) {
      if (attempt < retries - 1 && !(error instanceof Error && error.message.startsWith("API "))) {
        attempt++;
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
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
  stars: number;
  forks: number;
  pushed_at: string | null;
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
  | "web_mobile"
  | "data_infra"
  | "security"
  | "blockchain"
  | "oss_tools"
  | "science"
  | "creative";

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

  // Enhanced Early Radar fields (optional for backward compatibility)
  star_velocity_30d?: number;
  contributor_growth_rate?: number;
  sustainability_score?: number;
  breakout_score?: number;
  novelty_score?: number;
  velocity_ratio?: number;
  fork_proxy_score?: number;
  estimated_viral_eta_days?: number | null;
  momentum_stage?: "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout";
  active_signals?: string[];
  category_velocity_avg?: number;
  outpaces_category?: boolean;
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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ── Platform Features (Phase 1 & 2) ──────────────────────────────────────────

export interface RepoFilterDTO {
  languages?: string[];
  categories?: string[];
  min_stars?: number;
  max_stars?: number;
  min_age_days?: number;
  max_age_days?: number;
  min_trend_score?: number;
  sustainability_label?: string;
}

export interface SavedFilterPreset {
  id: string;
  name: string;
  description?: string;
  filter_config: RepoFilterDTO;
  is_public: boolean;
  created_by: string;
}

export interface ForecastResult {
  repo_id: string;
  current_stars: number;
  forecast_30d: number;
  forecast_90d: number;
  breakout_probability: number;
  growth_label: string;
}

export interface RecommendedRepo {
  repo_id: string;
  similarity_score: number;
  reasons: string[];
  repo?: RepoDetail;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  frequency: string;
  webhook_url: string | null;
  channels: string[];
  is_active: boolean;
}

export interface Collection {
  id: string;
  title: string;
  description: string | null;
  repo_count: number;
  votes: number;
  is_public: boolean;
  created_by: string;
}

// ────────────────────────────────────────────────────────────────────────────

export const api = {
  // Repos
  listRepos: (params?: { category?: string; sort_by?: string; page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.sort_by) qs.set("sort_by", params.sort_by);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    return apiFetch<PaginatedResponse<RepoSummary>>(`/repos?${qs}`);
  },
  getRepo: (id: string) => apiFetch<RepoDetail>(`/repos/${id}`),
  deltaRun: (owner: string, name: string) =>
    apiFetch<RepoDetail>(`/repos/${owner}/${name}/delta-run`, { method: "POST" }),
  getDeepSummary: (owner: string, name: string) =>
    apiFetch<DeepSummary>(`/repos/${owner}/${name}/deep-summary`),

  // ── Platform Phase 1 & 2 ───────────────────────────────────────────────────

  // Filtering
  filterRepos: (filter: RepoFilterDTO, page = 1, perPage = 20) =>
    apiFetch<PaginatedResponse<RepoSummary>>(`/filters/repos?page=${page}&per_page=${perPage}`, {
      method: "POST",
      body: JSON.stringify(filter),
    }),
  getSavedFilters: () =>
    apiFetch<SavedFilterPreset[]>("/filters/presets"),
  createSavedFilter: (preset: Omit<SavedFilterPreset, "id" | "created_by">) =>
    apiFetch<SavedFilterPreset>("/filters/presets", { method: "POST", body: JSON.stringify(preset) }),
  deleteSavedFilter: (id: string) =>
    apiFetch<void>(`/filters/presets/${id}`, { method: "DELETE" }),

  // Forecasting — GET /forecast/{owner}/{name}
  getForecast: (owner: string, name: string, days = 90) =>
    apiFetch<ForecastResult>(`/forecast/${owner}/${name}?days=${days}`),
  getBulkForecasts: (repoIds: string[]) =>
    apiFetch<ForecastResult[]>(`/forecast/bulk/batch?ids=${encodeURIComponent(repoIds.join(','))}`),

  // Export
  exportReposCsv: (filter?: RepoFilterDTO) =>
    apiFetch<Blob>("/export/repos/csv", { method: "POST", body: JSON.stringify(filter || {}) }),
  exportReposJson: (filter?: RepoFilterDTO) =>
    apiFetch<RepoSummary[]>("/export/repos/json", { method: "POST", body: JSON.stringify(filter || {}) }),

  // Recommendations — GET /recommendations?user_id=xxx and GET /recommendations/similar/{owner}/{name}
  getRecommendations: (userId: string, limit = 10) =>
    apiFetch<RecommendedRepo[]>(`/recommendations?user_id=${encodeURIComponent(userId)}&limit=${limit}`),
  getSimilarRepos: (owner: string, name: string, limit = 5) =>
    apiFetch<RecommendedRepo[]>(`/recommendations/similar/${owner}/${name}?limit=${limit}`),

  // Alert Rules — /alerts/rules with X-User-Id header
  getAlertRules: (userId: string) =>
    apiFetch<AlertRule[]>("/alerts/rules", { headers: { "Content-Type": "application/json", "X-User-Id": userId } }),
  createAlertRule: (userId: string, rule: Omit<AlertRule, "id" | "is_active">) =>
    apiFetch<AlertRule>("/alerts/rules", { method: "POST", body: JSON.stringify(rule), headers: { "Content-Type": "application/json", "X-User-Id": userId } }),
  deleteAlertRule: (userId: string, id: string) =>
    apiFetch<void>(`/alerts/rules/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json", "X-User-Id": userId } }),

  // Collections — /collections with X-User-Id header
  getTrendingCollections: () =>
    apiFetch<Collection[]>("/collections/trending"),
  createCollection: (userId: string, collection: { title: string; description?: string; repo_ids: string[]; is_public: boolean }) =>
    apiFetch<Collection>("/collections", { method: "POST", body: JSON.stringify(collection), headers: { "Content-Type": "application/json", "X-User-Id": userId } }),
  voteCollection: (userId: string, id: string, direction: 1 | -1) =>
    apiFetch<{ votes: number }>(`/collections/${id}/vote`, { method: "POST", body: JSON.stringify({ direction }), headers: { "Content-Type": "application/json", "X-User-Id": userId } }),

  // ───────────────────────────────────────────────────────────────────────────

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
  getEarlyRadar: (params?: {
    max_age_days?: number;
    min_age_days?: number;
    max_stars?: number;
    min_stars?: number;
    min_acceleration?: number;
    min_star_velocity_7d?: number;
    min_velocity_ratio?: number;
    min_breakout_score?: number;
    min_sustainability_score?: number;
    require_contributor_growth?: boolean;
    require_fork_momentum?: boolean;
    require_sustained_velocity?: boolean;
    category?: string;
    language?: string;
    topics?: string;
    momentum_stage?: "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout";
    require_pre_viral?: boolean;
    sort_by?: "breakout_score" | "acceleration" | "star_velocity_7d" | "velocity_ratio" | "novelty_score" | "trend_score";
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.max_age_days !== undefined) qs.set("max_age_days", String(params.max_age_days));
    if (params?.min_age_days !== undefined) qs.set("min_age_days", String(params.min_age_days));
    if (params?.max_stars !== undefined) qs.set("max_stars", String(params.max_stars));
    if (params?.min_stars !== undefined) qs.set("min_stars", String(params.min_stars));
    if (params?.min_acceleration !== undefined) qs.set("min_acceleration", String(params.min_acceleration));
    if (params?.min_star_velocity_7d !== undefined) qs.set("min_star_velocity_7d", String(params.min_star_velocity_7d));
    if (params?.min_velocity_ratio !== undefined) qs.set("min_velocity_ratio", String(params.min_velocity_ratio));
    if (params?.min_breakout_score !== undefined) qs.set("min_breakout_score", String(params.min_breakout_score));
    if (params?.min_sustainability_score !== undefined) qs.set("min_sustainability_score", String(params.min_sustainability_score));
    if (params?.require_contributor_growth !== undefined) qs.set("require_contributor_growth", String(params.require_contributor_growth));
    if (params?.require_fork_momentum !== undefined) qs.set("require_fork_momentum", String(params.require_fork_momentum));
    if (params?.require_sustained_velocity !== undefined) qs.set("require_sustained_velocity", String(params.require_sustained_velocity));
    if (params?.category) qs.set("category", params.category);
    if (params?.language) qs.set("language", params.language);
    if (params?.topics) qs.set("topics", params.topics);
    if (params?.momentum_stage) qs.set("momentum_stage", params.momentum_stage);
    if (params?.require_pre_viral !== undefined) qs.set("require_pre_viral", String(params.require_pre_viral));
    if (params?.sort_by) qs.set("sort_by", params.sort_by);
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

  // ── Research Mode ────────────────────────────────────────────────────────
  research: {
    createSession: (userId: string, title?: string, description?: string, verticals?: string[]) =>
      apiFetch<ResearchSession>("/research/sessions", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, title: title ?? "Untitled Research", description, verticals: verticals ?? [] }),
      }),

    listSessions: (userId: string) =>
      apiFetch<ResearchSession[]>(`/research/sessions?user_id=${encodeURIComponent(userId)}`),

    getSession: (id: string, userId: string) =>
      apiFetch<ResearchSessionDetail>(`/research/sessions/${id}?user_id=${encodeURIComponent(userId)}`),

    updateSession: (id: string, userId: string, patch: { title?: string; description?: string; verticals?: string[] }) =>
      apiFetch<ResearchSession>(`/research/sessions/${id}?user_id=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),

    deleteSession: (id: string, userId: string) =>
      apiFetch<void>(`/research/sessions/${id}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),

    sendMessage: (sessionId: string, userId: string, content: string, tier?: string) =>
      apiFetch<ResearchAgentMessage>(`/research/sessions/${sessionId}/message`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, content, user_tier: tier ?? "free" }),
      }),

    /** Returns the SSE stream URL — use EventSource on this URL */
    streamUrl: (sessionId: string, userId: string, message: string, tier?: string) => {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      return (
        `${base}/research/sessions/${sessionId}/stream` +
        `?user_id=${encodeURIComponent(userId)}` +
        `&message=${encodeURIComponent(message)}` +
        `&user_tier=${tier ?? "free"}`
      );
    },
    transcribeSpeech: async (userId: string, audioBlob: Blob, filename = "speech.webm", model = "whisper-large-v3-turbo") => {
      const form = new FormData();
      form.append("user_id", userId);
      form.append("file", audioBlob, filename);
      form.append("model", model);

      const res = await fetch(`${BASE}/research/stt/transcribe`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        let detail = "Speech transcription failed.";
        try {
          const body = await res.json();
          if (typeof body?.detail === "string") {
            detail = body.detail;
          }
        } catch {
          // keep fallback detail
        }
        throw new Error(detail);
      }

      return await res.json() as ResearchSpeechToText;
    },

    pinRepo: (sessionId: string, userId: string, repoFullName: string, repoData: Record<string, unknown>, note?: string, stage?: string) =>
      apiFetch<ResearchPin>(`/research/sessions/${sessionId}/pins`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, repo_full_name: repoFullName, repo_data: repoData, note, stage: stage ?? "watch" }),
      }),

    unpinRepo: (sessionId: string, userId: string, pinId: string) =>
      apiFetch<void>(`/research/sessions/${sessionId}/pins/${pinId}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),

    updatePin: (sessionId: string, userId: string, pinId: string, patch: { note?: string; stage?: string }) =>
      apiFetch<ResearchPin>(`/research/sessions/${sessionId}/pins/${pinId}`, {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, ...patch }),
      }),

    generateReport: (sessionId: string, userId: string) =>
      apiFetch<{ content_md: string; repos_count: number; generated_at: string }>(`/research/sessions/${sessionId}/report`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      }),

    getReport: (sessionId: string, userId: string) =>
      apiFetch<{ content_md: string; repos_count: number; generated_at: string }>(`/research/sessions/${sessionId}/report?user_id=${encodeURIComponent(userId)}`),

    createShare: (sessionId: string, userId: string, ttlDays?: number) =>
      apiFetch<{ token: string; share_url: string; expires_at: string | null }>(`/research/sessions/${sessionId}/share`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, ttl_days: ttlDays ?? 7 }),
      }),

    getShared: (token: string) =>
      apiFetch<ResearchSharedView>(`/research/share/${token}`),

    generateBlog: (
      sessionId: string,
      userId: string,
      platform: "reddit" | "twitter" | "linkedin",
      repo: Record<string, unknown>,
      niche?: string,
    ) =>
      apiFetch<{ platform: string; content: string; repo_name: string }>(
        `/research/sessions/${sessionId}/blog`,
        {
          method: "POST",
          body: JSON.stringify({ user_id: userId, platform, repo, niche: niche ?? "" }),
        }
      ),
  },
};

// ── Research Mode Types ──────────────────────────────────────────────────────

export interface ResearchSession {
  id: string;
  title: string;
  description: string | null;
  verticals: string[];
  message_count: number;
  pin_count: number;
  has_report: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResearchMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  intent: string | null;
  github_query: string | null;
  query_explanation: string | null;
  repos: ResearchRepo[];
  confidence: number | null;
  created_at: string;
}

export interface ResearchAgentMessage extends ResearchMessage {
  suggested_follow_ups: string[];
}

export interface ResearchPin {
  id: string;
  repo_full_name: string;
  repo_data: ResearchRepo;
  note: string | null;
  stage: "watch" | "evaluate" | "track" | "dismiss";
  pinned_at: string;
}

export interface ResearchSessionDetail extends ResearchSession {
  messages: ResearchMessage[];
  pins: ResearchPin[];
  report: { content_md: string; generated_at: string; repos_count: number } | null;
}

export interface ResearchRepo {
  repo_id?: number;
  owner: string;
  name: string;
  full_name: string;
  description: string;
  github_url: string;
  primary_language: string;
  stars: number;
  forks: number;
  open_issues: number;
  watchers: number;
  topics: string[];
  license: string;
  is_fork: boolean;
  archived: boolean;
  age_days: number;
  pushed_at: string;
  created_at: string;
  velocity_proxy: number;
  momentum: number;
  trend_label: "HIGH" | "MID" | "LOW";
}

export interface ResearchSharedView {
  title: string;
  description: string | null;
  created_at: string;
  pins: ResearchPin[];
  report: { content_md: string; generated_at: string; repos_count: number } | null;
  message_count: number;
}

// SSE event types emitted by the stream endpoint
export type ResearchSSEEvent =
  | { type: "status"; text: string }
  | { type: "query_explanation"; text: string }
  | { type: "repos"; data: ResearchRepo[] }
  | { type: "token"; text: string }
  | { type: "done"; data: { follow_ups: string[]; intent: string; github_query: string; query_explanation: string; confidence: number } | string }
  | { type: "error"; text: string };

export interface ResearchSpeechToText {
  text: string;
  model: string;
  language: string | null;
  duration_seconds: number | null;
}
