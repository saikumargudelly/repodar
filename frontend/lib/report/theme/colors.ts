export const colors = {
  bgPrimary: "#0a0d14",
  bgSurface: "rgba(255,255,255,0.02)",
  bgSurfaceHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.05)",
  borderActive: "rgba(0, 240, 255, 0.3)",
  textPrimary: "#ffffff",
  textSecondary: "#8b949e",
  textMuted: "#586069",
  accentCyan: "#00f0ff",
  accentBlue: "#0072ff",
  accentGold: "#d29922",
  healthGreen: "#3fb950",
  healthYellow: "#d29922",
  healthRed: "#f85149",
  gradientBackground: "radial-gradient(circle at 50% 50%, #171d2b 0%, #0a0d14 100%)",
  gradientAccent: "linear-gradient(135deg, #00f0ff 0%, #0072ff 100%)",
  gradientBlue: "linear-gradient(to right, #58a6ff, #1f6feb)"
} as const;

export type Colors = typeof colors;
