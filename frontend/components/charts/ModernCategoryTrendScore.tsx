"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
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

function trendColor(score: number): string {
  if (score >= 0.65) return "#84cc16"; // HIGH - Green
  if (score >= 0.4) return "#f59e0b"; // MID - Orange/Amber
  return "#6e7681"; // LOW - Grey
}

function getTrendLabel(score: number): string {
  if (score >= 0.65) return "HIGH";
  if (score >= 0.4) return "MID";
  return "LOW";
}

function getChakraClass(category: string): string {
  const norm = (category || "").trim();
  if (norm === "Agent Frameworks") return "chakra-fire";
  if (norm === "AI / ML") return "chakra-lightning";
  if (norm === "LLM Models") return "chakra-wind";
  if (norm === "DevTools") return "chakra-earth";
  if (norm === "Data & Infra") return "chakra-water";
  return "chakra-void";
}

function SignalDot({ label }: { label: string }) {
  if (label === "HIGH") {
    return (
      <span className="signal-container" title="High Priority alert. Konoha Leaf.">
        <span className="signal-high-glow"></span>
        <svg viewBox="0 0 24 24" width="8" height="8" fill="#639922" stroke="none" style={{ position: "relative", zIndex: 1 }}>
          <path d="M12,4 C7.58,4 4,7.58 4,12 C4,16.42 7.58,20 12,20 C14,20 15.8,19.2 17.2,17.8 L18.5,19.1 C16.8,20.9 14.5,22 12,22 C6.48,22 2,17.52 2,12 C2,6.48 6.48,2 12,2 C17,2 20.5,5 21,5.5 L18,8.5 L22,9 L21.5,5 L19.5,7 C18.2,5.2 15.2,4 12,4 Z" fill="#639922" />
          <path d="M12,8 C9.79,8 8,9.79 8,12 C8,14.21 9.79,16 12,16 C13.5,16 14.8,15.2 15.5,14 L13.5,13 C13.2,13.6 12.6,14 12,14 C10.9,14 10,13.1 10,12 C10,10.9 10.9,10 12,10 C13.1,10 14,10.9 14,12" fill="none" stroke="#639922" strokeWidth="1.8" />
          <path d="M5,19 L3,21" stroke="#639922" strokeWidth="2" />
        </svg>
      </span>
    );
  }
  if (label === "MID") {
    return (
      <span className="signal-container" title="Medium alert. Sand Gourd.">
        <svg viewBox="0 0 24 24" width="8" height="8" fill="#BA7517" stroke="none">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#BA7517" strokeWidth="2" />
          <path d="M12,5 C10,5 9,7 9,9 C9,11 11,11.5 11,12 C11,12.5 9,13 9,15 C9,17 10,19 12,19 C14,19 15,17 15,15 C15,13 13,12.5 13,12 C13,11.5 15,11 15,9 C15,7 14,5 12,5 Z" fill="#BA7517" />
        </svg>
      </span>
    );
  }
  return (
    <span className="signal-container" title="Low alert. Scratched Headband.">
      <svg viewBox="0 0 24 24" width="8" height="8" fill="none">
        <rect x="2" y="6" width="20" height="12" rx="1.5" fill="var(--color-border-secondary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
        <circle cx="5" cy="12" r="1" fill="var(--color-text-secondary)" />
        <circle cx="19" cy="12" r="1" fill="var(--color-text-secondary)" />
        <line x1="4" y1="8" x2="20" y2="16" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return String(num);
}

interface ModernCategoryTrendScoreProps {
  data: CategoryMetrics[];
  period: Period;
}

export function ModernCategoryTrendScore({
  data,
  period,
}: ModernCategoryTrendScoreProps) {
  const router = useRouter();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "stars">("score");
  const [animated, setAnimated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const chartData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === "stars") {
        return b.period_star_gain - a.period_star_gain;
      }
      return b.trend_composite - a.trend_composite;
    });
  }, [data, sortBy]);

  const top12Categories = useMemo(() => chartData.slice(0, 12), [chartData]);

  const displayedCategories = useMemo(() => {
    return isExpanded ? top12Categories : top12Categories.slice(0, 6);
  }, [top12Categories, isExpanded]);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
              Category trend score · {periodLabel}
            </span>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "x 10px",
              fontSize: "11px",
              color: "var(--text-muted)",
              rowGap: "4px",
              columnGap: "10px",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#84cc16", flexShrink: 0 }} />Stars 40%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#818cf8", flexShrink: 0 }} />Acceleration 20%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#06b6d4", flexShrink: 0 }} />Contributors 20%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />Releases 10%</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />Issues 10%</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {/* Legend */}
            <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#84cc16" }} />High</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />Mid</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6e7681" }} />Low</span>
            </div>

            {/* Toggle Sort Buttons */}
            <div style={{ display: "flex", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "2px", borderRadius: "6px" }}>
              <button
                onClick={() => setSortBy("score")}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: sortBy === "score" ? "rgba(255,255,255,0.08)" : "transparent",
                  color: sortBy === "score" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                Score
              </button>
              <button
                onClick={() => setSortBy("stars")}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: sortBy === "stars" ? "rgba(255,255,255,0.08)" : "transparent",
                  color: sortBy === "stars" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                Stars ⬆
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
        {displayedCategories.map((item, idx) => {
          const isHovered = hoveredCategory === item.category;
          const label = getTrendLabel(item.trend_composite);
          const percentage = item.trend_composite * 100;

          return (
            <div
              key={item.category}
              className="trend-row"
              onMouseEnter={() => setHoveredCategory(item.category)}
              onMouseLeave={() => setHoveredCategory(null)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 0",
                opacity: hoveredCategory === null || isHovered ? 1 : 0.4,
                transition: "opacity 0.2s ease",
                gap: "8px",
              }}
            >
              {/* Title & Repos Count */}
              <div style={{ minWidth: 0, flexBasis: "130px", flexShrink: 1, display: "flex", flexDirection: "column" }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "#ffffff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }} title={item.category}>
                  {item.category}
                </span>
                <span style={{
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  marginTop: "1px",
                }}>
                  {item.repo_count}r
                </span>
              </div>

              {/* Thin Progress Bar */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
                <div className="chakra-bar-container">
                  <div
                    className={`chakra-bar-fill ${getChakraClass(item.category)}`}
                    style={{
                      width: animated ? `${percentage}%` : "0%",
                    }}
                  />
                </div>
              </div>

              {/* Right Side Values */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                {/* Score Percentage */}
                <span style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#ffffff",
                  fontFamily: "var(--font-mono)",
                  minWidth: "32px",
                  textAlign: "right",
                }}>
                  {percentage.toFixed(0)}%
                </span>

                {/* Score Level Badge */}
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  minWidth: "44px",
                }}>
                  <SignalDot label={label} />
                  {label.toLowerCase()}
                </span>

                {/* Star Gained — hidden on very small screens via CSS */}
                <span className="trend-stars-col" style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#2ea043",
                  fontFamily: "var(--font-mono)",
                  minWidth: "54px",
                  textAlign: "right",
                }}>
                  +{formatNumber(item.period_star_gain)}
                </span>
              </div>
            </div>
          );
        })}

        {top12Categories.length > 6 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "6px" }}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 600,
                padding: "6px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "rgba(255, 255, 255, 0.02)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              {isExpanded ? "Show Less ▴" : "Show All ▾"}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
          Hover any row for score breakdown · Updated 12 min ago
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            onClick={() => router.push("/leaderboard")}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Drill down ↗
          </button>
          <button 
            onClick={() => router.push("/radar")}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Acceleration leaders ↗
          </button>
        </div>
      </div>

      <style>{`
        .trend-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .trend-row:hover {
          background: rgba(255, 255, 255, 0.03);
          transform: translateX(4px);
        }
        /* Hide star-gain column on very narrow screens */
        @media (max-width: 480px) {
          .trend-stars-col { display: none !important; }
        }
      `}</style>
    </div>
  );
}
