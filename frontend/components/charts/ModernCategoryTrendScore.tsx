"use client";

import { useState, useMemo } from "react";
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

const CATEGORY_COLORS: Record<string, string> = {
  "LLM Models": "#3b82f6",
  "Agent Frameworks": "#8b5cf6",
  "Inference Engines": "#f59e0b",
  "Vector Databases": "#10b981",
  "Model Serving / Runtimes": "#06b6d4",
  "Distributed Compute / Infra": "#f97316",
  "Evaluation Frameworks": "#84cc16",
  "Fine-tuning Toolkits": "#ec4899",
  "AI / ML": "#3b82f6",
  "DevTools": "#38bdf8",
  "Web Frameworks": "#a78bfa",
  "Web & Mobile": "#a78bfa",
  "Security": "#f87171",
  "Data Engineering": "#34d399",
  "Data & Infra": "#34d399",
  "Blockchain": "#fbbf24",
  "OSS Tools": "#fb923c",
  "Science & Research": "#84cc16",
  "Creative & Gaming": "#ec4899",
};

function trendColor(score: number): string {
  if (score >= 0.65) return "#22c55e";
  if (score >= 0.4) return "#f59e0b";
  return "#6b7280";
}

function getTrendLabel(score: number): string {
  if (score >= 0.65) return "HIGH";
  if (score >= 0.4) return "MID";
  return "LOW";
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
  const [showMore, setShowMore] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const chartData = useMemo(
    () => [...data].sort((a, b) => b.trend_composite - a.trend_composite),
    [data]
  );

  const topCategories = useMemo(() => chartData.slice(0, 6), [chartData]);
  const restCategories = useMemo(() => chartData.slice(6), [chartData]);
  const displayCategories = showMore ? chartData : topCategories;

  return (
    <div className="panel">
      <div className="panel-header">
        <div style={{ minWidth: 0 }}>
          <div className="panel-title">Category Trend Score ({periodLabel})</div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "3px",
            }}
          >
            Stars 40% · Acceleration 20% · Contributors 20% · Releases 10% · Issues 10%
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "12px",
            fontSize: "11px",
            color: "var(--text-muted)",
            flexShrink: 0,
            fontFamily: "var(--font-sans)",
          }}
        >
          {[
            ["#22c55e", "HIGH"],
            ["#f59e0b", "MID"],
            ["#6b7280", "LOW"],
          ].map(([c, l]) => (
            <span
              key={l}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                opacity: 0.8,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  background: c,
                  display: "inline-block",
                  borderRadius: "50%",
                }}
              />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {displayCategories.map((item, idx) => {
            const isHovered = hoveredCategory === item.category;
            const color = trendColor(item.trend_composite);
            const label = getTrendLabel(item.trend_composite);
            const percentage = item.trend_composite * 100;
            const categoryColor = CATEGORY_COLORS[item.category] ?? "#6b7280";

            return (
              <div
                key={item.category}
                onMouseEnter={() => setHoveredCategory(item.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  opacity: hoveredCategory === null || isHovered ? 1 : 0.4,
                  transform: isHovered ? "translateX(2px)" : "translateX(0)",
                  paddingLeft: isHovered ? "2px" : "0",
                }}
              >
                {/* Category info and trend badge */}
                <div style={{ width: "130px", flexShrink: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "2px",
                      transition: "transform 0.2s ease",
                      transform: isHovered ? "scale(1.02)" : "scale(1)",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "2px",
                        background: `${categoryColor}30`,
                        border: `1.2px solid ${categoryColor}50`,
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                        boxShadow: isHovered ? `0 0 8px ${categoryColor}40` : "none",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "9px",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      opacity: 0.7,
                      transition: "opacity 0.2s ease",
                    }}
                  >
                    {item.repo_count}r
                  </div>
                </div>

                {/* Progress visualization */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Background track */}
                  <div
                    style={{
                      position: "relative",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${isHovered ? `${color}20` : "rgba(255, 255, 255, 0.05)"}`,
                      overflow: "hidden",
                      transition: "all 0.2s ease",
                      boxShadow: isHovered ? `inset 0 0 8px ${color}10` : "none",
                    }}
                  >
                    {/* Animated gradient fill */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${percentage}%`,
                        background: `linear-gradient(90deg, ${color}30 0%, ${color}60 100%)`,
                        transition: isHovered
                          ? "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                          : "width 0.5s ease-out",
                        borderRadius: "6px",
                        boxShadow: isHovered ? `0 0 12px ${color}40` : "none",
                      }}
                    />

                    {/* Border highlight on hover */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${percentage}%`,
                        borderRight: `2px solid ${color}80`,
                        borderRadius: "6px",
                        opacity: isHovered ? 1 : 0,
                        transition: "opacity 0.25s ease",
                      }}
                    />

                    {/* Percentage text inside bar */}
                    {percentage > 12 && (
                      <div
                        style={{
                          position: "relative",
                          paddingLeft: "8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: percentage > 45 ? "rgba(255,255,255,0.9)" : color,
                          fontFamily: "var(--font-mono)",
                          zIndex: 2,
                          textShadow: percentage <= 45 ? `0 0 6px ${color}30` : "none",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {percentage.toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics column */}
                <div
                  style={{
                    width: "100px",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "2px",
                  }}
                >
                  {/* Trend badge - animated */}
                  <div
                    onMouseEnter={() => setHoveredTooltip(item.category)}
                    onMouseLeave={() => setHoveredTooltip(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "3px 7px",
                      background: `${color}12`,
                      border: `1.2px solid ${isHovered ? `${color}60` : `${color}30`}`,
                      borderRadius: "3px",
                      fontSize: "9px",
                      fontWeight: 700,
                      color: color,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.06em",
                      cursor: "help",
                      transition: "all 0.2s ease",
                      transform: isHovered ? "scale(1.05)" : "scale(1)",
                      textTransform: "uppercase",
                    }}
                  >
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: color,
                        display: "inline-block",
                        animation: isHovered ? "pulse 1.5s ease-in-out infinite" : "none",
                      }}
                    />
                    {label}
                  </div>

                  {/* Stars gained - interactive */}
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", opacity: 0.8, transition: "all 0.2s ease", transform: isHovered ? "translateY(-1px)" : "translateY(0)" }}>
                    <span style={{ color: "#22c55e", fontWeight: 600 }}>
                      +{item.period_star_gain > 999 ? `${(item.period_star_gain / 1000).toFixed(1)}k` : item.period_star_gain}
                    </span>
                  </div>
                </div>

                {/* Hover tooltip */}
                {isHovered && (
                  <div
                    style={{
                      position: "absolute",
                      right: "150px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "var(--bg-elevated)",
                      border: `1px solid ${color}40`,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                      zIndex: 10,
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
                      animation: "slideLeftIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        color: color,
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      Trend: {percentage.toFixed(1)}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                      Contributors: {item.total_contributors.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Show more button */}
          {restCategories.length > 0 && !showMore && (
            <button
              onClick={() => setShowMore(true)}
              style={{
                alignSelf: "center",
                marginTop: "6px",
                padding: "7px 14px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "5px",
                color: "var(--text-muted)",
                fontSize: "11px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                letterSpacing: "0.02em",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
              }}
            >
              +{restCategories.length} more
            </button>
          )}

          {/* Show less button */}
          {showMore && (
            <button
              onClick={() => setShowMore(false)}
              style={{
                alignSelf: "center",
                marginTop: "6px",
                padding: "7px 14px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "5px",
                color: "var(--text-muted)",
                fontSize: "11px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                letterSpacing: "0.02em",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
              }}
            >
              Show less
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideLeftIn {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
