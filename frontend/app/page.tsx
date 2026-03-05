"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
    <div className="card-pad" style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      padding: "20px 24px",
    }}>
      <p style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", margin: "0 0 6px" }}>
        {label}
      </p>
      <p className="stat-value">{value}</p>
      {sub && <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function PeriodSelector({ selected, onChange }: { selected: Period; onChange: (p: Period) => void }) {
  return (
    <div className="scroll-selector" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "4px" }}>
      <div style={{ display: "flex", gap: "4px" }}>
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
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </button>
      ))}
      </div>
    </div>
  );
}

function VerticalSelector({ selected, onChange }: { selected: Vertical; onChange: (v: Vertical) => void }) {
  return (
    <div className="scroll-selector" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "4px" }}>
      <div style={{ display: "flex", gap: "4px" }}>
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
    </div>
  );
}

// ─── Trend score colour (high=green, mid=amber, low=slate) ─────────────────
function trendColor(score: number): string {
  if (score >= 0.65) return "#22c55e";
  if (score >= 0.40) return "#f59e0b";
  return "#6b7280";
}

// ─── Chart 1: Category Trend Heatmap ────────────────────────────────────────
function CategoryTrendHeatmap({ data, period }: { data: CategoryMetrics[]; period: Period }) {
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;
  const chartData = [...data].sort((a, b) => b.trend_composite - a.trend_composite);
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            Category Trend Score ({periodLabel})
          </h2>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
            Composite: Stars 40% · Acceleration 20% · Contributors 20% · Releases 10% · Issues 10%
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
          {[["#22c55e", "High"], ["#f59e0b", "Mid"], ["#6b7280", "Low"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" barSize={18} margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}`} />
          <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 10, fill: "var(--text-secondary)", width: 110 }} />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              const c = payload[0]?.payload as CategoryMetrics;
              return (
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>{label}</p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Trend Score: <strong style={{ color: trendColor(c.trend_composite) }}>{(c.trend_composite * 100).toFixed(0)}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Stars gained: <strong>{c.period_star_gain.toLocaleString()}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Contributors: <strong>{c.total_contributors.toLocaleString()}</strong></p>
                  <p style={{ margin: 0, color: "var(--text-muted)" }}>{c.repo_count} repos</p>
                </div>
              );
            }}
          />
          <Bar dataKey="trend_composite" radius={[0, 4, 4, 0]}>
            {chartData.map((cat) => (
              <Cell key={cat.category} fill={trendColor(cat.trend_composite)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Chart 2: Stars Distribution (Donut) ────────────────────────────────────
function CategoryStarsChart({ data }: { data: CategoryMetrics[] }) {
  const chartData = [...data].sort((a, b) => b.total_stars - a.total_stars);
  const total = chartData.reduce((s, c) => s + c.total_stars, 0);
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px", display: "flex", flexDirection: "column", gap: "0" }}>
      <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
        Stars Distribution
      </h2>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 16px" }}>
        {total.toLocaleString()} total stars across all categories
      </p>

      {/* Chart + legend side by side on desktop, stacked on mobile */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        {/* Pie chart — takes up as much space as available */}
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart margin={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Pie
                data={chartData}
                dataKey="total_stars"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius="38%"
                outerRadius="72%"
                paddingAngle={2}
                label={({ cx, cy, midAngle, innerRadius: ir, outerRadius: or, percent }) => {
                  if (!percent || percent < 0.04 || midAngle == null) return null; // skip tiny slices
                  const RADIAN = Math.PI / 180;
                  const r = Number(ir) + (Number(or) - Number(ir)) * 1.35;
                  const x = Number(cx) + r * Math.cos(-midAngle * RADIAN);
                  const y = Number(cy) + r * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="var(--text-muted)" textAnchor={x > Number(cx) ? "start" : "end"} dominantBaseline="central" fontSize={10}>
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
                labelLine={{ stroke: "var(--border)", strokeWidth: 1 }}
              >
                {chartData.map((cat) => (
                  <Cell key={cat.category} fill={CATEGORY_COLORS[cat.category] ?? "#6b7280"} />
                ))}
              </Pie>
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const c = payload[0]?.payload as CategoryMetrics;
                  const pct = total > 0 ? ((c.total_stars / total) * 100).toFixed(1) : "0";
                  return (
                    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
                      <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-primary)" }}>{c.category}</p>
                      <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Stars: <strong>{c.total_stars.toLocaleString()}</strong></p>
                      <p style={{ margin: 0, color: "var(--text-muted)" }}>Share: <strong>{pct}%</strong></p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend — stacked vertically next to the pie */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
          {chartData.map((cat) => {
            const pct = total > 0 ? ((cat.total_stars / total) * 100).toFixed(1) : "0";
            return (
              <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "2px", flexShrink: 0,
                  background: CATEGORY_COLORS[cat.category] ?? "#6b7280",
                  display: "inline-block",
                }} />
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  {cat.category}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto", paddingLeft: "12px", fontFamily: "monospace", fontWeight: 600 }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Chart 3: PR Activity ────────────────────────────────────────────────────
function CategoryPRChart({ data, period }: { data: CategoryMetrics[]; period: Period }) {
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;
  const chartData = [...data]
    .sort((a, b) => (b.total_merged_prs + b.avg_open_prs) - (a.total_merged_prs + a.avg_open_prs))
    .slice(0, 8);
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
      <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
        PR Activity
      </h2>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 16px" }}>
        Merged PRs (cumulative) · Open PRs (avg/repo)
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical" barSize={10} margin={{ left: 0, right: 20, top: 4, bottom: 4 }} barGap={2}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 10, fill: "var(--text-secondary)", width: 110 }} />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              const c = payload[0]?.payload as CategoryMetrics;
              return (
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>{label}</p>
                  <p style={{ margin: "0 0 2px", color: "#a78bfa" }}>Merged PRs: <strong>{c.total_merged_prs.toLocaleString()}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "#67e8f9" }}>Open PRs: <strong>{c.avg_open_prs.toFixed(1)} avg/repo</strong></p>
                  {c.period_pr_gain > 0 && <p style={{ margin: 0, color: "var(--text-muted)" }}>New ({periodLabel}): <strong>+{c.period_pr_gain}</strong></p>}
                </div>
              );
            }}
          />
          <Bar dataKey="total_merged_prs" name="Merged PRs" fill="#a78bfa" radius={[0, 3, 3, 0]} />
          <Bar dataKey="avg_open_prs" name="Avg open PRs" fill="#67e8f9" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px" }}>
      <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--border)" }}>
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
              const slug = `${repo.owner}/${repo.name}`;
              const selected = compareSelection.includes(slug);
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
                      onChange={() => onToggleCompare(slug)}
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
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: "6px", cursor: "pointer", minWidth: 0 }}
            onClick={() => router.push(`/repo/${repo.repo_id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
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

// ─── Ecosystem Map Chart (scatter: trend vs sustainability) ─────────────────
function EcosystemMapChart({ repos }: { repos: RadarRepo[] }) {
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
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      padding: "24px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            AI Ecosystem Map
          </h2>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
            X-axis: Trend Score · Y-axis: Sustainability Score · Each dot = one repo
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: "10px", maxWidth: "100%", justifyContent: "flex-start" }}>
          {categories.map((c) => (
            <span key={c} style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLORS[c] ?? "#888", display: "inline-block" }} />
              {c}
            </span>
          ))}
        </div>
      </div>
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
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{d.owner}/{d.name}</p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Trend: <strong>{d.x}</strong></p>
                  <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Sustainability: <strong>{d.y}</strong></p>
                  <p style={{ margin: 0, color: CATEGORY_COLORS[d.category] ?? "#888", fontSize: "11px" }}>{d.category}</p>
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
          { bg: "#22c55e22", label: "⭐ Rising Stars", desc: "High trend, high sustainability" },
          { bg: "#f59e0b22", label: "🚀 Breakouts", desc: "High trend, lower sustainability" },
          { bg: "#3b82f622", label: "🏛 Established", desc: "Lower trend, high sustainability" },
          { bg: "#6b728022", label: "⚠ Watch", desc: "Low trend, low sustainability" },
        ].map(({ bg, label, desc }) => (
          <div key={label} style={{ background: bg, borderRadius: "6px", padding: "6px 10px", fontSize: "11px" }}>
            <span style={{ fontWeight: 600 }}>{label}</span>
            <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>{desc}</span>
          </div>
        ))}
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
  new_breakout: "🔥",
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
  const unread = alerts.filter((a) => !a.is_read).length;
  const [collapsed, setCollapsed] = useState(false);

  const handleDismissAll = () => {
    onDismissAll();
    setCollapsed(true);
  };

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      padding: collapsed ? "14px 24px" : "24px",
      transition: "padding 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed ? 0 : "16px" }}>
        {/* Left: title + badge + expand toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <span style={{ fontSize: "13px", color: "var(--text-muted)", transition: "transform 0.2s", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
          <h2 style={{ fontSize: "13px", fontWeight: 600, margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            Trend Alerts
          </h2>
          {unread > 0 && (
            <span style={{
              background: "#ef4444",
              color: "#fff",
              borderRadius: "999px",
              fontSize: "10px",
              fontWeight: 700,
              padding: "1px 7px",
              lineHeight: "16px",
            }}>
              {unread} new
            </span>
          )}
          {collapsed && alerts.length > 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              — {alerts.length} alert{alerts.length !== 1 ? "s" : ""} (click to expand)
            </span>
          )}
        </button>

        {/* Right: dismiss all + hint */}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {unread > 0 && (
              <button
                onClick={handleDismissAll}
                style={{
                  padding: "4px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Dismiss All
              </button>
            )}
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Last {alerts.length} alerts · click to dismiss
            </span>
          </div>
        )}
      </div>

      {!collapsed && (alerts.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "12px 0" }}>
          No active alerts — scores will trigger alerts after sufficient data accumulates.
        </p>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {alerts.map((alert) => (
          <div
            key={alert.id}
            onClick={() => !alert.is_read && onMarkRead(alert.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: alert.is_read ? "transparent" : "rgba(239,68,68,0.07)",
              cursor: alert.is_read ? "default" : "pointer",
              opacity: alert.is_read ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1 }}>
              {ALERT_ICONS[alert.alert_type] ?? "🔔"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {alert.headline}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                {alert.category} · {new Date(alert.triggered_at).toLocaleString()}
              </p>
            </div>
            {!alert.is_read && (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
      ))}
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

  // Ecosystem map — full repo set with both scores
  const { data: radarRepos } = useQuery({
    queryKey: ["radar"],
    queryFn: () => api.getRadar(false),
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
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch", minWidth: 0, maxWidth: "100%" }}>
          <PeriodSelector selected={period} onChange={setPeriod} />
          <VerticalSelector selected={vertical} onChange={(v) => { setVertical(v); setCompareSelection([]); }} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <StatCard
          label="Repos Tracked"
          value={overview.total_repos}
          sub={overview.discovered_repos > 0
            ? `+${overview.discovered_repos} auto-discovered`
            : "curated baseline"}
        />
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

      {/* Trend Alerts */}
      <AlertsPanel alerts={alerts} onMarkRead={handleMarkAlertRead} onDismissAll={handleDismissAllAlerts} />

      {/* Category Charts Row */}
      <CategoryTrendHeatmap data={categoriesData ?? overview.category_growth} period={period} />
      <div className="chart-row-2">
        <CategoryStarsChart data={categoriesData ?? overview.category_growth} />
        <CategoryPRChart data={categoriesData ?? overview.category_growth} period={period} />
      </div>

      {/* Ecosystem Map — trend vs sustainability per repo */}
      {radarRepos && radarRepos.length > 0 && (
        <EcosystemMapChart repos={radarRepos} />
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
