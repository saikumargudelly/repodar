import { SnapshotDetail } from "@/lib/api";

export interface NormalizedRepository {
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
}

export interface NormalizedWeeklyReport {
  weekId: string;
  publishedAt: string;
  allRepositories: NormalizedRepository[];
  featuredRepositories: NormalizedRepository[];
  trendingRepositories: NormalizedRepository[];
  watchList: NormalizedRepository[];
  accelerationRankings: NormalizedRepository[];
  summaryMetrics: {
    totalReposScanned: number;
    maxVelocity: number;
    avgAcceleration: number;
    healthyCount: number;
    yellowCount: number;
    redCount: number;
    productionSafePct: number;
  };
  languageDistribution: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
  }>;
  ecosystemHealth: {
    healthy: number;
    yellow: number;
    red: number;
  };
  editorialNotes: string;
}

export function normalizeWeeklyReport(snapshot: SnapshotDetail): NormalizedWeeklyReport {
  const allRepos = (snapshot.repos ?? []).map(r => ({
    rank: r.rank,
    repo_id: r.repo_id,
    owner: r.owner,
    name: r.name,
    category: r.category,
    github_url: r.github_url,
    primary_language: r.primary_language,
    description: r.description,
    trend_score: r.trend_score,
    sustainability_score: r.sustainability_score,
    sustainability_label: r.sustainability_label,
    star_velocity_7d: r.star_velocity_7d,
    acceleration: r.acceleration,
    stars: r.stars,
    age_days: r.age_days
  }));
  
  const featuredRepositories = allRepos.slice(0, 10);
  const trendingRepositories = allRepos.slice(10, 25);
  
  const watchList = allRepos.filter(r => 
    r.sustainability_label === "RED" || 
    (!r.sustainability_label || (r.sustainability_label !== "GREEN" && r.sustainability_label !== "YELLOW" && r.sustainability_label !== "HEALTHY"))
  );
  
  const accelerationRankings = [...allRepos]
    .sort((a, b) => (b.acceleration || 0) - (a.acceleration || 0));

  const maxVelocity = allRepos.length ? Math.max(...allRepos.map(r => r.star_velocity_7d || 0)) : 0;
  const avgAcceleration = allRepos.length ? allRepos.reduce((a, r) => a + (r.acceleration || 0), 0) / allRepos.length : 0;
  const healthyCount = allRepos.filter(r => r.sustainability_label === "GREEN" || r.sustainability_label === "HEALTHY").length;
  const yellowCount = allRepos.filter(r => r.sustainability_label === "YELLOW").length;
  const redCount = allRepos.filter(r => 
    r.sustainability_label === "RED" || 
    (!r.sustainability_label || (r.sustainability_label !== "GREEN" && r.sustainability_label !== "YELLOW" && r.sustainability_label !== "HEALTHY"))
  ).length;
  const productionSafePct = allRepos.length ? Math.round((healthyCount / allRepos.length) * 100) : 0;

  const langMap: Record<string, number> = {};
  allRepos.forEach(r => {
    if (r.primary_language) {
      langMap[r.primary_language] = (langMap[r.primary_language] || 0) + 1;
    }
  });
  const languageDistribution = Object.entries(langMap)
    .map(([language, count]) => ({
      language,
      count,
      percentage: allRepos.length ? (count / allRepos.length) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);

  const catMap: Record<string, number> = {};
  allRepos.forEach(r => {
    if (r.category) {
      catMap[r.category] = (catMap[r.category] || 0) + 1;
    }
  });
  const categoryDistribution = Object.entries(catMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const editorialNotes = `Our telemetry engine scanned ${allRepos.length} repositories across the AI and Machine Learning ecosystem this week, ranking each project by star velocity, growth acceleration, and community health.`;

  return {
    weekId: snapshot.week_id,
    publishedAt: snapshot.published_at,
    allRepositories: allRepos,
    featuredRepositories,
    trendingRepositories,
    watchList,
    accelerationRankings,
    summaryMetrics: {
      totalReposScanned: allRepos.length,
      maxVelocity,
      avgAcceleration,
      healthyCount,
      yellowCount,
      redCount,
      productionSafePct
    },
    languageDistribution,
    categoryDistribution,
    ecosystemHealth: {
      healthy: healthyCount,
      yellow: yellowCount,
      red: redCount
    },
    editorialNotes
  };
}
