/**
 * chartColors.ts — single source of truth for all chart colors in Repodar.
 *
 * Rules:
 * - CATEGORY_PALETTE: each vertical/category always maps to the same color.
 *   "AI/ML is always blue" — users build mental models.
 * - SEQUENTIAL_PALETTE: for multi-series charts (compare, multi-line) up to 5 series.
 * - Do not define inline COLORS or CATEGORY_COLORS anywhere else in the codebase.
 */

/** Maps each vertical/category slug to a fixed hex color. */
export const CATEGORY_PALETTE: Record<string, string> = {
  ai_ml:        "#58a6ff", // blue       — matches accent-blue
  devtools:     "#3fb950", // green      — matches accent-green
  web_mobile:   "#d29922", // amber      — matches accent-yellow
  data_infra:   "#a371f7", // purple
  security:     "#f0883e", // orange
  blockchain:   "#39d353", // bright green
  oss_tools:    "#8b949e", // neutral gray
  science:      "#22d3ee", // cyan
  creative:     "#e85a9d", // pink

  // Friendly label aliases (spaces → underscore normalization)
  "ai/ml":        "#58a6ff",
  "web & mobile": "#d29922",
  "data & infra": "#a371f7",
  "oss tools":    "#8b949e",
};

/**
 * Sequential palette for multi-series charts where categories are not known
 * in advance (e.g. compare page with up to 5 user-selected repos).
 * Index-stable — series 0 is always blue, series 1 always green, etc.
 */
export const SEQUENTIAL_PALETTE: readonly string[] = [
  "#58a6ff", // 0 blue
  "#3fb950", // 1 green
  "#d29922", // 2 amber
  "#a371f7", // 3 purple
  "#f0883e", // 4 orange
];

/**
 * Resolve a category string to its palette color.
 * Falls back to the sequential palette by index if the category is unknown.
 */
export function categoryColor(category: string, fallbackIndex = 0): string {
  const key = category.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  return CATEGORY_PALETTE[key] ?? CATEGORY_PALETTE[category.toLowerCase()] ?? SEQUENTIAL_PALETTE[fallbackIndex % SEQUENTIAL_PALETTE.length];
}

/**
 * Get a sequential color by index (for compare/multi-line charts).
 */
export function sequentialColor(index: number): string {
  return SEQUENTIAL_PALETTE[index % SEQUENTIAL_PALETTE.length];
}
