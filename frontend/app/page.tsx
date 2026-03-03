"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  api, Period, Vertical, CategoryMetrics, SustainabilityEntry, LeaderboardEntry,
} from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

const CATEGORY_COLORS: Record<string, string> = {
  "LLM Models": "#3b82f6",
  "Agent Frameworks": "#8b5cf6",
  "Inference Engines": "#f59e0b",
  "Vector Databases": "#10b981",
  "Model Serving / Runtimes": "#06b6d4",
  "Distributed Compute / Infra": "#f97316",
  "Evaluation Frameworks": "#84cc16",
  "Fine-tuning Toolkits": "#ec4899",
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
  { key: "ai_ml",           label: "AI / ML" },
  { key: "devtools",        label: "DevTools" },
  { key: "web_frameworks",  label: "Web Frameworks" },
  { key: "security",        label: "Security" },
  { key: "data_engineering",label: "Data Eng" },
  { key: "blockchain",      label: "Blockchain" },
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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      padding: "20px 24px",
    }}>
      <p style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", margin: "0 0 6px" }}>
        {label}
      </p>
      <p style={{ fontSize: "28px", fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function PeriodSelector({ selected, onChange }: { selected: Period; onChange: (p: Period) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "4px" }}>
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: "5px 14px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: selected === key ? 600 : 400,
            background: selected === key ? "var(--accent-blue)" : "transparent",
            color: selected === key ? "#fff" : "var(--text-muted)",
            transition: "all 0.15s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function VerticalSelector({ selected, onChange }: { selected: Vertical; onChange: (v: Vertical) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "4px" }}>
      {VERTICALS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: selected === key ? 600 : 400,
            background: selected === key ? "#7c3aed" : "transparent",
            color: selected === key ? "#fff" : "var(--text-muted)",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CategoryHeatmap({ data, period }: { data: CategoryMetrics[]; period: Period }) {
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;
  const chartData = [...data].sort((a, b) => b.trend_composite - a.trend_composite);
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 2px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            Category Heatmap — Trend Score ({periodLabel})
          </h2>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
            Weighted: Stars 40% · Acceleration 20% · Contributors 20% · Releases 10% · Issues 10%
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical" barSize={20} margin={{ left: 20, right: 60 }}>
          <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `${(v * 100).toFixed(0)}`} />
          <YAxis type="category" dataKey="category" width={190} tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              const cat = payload[0]?.payload as CategoryMetrics;
              return (
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-primary)" }}>{label}</p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Trend Score: <strong>{((cat?.trend_composite ?? 0) * 100).toFixed(1)}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Total Stars: <strong>{cat?.total_stars?.toLocaleString()}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Contributors: <strong>{cat?.total_contributors?.toLocaleString()}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Merged PRs: <strong>{cat?.total_merged_prs?.toLocaleString()}</strong></p>
                  <p style={{ margin: 0, color: "var(--text-muted)" }}>{cat?.repo_count} repos tracked</p>
                </div>
              );
            }}
          />
          <Bar dataKey="trend_composite" radius={[0, 4, 4, 0]}>
            {chartData.map((cat) => (
              <Cell key={cat.category} fill={CATEGORY_COLORS[cat.category] ?? "#6b7280"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryPieCharts({ data }: { data: CategoryMetrics[] }) {
  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx?: number; cy?: number; midAngle?: number;
    innerRadius?: number; outerRadius?: number; percent?: number;
  }) => {
    const pct = percent ?? 0;
    if (pct < 0.05) return null;
    const ir = innerRadius ?? 0;
    const or = outerRadius ?? 0;
    const r  = ir + (or - ir) * 0.5;
    const x  = (cx ?? 0) + r * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y  = (cy ?? 0) + r * Math.sin(-(midAngle ?? 0) * RADIAN);
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>{`${(pct * 100).toFixed(0)}%`}</text>;
  };

  const starData  = data.map((d) => ({ name: d.category, value: d.total_stars }));
  const prData    = data.map((d) => ({ name: d.category, value: d.total_merged_prs }));
  const hasPrData = data.some((d) => d.total_merged_prs > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
      {/* Stars Pie */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px 24px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 16px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
          ⭐ Stars by Category
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={starData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              outerRadius={90}
              labelLine={false}
              label={renderLabel}
            >
              {starData.map((entry) => (
                <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#6b7280"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number | undefined) => (v ?? 0).toLocaleString()}
              contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", color: "var(--text-muted)", paddingTop: "8px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* PRs Pie */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            🔀 Merged PRs by Category
          </h2>
          {!hasPrData && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: "4px" }}>
              Run ingest to populate
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={hasPrData ? prData : data.map((d) => ({ name: d.category, value: d.repo_count }))}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              outerRadius={90}
              labelLine={false}
              label={renderLabel}
            >
              {data.map((entry) => (
                <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number | undefined, name: string | undefined) => [
                (v ?? 0).toLocaleString(),
                hasPrData ? (name ?? "") : `${name ?? ""} (repo count)`
              ]}
              contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", color: "var(--text-muted)", paddingTop: "8px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
          Top Repos — {periodLabel}
        </h2>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "3px 10px", borderRadius: "4px" }}>
          Live · GitHub Search API
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Searching GitHub…
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          No repos found for this period. Try a longer window.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              {["", "#", "Repo / Description", "Category", "Stars / Gained", "Forks", "Open Issues", "Age", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "10px 12px",
                  textAlign: ["#", "Stars / Gained", "Forks", "Open Issues", "Age"].includes(h) ? "right" : "left",
                  fontWeight: 500, fontSize: "11px", letterSpacing: "0.5px", whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((repo) => {
              const selected = compareSelection.includes(repo.repo_id);
              const pinned = isPinned(repo.repo_id);
              return (
                <tr
                  key={repo.repo_id}
                  style={{ borderBottom: "1px solid var(--border)", background: selected ? "rgba(124,58,237,0.06)" : "transparent" }}
                >
                  {/* Compare checkbox */}
                  <td style={{ padding: "10px 8px 10px 16px", width: "28px", verticalAlign: "top" }}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleCompare(repo.repo_id)}
                      title="Add to comparison"
                      style={{ cursor: "pointer", accentColor: "#7c3aed" }}
                    />
                  </td>
                  <td
                    style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-muted)", width: "40px", verticalAlign: "top", cursor: "pointer" }}
                    onClick={() => window.open(repo.github_url, "_blank", "noopener")}
                  >
                    {repo.rank}
                  </td>
                  <td
                    style={{ padding: "12px 12px", maxWidth: "340px", cursor: "pointer" }}
                    onClick={() => window.open(repo.github_url, "_blank", "noopener")}
                    onMouseEnter={(e) => (e.currentTarget.closest("tr")!.style.background = selected ? "rgba(124,58,237,0.10)" : "var(--bg-elevated)")}
                    onMouseLeave={(e) => (e.currentTarget.closest("tr")!.style.background = selected ? "rgba(124,58,237,0.06)" : "transparent")}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span><span style={{ fontWeight: 600 }}>{repo.owner}/</span>{repo.name}</span>
                        {repo.primary_language && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>
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
                          {repo.topics.slice(0, 4).map((t) => (
                            <span key={t} style={{ fontSize: "10px", color: "var(--accent-blue)", background: "rgba(59,130,246,0.1)", padding: "1px 5px", borderRadius: "3px" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 12px", color: "var(--text-muted)", fontSize: "12px", verticalAlign: "top" }}>{repo.category}</td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "var(--accent-blue)", verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                      <span>{repo.current_stars.toLocaleString()} ⭐</span>
                      {repo.star_gain_label && (
                        <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--accent-green)" }}>
                          +{repo.star_gain_label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)", verticalAlign: "top" }}>
                    {repo.current_forks.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)", verticalAlign: "top" }}>
                    {repo.open_issues != null ? repo.open_issues.toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-muted)", fontSize: "12px", verticalAlign: "top" }}>
                    {repo.age_days}d
                  </td>
                  {/* Pin button */}
                  <td style={{ padding: "12px 12px", verticalAlign: "top", width: "32px" }}>
                    <button
                      onClick={() => onTogglePin(repo)}
                      title={pinned ? "Remove from watchlist" : "Add to watchlist"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "16px",
                        opacity: pinned ? 1 : 0.3,
                        transition: "opacity 0.15s",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = pinned ? "1" : "0.3")}
                    >
                      {pinned ? "★" : "☆"}
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
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
      <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 16px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
        Sustainability Ranking
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {repos.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No sustainability data yet — scores will populate after first ingestion run.
          </div>
        ) : repos.slice(0, 15).map((repo, i) => (
          <div
            key={repo.repo_id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: "6px", cursor: "pointer" }}
            onClick={() => router.push(`/repo/${repo.repo_id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "12px", width: "22px", textAlign: "right" }}>{i + 1}</span>
              <div>
                <span style={{ fontSize: "13px", fontWeight: 500 }}>{repo.owner}/{repo.name}</span>
                <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--text-muted)" }}>{repo.category}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)" }}>
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

export default function OverviewPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("7d");
  const [vertical, setVertical] = useState<Vertical>("ai_ml");
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const { items: watchlist, toggle: togglePin, isPinned } = useWatchlist();

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
    queryFn: () => api.getLeaderboard(period, undefined, 20, vertical),
  });

  const toggleCompare = (repo_id: string) => {
    setCompareSelection((prev) =>
      prev.includes(repo_id)
        ? prev.filter((x) => x !== repo_id)
        : prev.length < 5 ? [...prev, repo_id] : prev
    );
  };

  const openCompare = () => {
    if (compareSelection.length >= 2) {
      router.push(`/compare?ids=${compareSelection.join(",")}`);
    }
  };

  if (overviewLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading ecosystem data...</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div style={{ paddingTop: "40px" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--accent-red)", borderRadius: "10px", padding: "24px" }}>
          <p style={{ color: "var(--accent-red)", fontWeight: 600, marginBottom: "8px" }}>Backend not reachable</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Start the FastAPI server: <code>make dev-backend</code><br />
            Run first-time setup: <code>POST /admin/run-all</code> from the API docs at <code>localhost:8000/docs</code>
          </p>
        </div>
      </div>
    );
  }

  const greenCount = overview.sustainability_ranking.filter((r) => r.sustainability_label === "GREEN").length;
  const topCat = overview.category_growth[0];
  const topLeaderEntry = leaderboard?.entries[0];
  const verticalLabel = VERTICALS.find((v) => v.key === vertical)?.label ?? "AI / ML";

  return (
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Floating compare bar */}
      {compareSelection.length >= 2 && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          background: "#7c3aed", color: "#fff", borderRadius: "10px", padding: "12px 24px",
          display: "flex", alignItems: "center", gap: "16px", zIndex: 200,
          boxShadow: "0 8px 32px rgba(124,58,237,0.4)",
        }}>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>
            {compareSelection.length} repos selected
          </span>
          <button
            onClick={openCompare}
            style={{ background: "#fff", color: "#7c3aed", border: "none", borderRadius: "6px", padding: "6px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            Compare →
          </button>
          <button
            onClick={() => setCompareSelection([])}
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Ecosystem Overview</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>As of {overview.as_of}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
          <PeriodSelector selected={period} onChange={setPeriod} />
          <VerticalSelector selected={vertical} onChange={(v) => { setVertical(v); setCompareSelection([]); }} />
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
        <StatCard label="Repos Tracked" value={overview.total_repos} />
        <StatCard
          label="Top Category"
          value={topCat?.category ?? "—"}
          sub={topCat ? `${topCat.total_stars.toLocaleString()} total stars` : undefined}
        />
        <StatCard
          label={`#1 — ${PERIODS.find(p => p.key === period)?.label ?? period}`}
          value={topLeaderEntry ? `${topLeaderEntry.owner}/${topLeaderEntry.name}` : "—"}
          sub={topLeaderEntry
            ? `${topLeaderEntry.current_stars.toLocaleString()} ⭐`
            : undefined}
        />
        <StatCard
          label="Green Sustainability"
          value={greenCount}
          sub={`of ${overview.sustainability_ranking.length} scored`}
        />
      </div>

      {/* Category Heatmap + Pie Charts */}
      <CategoryHeatmap data={categoriesData ?? overview.category_growth} period={period} />
      <CategoryPieCharts data={categoriesData ?? overview.category_growth} />

      {/* Period + Vertical Leaderboard */}
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

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 16px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            ★ Watchlist ({watchlist.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {watchlist.map((item) => (
              <div key={item.repo_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "6px", background: "var(--bg-elevated)" }}>
                <a href={item.github_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", textDecoration: "none" }}>
                  {item.owner}/{item.name}
                </a>
                <button
                  onClick={() => togglePin(item)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "12px", padding: "2px 6px" }}
                >
                  Remove
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
