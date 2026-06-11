"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  api, Period, Vertical, CategoryMetrics, SustainabilityEntry, LeaderboardEntry,
  RadarRepo, AlertResponse,
} from "@/lib/api";
import { SustainBadge } from "@/components/Nav";
import { ModernCategoryCards } from "@/components/charts/ModernCategoryCards";
import { ModernPRChart } from "@/components/charts/ModernPRChart";
import { ModernCategoryTrendScore } from "@/components/charts/ModernCategoryTrendScore";

const C = {
  bg: "#0d1117",
  bgCard: "#161b22",
  bgHover: "#21262d",
  border: "#30363d",
  text: "#e6edf3",
  textSub: "#8b949e",
  textMuted: "#6e7681",
  green: "#3fb950",
  amber: "#d29922",
  red: "#f85149",
};

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
  // Non-AI verticals
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

const PERIODS: { key: Period; label: string }[] = [
  { key: "1d",   label: "Today" },
  { key: "7d",   label: "7D" },
  { key: "30d",  label: "1M" },
  { key: "90d",  label: "3M" },
  { key: "365d", label: "1Y" },
  { key: "3y",   label: "3Y" },
  { key: "5y",   label: "5Y" },
];

const VERTICALS: { key: Vertical; label: string }[] = [
  { key: "ai_ml",      label: "AI / ML" },
  { key: "devtools",   label: "DevTools" },
  { key: "web_mobile", label: "Web & Mobile" },
  { key: "data_infra", label: "Data & Infra" },
  { key: "security",   label: "Security" },
  { key: "blockchain", label: "Blockchain" },
  { key: "oss_tools",  label: "OSS Tools" },
  { key: "science",    label: "Science" },
  { key: "creative",   label: "Creative" },
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

function StatCard({ label, value, sub, index = 0 }: { label: string; value: string | number; sub?: string; index?: number }) {
  const [isHovered, setIsHovered] = useState(false);
  
  const icons = ["📦", "🏆", "🚀", "✅"];
  const colors = ["#58a6ff", "#d29922", "#f85149", "#3fb950"];
  const color = colors[index];
  const icon = icons[index];

  return (
    <div
      className="kpi-card card-pad"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isHovered ? "scale(1.02) translateY(-2px)" : "scale(1) translateY(0)",
        borderColor: isHovered ? color : "var(--border)",
        boxShadow: isHovered ? `0 8px 24px ${color}15` : "none",
      }}
    >
      {/* Icon + Label */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{
          fontSize: "18px",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isHovered ? "scale(1.2)" : "scale(1)",
          display: "inline-block",
        }}>
          {icon}
        </span>
        <div className="kpi-label">{label}</div>
      </div>

      {/* Value */}
      <div className="kpi-value" style={{
        color: color,
        transition: "all 0.2s ease",
        opacity: isHovered ? 1 : 0.9,
      }}>
        {value}
      </div>

      {/* Sub text */}
      {sub && (
        <div className="kpi-sub" style={{
          transition: "color 0.2s ease",
          color: isHovered ? "var(--text-secondary)" : "var(--text-muted)",
        }}>
          {/^[+]/.test(String(sub))
            ? <><em>{String(sub).split(' ')[0]}</em>{' '}{String(sub).split(' ').slice(1).join(' ')}</>
            : sub}
        </div>
      )}

      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: "2px",
          background: color,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          width: isHovered ? "100%" : "0%",
          borderRadius: "0 0 8px 8px",
        }}
      />

      {/* Corner number */}
      <div className="kpi-corner" style={{
        opacity: isHovered ? 0.12 : 0.05,
        transition: "opacity 0.2s ease",
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>
    </div>
  );
}

