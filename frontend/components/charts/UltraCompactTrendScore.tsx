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

function trendColor(score: number): string {
  if (score >= 0.65) return "#22c55e";
  if (score >= 0.4) return "#f59e0b";
  return "#6b7280";
}

interface UltraCompactTrendScoreProps {
  data: CategoryMetrics[];
}

export function UltraCompactTrendScore({ data }: UltraCompactTrendScoreProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const chartData = useMemo(() => [...data].sort((a, b) => b.trend_composite - a.trend_composite).slice(0, 5), [data]);
  const moreCount = useMemo(() => Math.max(0, data.length - 5), [data]);

  const toggleExpand = () => {
    if (expandedCategories.size === 0) {
      setExpandedCategories(new Set(data.map(d => d.category)));
    } else {
      setExpandedCategories(new Set());
    }
  };

  return (
    <div className="panel" style={{ minHeight: "auto" }}>
      <div className="panel-header" style={{ paddingBottom: "8px" }}>
        <div className="panel-title" style={{ fontSize: "13px", fontWeight: 600 }}>Trend Score</div>
      </div>

      <div style={{ padding: "10px 14px" }}>
        {chartData.map((item) => {
          const color = trendColor(item.trend_composite);
          const percentage = item.trend_composite * 100;
          const categoryColor = CATEGORY_COLORS[item.category] ?? "#6b7280";

          return (
            <div
              key={item.category}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
                fontSize: "12px",
              }}
            >
              {/* Color indicator */}
              <div style={{ width: "3px", height: "16px", borderRadius: "2px", background: color, flexShrink: 0 }} />

              {/* Category name */}
              <div style={{ width: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11px", color: "var(--text-secondary)" }}>
                {item.category}
              </div>

              {/* Mini progress bar */}
              <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden", position: "relative" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${percentage}%`,
                    background: `linear-gradient(90deg, ${color}40 0%, ${color}80 100%)`,
                    borderRadius: "2px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {/* Percentage */}
              <div style={{ width: "28px", textAlign: "right", fontSize: "10px", color: color, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                {percentage.toFixed(0)}%
              </div>
            </div>
          );
        })}

        {/* More button */}
        {moreCount > 0 && (
          <button
            onClick={toggleExpand}
            style={{
              marginTop: "6px",
              width: "100%",
              padding: "4px",
              fontSize: "10px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-muted)",
              cursor: "pointer",
              borderRadius: "3px",
              fontFamily: "var(--font-mono)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            +{moreCount} more
          </button>
        )}
      </div>
    </div>
  );
}
