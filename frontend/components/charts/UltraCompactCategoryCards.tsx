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

interface UltraCompactCardsProps {
  data: CategoryMetrics[];
}

export function UltraCompactCategoryCards({ data }: UltraCompactCardsProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const total = useMemo(() => data.reduce((s, c) => s + c.total_stars, 0), [data]);
  const topCategories = useMemo(() => [...data].sort((a, b) => b.total_stars - a.total_stars).slice(0, 4), [data]);

  return (
    <div className="panel" style={{ minHeight: "auto" }}>
      <div className="panel-header" style={{ paddingBottom: "8px" }}>
        <div className="panel-title" style={{ fontSize: "13px", fontWeight: 600 }}>Stars Distribution</div>
      </div>

      <div style={{ padding: "10px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
          {topCategories.map((cat) => {
            const percentage = total > 0 ? (cat.total_stars / total) * 100 : 0;
            const color = CATEGORY_COLORS[cat.category] ?? "#6b7280";
            const icon = CATEGORY_ICONS[cat.category] ?? "📌";
            const isHovered = hovered === cat.category;

            return (
              <div
                key={cat.category}
                onMouseEnter={() => setHovered(cat.category)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  background: isHovered ? `${color}08` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isHovered ? `${color}30` : "rgba(255,255,255,0.08)"}`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  transform: isHovered ? "scale(1.03)" : "scale(1)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "16px" }}>{icon}</span>
                  <div style={{ fontSize: "12px", fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>
                    {percentage.toFixed(0)}%
                  </div>
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: 1.2, marginBottom: "3px" }}>
                  {cat.category}
                </div>
                <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                  {cat.total_stars.toLocaleString()} ⭐
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
