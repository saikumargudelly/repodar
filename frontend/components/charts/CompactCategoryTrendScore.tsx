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

interface CompactCategoryTrendScoreProps {
  data: CategoryMetrics[];
  period: Period;
}

export function CompactCategoryTrendScore({ data, period }: CompactCategoryTrendScoreProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const chartData = useMemo(
    () => [...data].sort((a, b) => b.trend_composite - a.trend_composite),
    [data]
  );

  const topCategories = useMemo(() => chartData.slice(0, 5), [chartData]);
  const displayCategories = showAll ? chartData : topCategories;
  const restCount = chartData.length - 5;

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ paddingBottom: "8px" }}>
        <div style={{ minWidth: 0 }}>
          <div className="panel-title" style={{ fontSize: "13px" }}>Trend Score</div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
            {periodLabel}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", fontSize: "9px", color: "var(--text-muted)" }}>
          {[["#22c55e", "H"], ["#f59e0b", "M"], ["#6b7280", "L"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ width: "6px", height: "6px", background: c, borderRadius: "50%", display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 16px", flex: 1, overflowY: "auto", maxHeight: "220px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {displayCategories.map((item) => {
            const isHovered = hoveredCategory === item.category;
            const color = trendColor(item.trend_composite);
            const percentage = item.trend_composite * 100;
            const categoryColor = CATEGORY_COLORS[item.category] ?? "#6b7280";

            return (
              <div
                key={item.category}
                onMouseEnter={() => setHoveredCategory(item.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 60px",
                  gap: "8px",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  background: isHovered ? "rgba(255, 255, 255, 0.04)" : "transparent",
                  transition: "all 0.15s ease",
                  opacity: hoveredCategory === null || isHovered ? 1 : 0.6,
                  cursor: "pointer",
                }}
              >
                {/* Category name and type */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.category}
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "1px" }}>
                    {item.repo_count} repos
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ position: "relative", height: "20px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", overflow: "hidden" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${color}25 0%, ${color}45 100%)`,
                      transition: "all 0.3s ease",
                      borderRadius: "6px",
                    }}
                  />
                  {percentage > 20 && (
                    <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", paddingLeft: "6px", fontSize: "9px", fontWeight: 700, color: percentage > 60 ? "white" : color, zIndex: 2, textShadow: percentage > 60 ? "none" : `0 0 4px ${color}30` }}>
                      {percentage.toFixed(0)}%
                    </div>
                  )}
                </div>

                {/* Trend badge */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", padding: "2px 6px", background: `${color}15`, border: `1px solid ${color}40`, borderRadius: "3px", fontSize: "9px", fontWeight: 700, color: color, fontFamily: "var(--font-mono)" }}>
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: color, display: "inline-block" }} />
                    {getTrendLabel(item.trend_composite)}
                  </div>
                </div>

                {/* Hover tooltip */}
                {isHovered && (
                  <div style={{ position: "absolute", bottom: "-30px", left: 0, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "4px", padding: "6px 10px", fontSize: "9px", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)", animation: "fadeIn 0.15s ease" }}>
                    <span style={{ color }}>+{item.period_star_gain.toLocaleString()}</span> stars
                  </div>
                )}
              </div>
            );
          })}

          {restCount > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              style={{
                marginTop: "4px",
                padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                color: "var(--text-muted)",
                fontSize: "10px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              +{restCount} more
            </button>
          )}

          {showAll && restCount > 0 && (
            <button
              onClick={() => setShowAll(false)}
              style={{
                marginTop: "4px",
                padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                color: "var(--text-muted)",
                fontSize: "10px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              ↑ Collapse
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
