import { NormalizedRepository } from "../models/reportModel";

export interface PresentationRepositoryCard {
  repo: NormalizedRepository;
  rank: number;
  healthLabel: string;
  healthColor: string;
  analystComment: string;
}

export interface PresentationChartData {
  languages: Array<{ name: string; value: number; percentage: number }>;
  categories: Array<{ name: string; value: number }>;
  acceleratorLeaders: Array<{ name: string; value: number; normalizedPercent: number }>;
}

export interface PresentationModel {
  weekId: string;
  publishedDateText: string;
  cover: {
    title: string;
    subtitle: string;
    heroMetrics: Array<{ label: string; value: string; color?: string }>;
    topHighlightsText: string[];
  };
  featuredHighlights: PresentationRepositoryCard[];
  compactHighlights: PresentationRepositoryCard[];
  charts: PresentationChartData;
  trendingList: Array<{ rank: number; name: string; velocity: number }>;
  watchList: Array<{ rank: number; name: string; health: string }>;
  editorialInsights: {
    leadTitle: string;
    leadBody: string;
    bylineText: string;
  };
  about: {
    methodology: string;
    slogan: string;
    links: { website: string; github: string };
  };
}
