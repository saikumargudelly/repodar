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

function StatCard({ label, value, sub, index = 0 }: { label: string; value: string | number; sub?: string; index?: number }) {
  return (
    <div className="kpi-card card-pad">
      <div className="kpi-label">// {label}</div>
      <div className="kpi-value">{value}</div>
      {sub && (
        <div className="kpi-sub">
          {/^[+]/.test(String(sub))
            ? <><em>{String(sub).split(' ')[0]}</em>{' '}{String(sub).split(' ').slice(1).join(' ')}</>
            : sub}
        </div>
      )}
      <div className="kpi-corner">{String(index + 1).padStart(2, '0')}</div>
    </div>
  );
}

function PeriodSelector({ selected, onChange }: { selected: Period; onChange: (p: Period) => void }) {
  return (
    <div className="scroll-selector" style={{ display: "flex", gap: "2px" }}>
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`filter-btn-cyber${selected === key ? ' active' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function VerticalSelector({ selected, onChange }: { selected: Vertical; onChange: (v: Vertical) => void }) {
  return (
    <div className="scroll-selector" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {VERTICALS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`cat-pill-cyber${selected === key ? ' active' : ''}`}
        >
          {label}
        </button>
      ))}
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
    <div className="panel">
      <div className="panel-header">
        <div style={{ minWidth: 0 }}>
          <div className="panel-title">
            ◈ Category Trend Score ({periodLabel})
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", letterSpacing: "0.06em" }}>
            // Stars 40% · Acceleration 20% · Contributors 20% · Releases 10% · Issues 10%
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "var(--text-muted)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
          {[["#39ff14", "HIGH"], ["#ffab00", "MID"], ["#4a5a68", "LOW"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: 8, height: 8, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 24px" }}>
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
    </div>
  );
}

// ─── Chart 2: Stars Distribution (Donut) ────────────────────────────────────
function CategoryStarsChart({ data }: { data: CategoryMetrics[] }) {
  const chartData = [...data].sort((a, b) => b.total_stars - a.total_stars);
  const total = chartData.reduce((s, c) => s + c.total_stars, 0);
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">◇ Stars Distribution</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
            // {total.toLocaleString()} total stars across all categories
          </div>
        </div>
      </div>
      <div style={{ padding: "16px 24px", flex: 1 }}>
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
                    width: 10, height: 10, flexShrink: 0,
                    background: CATEGORY_COLORS[cat.category] ?? "#6b7280",
                    display: "inline-block",
                  }} />
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                    {cat.category}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "auto", paddingLeft: "12px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
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
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">⬡ PR Activity ({periodLabel})</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
            // Merged PRs (cumulative) · Open PRs (avg/repo)
          </div>
        </div>
      </div>
      <div style={{ padding: "16px 24px" }}>
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
  const router = useRouter();
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">▲ Top Repos — {periodLabel}</div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--cyan)", border: "1px solid rgba(0,229,255,0.2)", padding: "2px 8px", letterSpacing: "0.1em" }}>
          LIVE · GITHUB SEARCH API
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: "32px", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px", letterSpacing: "0.1em" }}>
          // SEARCHING GITHUB…
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px", letterSpacing: "0.08em" }}>
          // No repos found for this period. Try a longer window.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              {["", "#", "Repo / Description", "Category", "Stars / Gained", "Forks", "Open Issues", "Age", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "9px 12px",
                  textAlign: ["#", "Stars / Gained", "Forks", "Open Issues", "Age"].includes(h) ? "right" : "left",
                  fontWeight: 500, fontSize: "9px", letterSpacing: "0.2em", whiteSpace: "nowrap", textTransform: "uppercase",
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
                    onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                  >
                    {repo.rank}
                  </td>
                  <td
                    style={{ padding: "12px 12px", maxWidth: "340px", cursor: "pointer" }}
                    onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
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
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">◈ Sustainability Ranking</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {repos.length === 0 ? (
          <div style={{ padding: "20px 24px", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px", letterSpacing: "0.08em" }}>
            // No sustainability data yet — scores will populate after first ingestion run.
          </div>
        ) : repos.slice(0, 15).map((repo, i) => (
          <div
            key={repo.repo_id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", cursor: "pointer", minWidth: 0, borderBottom: "1px solid rgba(28,40,48,0.6)", transition: "background 0.15s" }}
            onClick={() => router.push(`/repo/${repo.repo_id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,229,255,0.025)")}
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
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">◎ AI Ecosystem Map</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
            // X-axis: Trend Score · Y-axis: Sustainability Score · Each dot = one repo
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: "10px", maxWidth: "50%", justifyContent: "flex-end" }}>
          {categories.map((c) => (
            <span key={c} style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              <span style={{ width: 7, height: 7, background: CATEGORY_COLORS[c] ?? "#888", display: "inline-block", clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
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
          { bg: "rgba(57,255,20,0.06)", border: "var(--green)", label: "◈ Rising Stars", desc: "High trend · high sustainability" },
          { bg: "rgba(255,171,0,0.06)", border: "var(--amber)", label: "▲ Breakouts", desc: "High trend · lower sustainability" },
          { bg: "rgba(0,229,255,0.06)", border: "var(--cyan)", label: "⬡ Established", desc: "Lower trend · high sustainability" },
          { bg: "rgba(255,61,107,0.06)", border: "var(--pink)", label: "⚠ Watch", desc: "Low trend · low sustainability" },
        ].map(({ bg, border, label, desc }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}22`, padding: "6px 10px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
            <span style={{ color: border, letterSpacing: "0.06em" }}>{label}</span>
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
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)", transition: "transform 0.2s", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
          <span className="panel-title">
            ▲ Trend Alerts
          </span>
          {unread > 0 && (
            <span className="alert-badge-cyber">
              {unread} NEW
            </span>
          )}
          {collapsed && alerts.length > 0 && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
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
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              Last {alerts.length} alerts · click to dismiss
            </span>
          </div>
        )}
      </div>

      {!collapsed && (alerts.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "center", padding: "16px 20px", letterSpacing: "0.08em" }}>
          // No active alerts — scores will trigger alerts after sufficient data accumulates.
        </p>
      ) : (
        <div>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => !alert.is_read && onMarkRead(alert.id)}
              className={`alert-row-cyber${alert.is_read ? " read" : ""}`}
            >
              <span style={{ fontSize: "16px", flexShrink: 0 }}>
                {ALERT_ICONS[alert.alert_type] ?? "★"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "3px" }}>
                  <strong style={{ color: "var(--cyan)", fontWeight: 700 }}>{alert.headline.split(" gained")[0]}</strong>
                  {alert.headline.includes(" gained") ? " gained" + alert.headline.split(" gained")[1] : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
                  <span style={{ border: "1px solid rgba(0,229,255,0.2)", color: "var(--cyan)", padding: "1px 5px", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {alert.category}
                  </span>
                  {new Date(alert.triggered_at).toLocaleString()}
                </div>
              </div>
              {!alert.is_read && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pink)", boxShadow: "0 0 6px var(--pink)", flexShrink: 0 }} />
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
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)", letterSpacing: "0.15em", fontSize: "11px" }}>
          // LOADING ECOSYSTEM DATA<span className="terminal-cursor" />
        </p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div style={{ paddingTop: "40px" }}>
        <div className="panel" style={{ padding: "24px" }}>
          <p style={{ color: "var(--pink)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.08em" }}>
            ✕ BACKEND NOT REACHABLE
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontFamily: "var(--font-mono)", lineHeight: 1.8 }}>
            Start the FastAPI server: <code style={{ color: "var(--cyan)" }}>make dev-backend</code><br />
            Run first-time setup: <code style={{ color: "var(--cyan)" }}>POST /admin/run-all</code> from the API docs at <code style={{ color: "var(--cyan)" }}>localhost:8000/docs</code>
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
          position: "fixed", bottom: "32px", left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-surface)", border: "1px solid var(--cyan)",
          padding: "10px 20px",
          display: "flex", alignItems: "center", gap: "16px", zIndex: 300,
          boxShadow: "0 0 24px rgba(0,229,255,0.25)",
          clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em" }}>
            {compareSelection.length} REPOS SELECTED
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

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div className="section-title-cyber">
            Ecosystem <span>Overview</span>
            <span className="terminal-cursor" />
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--text-muted)", letterSpacing: "0.12em",
            marginTop: "6px", textTransform: "uppercase",
          }}>
            // as_of: {overview.as_of} · filter: {PERIODS.find(p => p.key === period)?.label ?? period} · category: {VERTICALS.find(v => v.key === vertical)?.label ?? vertical}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end", minWidth: 0 }}>
          <PeriodSelector selected={period} onChange={setPeriod} />
          <VerticalSelector selected={vertical} onChange={(v) => { setVertical(v); setCompareSelection([]); }} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" style={{ gap: '1px', background: 'var(--border)' }}>
        <StatCard
          index={0}
          label="repos_tracked"
          value={overview.total_repos}
          sub={overview.discovered_repos > 0
            ? `+${overview.discovered_repos} auto-discovered`
            : "curated baseline"}
        />
        <StatCard
          index={1}
          label="top_category"
          value={topCat?.category ?? "—"}
          sub={topCat ? `${topCat.total_stars.toLocaleString()} total stars` : undefined}
        />
        <StatCard
          index={2}
          label={`#1 — ${PERIODS.find(p => p.key === period)?.label ?? period} momentum`}
          value={topLeaderEntry ? `${topLeaderEntry.owner}/${topLeaderEntry.name}` : "—"}
          sub={topLeaderEntry
            ? `★ ${topLeaderEntry.current_stars.toLocaleString()} stars`
            : undefined}
        />
        <StatCard
          index={3}
          label="green_score"
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
