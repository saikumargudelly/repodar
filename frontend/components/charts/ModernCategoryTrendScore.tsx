"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CategoryMetrics, Period } from "@/lib/api";

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

function getBarColor(category: string): string {
  if (category === "Agent Frameworks") return "#3fb950"; // Green
  if (category === "AI / ML") return "#38bdf8"; // Blue
  if (category === "LLM Models") return "#d29922"; // Orange
  return "#484f58"; // Gray
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
  const [isExpanded, setIsExpanded] = useState(false);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const chartData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === "stars") {
        return b.period_star_gain - a.period_star_gain;
      }
      return b.trend_composite - a.trend_composite;
    });
  }, [data, sortBy]);

  const top12Categories = useMemo(() => chartData.slice(0, 12), [chartData]);

  const displayedCategories = useMemo(() => {
    return isExpanded ? top12Categories : top12Categories.slice(0, 6);
  }, [top12Categories, isExpanded]);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
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
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#84cc16" }} />Stars 40%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#818cf8" }} />Acceleration 20%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#06b6d4" }} />Contributors 20%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />Releases 10%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f87171" }} />Issues 10%</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
            {/* Legend */}
            <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#84cc16" }} />High</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />Mid</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6e7681" }} />Low</span>
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

      <div style={{ padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>
        {displayedCategories.map((item, idx) => {
          const isHovered = hoveredCategory === item.category;
          const label = getTrendLabel(item.trend_composite);
          const percentage = item.trend_composite * 100;

          return (
            <div
              key={item.category}
              className="trend-row"
              onMouseEnter={() => setHoveredCategory(item.category)}
              onMouseLeave={() => setHoveredCategory(null)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 0",
                opacity: hoveredCategory === null || isHovered ? 1 : 0.4,
                transition: "opacity 0.2s ease",
              }}
            >
              {/* Title & Repos Count */}
              <div style={{ width: "160px", display: "flex", flexDirection: "column", flexShrink: 0, marginRight: "16px" }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "#ffffff",
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
                  marginTop: "2px",
                }}>
                  {item.repo_count}r
                </span>
              </div>

              {/* Thin Progress Bar */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", paddingRight: "24px" }}>
                <div style={{
                  width: "100%",
                  height: "4px",
                  background: "rgba(255, 255, 255, 0.06)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    background: getBarColor(item.category),
                    width: animated ? `${percentage}%` : "0%",
                    transition: "width 1.2s cubic-bezier(0.25, 1, 0.5, 1)",
                    borderRadius: "2px",
                  }} />
                </div>
              </div>

              {/* Right Side Values layout */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "180px", justifyContent: "flex-end", flexShrink: 0 }}>
                {/* Score Percentage */}
                <span style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#ffffff",
                  fontFamily: "var(--font-mono)",
                  width: "36px",
                  textAlign: "right",
                }}>
                  {percentage.toFixed(0)}%
                </span>

                {/* Score Level Badge/Dot */}
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  width: "56px",
                }}>
                  <span style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: label === "HIGH" ? "#3fb950" : label === "MID" ? "#d29922" : "#6e7681",
                    display: "inline-block",
                  }} />
                  {label.toLowerCase()}
                </span>

                {/* Star Gained */}
                <span style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#2ea043",
                  fontFamily: "var(--font-mono)",
                  width: "68px",
                  textAlign: "right",
                }}>
                  +{formatNumber(item.period_star_gain)}
                </span>
              </div>
            </div>
          );
        })}

        {top12Categories.length > 6 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "6px" }}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 600,
                padding: "6px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "rgba(255, 255, 255, 0.02)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              {isExpanded ? "Show Less ▴" : "Show All ▾"}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
          Hover any row for score breakdown · Updated 12 min ago
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
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
      `}</style>
    </div>
  );
}
