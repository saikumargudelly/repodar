"use client";

import { useState, useMemo } from "react";
import { CategoryMetrics, Period } from "@/lib/api";

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

interface UltraCompactPRChartProps {
  data: CategoryMetrics[];
  period: Period;
}

export function UltraCompactPRChart({ data, period }: UltraCompactPRChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const prData = useMemo(
    () => [...data].sort((a, b) => (b.total_merged_prs + b.avg_open_prs) - (a.total_merged_prs + a.avg_open_prs)).slice(0, 4),
    [data]
  );

  const maxValue = useMemo(() => Math.max(...prData.map(d => d.total_merged_prs + d.avg_open_prs)), [prData]);

  return (
    <div className="panel" style={{ minHeight: "auto" }}>
      <div className="panel-header" style={{ paddingBottom: "8px" }}>
        <div className="panel-title" style={{ fontSize: "13px", fontWeight: 600 }}>PR Activity</div>
      </div>

      <div style={{ padding: "10px 14px" }}>
        {prData.map((item, idx) => {
          const color = CATEGORY_COLORS[item.category] ?? "#6b7280";
          const totalPR = item.total_merged_prs + item.avg_open_prs;
          const percentage = maxValue > 0 ? (totalPR / maxValue) * 100 : 0;
          const isHovered = hovered === item.category;

          return (
            <div
              key={item.category}
              onMouseEnter={() => setHovered(item.category)}
              onMouseLeave={() => setHovered(null)}
              style={{
                marginBottom: "6px",
                transition: "opacity 0.2s ease",
                opacity: hovered === null || isHovered ? 1 : 0.6,
              }}
            >
              {/* Category and rank */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)" }}>
                  <span style={{ color, fontWeight: 700, marginRight: "4px" }}>#{idx + 1}</span>
                  {item.category}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {totalPR}
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: "5px",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "2px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${percentage}%`,
                    background: `linear-gradient(90deg, ${color}40 0%, ${color} 100%)`,
                    borderRadius: "2px",
                    boxShadow: isHovered ? `0 0 8px ${color}60` : "none",
                    transition: "all 0.3s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
