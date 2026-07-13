import { NormalizedWeeklyReport } from "../models/reportModel";
import { PresentationModel, PresentationRepositoryCard } from "./presentationModel";

function getHealthLabel(label: string): string {
  if (label === "GREEN") return "Jonin";
  if (label === "YELLOW") return "Chunin";
  return "Genin";
}

function getHealthColor(label: string): string {
  if (label === "GREEN") return "#3fb950";
  if (label === "YELLOW") return "#d29922";
  return "#f85149";
}

function generateInsightCommentary(repo: any) {
  const velocity = repo.star_velocity_7d ?? 0;
  const accel = repo.acceleration ?? 0;
  const label = repo.sustainability_label || "GREEN";
  const name = `${repo.owner}/${repo.name}`;

  const velocityText =
    velocity > 250
      ? `surging at +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day, signaling a viral breakout moment`
      : velocity > 80
      ? `growing steadily at +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day via consistent organic traction`
      : `attracting +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day of baseline interest`;

  const accelText =
    accel > 2.0
      ? ` The ${accel.toFixed(1)}x acceleration indicates a major inflection — a new release, viral thread, or conference buzz.`
      : accel > 1.2
      ? ` Its ${accel.toFixed(1)}x acceleration suggests genuine positive momentum above historical norms.`
      : ` Growth remains in steady-state with no unusual acceleration signals.`;

  const healthText =
    label === "GREEN"
      ? ` Jonin-tier health reflects robust maintenance, active issue resolution, and production-safe integration.`
      : label === "YELLOW"
      ? ` Chunin-tier health warrants monitoring — PR delays or contributor flux have been detected.`
      : ` Genin-tier health flags maintenance risk; high issue-to-close ratios despite trending velocity.`;

  return `${name} is ${velocityText}.${accelText}${healthText}`;
}

export function composePresentationModel(report: NormalizedWeeklyReport): PresentationModel {
  const allCards: PresentationRepositoryCard[] = report.allRepositories.map(repo => ({
    repo,
    rank: repo.rank,
    healthLabel: getHealthLabel(repo.sustainability_label),
    healthColor: getHealthColor(repo.sustainability_label),
    analystComment: generateInsightCommentary(repo)
  }));

  const featuredHighlights = allCards.slice(0, 5);
  const compactHighlights = allCards.slice(5, 10);

  const publishedDateText = report.publishedAt
    ? new Date(report.publishedAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      })
    : "—";

  const top3 = report.featuredRepositories.slice(0, 3).map(r => `${r.owner}/${r.name}`);

  const cover = {
    title: "Weekly AI/ML Ecosystem Breakthroughs",
    subtitle: "Automated intelligence telemetry capturing the highest velocity open-source projects, community health metrics, and growth acceleration.",
    heroMetrics: [
      { label: "Repos Tracked", value: String(report.summaryMetrics.totalReposScanned) },
      { label: "Peak Stars/Day", value: `+${report.summaryMetrics.maxVelocity.toFixed(0)}`, color: "#d29922" },
      { label: "Avg Acceleration", value: `${report.summaryMetrics.avgAcceleration.toFixed(1)}x` },
      { label: "Jonin Health", value: String(report.summaryMetrics.healthyCount), color: "#3fb950" }
    ],
    topHighlightsText: top3
  };

  const topLangs = report.languageDistribution.slice(0, 6).map(ld => ({
    name: ld.language,
    value: ld.count,
    percentage: ld.percentage
  }));

  const categories = report.categoryDistribution.slice(0, 5).map(cd => ({
    name: cd.category,
    value: cd.count
  }));

  const topAccel = report.accelerationRankings.slice(0, 5);
  const maxAccel = topAccel[0]?.acceleration || 1;
  const acceleratorLeaders = topAccel.map(r => ({
    name: `${r.owner}/${r.name}`,
    value: r.acceleration,
    normalizedPercent: Math.min(100, (r.acceleration / maxAccel) * 100)
  }));

  const trendingList = report.trendingRepositories.map(r => ({
    rank: r.rank,
    name: `${r.owner}/${r.name}`,
    velocity: r.star_velocity_7d
  }));

  const watchList = report.watchList.map(r => ({
    rank: r.rank,
    name: `${r.owner}/${r.name}`,
    health: getHealthLabel(r.sustainability_label)
  }));

  const editorialInsights = {
    leadTitle: `AI & ML Open-Source Momentum Report — Week ${report.weekId}`,
    leadBody: report.editorialNotes,
    bylineText: `Repodar Editorial Engine  |  ${publishedDateText}  |  5 min read  |  ${report.allRepositories.length} repositories tracked`
  };

  const about = {
    methodology: "Repodar scores ecosystem sustainability using issue resolution speed, release frequency, license types, and commit volume.",
    slogan: "Automated analysis, not human editorial.",
    links: {
      website: "repodar.io",
      github: "github.com/saikumargudelly/repodar"
    }
  };

  return {
    weekId: report.weekId,
    publishedDateText,
    cover,
    featuredHighlights,
    compactHighlights,
    charts: {
      languages: topLangs,
      categories,
      acceleratorLeaders
    },
    trendingList,
    watchList,
    editorialInsights,
    about
  };
}
