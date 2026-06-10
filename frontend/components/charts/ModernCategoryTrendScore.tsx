"use client";

import { useState, useMemo, useEffect } from "react";
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
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "stars">("score");
  const [animated, setAnimated] = useState(false);

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

      <div style={{ padding: "16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
        {top12Categories.map((item, idx) => {
          const isHovered = hoveredCategory === item.category;
          const color = trendColor(item.trend_composite);
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
                padding: "8px",
                borderRadius: "8px",
                opacity: hoveredCategory === null || isHovered ? 1 : 0.4,
              }}
            >
              {/* Rank */}
              <span style={{
                width: "18px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-muted)",
                marginRight: "8px",
                textAlign: "right",
                fontFamily: "var(--font-mono)",
              }}>
                {idx + 1}
              </span>

              {/* Title & Repos Count */}
              <div style={{ width: "130px", display: "flex", flexDirection: "column", marginRight: "12px", flexShrink: 0 }}>
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

              {/* Thick Pill Progress Bar */}
              <div style={{ flex: 1, minWidth: 0, marginRight: "16px" }}>
                <div style={{
                  position: "relative",
                  height: "18px",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "9px",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                }}>
                  <div style={{
                    height: "100%",
                    background: color,
                    width: animated ? `${percentage}%` : "0%",
                    transition: "width 1.2s cubic-bezier(0.25, 1, 0.5, 1)",
                    borderRadius: "9px",
                  }} />

                  {/* Percentage overlay text inside the bar */}
                  <span style={{
                    position: "absolute",
                    left: "10px",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#ffffff",
                    fontFamily: "var(--font-mono)",
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    pointerEvents: "none",
                  }}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Score Number Value */}
              <span style={{
                width: "28px",
                fontSize: "13px",
                fontWeight: 700,
                color: color,
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                marginRight: "16px",
                flexShrink: 0,
              }}>
                {percentage.toFixed(0)}
              </span>

              {/* Star Velocity Gained */}
              <span style={{
                width: "65px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#22c55e",
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                marginRight: "16px",
                flexShrink: 0,
              }}>
                +{formatNumber(item.period_star_gain)}
              </span>

              {/* Status Badge Pill */}
              <div style={{
                width: "56px",
                display: "flex",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "20px",
                  lineHeight: 1,
                  fontFamily: "var(--font-sans)",
                  letterSpacing: "0.03em",
                  ...(label === "HIGH" ? {
                    background: "rgba(132, 204, 22, 0.12)",
                    color: "#84cc16",
                    border: "1px solid rgba(132, 204, 22, 0.2)",
                  } : label === "MID" ? {
                    background: "rgba(245, 158, 11, 0.12)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245, 158, 11, 0.2)",
                  } : {
                    background: "rgba(255, 255, 255, 0.04)",
                    color: "var(--text-muted)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  })
                }}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
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
          <button style={{
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
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
            Drill down ↗
          </button>
          <button style={{
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
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
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
