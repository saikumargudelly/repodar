"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api, TopicMomentum, TopicRepo } from "@/lib/api";

// ── Score bar component ─────────────────────────────────────
function ScoreBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
      <div style={{ flex: 1, height: "6px", background: "var(--bg-dim)", borderRadius: "3px", overflow: "hidden" }}>
        <div
          style={{ height: "100%", background: "var(--accent-blue)", borderRadius: "3px", width: `${pct}%`, transition: "width 0.3s ease" }}
        />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", width: "48px", textAlign: "right" }}>
        {value.toFixed(4)}
      </span>
    </div>
  );
}

export default function TopicsPage() {
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [minRepos, setMinRepos] = useState(2);
  const [search, setSearch] = useState("");
  const [chartLimit, setChartLimit] = useState<15 | 20>(15);
  const [sortBy, setSortBy] = useState<"velocity" | "score" | "repos" | "accel">("velocity");

  const { data: topics, isLoading } = useQuery({
    queryKey: ["topic-momentum", minRepos],
    queryFn: () => api.getTopicMomentum({ min_repos: minRepos, limit: 50 }),
    staleTime: 10 * 60 * 1000,
  });

  const { data: topicRepos, isLoading: reposLoading } = useQuery({
    queryKey: ["topic-repos", selectedTopic],
    queryFn: () => api.getReposByTopic(selectedTopic!, 30),
    enabled: !!selectedTopic,
    staleTime: 5 * 60 * 1000,
  });

  // Filter list of topics by search input
  const filtered: TopicMomentum[] = (topics ?? []).filter((t) =>
    t.topic.toLowerCase().includes(search.toLowerCase())
  );

  // Sort filtered topics based on the active Sort Toggle
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") {
      return b.avg_trend_score - a.avg_trend_score;
    }
    if (sortBy === "repos") {
      return b.repo_count - a.repo_count;
    }
    if (sortBy === "accel") {
      return b.avg_acceleration - a.avg_acceleration;
    }
    return b.total_star_velocity - a.total_star_velocity;
  });

  // Sliced data for the velocity bar chart (always sorted by velocity descending)
  const chartData = [...filtered]
    .sort((a, b) => b.total_star_velocity - a.total_star_velocity)
    .slice(0, chartLimit)
    .map((t) => ({
      name: `#${t.topic}`,
      velocity: Math.round(t.total_star_velocity),
      avg_score: t.avg_trend_score,
    }));

  const maxScore = Math.max(...filtered.map((t) => t.avg_trend_score), 1);

  // Formatter helpers
  const formatVelocityHeader = (num: number) => {
    const sign = num >= 0 ? "+" : "";
    if (Math.abs(num) >= 1_000_000) {
      return `${sign}${(num / 1_000_000).toFixed(2)}M/d`;
    }
    if (Math.abs(num) >= 1000) {
      return `${sign}${(num / 1000).toFixed(1)}k/d`;
    }
    return `${sign}${num.toFixed(0)}/d`;
  };

  const formatTableVelocity = (num: number) => {
    const sign = num >= 0 ? "+" : "";
    if (Math.abs(num) >= 1_000_000) {
      return `${sign}${(num / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${sign}${(num / 1000).toFixed(1)}k`;
    }
    return `${sign}${num.toFixed(0)}`;
  };

  const formatYAxisTicks = (value: number) => {
    if (value >= 1000) return `${value / 1000}k`;
    return value.toString();
  };

  return (
    <div style={{ maxWidth: "80rem", margin: "0 auto", padding: "32px 0" }}>
      {/* ── Page Header ── */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>Topic intelligence</h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, fontFamily: "var(--font-sans)", marginTop: "4px" }}>
            GitHub topic tags ranked by combined star velocity &amp; trend score
          </p>
        </div>

        {/* Summary chips */}
        {topics && (
          <div className="topics-summary-chips">
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", display: "block" }}>Topics</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{filtered.length}</span>
            </div>
            <div style={{ width: "1px", height: "32px", background: "var(--border)" }} />
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", display: "block" }}>Avg score</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {filtered.length ? (filtered.reduce((s, t) => s + t.avg_trend_score, 0) / filtered.length).toFixed(3) : "0.000"}
              </span>
            </div>
            <div style={{ width: "1px", height: "32px", background: "var(--border)" }} />
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", display: "block" }}>Total velocity</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                {formatVelocityHeader(filtered.reduce((s, t) => s + t.total_star_velocity, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Chart Section ── */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
            <svg style={{ width: "16px", height: "16px", color: "var(--accent-blue)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Star velocity by topic — top {chartLimit}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)" }}>stars / day</span>
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", background: "var(--bg-elevated)" }}>
              <button
                onClick={() => setChartLimit(15)}
                style={{
                  padding: "4px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-sans)",
                  background: chartLimit === 15 ? "var(--bg-dim)" : "transparent",
                  color: chartLimit === 15 ? "var(--text-primary)" : "var(--text-muted)",
                  border: "none",
                  borderRight: "1px solid var(--border)",
                }}
              >
                Top 15
              </button>
              <button
                onClick={() => setChartLimit(20)}
                style={{
                  padding: "4px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-sans)",
                  background: chartLimit === 20 ? "var(--bg-dim)" : "transparent",
                  color: chartLimit === 20 ? "var(--text-primary)" : "var(--text-muted)",
                  border: "none",
                }}
              >
                Top 20
              </button>
            </div>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        {chartData.length > 0 ? (
          <div style={{ height: "240px", width: "100%", paddingRight: "16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, bottom: 35, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--text-muted)", fontWeight: 500 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatYAxisTicks}
                  tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(22, 27, 34, 0.75)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "var(--text-primary)",
                    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.45)",
                  }}
                  formatter={(v: any) => [`+${v}/d`, "Velocity"]}
                />
                <Bar
                  dataKey="velocity"
                  fill="var(--accent-blue)"
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    if (data && typeof data.name === "string") {
                      const cleanName = data.name.replace("#", "");
                      setSelectedTopic(selectedTopic === cleanName ? null : cleanName);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>No chart data available</div>
        )}
      </div>

      {/* ── Table Section Controls ── */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="topics-table-toolbar">
          <div className="topics-filter-inputs">
            {/* Search Input */}
            <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "260px" }}>
              <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, display: "flex", alignItems: "center", paddingLeft: "12px", pointerEvents: "none", color: "var(--text-muted)" }}>
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search topics…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "36px",
                  paddingRight: "12px",
                  paddingTop: "6px",
                  paddingBottom: "6px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            </div>

            {/* Min Repos input */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 12px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>Min repos</span>
              <input
                type="number"
                min={1}
                value={minRepos}
                onChange={(e) => setMinRepos(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: "32px", background: "transparent", color: "var(--text-primary)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "12px", outline: "none", textAlign: "center", border: "none" }}
              />
            </div>
          </div>

          {/* Sort selection buttons */}
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", background: "var(--bg-elevated)", marginLeft: "auto" }}>
            {(["velocity", "score", "repos", "accel"] as const).map((s, i, arr) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-sans)",
                  background: sortBy === s ? "var(--bg-dim)" : "transparent",
                  color: sortBy === s ? "var(--text-primary)" : "var(--text-muted)",
                  border: "none",
                  borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Topics Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["#", "Topic", "Repos", "Avg score", "Score bar", "Vel / day", "Accel"].map((h, i) => (
                  <th key={h} className={i === 2 || i === 4 ? "col-hide-mobile" : i === 3 || i === 6 ? "col-hide-tablet" : ""}
                    style={{ padding: "12px 16px", fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", textAlign: i >= 5 ? "center" : i === 3 ? "right" : "left" }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} style={{ padding: "24px 16px" }}><div style={{ height: "16px", background: "var(--bg-elevated)", borderRadius: "4px", width: "100%" }} /></td>
                  </tr>
                ))
              ) : sorted.map((t, idx) => (
                <tr
                  key={t.topic}
                  onClick={() => setSelectedTopic(selectedTopic === t.topic ? null : t.topic)}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: selectedTopic === t.topic ? "rgba(255,255,255,0.03)" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (selectedTopic !== t.topic) (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = selectedTopic === t.topic ? "rgba(255,255,255,0.03)" : "transparent"; }}
                >
                  {/* Rank */}
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>{idx + 1}</td>
                  {/* Topic name */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "13px" }}># {t.topic}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 500, fontFamily: "var(--font-sans)", marginTop: "2px" }}>{t.repo_count} repos</div>
                  </td>
                  {/* Repos count */}
                  <td className="col-hide-mobile" style={{ padding: "12px 16px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 700 }}>{t.repo_count}</td>
                  {/* Avg Trend Score */}
                  <td className="col-hide-tablet" style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>{t.avg_trend_score.toFixed(4)}</td>
                  {/* Score bar */}
                  <td className="col-hide-mobile" style={{ padding: "12px 16px", minWidth: "150px" }}>
                    <ScoreBar value={t.avg_trend_score} max={maxScore} />
                  </td>
                  {/* Total star velocity */}
                  <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent-green)", fontWeight: 700 }}>
                    {formatTableVelocity(t.total_star_velocity)}
                  </td>
                  {/* Acceleration pill */}
                  <td className="col-hide-tablet" style={{ padding: "12px 16px", textAlign: "center" }}>
                    {t.avg_acceleration > 0 ? (
                      <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, background: "rgba(63,185,80,0.12)", border: "1px solid rgba(63,185,80,0.3)", color: "var(--accent-green)" }}>
                        +{t.avg_acceleration.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 500, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        {t.avg_acceleration.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    No topics match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer controls inside table card */}
        <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "16px", background: "var(--bg-elevated)", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, fontFamily: "var(--font-sans)" }}>
            Showing {sorted.length} of {topics?.length ?? 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href="/early-radar"
              style={{ padding: "5px 14px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", transition: "all 0.15s" }}
            >
              Acceleration leaders <span style={{ fontSize: "11px" }}>↗</span>
            </Link>
            <Link
              href="/overview"
              style={{ padding: "5px 14px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", transition: "all 0.15s" }}
            >
              By category <span style={{ fontSize: "11px" }}>↗</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Slide-over Drawer for Selected Topic Detail ── */}
      {selectedTopic && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, overflow: "hidden" }}>
          {/* Backdrop */}
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", transition: "opacity 0.2s" }}
            onClick={() => setSelectedTopic(null)}
          />

          <div className="topics-drawer-container">
            <div style={{ width: "100vw", maxWidth: "448px", background: "var(--bg-primary)", borderLeft: "1px solid var(--border)", boxShadow: "0 0 40px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", height: "100%" }}>
              {/* Drawer Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", display: "block" }}>Topic Details</span>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0 0" }}>#{selectedTopic}</h2>
                </div>
                <button
                  onClick={() => setSelectedTopic(null)}
                  style={{ color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px", cursor: "pointer", background: "transparent", display: "flex", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                >
                  <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Topic Metrics */}
              {(() => {
                const td = topics?.find((t) => t.topic === selectedTopic);
                if (!td) return null;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "24px", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.01)" }}>
                    {[
                      { label: "Repos", val: String(td.repo_count), color: "var(--text-primary)" },
                      { label: "Avg Trend Score", val: td.avg_trend_score.toFixed(4), color: "var(--text-primary)" },
                      { label: "Velocity", val: `+${td.total_star_velocity.toFixed(1)}/d`, color: "var(--accent-green)" },
                      { label: "Acceleration", val: td.avg_acceleration.toFixed(2), color: td.avg_acceleration > 1 ? "var(--accent-green)" : "var(--text-secondary)" },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", display: "block" }}>{label}</span>
                        <span style={{ fontSize: "18px", fontWeight: 700, color }}>{val}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Drawer Repositories List */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-mono)", margin: "0 0 8px 0" }}>Repositories</h3>

                {reposLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", border: `2px solid var(--border)`, borderTopColor: "var(--accent-blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Loading repositories...</span>
                  </div>
                ) : (topicRepos ?? []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>No repositories found for #{selectedTopic}</div>
                ) : (
                  (topicRepos ?? []).map((repo: TopicRepo, idx) => (
                    <div
                      key={repo.repo_id}
                      onClick={() => {
                        setSelectedTopic(null);
                        router.push(`/repo/${repo.owner}/${repo.name}`);
                      }}
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "16px",
                        cursor: "pointer",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-blue)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {repo.owner}/{repo.name}
                        </div>
                        <span style={{
                          padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, flexShrink: 0,
                          background: repo.sustainability_label === "GREEN" ? "rgba(63,185,80,0.12)" : repo.sustainability_label === "YELLOW" ? "rgba(210,153,34,0.12)" : "rgba(248,81,73,0.12)",
                          color: repo.sustainability_label === "GREEN" ? "var(--accent-green)" : repo.sustainability_label === "YELLOW" ? "var(--accent-yellow)" : "var(--accent-red)",
                          border: repo.sustainability_label === "GREEN" ? "1px solid rgba(63,185,80,0.25)" : repo.sustainability_label === "YELLOW" ? "1px solid rgba(210,153,34,0.25)" : "1px solid rgba(248,81,73,0.25)",
                        }}>
                          {repo.sustainability_label || "YELLOW"}
                        </span>
                      </div>

                      {/* Trend Score */}
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                          <span>Trend Score</span>
                          <span>{repo.trend_score.toFixed(4)}</span>
                        </div>
                        <ScoreBar value={repo.trend_score} max={1} />
                      </div>

                      {/* Repository stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
                        {[
                          { label: "Stars", val: repo.stars != null ? (repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : String(repo.stars)) : "—", color: "var(--text-secondary)" },
                          { label: "Rank", val: `#${idx + 1}`, color: "var(--text-secondary)" },
                          { label: "Accel", val: `${repo.acceleration > 1 ? "▲" : ""}${repo.acceleration.toFixed(2)}`, color: repo.acceleration > 1 ? "var(--accent-green)" : "var(--text-secondary)" },
                        ].map(({ label, val, color }) => (
                          <div key={label}>
                            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", fontFamily: "var(--font-mono)", display: "block" }}>{label}</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
