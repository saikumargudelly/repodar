import { normalizeWeeklyReport } from "../models/reportModel";
import { composePresentationModel } from "../presentation/presentationComposer";
import { generatePages } from "../layout/layoutEngine";
import { SnapshotDetail } from "@/lib/api";

const mockSnapshot: SnapshotDetail = {
  week_id: "2026-W28",
  published_at: "2026-07-13T12:00:00Z",
  repos: [
    {
      rank: 1,
      repo_id: "id-1",
      owner: "owner1",
      name: "repo1",
      category: "Framework",
      github_url: "https://github.com/owner1/repo1",
      primary_language: "TypeScript",
      description: "Description 1",
      trend_score: 99,
      sustainability_score: 95,
      sustainability_label: "GREEN",
      star_velocity_7d: 150,
      acceleration: 2.5,
      stars: 12000,
      age_days: 350
    },
    {
      rank: 2,
      repo_id: "id-2",
      owner: "owner2",
      name: "repo2",
      category: "Library",
      github_url: "https://github.com/owner2/repo2",
      primary_language: "Python",
      description: "Description 2",
      trend_score: 80,
      sustainability_score: 75,
      sustainability_label: "YELLOW",
      star_velocity_7d: 80,
      acceleration: 1.8,
      stars: 8000,
      age_days: 120
    },
    {
      rank: 3,
      repo_id: "id-3",
      owner: "owner3",
      name: "repo3",
      category: "Tool",
      github_url: "https://github.com/owner3/repo3",
      primary_language: "Rust",
      description: "Description 3",
      trend_score: 50,
      sustainability_score: 40,
      sustainability_label: "RED",
      star_velocity_7d: 30,
      acceleration: 1.1,
      stars: 3000,
      age_days: 80
    }
  ]
};

function runTests() {
  console.log("=== RUNNING MODULAR PUBLISHING ENGINE TEST SUITE ===");

  try {
    // Test 1: normalizeWeeklyReport
    console.log("\nTesting normalizeWeeklyReport()...");
    const report = normalizeWeeklyReport(mockSnapshot);
    if (report.weekId !== "2026-W28") throw new Error("Incorrect weekId mapping");
    if (report.allRepositories.length !== 3) throw new Error("Incorrect repo count");
    if (report.summaryMetrics.maxVelocity !== 150) throw new Error("Incorrect maxVelocity calculation");
    if (report.summaryMetrics.healthyCount !== 1) throw new Error("Incorrect healthyCount");
    if (report.watchList.length !== 1 || report.watchList[0].name !== "repo3") throw new Error("Incorrect WatchList mapping");
    console.log("✓ normalizeWeeklyReport() tests passed successfully.");

    // Test 2: composePresentationModel
    console.log("\nTesting composePresentationModel()...");
    const presentation = composePresentationModel(report);
    if (presentation.cover.title !== "Weekly AI/ML Ecosystem Breakthroughs") throw new Error("Incorrect cover title");
    if (presentation.cover.heroMetrics.length !== 4) throw new Error("Incorrect heroMetrics count");
    if (presentation.featuredHighlights.length !== 3) throw new Error("Incorrect featuredHighlights count");
    if (presentation.charts.languages.length !== 3) throw new Error("Incorrect language distribution length");
    console.log("✓ composePresentationModel() tests passed successfully.");

    // Test 3: generatePages (LayoutEngine)
    console.log("\nTesting LayoutEngine generatePages()...");
    const pages = generatePages(presentation);
    
    // Check if Cover, Featured #1, Medium Featured, Charts, Trending/Watchlist, and About pages are mapped
    if (pages.length === 0) throw new Error("No pages generated");
    
    const coverPage = pages.find(p => p.type === "cover");
    if (!coverPage || coverPage.metadata.index !== 1) throw new Error("Incorrect Cover page mapping");

    const largeFeaturedPage = pages.find(p => p.type === "featured-repo-large");
    if (!largeFeaturedPage || largeFeaturedPage.metadata.index !== 2) throw new Error("Incorrect Large Featured page mapping");

    const mediumFeaturedPage = pages.find(p => p.type === "featured-repos-medium");
    if (!mediumFeaturedPage || mediumFeaturedPage.metadata.index !== 3) throw new Error("Incorrect Medium Featured page mapping");

    const chartsPage = pages.find(p => p.type === "charts");
    if (!chartsPage) throw new Error("Charts page missing");

    const trendingPage = pages.find(p => p.type === "trending-watchlist");
    if (!trendingPage) throw new Error("Trending watchlist page missing");

    const aboutPage = pages.find(p => p.type === "about");
    if (!aboutPage) throw new Error("About page missing");

    // Verify dynamic page indices are sequential
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].metadata.index !== i + 1) {
        throw new Error(`Non-sequential page index found at page type ${pages[i].type}`);
      }
      if (pages[i].metadata.totalPageCount !== pages.length) {
        throw new Error("totalPageCount metadata mismatch");
      }
    }

    console.log(`✓ LayoutEngine tests passed successfully (${pages.length} pages generated).`);

    console.log("\n================ ALL TESTS PASSED ================");
  } catch (err: any) {
    console.error("\n❌ TEST FAILURE:", err.message || err);
    process.exit(1);
  }
}

runTests();
