"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api, TopicMomentum, TopicRepo } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

// ── Score bar component ─────────────────────────────────────
function ScoreBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 70 ? "var(--accent-green)" : pct > 40 ? "var(--accent-blue)" : "var(--text-muted)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{
        flex: 1,
        height: "4px",
        background: "var(--bg-dim)",
        borderRadius: "2px",
        overflow: "hidden",
      }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "2px", transition: "width 0.3s ease" }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color, minWidth: "40px", textAlign: "right" }}>
        {value.toFixed(4)}
      </span>
    </div>
  );
}

// ── Stat chip ───────────────────────────────────────────────
function StatChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: accent ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function TopicsPage() {
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [minRepos, setMinRepos] = useState(2);
  const [search, setSearch] = useState("");

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

  const filtered: TopicMomentum[] = (topics ?? []).filter((t) =>
    t.topic.toLowerCase().includes(search.toLowerCase())
  );

  const chartData = [...filtered]
    .sort((a, b) => b.total_star_velocity - a.total_star_velocity)
    .slice(0, 20)
    .map((t) => ({
      name: t.topic,
      velocity: Math.round(t.total_star_velocity),
      avg_score: parseFloat(t.avg_trend_score.toFixed(4)),
    }));

  const maxScore = Math.max(...filtered.map((t) => t.avg_trend_score), 1);

  return (
    <div className="page-root">
      {/* ── Page Header ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div className="section-title-cyber">
            Topic Intelligence<span className="terminal-cursor" />
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)", marginTop: "6px" }}>
            GitHub topic tags ranked by combined star velocity &amp; trend score
          </div>
        </div>

        {/* Summary chips */}
        {topics && (
          <div style={{
            display: "flex",
            gap: "20px",
            padding: "12px 16px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "var(--bg-surface)",
          }}>
            <StatChip label="Topics" value={filtered.length.toString()} accent="var(--accent-blue)" />
            <StatChip label="Avg Score" value={filtered.length ? (filtered.reduce((s, t) => s + t.avg_trend_score, 0) / filtered.length).toFixed(4) : "—"} />
            <StatChip label="Total Velocity" value={`+${filtered.reduce((s, t) => s + t.total_star_velocity, 0).toFixed(0)}/d`} accent="var(--accent-green)" />
          </div>
        )}
      </div>

      {/* ── Controls ────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        alignItems: "center",
        padding: "12px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search topics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="cyber-input"
          style={{ minWidth: "200px", flex: 1 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Min repos:
          </span>
          <select
            value={minRepos}
            onChange={(e) => setMinRepos(Number(e.target.value))}
            className="cyber-select"
            style={{ width: "70px" }}
          >
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {selectedTopic && (
          <button
            onClick={() => setSelectedTopic(null)}
            className="btn-cyber btn-cyber-cyan"
            style={{ padding: "5px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
          >
            ← Clear selection
          </button>
        )}
      </div>

      {/* ── Loading state ────────────────────────────────── */}
      {isLoading && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          padding: "80px 0",
        }}>
          <div style={{
            width: "36px", height: "36px", border: "2px solid var(--border)",
            borderTopColor: "var(--accent-blue)", borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)" }}>
            Analysing topic momentum…
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      {!isLoading && topics && (
        <div style={{
          display: "grid",
          gridTemplateColumns: selectedTopic ? "1fr 380px" : "1fr",
          gap: "20px",
          alignItems: "start",
        }}>
          {/* ── LEFT COLUMN ──────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>

            {/* Bar chart */}
            {chartData.length > 0 && (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                    Star Velocity by Topic — Top 20
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
                    stars/day
                  </span>
                </div>
                <div style={{ padding: "0 16px 16px" }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 8, right: 0, bottom: 60, left: 0 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-sans)" }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontFamily: "var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                        formatter={(v: any) => [`+${typeof v === "number" ? v : 0}/day`, "Velocity"]}
                      />
                      <Bar dataKey="velocity" radius={[3, 3, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.name === selectedTopic ? "var(--accent-green)" : "var(--accent-blue)"}
                            cursor="pointer"
                            opacity={selectedTopic && entry.name !== selectedTopic ? 0.4 : 1}
                            onClick={() => setSelectedTopic(entry.name === selectedTopic ? null : entry.name)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Topic table */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  All Topics
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
                  {filtered.length} results
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th className="th-mono" style={{ textAlign: "left", paddingLeft: "16px" }}>#</th>
                      <th className="th-mono" style={{ textAlign: "left" }}>Topic</th>
                      <th className="th-mono" style={{ textAlign: "right" }}>Repos</th>
                      <th className="th-mono" style={{ textAlign: "right" }}>Avg Score</th>
                      <th className="th-mono" style={{ textAlign: "right", minWidth: "130px" }}>Score Bar</th>
                      <th className="th-mono" style={{ textAlign: "right" }}>Vel/day</th>
                      <th className="th-mono" style={{ textAlign: "right" }}>Accel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => (
                      <tr
                        key={t.topic}
                        className="tr-cyber"
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: selectedTopic === t.topic ? "rgba(88,166,255,0.06)" : "transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedTopic(selectedTopic === t.topic ? null : t.topic)}
                      >
                        {/* Rank */}
                        <td style={{ padding: "10px 8px 10px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", width: "36px" }}>
                          {i + 1}
                        </td>
                        {/* Tag */}
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            fontWeight: 500,
                            background: selectedTopic === t.topic ? "rgba(88,166,255,0.12)" : "var(--bg-elevated)",
                            color: selectedTopic === t.topic ? "var(--accent-blue)" : "var(--text-secondary)",
                            border: `1px solid ${selectedTopic === t.topic ? "var(--accent-blue)" : "var(--border)"}`,
                            borderRadius: "4px",
                            padding: "2px 8px",
                            letterSpacing: "0.02em",
                            display: "inline-block",
                          }}>
                            #{t.topic}
                          </span>
                        </td>
                        {/* Repos */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>
                          {t.repo_count}
                        </td>
                        {/* Avg score */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                          {t.avg_trend_score.toFixed(4)}
                        </td>
                        {/* Score bar */}
                        <td style={{ padding: "10px 16px 10px 12px", minWidth: "130px" }}>
                          <ScoreBar value={t.avg_trend_score} max={maxScore} />
                        </td>
                        {/* Velocity */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-blue)" }}>
                          +{t.total_star_velocity.toFixed(1)}
                        </td>
                        {/* Accel */}
                        <td style={{ padding: "10px 16px 10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: t.avg_acceleration > 1 ? "var(--accent-green)" : "var(--text-secondary)" }}>
                          {t.avg_acceleration > 1 ? "▲ " : ""}{t.avg_acceleration.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)" }}>
                          No topics match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN — selected topic detail ────── */}
          {selectedTopic && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: "sticky", top: "72px", maxHeight: "calc(100vh - 100px)", minWidth: 0 }}>
              {/* Panel header */}
              <div className="panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "inherit" }}>
                <div className="panel-header" style={{ flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Topic
                    </span>
                    <span className="panel-title" style={{ color: "var(--accent-blue)", fontSize: "16px" }}>
                      #{selectedTopic}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: "5px", cursor: "pointer", color: "var(--text-muted)", padding: "4px 8px", fontSize: "12px" }}
                    aria-label="Close panel"
                  >✕</button>
                </div>

                {/* Topic stats summary */}
                {topics && (() => {
                  const td = topics.find((t) => t.topic === selectedTopic);
                  if (!td) return null;
                  return (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      flexShrink: 0,
                    }}>
                      <StatChip label="Repos" value={td.repo_count.toString()} accent="var(--accent-blue)" />
                      <StatChip label="Avg Score" value={td.avg_trend_score.toFixed(4)} />
                      <StatChip label="Velocity" value={`+${td.total_star_velocity.toFixed(1)}/d`} accent="var(--accent-green)" />
                      <StatChip label="Acceleration" value={td.avg_acceleration.toFixed(2)} accent={td.avg_acceleration > 1 ? "var(--accent-green)" : undefined} />
                    </div>
                  );
                })()}

                {/* Repo list */}
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {/* Loading state */}
                  {reposLoading && (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                      padding: "40px 0",
                    }}>
                      <div style={{
                        width: "28px", height: "28px", border: "2px solid var(--border)",
                        borderTopColor: "var(--accent-blue)", borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }} />
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)" }}>
                        Loading repos…
                      </span>
                    </div>
                  )}

                  {/* Empty state */}
                  {!reposLoading && (topicRepos ?? []).length === 0 && (
                    <div style={{ padding: "40px 16px", textAlign: "center", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)" }}>
                      No repos found for #{selectedTopic}
                    </div>
                  )}

                  {/* Repo cards */}
                  {!reposLoading && (topicRepos ?? []).length > 0 && (
                    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(topicRepos ?? []).map((repo: TopicRepo, idx) => (
                        <div
                          key={repo.repo_id}
                          onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                          style={{
                            padding: "12px",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            background: "var(--bg-elevated)",
                            cursor: "pointer",
                            transition: "border-color 0.13s, background 0.13s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-blue)";
                            (e.currentTarget as HTMLElement).style.background = "var(--bg-dim)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                            (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                          }}
                        >
                          {/* Repo header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                              <span style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "var(--accent-blue)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {repo.owner}/{repo.name}
                              </span>
                            </div>
                            <SustainBadge label={repo.sustainability_label} />
                          </div>

                          {/* Score bar */}
                          <div style={{ marginBottom: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                              <span style={{ fontFamily: "var(--font-sans)", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Trend Score</span>
                            </div>
                            <ScoreBar value={repo.trend_score} max={1} />
                          </div>

                          {/* Stats row */}
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "6px",
                            paddingTop: "8px",
                            borderTop: "1px solid var(--border)",
                          }}>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontFamily: "var(--font-sans)", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Stars</div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                                {repo.stars != null ? (repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars.toString()) : "—"}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontFamily: "var(--font-sans)", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Rank</div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                                #{idx + 1}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontFamily: "var(--font-sans)", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Accel</div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: repo.acceleration > 1 ? "var(--accent-green)" : "var(--text-secondary)" }}>
                                {repo.acceleration > 1 ? "▲" : ""}{repo.acceleration.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Topic tags */}
                          {repo.topics && repo.topics.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                              {repo.topics.slice(0, 5).map((tag) => (
                                <span
                                  key={tag}
                                  className="cyber-tag"
                                  style={{
                                    color: tag === selectedTopic ? "var(--accent-blue)" : undefined,
                                    borderColor: tag === selectedTopic ? "var(--accent-blue)" : undefined,
                                    background: tag === selectedTopic ? "rgba(88,166,255,0.1)" : undefined,
                                  }}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
