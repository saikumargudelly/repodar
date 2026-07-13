export const charts = {
  gridColor: "rgba(255, 255, 255, 0.05)",
  tooltipBackground: "#171d2b",
  tooltipBorder: "#30363d",
  colors: [
    "#00f0ff", // Cyan
    "#0072ff", // Blue
    "#d29922", // Gold
    "#3fb950", // Green
    "#f85149", // Red
    "#8a63d2"  // Purple
  ]
} as const;

export type Charts = typeof charts;
