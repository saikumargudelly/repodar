"use client";

import { useState, useMemo } from "react";
import { CategoryMetrics } from "@/lib/api";

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

const CATEGORY_ICONS: Record<string, string> = {
  "LLM Models": "🧠",
  "Agent Frameworks": "🤖",
  "Inference Engines": "⚡",
  "Vector Databases": "🗂️",
  "Model Serving / Runtimes": "🚀",
  "Distributed Compute / Infra": "🌐",
  "Evaluation Frameworks": "✅",
  "Fine-tuning Toolkits": "🔧",
  "AI / ML": "🧠",
  "DevTools": "🛠️",
  "Web Frameworks": "🕸️",
  "Web & Mobile": "📱",
  "Security": "🔒",
  "Data Engineering": "📊",
  "Data & Infra": "📦",
  "Blockchain": "⛓️",
  "OSS Tools": "🎁",
  "Science & Research": "🔬",
  "Creative & Gaming": "🎮",
};

interface CompactCategoryCardsProps {
  data: CategoryMetrics[];
}

export function CompactCategoryCards({ data }: CompactCategoryCardsProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const total = useMemo(() => data.reduce((s, c) => s + c.total_stars, 0), [data]);
  const sortedData = useMemo(
    () => [...data].sort((a, b) => b.total_stars - a.total_stars),
    [data]
  );
  const topCategories = useMemo(() => sortedData.slice(0, 4), [sortedData]);

  return (
    <div className="panel">
      <div className="panel-header" style={{ paddingBottom: "8px" }}>
        <div>
          <div className="panel-title" style={{ fontSize: "13px" }}>Stars Distribution</div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
            {total.toLocaleString()} stars
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          {topCategories.map((cat) => {
            const percentage = total > 0 ? (cat.total_stars / total) * 100 : 0;
            const color = CATEGORY_COLORS[cat.category] ?? "#6b7280";
            const icon = CATEGORY_ICONS[cat.category] ?? "📌";
            const isHovered = hoveredCategory === cat.category;

            return (
              <div
                key={cat.category}
                onMouseEnter={() => setHoveredCategory(cat.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: isHovered ? `${color}10` : "rgba(255, 255, 255, 0.02)",
                  border: `1.5px solid ${isHovered ? `${color}30` : "rgba(255, 255, 255, 0.05)"}`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Gradient blob on hover */}
                <div
                  style={{
                    position: "absolute",
                    top: "-20px",
                    right: "-20px",
                    width: "60px",
                    height: "60px",
                    background: `radial-gradient(circle, ${color}20, transparent)`,
                    borderRadius: "50%",
                    transform: `translate(${isHovered ? "-10px" : "0px"}, ${isHovered ? "-10px" : "0px"})`,
                    transition: "transform 0.3s ease-out",
                    pointerEvents: "none",
                  }}
                />

                {/* Content */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "16px" }}>{icon}</span>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cat.category}
                    </div>
                  </div>

                  {/* Percentage */}
                  <div style={{ fontSize: "18px", fontWeight: 700, color, marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
                    {percentage.toFixed(0)}%
                  </div>

                  {/* Stats */}
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
                    <span>{cat.total_stars.toLocaleString()} ⭐</span>
                    <span>{cat.repo_count}</span>
                  </div>

                  {/* Mini progress bar */}
                  <div style={{ marginTop: "6px", height: "3px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "2px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        background: color,
                        width: `${percentage}%`,
                        transition: "width 0.3s ease-out",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
