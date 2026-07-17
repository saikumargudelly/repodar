"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/lib/useAuthSession";
import { useUnreadAlerts } from "@/lib/useUnreadAlerts";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from "recharts";
import {
  api, Period, Vertical, CategoryMetrics, SustainabilityEntry, LeaderboardEntry,
  RadarRepo, AlertResponse,
} from "@/lib/api";
import { StatusDot } from "@/components/ui/StatusDot";
import { ModernCategoryCards } from "@/components/charts/ModernCategoryCards";
import { ModernPRChart } from "@/components/charts/ModernPRChart";
import { ModernCategoryTrendScore } from "@/components/charts/ModernCategoryTrendScore";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCompactNumber } from "@/lib/utils";
import { categoryColor as getCategoryColor } from "@/lib/chartColors";


const C = {
  bg: "var(--bg-primary)",
  bgCard: "var(--bg-surface)",
  bgHover: "var(--bg-elevated)",
  border: "var(--border)",
  text: "var(--text-primary)",
  textSub: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  green: "var(--accent-green)",
  amber: "var(--accent-yellow)",
  red: "var(--accent-red)",
};

// CATEGORY_COLORS is now derived from unified getCategoryColor theme helper

const PERIODS: { key: Period; label: string }[] = [
  { key: "1d", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "1M" },
  { key: "90d", label: "3M" },
  { key: "365d", label: "1Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
];

const VERTICALS: { key: Vertical; label: string }[] = [
  { key: "ai_ml", label: "AI / ML" },
  { key: "devtools", label: "DevTools" },
  { key: "web_mobile", label: "Web & Mobile" },
  { key: "data_infra", label: "Data & Infra" },
  { key: "security", label: "Security" },
  { key: "blockchain", label: "Blockchain" },
  { key: "oss_tools", label: "OSS Tools" },
  { key: "science", label: "Science" },
  { key: "creative", label: "Creative" },
];

// ─── Watchlist hook (localStorage) ───────────────────────────────────────────

interface WatchlistItem {
  repo_id: string;
  owner: string;
  name: string;
  github_url: string;
}

function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("repodar_watchlist");
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const save = useCallback((next: WatchlistItem[]) => {
    setItems(next);
    localStorage.setItem("repodar_watchlist", JSON.stringify(next));
  }, []);

  const toggle = useCallback((item: WatchlistItem) => {
    setItems((prev) => {
      const exists = prev.some((x) => x.repo_id === item.repo_id);
      const next = exists ? prev.filter((x) => x.repo_id !== item.repo_id) : [...prev, item];
      localStorage.setItem("repodar_watchlist", JSON.stringify(next));
      return next;
    });
  }, []);

  const isPinned = useCallback((repo_id: string) => items.some((x) => x.repo_id === repo_id), [items]);
  return { items, toggle, isPinned, save };
}

