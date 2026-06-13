"use client";

import { useState, useMemo, useEffect } from "react";
import { CategoryMetrics } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  "LLM Models": "#a78bfa",
  "Agent Frameworks": "#818cf8",
  "Inference Engines": "#f59e0b",
  "Vector Databases": "#10b981",
  "Model Serving / Runtimes": "#06b6d4",
  "Distributed Compute / Infra": "#f97316",
  "Evaluation Frameworks": "#84cc16",
  "Fine-tuning Toolkits": "#ec4899",
  "AI / ML": "#818cf8",
  "DevTools": "#38bdf8",
  "Web Frameworks": "#34d399",
  "Web & Mobile": "#818cf8",
  "Security": "#f87171",
  "Data Engineering": "#34d399",
  "Data & Infra": "#34d399",
  "Blockchain": "#fbbf24",
  "OSS Tools": "#fb923c",
  "Science & Research": "#84cc16",
  "Creative & Gaming": "#ec4899",
};

// SVG GitHub Octicon-style icons for each category
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "LLM Models": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
    </svg>
  ),
  "Agent Frameworks": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M12 7.5V13a2 2 0 0 1-2 2H7.5M12 13a2 2 0 0 0 2 2h4.5" />
    </svg>
  ),
  "Inference Engines": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  "Vector Databases": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  "Model Serving / Runtimes": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
  "Distributed Compute / Infra": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  "Evaluation Frameworks": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 11 2 2 4-4" />
    </svg>
  ),
  "Fine-tuning Toolkits": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="2" y1="14" x2="6" y2="14" />
      <line x1="10" y1="8" x2="14" y2="8" />
      <line x1="18" y1="16" x2="22" y2="16" />
    </svg>
  ),
  "AI / ML": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-7.88A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-7.88A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  ),
  "DevTools": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  "Web Frameworks": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  "Web & Mobile": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  "Security": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  "Data Engineering": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  "Data & Infra": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  "Blockchain": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  "OSS Tools": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  "Science & Research": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12M12 3v14M9 21h6M5 8h14M10 3a2 2 0 0 1-2 2M14 3a2 2 0 0 0 2 2" />
    </svg>
  ),
  "Creative & Gaming": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <circle cx="15.5" cy="10.5" r="1" />
      <circle cx="18.5" cy="13.5" r="1" />
    </svg>
  ),
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return String(num);
}

interface ModernCategoryCardsProps {
  data: CategoryMetrics[];
}

export function ModernCategoryCards({ data }: ModernCategoryCardsProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

  const total = useMemo(() => data.reduce((s, c) => s + c.total_stars, 0), [data]);
  const sortedData = useMemo(
    () => [...data].sort((a, b) => b.total_stars - a.total_stars),
    [data]
  );
  const top8Categories = useMemo(() => sortedData.slice(0, 8), [sortedData]);

  // Trigger animation after mount
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="header-container-animate">
            <div className="header-icon-animate" style={{ color: "#fbbf24", display: "flex", alignItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", lineHeight: "1.2" }}>Stars</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", lineHeight: "1.2" }}>distribution</span>
            </div>
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--text-muted)",
              textAlign: "right",
              lineHeight: "1.4",
            }}
          >
            <div>{formatNumber(total)} across {data.length}</div>
            <div>categories</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
        {top8Categories.map((cat, idx) => {
          const percentage = total > 0 ? (cat.total_stars / total) * 100 : 0;
          const color = CATEGORY_COLORS[cat.category] ?? "#6b7280";
          const icon = CATEGORY_ICONS[cat.category] ?? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          );
          const isHovered = hoveredCategory === cat.category;

          return (
            <div
              key={cat.category}
              className="distribution-row"
              onMouseEnter={() => setHoveredCategory(cat.category)}
              onMouseLeave={() => setHoveredCategory(null)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "7px 6px",
                borderRadius: "8px",
                gap: "6px",
                opacity: hoveredCategory === null || isHovered ? 1 : 0.4,
              }}
            >
              {/* Rank */}
              <span style={{
                width: "14px",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                flexShrink: 0,
              }}>
                {idx + 1}
              </span>

              {/* Icon Container */}
              <div
                className="icon-box"
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "6px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isHovered ? "var(--text-primary)" : "var(--text-secondary)",
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                }}
              >
                {icon}
              </div>

              {/* Title — flex grows and truncates */}
              <span style={{
                flex: 1,
                minWidth: 0,
                fontWeight: 600,
                fontSize: "12px",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={cat.category}>
                {cat.category}
              </span>

              {/* Progress Bar */}
              <div style={{ width: "60px", flexShrink: 0, height: "4px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "2px", overflow: "hidden", position: "relative" }}>
                <div
                  style={{
                    height: "100%",
                    background: isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.7)",
                    width: animated ? `${percentage}%` : "0%",
                    transition: "width 1.2s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.2s ease",
                    boxShadow: isHovered ? "0 0 6px rgba(255, 255, 255, 0.5)" : "none",
                    borderRadius: "2px",
                  }}
                />
              </div>

              {/* Value Percentage */}
              <span style={{
                width: "40px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-primary)",
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                flexShrink: 0,
              }}>
                {percentage.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes starPulse {
          0% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.2) rotate(15deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .header-container-animate:hover .header-icon-animate {
          animation: starPulse 0.8s ease-in-out infinite;
        }
        .distribution-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .distribution-row:hover {
          background: rgba(255, 255, 255, 0.03);
          transform: translateX(4px);
        }
        .distribution-row:hover .icon-box {
          border-color: var(--text-primary);
          background: var(--bg-dim);
        }
        .distribution-row:hover .icon-box svg {
          transform: scale(1.15) rotate(8deg);
        }
        .distribution-row .icon-box svg {
          transition: transform 0.2s ease;
        }
      `}</style>
    </div>
  );
}
