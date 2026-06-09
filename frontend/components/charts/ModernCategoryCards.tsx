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

interface ModernCategoryCardsProps {
  data: CategoryMetrics[];
}

export function ModernCategoryCards({ data }: ModernCategoryCardsProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const total = useMemo(() => data.reduce((s, c) => s + c.total_stars, 0), [data]);
  const sortedData = useMemo(
    () => [...data].sort((a, b) => b.total_stars - a.total_stars),
    [data]
  );
  const topCategories = useMemo(() => sortedData.slice(0, 6), [sortedData]);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">Stars Distribution</div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "3px",
            }}
          >
            {total.toLocaleString()} total stars across{" "}
            {data.length} categories
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px", flex: 1 }}>
        {/* Top 6 categories as interactive cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          {topCategories.map((cat) => {
            const percentage = total > 0 ? (cat.total_stars / total) * 100 : 0;
            const color = CATEGORY_COLORS[cat.category] ?? "#6b7280";
            const icon = CATEGORY_ICONS[cat.category] ?? "📌";
            const isHovered = hoveredCategory === cat.category;
            const isSelected = selectedCategory === cat.category;

            return (
              <div
                key={cat.category}
                onMouseEnter={() => setHoveredCategory(cat.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: isSelected
                    ? `${color}18`
                    : isHovered
                    ? `${color}10`
                    : "rgba(255, 255, 255, 0.02)",
                  border: `1.2px solid ${
                    isSelected ? `${color}50` : isHovered ? `${color}30` : "rgba(255, 255, 255, 0.06)"
                  }`,
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "scale(1.04) translateY(-1px)" : "scale(1)",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: isHovered ? `0 4px 12px ${color}12` : "none",
                }}
              >
                {/* Animated background gradient */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "80px",
                    height: "80px",
                    background: `radial-gradient(circle, ${color}20, transparent)`,
                    borderRadius: "50%",
                    transform: `translate(${isHovered ? "0px" : "20px"}, ${
                      isHovered ? "-10px" : "0px"
                    })`,
                    transition: "transform 0.4s ease-out",
                    pointerEvents: "none",
                  }}
                />

                {/* Content */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  {/* Header with icon and category name */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "7px",
                      marginBottom: "8px",
                      transition: "transform 0.2s ease",
                      transform: isHovered ? "translateY(-1px)" : "translateY(0)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "18px",
                        lineHeight: "1",
                        display: "inline-block",
                        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        transform: isHovered ? "scale(1.2) rotate(8deg)" : "scale(1) rotate(0deg)",
                        transformOrigin: "center",
                      }}
                    >
                      {icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          lineHeight: "1.2",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {cat.category}
                      </div>
                      <div
                        style={{
                          fontSize: "9px",
                          color: "var(--text-muted)",
                          marginTop: "1px",
                          opacity: 0.7,
                        }}
                      >
                        #{sortedData.indexOf(cat) + 1}
                      </div>
                    </div>
                  </div>

                  {/* Large percentage */}
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: color,
                      marginBottom: "1px",
                      fontFamily: "var(--font-mono)",
                      transition: "font-size 0.2s ease",
                    }}
                  >
                    {percentage.toFixed(1)}%
                  </div>

                  {/* Stars count and repos */}
                  <div
                    style={{
                      fontSize: "9px",
                      color: "var(--text-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--font-mono)",
                      marginBottom: "7px",
                      gap: "4px",
                    }}
                  >
                    <span>{cat.total_stars > 999 ? `${(cat.total_stars / 1000).toFixed(1)}k` : cat.total_stars}⭐</span>
                    <span>{cat.repo_count}r</span>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      height: "3px",
                      background: "rgba(255, 255, 255, 0.08)",
                      borderRadius: "1.5px",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        background: `linear-gradient(90deg, ${color}40, ${color}80)`,
                        width: `${percentage}%`,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        borderRadius: "1.5px",
                        boxShadow: isHovered ? `0 0 6px ${color}60` : "none",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest of categories as compact list */}
        {sortedData.length > 6 && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Other Categories
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "8px",
              }}
            >
              {sortedData.slice(6).map((cat) => {
                const percentage = total > 0 ? (cat.total_stars / total) * 100 : 0;
                const color = CATEGORY_COLORS[cat.category] ?? "#6b7280";
                return (
                  <div
                    key={cat.category}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {cat.category}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