function StatCard({ label, value, sub, index = 0, href, trend = "neutral" }: { label: string; value: string | number; sub?: string; index?: number; href?: string; trend?: "up" | "down" | "neutral" }) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  // Responsive font size via JS (CSS can't reach inline styles easily)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const isTiny = typeof window !== "undefined" && window.innerWidth <= 420;

  const colors = ["var(--accent-blue)", "var(--accent-green)", "var(--accent-yellow)", "var(--accent-green)"];
  const color = colors[index];

  const svgIcons = [
    // Card 1: Package
    <svg key="pkg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08" />
      <polygon points="12 12 21 6.92 21 17.08 12 22.08" />
      <polygon points="12 12 3 6.92 12 1.84 21 6.92 12 12" />
      <path d="M12 22V12" />
    </svg>,
    // Card 2: Trophy
    <svg key="trph" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
      <path d="M12 2a6 6 0 0 1 6 6v3.5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z" />
    </svg>,
    // Card 3: Rocket
    <svg key="rkt" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
      <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5" />
      <path d="M12 2c1.5 2 2.5 4 2.5 6 0 1-.5 1.5-1.5 1.5s-4-1-6-2.5c-2-1.5-3-2.5-3-3.5 0-1 .5-1.5 1.5-1.5 2 0 4 1 6 2.5Z" />
      <path d="M12 2s4 1.5 6 3.5c1.5 1.5 2.5 3 2.5 4.5 0 1-.5 1.5-1.5 1.5s-3-1-4.5-2.5c-1.5-1.5-2.5-3-2.5-7Z" />
      <path d="M9 15 3 21" />
      <path d="m15 9 6-6" />
    </svg>,
    // Card 4: Shield Check
    <svg key="chk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ];

  const subTextColor = trend === "up" ? "var(--accent-green)" : trend === "down" ? "var(--accent-red)" : "var(--text-muted)";
  
  // Dynamically calculate font size based on the value's string length
  const getFontSize = (val: string | number) => {
    const str = String(val);
    if (str.length > 20) {
      return isMobile ? "clamp(10px, 2.5vw, 12px)" : "clamp(12px, 1.2vw, 15px)";
    }
    if (str.length > 15) {
      return isMobile ? "clamp(11px, 3vw, 14px)" : "clamp(13px, 1.5vw, 18px)";
    }
    if (str.length > 11) {
      return isMobile ? "clamp(12px, 3.2vw, 16px)" : "clamp(15px, 1.8vw, 21px)";
    }
    return isMobile ? "clamp(13px, 3.5vw, 18px)" : "clamp(16px, 2vw, 24px)";
  };
  const fontSize = getFontSize(value);

  return (
    <div
      className="kpi-card card-pad"
      onClick={href ? () => router.push(href) : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        cursor: href ? "pointer" : "default",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isHovered ? "translateY(-1px)" : "translateY(0)",
        borderLeftColor: isHovered ? "var(--text-secondary)" : "var(--border)",
        borderRightColor: isHovered ? "var(--text-secondary)" : "var(--border)",
        borderBottomColor: isHovered ? "var(--text-secondary)" : "var(--border)",
        borderTop: `3px solid ${color}`,
        boxShadow: isHovered ? `0 4px 16px ${color}18` : "none",
        position: "relative",
      }}
    >
      {/* Icon + Label */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", color: "var(--text-muted)" }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          transition: "transform 0.3s ease",
          transform: isHovered ? "scale(1.15)" : "scale(1)",
          flexShrink: 0,
        }}>
          {svgIcons[index]}
        </span>
        <div className="kpi-label" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      </div>

      {/* Value */}
      <div 
        className="kpi-value"
        title={String(value)}
        style={{
          color: "var(--text-primary)",
          fontSize: fontSize,
          fontWeight: 700,
          fontFamily: "var(--font-sans)",
          transition: "all 0.2s ease",
          opacity: 0.95,
          marginBottom: "4px",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          overflow: "hidden",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>

      {/* Sub text */}
      {sub && (
        <div className="kpi-sub" style={{
          fontSize: "11px",
          fontWeight: 600,
          color: subTextColor,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          marginTop: "auto", // Push subtext to the bottom to maintain visual alignment
        }}>
          {index === 2 && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
        </div>
      )}
    </div>
  );
}

function PeriodSelector({ selected, onChange }: { selected: Period; onChange: (p: Period) => void }) {
  return (
    <div className="period-selector-scroll">
      {PERIODS.map(({ key, label }) => {
        const active = selected === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
              transition: "all 0.15s",
              background: "transparent",
              border: `1px solid ${active ? C.text : C.border}`,
              color: active ? C.text : C.textSub,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.color = C.text;
                e.currentTarget.style.borderColor = C.textSub;
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.color = C.textSub;
                e.currentTarget.style.borderColor = C.border;
              }
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function VerticalSelector({
  selected,
  onChange,
  userVerticals = [],
  showMine,
  setShowMine,
}: {
  selected: Vertical;
  onChange: (v: Vertical) => void;
  userVerticals?: string[];
  showMine: boolean;
  setShowMine: (v: boolean) => void;
}) {
  const favorites = userVerticals.length > 0
    ? userVerticals
    : ["ai_ml", "devtools", "web_mobile", "oss_tools"];

  const displayed = showMine
    ? VERTICALS.filter((v) => favorites.includes(v.key))
    : VERTICALS;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", overflowX: "auto", padding: "2px 0" }} className="scroll-selector">
      {/* Mine Toggle Switch */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "6px", flexShrink: 0 }}>
        <div
          onClick={() => setShowMine(!showMine)}
          style={{
            width: "36px",
            height: "20px",
            borderRadius: "10px",
            background: showMine ? "var(--accent-blue)" : C.border,
            position: "relative",
            cursor: "pointer",
            transition: "background-color 0.2s",
            border: `1px solid ${showMine ? "var(--accent-blue)" : C.border}`,
          }}
        >
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              background: "#ffffff",
              position: "absolute",
              top: "2px",
              left: showMine ? "18px" : "2px",
              transition: "left 0.2s, background-color 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            }}
          />
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: showMine ? C.text : C.textSub, fontWeight: 600, userSelect: "none" }}>
          Mine
        </span>
      </div>

      {/* Category Pills */}
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        {displayed.map(({ key, label }) => {
          const active = selected === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
                transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                background: active ? "rgba(255, 255, 255, 0.08)" : C.bgCard,
                border: `1px solid ${active ? C.text : C.border}`,
                color: active ? C.text : C.textSub,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = C.textSub;
                  e.currentTarget.style.color = C.text;
                  e.currentTarget.style.transform = "translateY(-1.5px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.color = C.textSub;
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trend score colour (high=green, mid=amber, low=slate) ─────────────────
// ─── Chart 1: Category Trend Score (replaced with ModernCategoryTrendScore) ──

function trendColor(score: number): string {
  if (score >= 0.65) return "#22c55e";
  if (score >= 0.40) return "#f59e0b";
  return "#6b7280";
}

// ─── Chart 2: Stars Distribution (replaced with ModernCategoryCards) ────────

// ─── Chart 3: PR Activity (replaced with ModernPRChart) ─────────────────────

function LeaderboardTable({
  entries,
  period,
  isLoading,
  isPinned,
  onTogglePin,
}: {
  entries: LeaderboardEntry[];
  period: Period;
  isLoading: boolean;
  isPinned: (repo_id: string) => boolean;
  onTogglePin: (entry: LeaderboardEntry) => void;
}) {
  const router = useRouter();
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"stars" | "forks" | "issues" | "age">("stars");

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  // Local helper to format large numbers
  const formatNum = (num: number): string => {
    return formatCompactNumber(num);
  };

  // Local helper to format stars change
  const formatStarsChange = (num: number | string | null | undefined): string => {
    if (num === null || num === undefined) return "";
    const parsed = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(parsed)) return String(num);
    return `+${formatNum(parsed)}`;
  };

  // Local helper to style language badges
  const getLangBadgeStyle = (lang: string) => {
    const l = lang.toLowerCase();
    if (l === "typescript" || l === "javascript") {
      return { background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.2)" };
    }
    if (l === "rust") {
      return { background: "rgba(249, 115, 22, 0.12)", color: "#f97316", border: "1px solid rgba(249, 115, 22, 0.2)" };
    }
    if (l === "go" || l === "golang") {
      return { background: "rgba(6, 182, 212, 0.12)", color: "#06b6d4", border: "1px solid rgba(6, 182, 212, 0.2)" };
    }
    if (l === "python") {
      return { background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.2)" };
    }
    return { background: "rgba(255, 255, 255, 0.04)", color: "var(--text-secondary)", border: "1px solid rgba(255, 255, 255, 0.08)" };
  };

  // Compute category list dynamically from entries
  const categories = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return ["All", ...Array.from(set).slice(0, 3)];
  }, [entries]);

  // Filter and Sort logic
  const processedEntries = useMemo(() => {
    let result = [...entries];

    // Search Query Filter
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.owner.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q))
      );
    }

    // Category Filter
    if (selectedCategory !== "All") {
      result = result.filter((e) => e.category === selectedCategory);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "forks") {
        return b.current_forks - a.current_forks;
      }
      if (sortBy === "issues") {
        return (b.open_issues ?? 0) - (a.open_issues ?? 0);
      }
      if (sortBy === "age") {
        return b.age_days - a.age_days;
      }
      return b.current_stars - a.current_stars;
    });

    return result;
  }, [entries, filterQuery, selectedCategory, sortBy]);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div className="top-repos-title-row">
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
            Top repos · {periodLabel}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "10px",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: "20px",
              background: "rgba(34, 197, 94, 0.12)",
              color: "#22c55e",
              border: "1px solid rgba(34, 197, 94, 0.2)",
              lineHeight: 1,
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Live
            </span>
            <button style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}>
              GitHub Search API
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Sort Row */}
      <div className="lb-filter-row">
        {/* Search */}
        <div className="lb-filter-search">
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: "10px", color: "var(--text-muted)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Filter repos…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                padding: "6px 10px 6px 30px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--text-primary)",
                outline: "none",
                width: "140px",
                minWidth: 0,
                transition: "width 0.2s ease, border-color 0.2s ease",
              }}
              onFocus={(e) => { e.currentTarget.style.width = "190px"; e.currentTarget.style.borderColor = "var(--text-muted)"; }}
              onBlur={(e) => { if (!filterQuery) { e.currentTarget.style.width = "140px"; } e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="lb-filter-pills">
          {categories.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: "16px",
                cursor: "pointer",
                transition: "all 0.15s",
                border: "1px solid var(--border)",
                background: selectedCategory === cat ? "#ffffff" : "transparent",
                color: selectedCategory === cat ? "var(--bg-primary)" : "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Buttons */}
        <div className="lb-filter-sort">
          {[
            { key: "stars", label: "Stars", icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ) },
            { key: "forks", label: "Forks", icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 15V9a4 4 0 0 0-4-4H9" />
                <line x1="6" y1="9" x2="6" y2="15" />
              </svg>
            ) },
            { key: "issues", label: "Issues", icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) },
            { key: "age", label: "Age", icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ) },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key as any)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s",
                border: "1px solid var(--border)",
                background: sortBy === s.key ? "var(--accent-blue)" : "transparent",
                color: sortBy === s.key ? "var(--bg-primary)" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center" }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "32px", textAlign: "center", fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "13px" }}>
          Searching GitHub…
        </div>
      ) : processedEntries.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "13px" }}>
          No repositories found matching filters.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: "var(--font-sans)" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              {/* rank */}<th style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>#</th>
              {/* repo */}<th style={{ padding: "9px 12px", fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>Repo</th>
              {/* category */}<th className="col-hide-mobile" style={{ padding: "9px 12px", fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>Category</th>
              {/* stars */}<th style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>Stars</th>
              {/* forks */}<th className="col-hide-tablet" style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>Forks</th>
              {/* issues */}<th className="col-hide-tablet" style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>Issues</th>
              {/* age */}<th className="col-hide-tablet" style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>Age</th>
              {/* pin */}<th style={{ padding: "9px 12px", width: "32px" }} />
            </tr>
          </thead>
          <tbody>
            {processedEntries.map((repo: LeaderboardEntry, idx: number) => {
              const pinned = isPinned(repo.repo_id);
              const years = Math.max(1, Math.round(repo.age_days / 365));
              const agePercentage = Math.min((repo.age_days / (365 * 12)) * 100, 100);
              const categoryColor = getCategoryColor(repo.category);

              return (
                <tr
                  key={repo.repo_id}
                  className="repo-row"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                  }}
                >

                  {/* Rank */}
                  <td
                    style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-muted)", width: "40px", verticalAlign: "top", cursor: "pointer", fontFamily: "var(--font-mono)" }}
                    onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                  >
                    {idx + 1}
                  </td>

                  {/* Repo Details */}
                  <td
                    className="repo-details-col"
                    onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span className="repo-name" style={{ color: "var(--text-primary)", fontSize: "14px" }}>
                          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{repo.owner}/</span>
                          <span style={{ fontWeight: 700 }}>{repo.name}</span>
                        </span>
                        {repo.primary_language && (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            lineHeight: 1,
                            ...getLangBadgeStyle(repo.primary_language)
                          }}>
                            {repo.primary_language}
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {repo.description}
                        </span>
                      )}
                      {repo.topics && repo.topics.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                          {repo.topics.slice(0, 4).map((t: string) => (
                            <span key={t} style={{
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              background: "rgba(255, 255, 255, 0.04)",
                              border: "1px solid var(--border)",
                              padding: "1px 5px",
                              borderRadius: "3px"
                            }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Category Pill */}
                  <td className="col-hide-mobile" style={{ padding: "12px 12px", verticalAlign: "top" }}>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "20px",
                      background: `${categoryColor}15`,
                      color: categoryColor,
                      border: `1.2px solid ${categoryColor}25`,
                      display: "inline-block",
                      whiteSpace: "nowrap",
                    }}>
                      {repo.category}
                    </span>
                  </td>

                  {/* Stars / Stars gained */}
                  <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: "var(--font-mono)", verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "13px" }}>
                        {formatNum(repo.current_stars)}
                      </span>
                      {repo.star_gain_label && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#22c55e" }}>
                          {formatStarsChange(repo.star_gain_label)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Forks */}
                  <td className="col-hide-tablet" style={{ padding: "12px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)", verticalAlign: "top" }}>
                    {formatNum(repo.current_forks)}
                  </td>

                  {/* Issues */}
                  <td className="col-hide-tablet" style={{ padding: "12px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)", verticalAlign: "top" }}>
                    {repo.open_issues != null ? repo.open_issues.toLocaleString() : "—"}
                  </td>

                  {/* Age relative bar */}
                  <td className="col-hide-tablet" style={{ padding: "12px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)", verticalAlign: "top" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                      <span>{years}y</span>
                      <div style={{ width: "24px", height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "1.5px", overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ height: "100%", background: "rgba(255,255,255,0.4)", width: `${agePercentage}%` }} />
                      </div>
                    </div>
                  </td>

                  {/* Pin watchlist */}
                  <td style={{ padding: "12px 12px", verticalAlign: "top", width: "32px" }}>
                    <button
                      onClick={() => onTogglePin(repo)}
                      title={pinned ? "Remove from watchlist" : "Add to watchlist"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "16px",
                        opacity: pinned ? 1 : 0.2,
                        color: pinned ? "var(--accent-yellow)" : "var(--text-muted)",
                        transition: "opacity 0.15s, color 0.15s",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--accent-yellow)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = pinned ? "1" : "0.2"; e.currentTarget.style.color = pinned ? "var(--accent-yellow)" : "var(--text-muted)"; }}
                    >
                      ★
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}




    </div>
  );
}

function SustainabilityRanking({ repos }: { repos: SustainabilityEntry[] }) {
  const router = useRouter();
  return (
    <div className="panel bento-card-row2" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div className="panel-title">Sustainability Ranking</div>
      </div>
      <div className="bento-scroll-content" style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, padding: "12px 10px" }}>
        {repos.length === 0 ? (
          <div style={{ padding: "20px 24px", textAlign: "center", fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "13px" }}>
            No sustainability data yet — scores will populate after first ingestion run.
          </div>
        ) : repos.map((repo, i) => {
          const sustainColor = repo.sustainability_label === "GREEN"
            ? "var(--accent-green)"
            : repo.sustainability_label === "YELLOW"
            ? "var(--accent-yellow)"
            : "var(--accent-red)";
          return (
            <div
              key={repo.repo_id}
              className="sustain-row"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px 7px 6px", cursor: "pointer", minWidth: 0, borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${sustainColor}`, transition: "background 0.15s" }}
              onClick={() => router.push(`/repo/${repo.repo_id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, overflow: "hidden", flex: 1 }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "10px", width: "14px", textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <span className="sustain-repo-name" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word" }}>{repo.owner}/{repo.name}</span>
                <span style={{ marginLeft: "6px", fontFamily: "var(--font-sans)", fontSize: "10px", color: "var(--text-muted)" }}>{repo.category}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--amber)" }}>
                {(repo.sustainability_score * 100).toFixed(0)}%
              </span>
              <StatusDot label={repo.sustainability_label} size="sm" />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Ecosystem Map Chart (scatter: trend vs sustainability) ─────────────────
function EcosystemMapChart({ repos, title = "Ecosystem Landscape Map" }: { repos: RadarRepo[]; title?: string }) {
  const [chartHeight, setChartHeight] = useState(320);
  const [selectedRepo, setSelectedRepo] = useState<RadarRepo | null>(null);
  const [activeQuadrant, setActiveQuadrant] = useState<string | null>(null);
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = () => {
      if (window.innerWidth <= 480) setChartHeight(220);
      else if (window.innerWidth <= 768) setChartHeight(260);
      else setChartHeight(320);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Determine all available categories from the original dataset
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    repos.forEach(r => {
      if (r.category) cats.add(r.category);
    });
    return Array.from(cats);
  }, [repos]);

  // Assign a unique color to each category from a premium palette
  const categoryColorMap = useMemo(() => {
    const palette = [
      "#58a6ff", // Blue
      "#3fb950", // Green
      "#d29922", // Amber
      "#a371f7", // Purple
      "#f0883e", // Orange
      "#22d3ee", // Cyan
      "#e85a9d", // Pink
      "#39d353", // Bright Green
      "#2dd4bf", // Teal
      "#f87171", // Coral Red
    ];
    const mapping: Record<string, string> = {};
    allCategories.forEach((cat, index) => {
      const color = getCategoryColor(cat);
      if (color === "#58a6ff" && cat.toLowerCase() !== "ai/ml" && cat.toLowerCase() !== "ai_ml" && cat.toLowerCase() !== "ai / ml") {
        mapping[cat] = palette[index % palette.length];
      } else {
        mapping[cat] = color;
      }
    });
    return mapping;
  }, [allCategories]);

  // Filter repos based on disabled categories
  const filteredRepos = useMemo(() => {
    return repos.filter(r => !disabledCategories.has(r.category));
  }, [repos, disabledCategories]);

  // Calculate median points dynamically to segment the quadrants cleanly
  const midPoints = useMemo(() => {
    if (!filteredRepos.length) return { x: 8, y: 50 };
    const xs = filteredRepos.map(r => r.trend_score * 100);
    const ys = filteredRepos.map(r => r.sustainability_score * 100);
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const mx = xs[Math.floor(xs.length / 2)] ?? 8;
    const my = ys[Math.floor(ys.length / 2)] ?? 50;
    // Clip midpoints to sane ranges
    return {
      x: mx > 0 ? mx : 8,
      y: my > 0 ? my : 50,
    };
  }, [filteredRepos]);

  const isInQuadrant = (x: number, y: number, quad: string) => {
    if (quad === "rising_stars") return x >= midPoints.x && y >= midPoints.y;
    if (quad === "breakouts") return x >= midPoints.x && y < midPoints.y;
    if (quad === "established") return x < midPoints.x && y >= midPoints.y;
    if (quad === "watch") return x < midPoints.x && y < midPoints.y;
    return true;
  };

  const quadrantCounts = useMemo(() => {
    const counts = { rising_stars: 0, breakouts: 0, established: 0, watch: 0 };
    filteredRepos.forEach(r => {
      const x = r.trend_score * 100;
      const y = r.sustainability_score * 100;
      if (x >= midPoints.x && y >= midPoints.y) counts.rising_stars++;
      else if (x >= midPoints.x && y < midPoints.y) counts.breakouts++;
      else if (x < midPoints.x && y >= midPoints.y) counts.established++;
      else counts.watch++;
    });
    return counts;
  }, [filteredRepos, midPoints]);

  // Group by category for multi-series scatter
  const byCategory = useMemo(() => {
    return filteredRepos.reduce<Record<string, { x: number; y: number; name: string; owner: string; category: string; z: number }[]>>(
      (acc, r) => {
        const key = r.category;
        const point = {
          x: Number((r.trend_score * 100).toFixed(2)),
          y: Number((r.sustainability_score * 100).toFixed(2)),
          name: r.name,
          owner: r.owner,
          category: r.category,
          z: 30,
        };
        if (!acc[key]) acc[key] = [];
        acc[key].push(point);
        return acc;
      },
      {}
    );
  }, [filteredRepos]);

  const handlePointClick = (event: any) => {
    if (event && event.payload) {
      const p = event.payload;
      const match = repos.find(r => r.owner === p.owner && r.name === p.name);
      if (match) {
        setSelectedRepo(match);
      }
    }
  };

  // Custom premium Dot Shape
  const CustomDot = (props: any) => {
    const { cx, cy, fill, payload } = props;
    if (!cx || !cy) return null;

    const isHighlighted = activeQuadrant ? isInQuadrant(payload.x, payload.y, activeQuadrant) : true;
    const isSelected = selectedRepo && selectedRepo.owner === payload.owner && selectedRepo.name === payload.name;
    
    const opacity = isHighlighted ? (isSelected ? 1.0 : 0.85) : 0.12;
    const r = isSelected ? 8 : (isHighlighted ? 5.5 : 4);
    
    return (
      <g style={{ cursor: "pointer" }}>
        {isSelected && (
          <circle cx={cx} cy={cy} r={r + 4} fill={fill} fillOpacity={0.25} className="pulse-glow" />
        )}
        <circle 
          cx={cx} 
          cy={cy} 
          r={r} 
          fill={fill} 
          fillOpacity={opacity} 
          stroke="var(--bg-surface)" 
          strokeWidth={isSelected ? 1.5 : 1} 
          style={{ transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" }} 
        />
      </g>
    );
  };

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="panel-header ecosystem-header" style={{ flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="panel-title">{title}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
            Ecosystem landscape mapping repository star momentum (X-axis) against project health score (Y-axis).
          </div>
        </div>
        
        {/* Reset Filter Button */}
        {disabledCategories.size > 0 && (
          <button 
            onClick={() => setDisabledCategories(new Set())}
            style={{
              background: "transparent",
              border: "1px dashed var(--border)",
              color: "var(--text-secondary)",
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--text-muted)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }} className="ecosystem-bento-layout">
        {/* Left Column: Interactive Map */}
        <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
          {/* Category Filter Pills (Legend) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {allCategories.map((c) => {
              const isDisabled = disabledCategories.has(c);
              const color = categoryColorMap[c] || "#58a6ff";
              return (
                <button
                  key={c}
                  onClick={() => {
                    setDisabledCategories(prev => {
                      const next = new Set(prev);
                      if (next.has(c)) {
                        next.delete(c);
                      } else {
                        next.add(c);
                      }
                      return next;
                    });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "9.5px",
                    background: isDisabled ? "transparent" : "var(--bg-elevated)",
                    border: `1px solid ${isDisabled ? "var(--border)" : color + "33"}`,
                    padding: "4px 9px",
                    borderRadius: "4px",
                    color: isDisabled ? "var(--text-muted)" : "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => {
                    if (isDisabled) e.currentTarget.style.borderColor = "var(--text-muted)";
                  }}
                  onMouseLeave={e => {
                    if (isDisabled) e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <span style={{ width: 6, height: 6, background: color, display: "inline-block", borderRadius: "50%", opacity: isDisabled ? 0.35 : 1 }} />
                  {c}
                </button>
              );
            })}
          </div>

          {/* Scatter Chart container */}
          <div style={{ height: `${chartHeight}px`, position: "relative", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 10, bottom: 20, left: -14 }}>
                <XAxis
                  type="number" dataKey="x" name="Trend"
                  domain={[0, "auto"]}
                  tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                  label={{ value: "Star Momentum (Trend Score)", position: "insideBottom", offset: -5, fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-sans)", fontWeight: 600 }}
                />
                <YAxis
                  type="number" dataKey="y" name="Sustainability"
                  domain={[0, 100]}
                  width={38}
                  tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                  label={{ value: "Project Health (Sustainability Score)", angle: -90, position: "insideLeft", offset: 15, fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-sans)", fontWeight: 600 }}
                />
                <ZAxis range={[30, 30]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "var(--border)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as { x: number; y: number; name: string; owner: string; category: string };
                    return (
                      <div style={{ 
                        background: "var(--bg-surface)", 
                        border: "1px solid var(--border)", 
                        padding: "8px 12px", 
                        fontSize: "11px", 
                        fontFamily: "var(--font-mono)", 
                        borderRadius: "6px", 
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)" 
                      }}>
                        <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--text-primary)" }}>{d.owner}/{d.name}</p>
                        <p style={{ margin: "0 0 2px", color: "var(--cyan)", fontSize: "10px" }}>TREND: <strong>{(d.x / 100).toFixed(2)}</strong></p>
                        <p style={{ margin: "0 0 2px", color: "var(--amber)", fontSize: "10px" }}>SUSTAIN: <strong>{d.y.toFixed(0)}%</strong></p>
                        <p style={{ margin: 0, color: categoryColorMap[d.category] || "#58a6ff", fontSize: "9.5px", letterSpacing: "0.04em", textTransform: "uppercase" }}>{d.category}</p>
                      </div>
                    );
                  }}
                />
                
                {/* Quadrant Crosshairs */}
                <ReferenceLine x={midPoints.x} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
                <ReferenceLine y={midPoints.y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />

                {allCategories.filter(cat => !disabledCategories.has(cat)).map((cat) => (
                  <Scatter
                    key={cat}
                    name={cat}
                    data={byCategory[cat] || []}
                    fill={categoryColorMap[cat] || "#58a6ff"}
                    shape={<CustomDot />}
                    onClick={handlePointClick}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Premium Details Card */}
        <div className="ecosystem-details-col" style={{ width: "280px", borderLeft: "1px solid var(--border)", background: "rgba(255,255,255,0.012)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {selectedRepo ? (
            /* Repo Details View */
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px", height: "100%", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Repository details</span>
                <button 
                  onClick={() => setSelectedRepo(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    fontSize: "11px",
                    cursor: "pointer",
                    padding: "2px 6px",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text-secondary)"}
                >
                  ✕ Close
                </button>
              </div>

              <div>
                <a 
                  href={selectedRepo.github_url} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    display: "block",
                    wordBreak: "break-all",
                    lineHeight: 1.2
                  }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                >
                  {selectedRepo.owner}/{selectedRepo.name} ↗
                </a>
                <span style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "4px", 
                  fontSize: "9.5px", 
                  fontFamily: "var(--font-mono)", 
                  color: categoryColorMap[selectedRepo.category] || "#58a6ff", 
                  marginTop: "6px",
                  background: "rgba(255,255,255,0.03)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: `1px solid ${(categoryColorMap[selectedRepo.category] || "#58a6ff")}15`
                }}>
                  <span style={{ width: 5, height: 5, background: categoryColorMap[selectedRepo.category] || "#58a6ff", borderRadius: "50%" }} />
                  {selectedRepo.category}
                </span>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Stars</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                    {formatCompactNumber(selectedRepo.stars)}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Language</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                    {selectedRepo.primary_language || "—"}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Velocity (7D)</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                    +{formatCompactNumber(selectedRepo.star_velocity_7d)}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Age</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                    {selectedRepo.age_days}d
                  </span>
                </div>
              </div>

              {/* Gauge scores */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    <span>Trend Momentum</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)", fontWeight: 700 }}>
                      {selectedRepo.trend_score.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--cyan)", width: `${Math.min(selectedRepo.trend_score * 10, 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    <span>Project Sustainability</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--amber)", fontWeight: 700 }}>
                      {(selectedRepo.sustainability_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--amber)", width: `${selectedRepo.sustainability_score * 100}%` }} />
                  </div>
                </div>
              </div>

              {selectedRepo.topics && selectedRepo.topics.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <span style={{ display: "block", fontSize: "8px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>topics</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {selectedRepo.topics.slice(0, 8).map(topic => (
                      <span
                        key={topic}
                        style={{
                          fontSize: "8.5px",
                          fontFamily: "var(--font-mono)",
                          background: "var(--bg-elevated)",
                          color: "var(--text-secondary)",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Macro Overview Insights View */
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
              <div>
                <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Ecosystem Insights</span>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0 0" }}>Landscape Overview</h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                  <span style={{ display: "block", fontSize: "8.5px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Projects Mapped</span>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                    {filteredRepos.length}
                  </span>
                </div>

                <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                  <span style={{ display: "block", fontSize: "8.5px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Avg Sustainability</span>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-yellow)", fontFamily: "var(--font-mono)" }}>
                    {(filteredRepos.reduce((acc, r) => acc + r.sustainability_score, 0) / Math.max(filteredRepos.length, 1) * 100).toFixed(1)}%
                  </span>
                </div>

                <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                  <span style={{ display: "block", fontSize: "8.5px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Avg Weekly Star Gain</span>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                    +{Math.round(filteredRepos.reduce((acc, r) => acc + r.star_velocity_7d, 0) / Math.max(filteredRepos.length, 1))}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "auto", padding: "10px", background: "rgba(132,204,22,0.03)", border: "1px dashed rgba(132,204,22,0.15)", borderRadius: "6px", fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.3 }}>
                💡 <strong>Interactive:</strong> Click any dot in the scatter plot to inspect repository health, age, tags, and momentum stats in this panel.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quadrant Controls / Legends */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
        <div className="quadrant-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
          {[
            { id: "rising_stars", color: "var(--accent-green)", bg: "rgba(132,204,22,0.04)", border: "rgba(132,204,22,0.2)", hoverBorder: "var(--accent-green)", label: "Rising Stars 🚀", desc: "High momentum & high health", count: quadrantCounts.rising_stars },
            { id: "breakouts", color: "var(--accent-yellow)", bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.2)", hoverBorder: "var(--accent-yellow)", label: "Breakouts", desc: "High momentum · lower health", count: quadrantCounts.breakouts },
            { id: "established", color: "var(--accent-blue)", bg: "rgba(99,102,241,0.04)", border: "rgba(99,102,241,0.2)", hoverBorder: "var(--accent-blue)", label: "Established", desc: "Steady growth · high health", count: quadrantCounts.established },
            { id: "watch", color: "var(--accent-red)", bg: "rgba(248,113,113,0.04)", border: "rgba(248,113,113,0.2)", hoverBorder: "var(--accent-red)", label: "Watch list", desc: "Low momentum · low health", count: quadrantCounts.watch },
          ].map(({ id, color, bg, border, hoverBorder, label, desc, count }) => {
            const isCurrent = activeQuadrant === id;
            return (
              <button
                key={id}
                onMouseEnter={() => setActiveQuadrant(id)}
                onMouseLeave={() => setActiveQuadrant(null)}
                style={{
                  background: isCurrent ? `${color}11` : bg,
                  border: `1px solid ${isCurrent ? hoverBorder : border}`,
                  borderRadius: "6px",
                  padding: "8px 12px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span style={{ color: color, fontWeight: 700, fontSize: "11.5px" }}>{label}</span>
                  <span style={{ fontSize: "9.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", background: "rgba(255,255,255,0.03)", padding: "1px 5px", borderRadius: "3px" }}>
                    {count}
                  </span>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "9px", lineHeight: 1.2 }}>{desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        .pulse-glow {
          animation: pulse-opacity 2s infinite ease-in-out;
        }
        @keyframes pulse-opacity {
          0% { opacity: 0.15; }
          50% { opacity: 0.45; }
          100% { opacity: 0.15; }
        }
        @media (max-width: 768px) {
          .ecosystem-bento-layout {
            flex-direction: column !important;
            overflow: visible !important;
          }
          .ecosystem-details-col {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid var(--border) !important;
          }
          .quadrant-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .quadrant-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}


// === Alerts Panel =============================================================
const ALERT_ICONS: Record<string, React.ReactNode> = {
  star_spike_24h: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-yellow)" }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  star_spike_48h: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-yellow)" }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  momentum_surge: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-green)" }}>
      <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5" />
      <path d="M12 2c1.5 2 2.5 4 2.5 6 0 1-.5 1.5-1.5 1.5s-4-1-6-2.5c-2-1.5-3-2.5-3-3.5 0-1 .5-1.5 1.5-1.5 2 0 4 1 6 2.5Z" />
      <path d="M12 2s4 1.5 6 3.5c1.5 1.5 2.5 3 2.5 4.5 0 1-.5 1.5-1.5 1.5s-3-1-4.5-2.5c-1.5-1.5-2.5-3-2.5-7Z" />
    </svg>
  ),
  pr_surge: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-blue)" }}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 15V9a4 4 0 0 0-4-4H9" />
      <line x1="6" y1="9" x2="6" y2="15" />
    </svg>
  ),
  new_breakout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-red)" }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

function AlertsPanel({
  alerts,
  onMarkRead,
  onDismissAll,
}: {
  alerts: AlertResponse[];
  onMarkRead: (id: string) => void;
  onDismissAll: () => void;
}) {
  const router = useRouter();
  const unread = alerts.filter((a) => !a.is_read).length;
  const [collapsed, setCollapsed] = useState(false);

  const handleDismissAll = () => {
    onDismissAll();
    setCollapsed(true);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        {/* Left: title + badge + expand toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: "var(--text-muted)",
              transition: "transform 0.2s",
              display: "inline-block",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="panel-title">
            Trend Alerts
          </span>
          {unread > 0 && (
            <span className="alert-badge-cyber">
              {unread} new
            </span>
          )}
          {collapsed && alerts.length > 0 && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
              — {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
            </span>
          )}
        </button>

        {/* Right: dismiss all + hint */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? "none" : "auto",
            transition: "opacity 0.2s ease-in-out"
          }}
        >
          {unread > 0 && (
            <button onClick={handleDismissAll} className="link-btn-cyber">
              Dismiss All
            </button>
          )}
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)" }}>
            Last {alerts.length} alerts · click to view
          </span>
        </div>
      </div>

      <div
        style={{
          maxHeight: collapsed ? "0" : "800px",
          opacity: collapsed ? 0 : 1,
          overflow: "hidden",
          transition: "max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-in-out",
        }}
      >
        {alerts.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: "13px", textAlign: "center", padding: "16px 20px" }}>
            No active alerts — scores will trigger alerts after sufficient data accumulates.
          </p>
        ) : (
          <div>
            {alerts.map((alert) => {
              const prefix = `${alert.owner}/${alert.name} `;
              const detailText = alert.headline.startsWith(prefix)
                ? alert.headline.slice(prefix.length)
                : alert.headline;
              return (
                <div
                  key={alert.id}
                  onClick={() => {
                    if (!alert.is_read) {
                      onMarkRead(alert.id);
                    }
                    router.push(`/repo/${alert.owner}/${alert.name}`);
                  }}
                  className={`alert-row-cyber${alert.is_read ? " read" : ""}`}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", width: "100%" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                    {ALERT_ICONS[alert.alert_type] ?? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "2px" }}>
                      <strong style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{alert.owner}/{alert.name}</strong>
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {detailText}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--accent-blue)", padding: "1px 6px", fontSize: "11px", borderRadius: "4px" }}>
                        {alert.category}
                      </span>
                      {new Date(alert.triggered_at).toLocaleString()}
                    </div>
                  </div>
                  {!alert.is_read && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-red)", flexShrink: 0 }} />
                  )}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: authLoaded, userId, token, isReady } = useAuthSession();
  const [period, setPeriod] = useState<Period>("7d");
  const [vertical, setVertical] = useState<Vertical>("ai_ml");
  const [userVerticals, setUserVerticals] = useState<string[]>([]);
  const [showMine, setShowMine] = useState(false);
  const { items: watchlist, toggle: togglePin, isPinned } = useWatchlist();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Read vertical from URL ?vertical=xxx (set by sidebar links)
  useEffect(() => {
    const v = searchParams.get("vertical");
    if (v && VERTICALS.some((item) => item.key === v)) {
      setVertical(v as Vertical);
    }
  }, [searchParams]);

  // Load user's preferred verticals from onboarding and set as default
  useEffect(() => {
    if (!authLoaded || !isReady || !token) return;
    api.getOnboardingStatus(token)
      .then((status) => {
        const prefs = status.selected_verticals ?? [];
        setUserVerticals(prefs);
        // Default to user's first preferred vertical if it's a valid Vertical key
        const validKeys = VERTICALS.map((v) => v.key);
        const firstPref = prefs.find((p) => validKeys.includes(p as Vertical));
        if (firstPref) setVertical(firstPref as Vertical);
      }).catch(() => { /* not critical — keep default */ });
  }, [authLoaded, isReady, token]);

  const { data: overview, isLoading: overviewLoading, error } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", period],
    queryFn: () => api.getCategories(period),
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["leaderboard", period, vertical],
    queryFn: () => api.getLeaderboard(period, undefined, 10, vertical),
  });

  // Ecosystem map — full repo set with both scores
  const { data: radarRepos } = useQuery({
    queryKey: ["radar", vertical],
    queryFn: () => api.getRadar(false, undefined, vertical, "trend_score", "desc", 100),
    staleTime: 5 * 60 * 1000,   // re-fetch at most every 5 min
  });

  // Unread alerts count for the inline bell button
  const { unreadCount: unreadAlerts } = useUnreadAlerts();





  if (overviewLoading) {
    return <Skeleton shape="page" />;
  }


  if (error || !overview) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", padding: "24px" }}>
        <div className="panel" style={{ padding: "32px", maxWidth: "460px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "16px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(248,81,73,0.1)", border: "1px solid var(--accent-red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px 0" }}>Backend Service Offline</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", fontFamily: "var(--font-sans)", lineHeight: 1.6, margin: 0 }}>
              Start the FastAPI server: <code style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>make dev-backend</code><br />
              Or run first-time setup: <code style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>POST /admin/run-all</code> via <code style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>localhost:8000/docs</code>
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-cyber btn-cyber-cyan"
            style={{
              padding: "8px 20px",
              fontSize: "12px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "8px"
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.3s ease-in-out" }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const greenCount = overview.healthy_repos;
  const topCat = overview.category_growth[0];
  const topLeaderEntry = leaderboard?.entries[0];
  const verticalLabel = VERTICALS.find((v) => v.key === vertical)?.label ?? "AI / ML";

  return (
    <div className="page-root page-fade-in">





      {/* Header */}
      <div className="overview-header" style={{ marginBottom: "0px" }}>


        {/* Row 1: Title + Period Selector */}
        <div className="overview-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 className="page-title">
              Ecosystem overview
            </h1>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.textSub}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ cursor: "pointer", opacity: 0.8, marginTop: "4px", transition: "transform 0.2s ease, stroke 0.2s ease", flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(15deg)"; e.currentTarget.style.stroke = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "rotate(0deg)"; e.currentTarget.style.stroke = C.textSub; }}
            >
              <title>Edit Ecosystem</title>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          {isMobile ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => router.push("/leaderboard")}
                className="btn-cyber btn-cyber-cyan"
                style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                Leaderboard
              </button>
              <button
                onClick={() => router.push("/compare")}
                className="btn-cyber btn-cyber-cyan"
                style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
                </svg>
                Compare
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/leaderboard")}
                className="btn-cyber btn-cyber-cyan"
                style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                Leaderboard
              </button>
              <button
                onClick={() => router.push("/compare")}
                className="btn-cyber btn-cyber-cyan"
                style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
                </svg>
                Compare
              </button>
              <PeriodSelector selected={period} onChange={setPeriod} />
            </div>
          )}
        </div>

        {/* Mobile Period Selector Row */}
        {isMobile && (
          <div style={{ marginBottom: "12px", width: "100%" }}>
            <PeriodSelector selected={period} onChange={setPeriod} />
          </div>
        )}

        {/* Row 2: Subtitle & Badge + Alerts Bell */}
        <div className="overview-subtitle-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "6px" }}>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: "13px",
            color: C.textSub,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span>As of {overview.as_of} · {PERIODS.find(p => p.key === period)?.label ?? period} · {VERTICALS.find(v => v.key === vertical)?.label ?? vertical}</span>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              background: "var(--bg-elevated)",
              border: "1px solid rgba(63,185,80,0.25)",
              borderRadius: "12px",
              color: "var(--accent-green)",
              fontSize: "11px",
              fontWeight: 600,
            }}>
              ✦ Personalized
            </span>
          </div>

          {/* Alerts bell — right-aligned, fires custom event to open panel, desktop only */}
          {!isMobile && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("repodar:open-alerts"))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                transition: "border-color 0.15s, color 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text-muted)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              title="Open alerts"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Alerts
              {unreadAlerts > 0 && (
                <span style={{
                  padding: "1px 5px",
                  borderRadius: "8px",
                  background: "var(--accent-red)",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}>
                  {unreadAlerts}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Row 3: Vertical selector — always full width */}
        <div style={{ marginTop: "0px" }}>
          <VerticalSelector
            selected={vertical}
            onChange={(v) => { setVertical(v); }}
            userVerticals={userVerticals}
            showMine={showMine}
            setShowMine={setShowMine}
          />
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="bento-grid">
        {/* Stat Cards */}
        <div className="bento-col-3" style={{ display: "flex", flexDirection: "column" }}>
          <StatCard
            index={0}
            label="Repos Tracked"
            value={overview.total_repos}
            sub={overview.discovered_repos > 0
              ? `+${overview.discovered_repos} auto-discovered`
              : "curated baseline"}
            trend={overview.discovered_repos > 0 ? "up" : "neutral"}
          />
        </div>
        <div className="bento-col-3" style={{ display: "flex", flexDirection: "column" }}>
          <StatCard
            index={1}
            label="Top Category"
            value={topCat?.category ?? "—"}
            sub={topCat ? `${topCat.total_stars.toLocaleString()} total stars` : undefined}
            trend="neutral"
          />
        </div>
        <div className="bento-col-3" style={{ display: "flex", flexDirection: "column" }}>
          <StatCard
            index={2}
            label={`#1 — ${PERIODS.find(p => p.key === period)?.label ?? period} Momentum`}
            value={topLeaderEntry ? `${topLeaderEntry.owner}/${topLeaderEntry.name}` : "—"}
            sub={topLeaderEntry
              ? `★ ${topLeaderEntry.current_stars.toLocaleString()} stars`
              : undefined}
            href={topLeaderEntry ? `/repo/${topLeaderEntry.owner}/${topLeaderEntry.name}` : undefined}
            trend="up"
          />
        </div>
        <div className="bento-col-3" style={{ display: "flex", flexDirection: "column" }}>
          <StatCard
            index={3}
            label="Healthy Repos"
            value={greenCount}
            sub={`of ${overview.total_repos} active`}
            trend="neutral"
          />
        </div>

        {/* Row 2: Category Trend Score (8 cols) & Sustainability Ranking (4 cols) */}
        <div className="bento-col-8">
          <ModernCategoryTrendScore data={categoriesData ?? overview.category_growth} period={period} />
        </div>
        <div className="bento-col-4">
          <SustainabilityRanking repos={overview.sustainability_ranking} />
        </div>

        {/* Row 3: Stars Distribution (8 cols) & PR Activity (4 cols) */}
        <div className="bento-col-8">
          <ModernCategoryCards data={categoriesData ?? overview.category_growth} />
        </div>
        <div className="bento-col-4">
          <ModernPRChart data={categoriesData ?? overview.category_growth} period={period} />
        </div>

        {/* Row 4: Ecosystem Map (12 cols) */}
        {radarRepos && radarRepos.length > 0 && (
          <div className="bento-col-12">
            <EcosystemMapChart repos={radarRepos} title="Ecosystem Landscape Map" />
          </div>
        )}

        {/* Row 5: Leaderboard Table (12 cols) */}
        <div className="bento-col-12">
          <div className="table-scroll">
            <LeaderboardTable
              entries={leaderboard?.entries ?? []}
              period={period}
              isLoading={leaderboardLoading}
              isPinned={isPinned}
              onTogglePin={(entry) => togglePin({
                repo_id: entry.repo_id,
                owner: entry.owner,
                name: entry.name,
                github_url: entry.github_url,
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
