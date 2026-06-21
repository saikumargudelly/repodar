"use client";

import { useState, useMemo, useEffect } from "react";
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

interface ModernPRChartProps {
  data: CategoryMetrics[];
  period: Period;
}

interface LollipopDataPoint {
  category: string;
  totalPRs: number; // merged
  avgOpenPRs: number; // open
  color: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2).replace(/\.00$/, "")}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return String(num.toFixed(1).replace(/\.0$/, ""));
}

export function ModernPRChart({ data, period }: ModernPRChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

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
        .map((cat) => ({
          category: cat.category,
          totalPRs: cat.total_merged_prs,
          avgOpenPRs: cat.avg_open_prs,
          color: CATEGORY_COLORS[cat.category] ?? "#6b7280",
        })),
    [data]
  );

  useEffect(() => {
    setAnimated(true);
  }, []);

  return (
    <div className="panel bento-card-row3" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="header-container-animate">
            <div className="header-icon-animate" style={{ color: "#34d399", display: "flex", alignItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 15V9a4 4 0 0 0-4-4H9" />
                <line x1="6" y1="9" x2="6" y2="15" />
              </svg>
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>PR activity</span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--text-muted)",
              textAlign: "right",
            }}
          >
            {periodLabel} · merged vs open
          </span>
        </div>
      </div>

      <div className="bento-scroll-content" style={{ padding: "16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
        {chartData.map((item, idx) => {
          const isHovered = hoveredCategory === item.category;

          return (
            <div
              key={item.category}
              className="pr-row"
              onMouseEnter={() => setHoveredCategory(item.category)}
              onMouseLeave={() => setHoveredCategory(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 6px",
                borderRadius: "8px",
                opacity: hoveredCategory === null || isHovered ? 1 : 0.4,
              }}
            >
              {/* Category Bullet and Name */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                <span
                  className="bullet-dot"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: item.color,
                    color: item.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={item.category}
                >
                  {item.category}
                </span>
              </div>

              {/* Merged PRs count */}
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "nowrap",
                  textAlign: "right",
                  flexShrink: 0,
                  minWidth: "64px",
                }}
              >
                {formatNumber(item.totalPRs)} merged
              </span>

              {/* Open PRs count — hidden on very small screens */}
              <span
                className="pr-open-col"
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "nowrap",
                  textAlign: "right",
                  flexShrink: 0,
                  minWidth: "52px",
                }}
              >
                {formatNumber(item.avgOpenPRs)} open
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes prFloat {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) scale(1.1) rotate(-5deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        .header-container-animate:hover .header-icon-animate {
          animation: prFloat 0.8s ease-in-out infinite;
        }
        .pr-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pr-row:hover {
          background: rgba(255, 255, 255, 0.03);
          transform: translateX(4px);
        }
        .pr-row:hover .bullet-dot {
          transform: scale(1.3);
          box-shadow: 0 0 8px currentColor;
        }
        .pr-row .bullet-dot {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        /* Hide open PRs column on very narrow screens */
        @media (max-width: 420px) {
          .pr-open-col { display: none !important; }
        }
      `}</style>
    </div>
  );
}
