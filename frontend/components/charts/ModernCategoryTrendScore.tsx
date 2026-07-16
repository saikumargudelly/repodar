"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CategoryMetrics, Period } from "@/lib/api";
import { categoryColor } from "@/lib/chartColors";
import Logo from "@/components/Logo";

const PERIODS: { key: Period; label: string }[] = [
  { key: "1d", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "1M" },
  { key: "90d", label: "3M" },
  { key: "365d", label: "1Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
];

function trendColor(score: number): string {
  if (score >= 0.65) return "#84cc16"; // HIGH - Green
  if (score >= 0.4) return "#f59e0b"; // MID - Orange/Amber
  return "#6e7681"; // LOW - Grey
}

function getTrendLabel(score: number): string {
  if (score >= 0.65) return "HIGH";
  if (score >= 0.4) return "MID";
  return "LOW";
}

function getChakraClass(category: string): string {
  const norm = (category || "").trim();
  if (norm === "Agent Frameworks") return "chakra-fire";
  if (norm === "AI / ML") return "chakra-lightning";
  if (norm === "LLM Models") return "chakra-wind";
  if (norm === "DevTools") return "chakra-earth";
  if (norm === "Data & Infra") return "chakra-water";
  return "chakra-void";
}

function SignalDot({ label }: { label: string }) {
  if (label === "HIGH") {
    return (
      <span className="signal-container" title="High Priority alert. Repodar Radar.">
        <span className="signal-high-glow"></span>
        <span style={{ position: "relative", zIndex: 1, display: "inline-flex" }}>
          <Logo size={10} />
        </span>
      </span>
    );
  }
  if (label === "MID") {
    return (
      <span className="signal-container" title="Medium alert. Sand Gourd.">
        <svg viewBox="0 0 24 24" width="8" height="8" fill="#BA7517" stroke="none">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#BA7517" strokeWidth="2" />
          <path d="M12,5 C10,5 9,7 9,9 C9,11 11,11.5 11,12 C11,12.5 9,13 9,15 C9,17 10,19 12,19 C14,19 15,17 15,15 C15,13 13,12.5 13,12 C13,11.5 15,11 15,9 C15,7 14,5 12,5 Z" fill="#BA7517" />
        </svg>
      </span>
    );
  }
  return (
    <span className="signal-container" title="Low alert. Scratched Headband.">
      <svg viewBox="0 0 24 24" width="8" height="8" fill="none">
        <rect x="2" y="6" width="20" height="12" rx="1.5" fill="var(--color-border-secondary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
        <circle cx="5" cy="12" r="1" fill="var(--color-text-secondary)" />
        <circle cx="19" cy="12" r="1" fill="var(--color-text-secondary)" />
        <line x1="4" y1="8" x2="20" y2="16" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return String(num);
}

interface ModernCategoryTrendScoreProps {
  data: CategoryMetrics[];
  period: Period;
}

export function ModernCategoryTrendScore({
  data,
  period,
}: ModernCategoryTrendScoreProps) {
  const router = useRouter();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "stars">("score");
  const [animated, setAnimated] = useState(false);
  const [activeCategoryName, setActiveCategoryName] = useState<string | null>(null);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const chartData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === "stars") {
        return b.period_star_gain - a.period_star_gain;
      }
      return b.trend_composite - a.trend_composite;
    });
  }, [data, sortBy]);

  const activeCategory = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    return chartData.find(c => c.category === activeCategoryName) || chartData[0];
  }, [chartData, activeCategoryName]);

  const categoryColorMap = useMemo(() => {
    const palette = [
      "#58a6ff", // Blue
      "#3fb950", // Green
      "#d29922", // Amber
      "#a371f7", // Purple
      "#f0883e", // Orange
      "#22d3ee", // Cyan
      "#e85a9d", // Pink
      "#39d353", // Bright Green
      "#2dd4bf", // Teal
      "#f87171", // Coral Red
    ];
    const mapping: Record<string, string> = {};
    const sortedCats = Array.from(new Set(data.map(c => c.category))).sort();
    sortedCats.forEach((cat, index) => {
      const color = categoryColor(cat);
      if (color === "#58a6ff" && cat.toLowerCase() !== "ai/ml" && cat.toLowerCase() !== "ai_ml" && cat.toLowerCase() !== "ai / ml") {
        mapping[cat] = palette[index % palette.length];
      } else {
        mapping[cat] = color;
      }
    });
    return mapping;
  }, [data]);

  const breakdownMetrics = useMemo(() => {
    if (!activeCategory || !data || data.length === 0) return null;
    
    const starGains = data.map(c => c.period_star_gain);
    const maxStar = Math.max(...starGains, 1);
    const minStar = Math.min(...starGains, 0);
    const starScore = maxStar === minStar ? 0.5 : (activeCategory.period_star_gain - minStar) / (maxStar - minStar);

    const contribs = data.map(c => c.total_contributors);
    const maxContrib = Math.max(...contribs, 1);
    const minContrib = Math.min(...contribs, 0);
    const contribScore = maxContrib === minContrib ? 0.5 : (activeCategory.total_contributors - minContrib) / (maxContrib - minContrib);

    let starLabel = "Steady";
    if (starScore >= 0.8) starLabel = "Breakout Growth";
    else if (starScore >= 0.5) starLabel = "High Influence";
    else if (starScore >= 0.2) starLabel = "Moderate Growth";

    let contribLabel = "Stable";
    if (contribScore >= 0.8) contribLabel = "Massive Surge";
    else if (contribScore >= 0.5) contribLabel = "Active Surge";
    else if (contribScore >= 0.2) contribLabel = "Growing";

    return {
      starWidth: Math.round(20 + starScore * 80) + "%",
      starLabel,
      contribWidth: Math.round(20 + contribScore * 80) + "%",
      contribLabel,
    };
  }, [activeCategory, data]);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="panel bento-card-row2" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
              Category trend score · {periodLabel}
            </span>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "x 10px",
              fontSize: "11px",
              color: "var(--text-muted)",
              rowGap: "4px",
              columnGap: "10px",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#84cc16", flexShrink: 0 }} />Stars 40%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#818cf8", flexShrink: 0 }} />Acceleration 20%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#06b6d4", flexShrink: 0 }} />Contributors 20%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />Releases 10%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />Issues 10%</span>
            </div>
          </div>

          <div className="trend-header-controls">
            {/* Legend */}
            <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#84cc16" }} />High</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />Mid</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6e7681" }} />Low</span>
            </div>

            {/* Toggle Sort Buttons */}
            <div style={{ display: "flex", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "2px", borderRadius: "6px" }}>
              <button
                onClick={() => setSortBy("score")}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: sortBy === "score" ? "rgba(255,255,255,0.08)" : "transparent",
                  color: sortBy === "score" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                Score
              </button>
              <button
                onClick={() => setSortBy("stars")}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: sortBy === "stars" ? "rgba(255,255,255,0.08)" : "transparent",
                  color: sortBy === "stars" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                Stars ⬆
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bento-trend-body" style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div className="bento-scroll-content" style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          {chartData.map((item, idx) => {
            const isHovered = hoveredCategory === item.category;
            const label = getTrendLabel(item.trend_composite);
            const percentage = item.trend_composite * 100;

            return (
              <div
                key={item.category}
                className="trend-row"
                onMouseEnter={() => {
                  setHoveredCategory(item.category);
                  setActiveCategoryName(item.category);
                }}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 0",
                  opacity: hoveredCategory === null || isHovered ? 1 : 0.4,
                  transition: "opacity 0.2s ease",
                  gap: "8px",
                  cursor: "pointer",
                }}
              >
                {/* Title & Repos Count */}
                <div style={{ minWidth: 0, flexBasis: "130px", flexShrink: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }} title={item.category}>
                    {item.category}
                  </span>
                  <span style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    marginTop: "1px",
                  }}>
                    {item.repo_count}r
                  </span>
                </div>

                {/* Thin Progress Bar */}
                <div style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
                  <div className="chakra-bar-container">
                    <div
                      className="chakra-bar-fill"
                      style={{
                        width: animated ? `${percentage}%` : "0%",
                        background: categoryColorMap[item.category] || "#58a6ff",
                      }}
                    />
                  </div>
                </div>

                {/* Right Side Values */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {/* Score Percentage */}
                  <span style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                    minWidth: "32px",
                    textAlign: "right",
                  }}>
                    {percentage.toFixed(0)}%
                  </span>

                  {/* Score Level Badge */}
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    minWidth: "44px",
                  }}>
                    <SignalDot label={label} />
                    {label.toLowerCase()}
                  </span>

                  {/* Star Gained — hidden on very small screens via CSS */}
                  <span className="trend-stars-col" style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--accent-green)",
                    fontFamily: "var(--font-mono)",
                    minWidth: "54px",
                    textAlign: "right",
                  }}>
                    +{formatNumber(item.period_star_gain)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Deep-Dive Panel */}
        {activeCategory && (
          <div className="bento-trend-detail" style={{ width: "270px", borderLeft: "1px solid var(--border)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.01)", overflowY: "hidden", flexShrink: 0 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 3v18h18" />
                  <path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={activeCategory.category}>
                  {activeCategory.category}
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", lineHeight: 1.1 }}>
                  {activeCategory.repo_count} repos
                </span>
              </div>
            </div>

            {/* Composite Score Display */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "6px" }}>
              <div style={{ 
                position: "relative", 
                width: "38px", 
                height: "38px", 
                borderRadius: "50%", 
                border: `2.5px solid ${trendColor(activeCategory.trend_composite)}`, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 0 8px ${trendColor(activeCategory.trend_composite)}15`
              }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  {(activeCategory.trend_composite * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em" }}>MOMENTUM</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: trendColor(activeCategory.trend_composite), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {getTrendLabel(activeCategory.trend_composite)} LEVEL
                </span>
              </div>
            </div>

            {/* 2x2 Grid of Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Star Velocity</span>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                  +{formatNumber(activeCategory.period_star_gain)}
                </span>
              </div>
              <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Contributors</span>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                  {formatNumber(activeCategory.total_contributors)}
                </span>
              </div>
              <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Merged PRs</span>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--accent-blue)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                  +{formatNumber(activeCategory.period_pr_gain || activeCategory.total_merged_prs)}
                </span>
              </div>
              <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>MoM Growth</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                  {activeCategory.mom_growth_pct >= 0 ? "+" : ""}{activeCategory.mom_growth_pct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Score Breakdown Bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "auto" }}>
              <span style={{ fontSize: "7.5px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em", opacity: 0.6 }}>METRIC WEIGHT INFLUENCE</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "9px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                    <span>Stars (40%)</span>
                    <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "8.5px" }}>
                      {breakdownMetrics?.starLabel ?? "High Influence"}
                    </span>
                  </div>
                  <div style={{ height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#84cc16", width: breakdownMetrics?.starWidth ?? "85%" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                    <span>Velocity & contributors (40%)</span>
                    <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "8.5px" }}>
                      {breakdownMetrics?.contribLabel ?? "Active Surge"}
                    </span>
                  </div>
                  <div style={{ height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#38bdf8", width: breakdownMetrics?.contribWidth ?? "70%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="trend-score-footer">
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
          Hover any row for score breakdown · Updated 12 min ago
        </span>
        <div className="trend-score-footer-buttons">
          <button 
            onClick={() => router.push("/leaderboard")}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Drill down ↗
          </button>
          <button 
            onClick={() => router.push("/radar")}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Acceleration leaders ↗
          </button>
        </div>
      </div>

      <style>{`
        .trend-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .trend-row:hover {
          background: rgba(255, 255, 255, 0.03);
          transform: translateX(4px);
        }
        .trend-header-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .trend-score-footer {
          border-top: 1px solid var(--border);
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .trend-score-footer-buttons {
          display: flex;
          gap: 8px;
        }
        .bento-trend-body {
          min-height: 0;
        }
        .bento-trend-detail::-webkit-scrollbar {
          width: 4px;
        }
        .bento-trend-detail::-webkit-scrollbar-thumb {
          background-color: var(--border);
          border-radius: 2px;
        }
        /* Hide star-gain column on very narrow screens */
        @media (max-width: 480px) {
          .trend-stars-col { display: none !important; }
        }
        @media (max-width: 768px) {
          .trend-header-controls {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 6px;
          }
          .bento-trend-detail {
            display: none !important;
          }
        }

        @media (max-width: 640px) {
          .trend-score-footer {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 12px;
          }
          .trend-score-footer > span {
            text-align: center;
            font-size: 10px !important;
          }
          .trend-score-footer-buttons {
            width: 100%;
            display: flex;
            gap: 8px;
          }
          .trend-score-footer-buttons button {
            flex: 1;
            justify-content: center;
            padding: 8px 12px !important;
            font-size: 11px !important;
            white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
}
