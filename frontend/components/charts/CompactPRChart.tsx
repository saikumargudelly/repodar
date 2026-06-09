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

interface CompactPRChartProps {
  data: CategoryMetrics[];
  period: Period;
}

export function CompactPRChart({ data, period }: CompactPRChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.total_merged_prs + b.avg_open_prs - (a.total_merged_prs + a.avg_open_prs))
      .slice(0, 5);
  }, [data]);

  const maxValue = useMemo(() => {
    return Math.max(...chartData.map((d) => d.total_merged_prs + d.avg_open_prs), 1);
  }, [chartData]);

  return (
    <div className="panel">
      <div className="panel-header" style={{ paddingBottom: "8px" }}>
        <div>
          <div className="panel-title" style={{ fontSize: "13px" }}>PR Activity</div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
            {periodLabel}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {chartData.map((item, idx) => {
            const isHovered = hoveredCategory === item.category;
            const color = CATEGORY_COLORS[item.category] ?? "#6b7280";
            const totalValue = item.total_merged_prs + item.avg_open_prs;
            const percentage = (totalValue / maxValue) * 100;

            return (
              <div
                key={item.category}
                onMouseEnter={() => setHoveredCategory(item.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  opacity: hoveredCategory === null || isHovered ? 1 : 0.5,
                  transition: "opacity 0.15s ease",
                }}
              >
                {/* Header with rank and category */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `${color}15`,
                      border: `1.5px solid ${color}40`,
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: color,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.category}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      color: isHovered ? color : "var(--text-muted)",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {totalValue.toLocaleString()}
                  </span>
                </div>

                {/* Horizontal bar with gradient */}
                <div
                  style={{
                    position: "relative",
                    height: "24px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid rgba(255, 255, 255, 0.04)`,
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  {/* Animated fill */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${color}30 0%, ${color}50 100%)`,
                      transition: isHovered ? "all 0.2s ease" : "width 0.4s ease-out",
                      boxShadow: isHovered ? `inset 0 0 12px ${color}40` : "none",
                    }}
                  />

                  {/* Value text inside bar */}
                  {percentage > 25 && (
                    <div
                      style={{
                        position: "relative",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: "8px",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: percentage > 60 ? "white" : color,
                        zIndex: 2,
                        textShadow: percentage > 60 ? "none" : `0 0 3px ${color}30`,
                      }}
                    >
                      {percentage.toFixed(0)}%
                    </div>
                  )}

                  {/* Hover glow dot at the end */}
                  {isHovered && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${percentage}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: color,
                        boxShadow: `0 0 12px ${color}60`,
                        animation: "pulse 0.8s ease-in-out infinite",
                      }}
                    />
                  )}
                </div>

                {/* Sub metrics */}
                {isHovered && (
                  <div
                    style={{
                      fontSize: "9px",
                      color: "var(--text-muted)",
                      marginTop: "4px",
                      display: "flex",
                      gap: "12px",
                      fontFamily: "var(--font-mono)",
                      animation: "fadeIn 0.15s ease",
                    }}
                  >
                    <span>
                      Merged: <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>{item.total_merged_prs.toLocaleString()}</span>
                    </span>
                    <span>
                      Open: <span style={{ color: "var(--accent-yellow)", fontWeight: 600 }}>{item.avg_open_prs.toLocaleString()}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