function PeriodSelector({ selected, onChange }: { selected: Period; onChange: (p: Period) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px" }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", overflowX: "auto", padding: "6px 0" }} className="scroll-selector">
      {/* Mine Toggle Switch */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "6px", flexShrink: 0 }}>
        <div
          onClick={() => setShowMine(!showMine)}
          style={{
            width: "36px",
            height: "20px",
            borderRadius: "10px",
            background: showMine ? "#218bff" : C.border,
            position: "relative",
            cursor: "pointer",
            transition: "background-color 0.2s",
            border: `1px solid ${showMine ? "#218bff" : C.border}`,
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
          const isFavorite = userVerticals.includes(key);
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
                transition: "all 0.15s",
                background: active ? "rgba(255, 255, 255, 0.05)" : C.bgCard,
                border: `1px solid ${active ? C.text : C.border}`,
                color: active ? C.text : C.textSub,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = C.textSub;
                  e.currentTarget.style.color = C.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.color = C.textSub;
                }
              }}
            >
              {isFavorite && <span style={{ marginRight: "4px", color: C.amber }}>✦</span>}
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
  compareSelection,
  onToggleCompare,
  isPinned,
  onTogglePin,
}: {
  entries: LeaderboardEntry[];
  period: Period;
  isLoading: boolean;
  compareSelection: string[];
  onToggleCompare: (repo_id: string) => void;
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
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return String(num);
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
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
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
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255, 255, 255, 0.01)",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
      }}>
        {/* Search */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: "10px", color: "var(--text-muted)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Filter"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              padding: "5px 10px 5px 28px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "12px",
              color: "var(--text-primary)",
              outline: "none",
              width: "120px",
              transition: "width 0.2s ease, border-color 0.2s ease",
            }}
            onFocus={(e) => { e.currentTarget.style.width = "180px"; e.currentTarget.style.borderColor = "var(--text-muted)"; }}
            onBlur={(e) => { if (!filterQuery) { e.currentTarget.style.width = "120px"; } e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: "flex", gap: "6px" }}>
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
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Buttons */}
        <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
          {[
            { key: "stars", label: "Stars", icon: "⭐" },
            { key: "forks", label: "Forks", icon: "🍴" },
            { key: "issues", label: "Issues", icon: "☉" },
            { key: "age", label: "Age", icon: "🕒" },
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
                background: sortBy === s.key ? "#ffffff" : "transparent",
                color: sortBy === s.key ? "var(--bg-primary)" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ fontSize: "10px" }}>{s.icon}</span>
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
              {["", "#", "Repo", "Category", "Stars", "Forks", "Issues", "Age", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "9px 12px",
                  textAlign: ["#", "Stars", "Forks", "Issues", "Age"].includes(h) ? "right" : "left",
                  fontWeight: 600, fontSize: "11px", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedEntries.map((repo: LeaderboardEntry, idx: number) => {
              const slug = `${repo.owner}/${repo.name}`;
              const selected = compareSelection.includes(slug);
              const pinned = isPinned(repo.repo_id);
              const years = Math.max(1, Math.round(repo.age_days / 365));
              const agePercentage = Math.min((repo.age_days / (365 * 12)) * 100, 100);
              const categoryColor = CATEGORY_COLORS[repo.category] ?? "#6b7280";

              return (
                <tr
                  key={repo.repo_id}
                  className="repo-row"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: selected ? "rgba(255, 255, 255, 0.02)" : "transparent",
                  }}
                >
                  {/* Compare checkbox */}
                  <td style={{ padding: "12px 8px 10px 16px", width: "28px", verticalAlign: "top" }}>
                    <div 
                      onClick={() => onToggleCompare(slug)}
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "3px",
                        border: `1.5px solid ${selected ? "var(--text-primary)" : "var(--border)"}`,
                        background: selected ? "var(--text-primary)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        userSelect: "none",
                        marginTop: "2px",
                      }}
                      title="Add to comparison"
                    >
                      {selected && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </td>
                  
                  {/* Rank */}
                  <td
                    style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-muted)", width: "40px", verticalAlign: "top", cursor: "pointer", fontFamily: "var(--font-mono)" }}
                    onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                  >
                    {idx + 1}
                  </td>

                  {/* Repo Details */}
                  <td
                    style={{ padding: "12px 12px", maxWidth: "340px", cursor: "pointer" }}
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
                  <td style={{ padding: "12px 12px", verticalAlign: "top" }}>
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
                  <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)", verticalAlign: "top" }}>
                    {formatNum(repo.current_forks)}
                  </td>

                  {/* Issues */}
                  <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)", verticalAlign: "top" }}>
                    {repo.open_issues != null ? repo.open_issues.toLocaleString() : "—"}
                  </td>

                  {/* Age relative bar */}
                  <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)", verticalAlign: "top" }}>
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



      <style>{`
        @keyframes rowFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .repo-row {
          animation: rowFadeIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          transition: background-color 0.2s ease;
        }
        .repo-row:hover {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        .repo-row:hover .repo-name {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

function SustainabilityRanking({ repos }: { repos: SustainabilityEntry[] }) {
  const router = useRouter();
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Sustainability Ranking</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {repos.length === 0 ? (
          <div style={{ padding: "20px 24px", textAlign: "center", fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "13px" }}>
            No sustainability data yet — scores will populate after first ingestion run.
          </div>
        ) : repos.slice(0, 10).map((repo, i) => (
          <div
            key={repo.repo_id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", cursor: "pointer", minWidth: 0, borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
            onClick={() => router.push(`/repo/${repo.repo_id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "10px", width: "22px", textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)" }}>{repo.owner}/{repo.name}</span>
                <span style={{ marginLeft: "8px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>{repo.category}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--amber)" }}>
                {(repo.sustainability_score * 100).toFixed(0)}%
              </span>
              <SustainBadge label={repo.sustainability_label} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ecosystem Map Chart (scatter: trend vs sustainability) ─────────────────
function EcosystemMapChart({ repos, title = "AI Ecosystem Map" }: { repos: RadarRepo[]; title?: string }) {
  // Group by category for multi-series scatter
  const byCategory = repos.reduce<Record<string, { x: number; y: number; name: string; owner: string; category: string }[]>>(
    (acc, r) => {
      const key = r.category;
      const point = {
        x: Number((r.trend_score * 100).toFixed(2)),
        y: Number((r.sustainability_score * 100).toFixed(2)),
        name: r.name,
        owner: r.owner,
        category: r.category,
      };
      if (!acc[key]) acc[key] = [];
      acc[key].push(point);
      return acc;
    },
    {}
  );

  const categories = Object.keys(byCategory);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{title}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
            X-axis: Trend Score · Y-axis: Sustainability Score · Each dot = one repo
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: "11px", maxWidth: "50%", justifyContent: "flex-end" }}>
          {categories.map((c) => (
            <span key={c} style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-sans)", color: "var(--text-muted)" }}>
              <span style={{ width: 7, height: 7, background: CATEGORY_COLORS[c] ?? "#888", display: "inline-block", borderRadius: "50%" }} />
              {c}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px 24px" }}>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
          <XAxis
            type="number" dataKey="x" name="Trend"
            domain={[0, "auto"]}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            label={{ value: "Trend Score", position: "insideBottom", offset: -10, fontSize: 10, fill: "var(--text-muted)" }}
          />
          <YAxis
            type="number" dataKey="y" name="Sustainability"
            domain={[0, 100]}
            width={36}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            label={{ value: "Sustain.", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "var(--text-muted)" }}
          />
          <ZAxis range={[30, 30]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload as { x: number; y: number; name: string; owner: string; category: string };
              return (
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "8px 12px", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-primary)" }}>{d.owner}/{d.name}</p>
                  <p style={{ margin: "0 0 2px", color: "var(--cyan)" }}>TREND: <strong>{d.x}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "var(--amber)" }}>SUSTAIN: <strong>{d.y}</strong></p>
                  <p style={{ margin: 0, color: CATEGORY_COLORS[d.category] ?? "#888", fontSize: "10px", letterSpacing: "0.06em" }}>{d.category}</p>
                </div>
              );
            }}
          />
          {categories.map((cat) => (
            <Scatter
              key={cat}
              name={cat}
              data={byCategory[cat]}
              fill={CATEGORY_COLORS[cat] ?? "#888"}
              opacity={0.85}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant hints */}
      <div className="quadrant-grid">
        {[
          { bg: "rgba(63,185,80,0.06)", border: "var(--accent-green)", label: "Rising Stars 🍃", desc: "High trend · high sustainability" },
          { bg: "rgba(210,153,34,0.06)", border: "var(--accent-yellow)", label: "Breakouts", desc: "High trend · lower sustainability" },
          { bg: "rgba(88,166,255,0.06)", border: "var(--accent-blue)", label: "Established", desc: "Lower trend · high sustainability" },
          { bg: "rgba(248,81,73,0.06)", border: "var(--accent-red)", label: "Watch", desc: "Low trend · low sustainability" },
        ].map(({ bg, border, label, desc }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}33`, borderRadius: "5px", padding: "7px 10px", fontSize: "12px", fontFamily: "var(--font-sans)" }}>
            <span style={{ color: border, fontWeight: 600 }}>{label}</span>
            <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>{desc}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}


// ─── Alerts Panel ─────────────────────────────────────────────────────────────
const ALERT_ICONS: Record<string, string> = {
  star_spike_24h: "⭐",
  star_spike_48h: "🌟",
  momentum_surge: "🚀",
  pr_surge: "🔀",
  new_breakout: "🌀",   // Rasengan!
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
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)", transition: "transform 0.2s", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
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
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {unread > 0 && (
              <button onClick={handleDismissAll} className="link-btn-cyber">
                Dismiss All
              </button>
            )}
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)" }}>
              Last {alerts.length} alerts · click to view
            </span>
          </div>
        )}
      </div>

      {!collapsed && (alerts.length === 0 ? (
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
                <span style={{ fontSize: "16px", flexShrink: 0 }}>
                  {ALERT_ICONS[alert.alert_type] ?? "★"}
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
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: authLoaded, userId } = useAuth();
  const [period, setPeriod] = useState<Period>("7d");
  const [vertical, setVertical] = useState<Vertical>("ai_ml");
  const [userVerticals, setUserVerticals] = useState<string[]>([]);
  const [showMine, setShowMine] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { items: watchlist, toggle: togglePin, isPinned } = useWatchlist();

  // Read vertical from URL ?vertical=xxx (set by sidebar links)
  useEffect(() => {
    const v = searchParams.get("vertical");
    if (v && VERTICALS.some((item) => item.key === v)) {
      setVertical(v as Vertical);
    }
  }, [searchParams]);

  // Load user's preferred verticals from onboarding and set as default
  useEffect(() => {
    if (!authLoaded || !userId) return;
    api.getOnboardingStatus(userId)
      .then((status) => {
        const prefs = status.selected_verticals ?? [];
        setUserVerticals(prefs);
        // Default to user's first preferred vertical if it's a valid Vertical key
        const validKeys = VERTICALS.map((v) => v.key);
        const firstPref = prefs.find((p) => validKeys.includes(p as Vertical));
        if (firstPref) setVertical(firstPref as Vertical);
      })
      .catch(() => { /* not critical — keep default */ });
  }, [authLoaded, userId]);

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

  // Trend alerts
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.getAlerts(false, 20),
    refetchInterval: 60_000,    // poll for new alerts every 60 s
  });
  useEffect(() => {
    if (alertsData) setAlerts(alertsData);
  }, [alertsData]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const handleMarkAlertRead = async (alertId: string) => {
    try {
      await api.markAlertRead(alertId);
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, is_read: true } : a));
    } catch { /* silent fail — UI still optimistic */ }
  };

  const handleDismissAllAlerts = async () => {
    // Optimistic update first
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    try {
      await api.markAllAlertsRead();
    } catch { /* silent fail */ }
  };

  const toggleCompare = (repo_id: string) => {
    setCompareSelection((prev) =>
      prev.includes(repo_id)
        ? prev.filter((x) => x !== repo_id)
        : prev.length < 5 ? [...prev, repo_id] : prev
    );
  };

  const openCompare = () => {
    if (compareSelection.length >= 2) {
      router.push(`/compare?repos=${compareSelection.join(",")}`);
    }
  };

  if (overviewLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "13px" }}>
          Channeling chakra…
        </p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div style={{ paddingTop: "40px" }}>
        <div className="panel" style={{ padding: "24px" }}>
          <p style={{ color: "var(--accent-red)", fontFamily: "var(--font-sans)", fontWeight: 600, marginBottom: "8px", fontSize: "14px" }}>
            Backend not reachable
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", fontFamily: "var(--font-sans)", lineHeight: 1.7 }}>
            Start the FastAPI server: <code style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>make dev-backend</code><br />
            Run first-time setup: <code style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>POST /admin/run-all</code> from the API docs at <code style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>localhost:8000/docs</code>
          </p>
        </div>
      </div>
    );
  }

  const greenCount = overview.healthy_repos;
  const topCat = overview.category_growth[0];
  const topLeaderEntry = leaderboard?.entries[0];
  const verticalLabel = VERTICALS.find((v) => v.key === vertical)?.label ?? "AI / ML";

  return (
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Floating compare bar */}
      {compareSelection.length >= 2 && (
        <div style={{
          position: "fixed", bottom: "32px", left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "10px 20px",
          display: "flex", alignItems: "center", gap: "16px", zIndex: 300,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          maxWidth: "calc(100vw - 32px)", flexWrap: "wrap", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "var(--accent-blue)" }}>
            {compareSelection.length} repos selected
          </span>
          <button
            onClick={openCompare}
            className="btn-cyber btn-cyber-cyan"
            style={{ fontSize: "10px" }}
          >
            Compare →
          </button>
          <button
            onClick={() => setCompareSelection([])}
            className="link-btn-cyber"
          >
            Clear
          </button>
        </div>
      )}

      {/* Trend Alerts Drawer */}
      {alertsOpen && (
        <div
          onClick={() => setAlertsOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 390 }}
        />
      )}
      <div style={{
        position: "fixed",
        top: "56px",
        right: "16px",
        width: "min(380px, calc(100vw - 32px))",
        maxHeight: "70vh",
        overflowY: "auto",
        zIndex: 400,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        transition: "opacity 0.15s, transform 0.15s",
        opacity: alertsOpen ? 1 : 0,
        pointerEvents: alertsOpen ? "auto" : "none",
        transform: alertsOpen ? "translateY(0)" : "translateY(-6px)",
      }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-surface)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "13px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "7px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            Trend Alerts
            {unreadCount > 0 && (
              <span style={{ background: "var(--accent-red)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "10px" }}>
                {unreadCount}
              </span>
            )}
          </span>
          {unreadCount > 0 && (
            <button onClick={handleDismissAllAlerts} className="link-btn-cyber" style={{ fontSize: "11px" }}>
              Dismiss all
            </button>
          )}
        </div>
        {alerts.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: "13px", textAlign: "center", padding: "24px 20px" }}>
            No active alerts
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
                      handleMarkAlertRead(alert.id);
                    }
                    router.push(`/repo/${alert.owner}/${alert.name}`);
                    setAlertsOpen(false);
                  }}
                  className={`alert-row-cyber${alert.is_read ? " read" : ""}`}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", width: "100%" }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>{ALERT_ICONS[alert.alert_type] ?? "★"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "2px" }}>
                      <strong style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{alert.owner}/{alert.name}</strong>
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {detailText}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--accent-blue)", padding: "1px 6px", fontSize: "11px", borderRadius: "4px" }}>{alert.category}</span>
                      {new Date(alert.triggered_at).toLocaleDateString()}
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

      {/* Header */}
      <div className="overview-header" style={{ marginBottom: "24px" }}>
        {/* Row 1: Title + Period Selector */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "28px", fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>
              Ecosystem overview
            </h1>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textSub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: "pointer", opacity: 0.8, marginTop: "4px" }}>
              <title>Edit Ecosystem</title>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <PeriodSelector selected={period} onChange={setPeriod} />
        </div>

        {/* Row 2: Subtitle & Badge + Trends button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
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
              background: "rgba(56, 189, 248, 0.15)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "12px",
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: 600,
            }}>
              ✦ Personalized
            </span>
          </div>

          <button
            onClick={() => setAlertsOpen((o) => !o)}
            title="Trend Alerts"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
              transition: "all 0.15s",
              background: "transparent",
              border: `1px solid ${alertsOpen ? C.text : C.border}`,
              color: alertsOpen ? C.text : C.textSub,
            }}
            onMouseEnter={(e) => {
              if (!alertsOpen) {
                e.currentTarget.style.color = C.text;
                e.currentTarget.style.borderColor = C.textSub;
              }
            }}
            onMouseLeave={(e) => {
              if (!alertsOpen) {
                e.currentTarget.style.color = C.textSub;
                e.currentTarget.style.borderColor = C.border;
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "2px" }}>
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <span>Trends</span>
            {unreadCount > 0 && (
              <span style={{
                background: C.red,
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                marginLeft: "4px",
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 3: Vertical selector — always full width */}
        <div style={{ marginTop: "4px" }}>
          <VerticalSelector
            selected={vertical}
            onChange={(v) => { setVertical(v); setCompareSelection([]); }}
            userVerticals={userVerticals}
            showMine={showMine}
            setShowMine={setShowMine}
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <StatCard
          index={0}
          label="Repos Tracked"
          value={overview.total_repos}
          sub={overview.discovered_repos > 0
            ? `+${overview.discovered_repos} auto-discovered`
            : "curated baseline"}
        />
        <StatCard
          index={1}
          label="Top Category"
          value={topCat?.category ?? "—"}
          sub={topCat ? `${topCat.total_stars.toLocaleString()} total stars` : undefined}
        />
        <StatCard
          index={2}
          label={`#1 — ${PERIODS.find(p => p.key === period)?.label ?? period} Momentum`}
          value={topLeaderEntry ? `${topLeaderEntry.owner}/${topLeaderEntry.name}` : "—"}
          sub={topLeaderEntry
            ? `★ ${topLeaderEntry.current_stars.toLocaleString()} stars`
            : undefined}
        />
        <StatCard
          index={3}
          label="Healthy Repos"
          value={greenCount}
          sub={`of ${overview.total_repos} active`}
        />
      </div>

      {/* Category Charts Row */}
      <ModernCategoryTrendScore data={categoriesData ?? overview.category_growth} period={period} />
      <div className="chart-row-2">
        <ModernCategoryCards data={categoriesData ?? overview.category_growth} />
        <ModernPRChart data={categoriesData ?? overview.category_growth} period={period} />
      </div>

      {/* Ecosystem Map — trend vs sustainability per repo */}
      {radarRepos && radarRepos.length > 0 && (
        <EcosystemMapChart repos={radarRepos} title={`${verticalLabel} Ecosystem Map`} />
      )}

      {/* Period + Vertical Leaderboard */}
      <div className="table-scroll">
      <LeaderboardTable
        entries={leaderboard?.entries ?? []}
        period={period}
        isLoading={leaderboardLoading}
        compareSelection={compareSelection}
        onToggleCompare={toggleCompare}
        isPinned={isPinned}
        onTogglePin={(entry) => togglePin({
          repo_id: entry.repo_id,
          owner: entry.owner,
          name: entry.name,
          github_url: entry.github_url,
        })}
      />
      </div>

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">★ Watchlist</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--cyan)", border: "1px solid var(--cyan)", padding: "2px 8px", letterSpacing: "0.08em" }}>{watchlist.length}</span>
          </div>
          <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)" }}>
            {watchlist.map((item) => (
              <div key={item.repo_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "var(--bg-surface)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,229,255,0.025)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
              >
                <a href={`/repo/${item.owner}/${item.name}`} style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", textDecoration: "none" }}>
                  {item.owner}/{item.name}
                </a>
                <button
                  onClick={() => togglePin(item)}
                  style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer", color: "var(--pink)", fontSize: "10px", padding: "2px 8px", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sustainability Ranking */}
      <SustainabilityRanking repos={overview.sustainability_ranking} />
    </div>
  );
}
