"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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

interface ModernPRChartProps {
  data: CategoryMetrics[];
  period: Period;
}

interface LollipopDataPoint {
  category: string;
  totalPRs: number;
  avgOpenPRs: number;
  avgPRs: number;
  color: string;
}

export function ModernPRChart({ data, period }: ModernPRChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const chartData: LollipopDataPoint[] = useMemo(
    () =>
      [...data]
        .sort(
          (a, b) =>
            b.total_merged_prs +
            b.avg_open_prs -
            (a.total_merged_prs + a.avg_open_prs)
        )
        .slice(0, 8)
        .map((cat) => ({
          category: cat.category,
          totalPRs: cat.total_merged_prs,
          avgOpenPRs: cat.avg_open_prs,
          avgPRs: cat.total_merged_prs + cat.avg_open_prs,
          color: CATEGORY_COLORS[cat.category] ?? "#6b7280",
        })),
    [data]
  );

  const maxValue = useMemo(
    () => Math.max(...chartData.map((d) => d.avgPRs), 1),
    [chartData]
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">PR Activity ({periodLabel})</div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "10px",
              color: "var(--text-muted)",
              marginTop: "2px",
              opacity: 0.8,
            }}
          >
            Merged · Open PRs (avg/repo)
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 18px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Lollipop chart items */}
          {chartData.map((item, idx) => {
            const isHovered = hoveredCategory === item.category;
            const percentage = (item.avgPRs / maxValue) * 100;

            // Create SVG animation for line
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
                  opacity: hoveredCategory === null || isHovered ? 1 : 0.35,
                  transform: isHovered ? "translateX(1px)" : "translateX(0)",
                }}
              >
                {/* Category label with rank badge */}
                <div
                  style={{
                    width: "100px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: `${item.color}25`,
                      border: `1.2px solid ${isHovered ? `${item.color}60` : `${item.color}35`}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: item.color,
                      flexShrink: 0,
                      transition: "all 0.2s ease",
                      boxShadow: isHovered ? `0 0 8px ${item.color}40` : "none",
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {item.category}
                  </div>
                </div>

                {/* Lollipop visualization */}
                <div
                  style={{
                    flex: 1,
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    position: "relative",
                    cursor: "pointer",
                  }}
                >
                  {/* Background track */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: "1.5px",
                      background: "rgba(255, 255, 255, 0.05)",
                      borderRadius: "1px",
                      zIndex: 0,
                    }}
                  />

                  {/* Animated gradient line */}
                  <svg
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "100%",
                      height: "2px",
                      pointerEvents: "none",
                    }}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id={`grad-${idx}`} x1="0%" x2="100%">
                        <stop
                          offset="0%"
                          stopColor={item.color}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset={`${percentage}%`}
                          stopColor={item.color}
                          stopOpacity={1}
                        />
                        <stop
                          offset={`${percentage + 1}%`}
                          stopColor={item.color}
                          stopOpacity={0}
                        />
                        <stop
                          offset="100%"
                          stopColor={item.color}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <line
                      x1="0"
                      y1="50%"
                      x2="100%"
                      y2="50%"
                      stroke={`url(#grad-${idx})`}
                      strokeWidth="2"
                    />
                  </svg>

                  {/* Lollipop dot */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${percentage}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: isHovered ? "14px" : "10px",
                      height: isHovered ? "14px" : "10px",
                      borderRadius: "50%",
                      background: item.color,
                      boxShadow: isHovered
                        ? `0 0 12px ${item.color}60, 0 0 24px ${item.color}30`
                        : "0 2px 8px rgba(0, 0, 0, 0.3)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      zIndex: 2,
                      border: "2px solid rgba(255, 255, 255, 0.1)",
                    }}
                  />

                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${percentage}%`,
                        top: "-40px",
                        transform: "translateX(-50%)",
                        background: "var(--bg-elevated)",
                        border: `1px solid ${item.color}40`,
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "nowrap",
                        zIndex: 10,
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
                        animation:
                          "slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      <div
                        style={{
                          color: item.color,
                          fontWeight: 600,
                        }}
                      >
                        {item.avgPRs}
                      </div>
                    </div>
                  )}
                </div>

                {/* Value display */}
                <div
                  style={{
                    width: "80px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: item.color,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {item.avgPRs.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {item.totalPRs} merged · {item.avgOpenPRs.toFixed(1)}{" "}
                    open
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
