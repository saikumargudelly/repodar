import { Page, PageMetadata } from "../types";
import { PresentationModel } from "../presentation/presentationModel";

export function generatePages(
  presentation: PresentationModel,
  dimensions = { width: 1080, height: 1350 }
): Page[] {
  const pages: Page[] = [];
  const weekId = presentation.weekId;

  // 1. Page 1: Cover
  pages.push({
    id: "page-cover",
    type: "cover",
    title: "Cover Page",
    dimensions,
    metadata: { weekId, index: 1 },
    components: [
      {
        type: "CoverPage",
        props: {
          title: presentation.cover.title,
          subtitle: presentation.cover.subtitle,
          heroMetrics: presentation.cover.heroMetrics,
          topHighlights: presentation.cover.topHighlightsText,
          publishedDateText: presentation.publishedDateText,
          weekId
        }
      }
    ]
  });

  // 2. Page 2: Featured Repo Large (Rank 1)
  if (presentation.featuredHighlights.length > 0) {
    pages.push({
      id: "page-featured-1",
      type: "featured-repo-large",
      title: "Featured Highlight #1",
      dimensions,
      metadata: { weekId, index: pages.length + 1 },
      components: [
        {
          type: "LargeFeaturedCard",
          props: { card: presentation.featuredHighlights[0] }
        }
      ]
    });
  }

  // 3. Medium Featured Pages (Ranks 2-3, 4-5, etc., grouped 2 per page)
  const remainingFeatured = presentation.featuredHighlights.slice(1);
  for (let i = 0; i < remainingFeatured.length; i += 2) {
    const chunk = remainingFeatured.slice(i, i + 2);
    const startRank = chunk[0].rank;
    const endRank = chunk[chunk.length - 1].rank;
    pages.push({
      id: `page-featured-${startRank}-${endRank}`,
      type: "featured-repos-medium",
      title: `Featured Ranks #${startRank} - #${endRank}`,
      dimensions,
      metadata: { weekId, index: pages.length + 1 },
      components: [
        {
          type: "MediumFeaturedList",
          props: { cards: chunk }
        }
      ]
    });
  }

  // 4. Compact Featured Pages (Ranks 6-10, grouped 5 per page)
  const compactCards = presentation.compactHighlights;
  for (let i = 0; i < compactCards.length; i += 5) {
    const chunk = compactCards.slice(i, i + 5);
    const startRank = chunk[0].rank;
    const endRank = chunk[chunk.length - 1].rank;
    pages.push({
      id: `page-compact-${startRank}-${endRank}`,
      type: "featured-repos-compact",
      title: `Ranks #${startRank} - #${endRank}`,
      dimensions,
      metadata: { weekId, index: pages.length + 1 },
      components: [
        {
          type: "CompactFeaturedList",
          props: { cards: chunk }
        }
      ]
    });
  }

  // 5. Page 6: Charts
  pages.push({
    id: "page-charts",
    type: "charts",
    title: "Ecosystem Analytics",
    dimensions,
    metadata: { weekId, index: pages.length + 1 },
    components: [
      {
        type: "ChartsBlock",
        props: { charts: presentation.charts }
      }
    ]
  });

  // 6. Page 7: Trending, Watch List, Editorial Insights
  pages.push({
    id: "page-trending-watchlist",
    type: "trending-watchlist",
    title: "Ecosystem Momentum & Alerts",
    dimensions,
    metadata: { weekId, index: pages.length + 1 },
    components: [
      {
        type: "TrendingWatchListBlock",
        props: {
          trendingList: presentation.trendingList,
          watchList: presentation.watchList,
          editorial: presentation.editorialInsights
        }
      }
    ]
  });

  // 7. Page 8: About/Methodology
  pages.push({
    id: "page-about",
    type: "about",
    title: "About & Methodology",
    dimensions,
    metadata: { weekId, index: pages.length + 1 },
    components: [
      {
        type: "AboutBlock",
        props: {
          about: presentation.about,
          weekId
        }
      }
    ]
  });

  // Set totalPageCount in metadata for all pages
  const totalPageCount = pages.length;
  pages.forEach(p => {
    p.metadata.totalPageCount = totalPageCount;
  });

  return pages;
}
