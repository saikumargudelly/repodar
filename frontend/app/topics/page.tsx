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

  // chart data — top 20 by total_star_velocity
  const chartData = [...filtered]
    .sort((a, b) => b.total_star_velocity - a.total_star_velocity)
    .slice(0, 20)
    .map((t) => ({ name: t.topic, velocity: Math.round(t.total_star_velocity), avg_score: parseFloat(t.avg_trend_score.toFixed(4)) }));

  const BLUE = "var(--cyan)";
  const MUTED = "#4a5568";

  return (
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">TOPIC INTELLIGENCE<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // GitHub topic tags ranked by combined star velocity
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="SEARCH TOPICS…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="cyber-input" style={{ minWidth: "200px" }} />
        <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
          letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
          MIN REPOS:
          <select value={minRepos} onChange={(e) => setMinRepos(Number(e.target.value))}
            className="cyber-select" style={{ width: "60px" }}>
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {selectedTopic && (
          <button onClick={() => setSelectedTopic(null)} className="btn-cyber"
            style={{ padding: "5px 12px", fontSize: "10px" }}>
            ← CLEAR
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "60px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // ANALYSING TOPICS<span className="terminal-cursor" />
        </div>
      )}

      {!isLoading && topics && (
        <div style={{ display: "grid", gridTemplateColumns: selectedTopic ? "1fr 1fr" : "1fr", gap: "24px" }}>
          {/* Left panel — topic list + chart */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Bar Chart */}
            {chartData.length > 0 && (
              <div className="panel">
                <div className="panel-header"><span className="panel-title">◈ STAR VELOCITY BY TOPIC (TOP 20)</span></div>
                <div style={{ padding: "0 20px 20px" }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 60, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)",
                        fontFamily: "var(--font-mono)" }} angle={-40} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)",
                        fontFamily: "var(--font-mono)" }} />
                      <Tooltip contentStyle={{ background: "var(--bg-elevated)",
                        border: "1px solid var(--border)", fontSize: "11px",
                        fontFamily: "var(--font-mono)", color: "var(--text-primary)" }} />
                      <Bar dataKey="velocity" radius={[0, 0, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell key={entry.name}
                            fill={entry.name === selectedTopic ? "var(--green)" : BLUE}
                            cursor="pointer" onClick={() => setSelectedTopic(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Topic table */}
            <div className="panel table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th className="th-mono">TOPIC</th>
                    <th className="th-mono" style={{ textAlign: "right" }}>REPOS</th>
                    <th className="th-mono" style={{ textAlign: "right" }}>AVG SCORE</th>
                    <th className="th-mono" style={{ textAlign: "right" }}>STAR VEL/D</th>
                    <th className="th-mono" style={{ textAlign: "right" }}>AVG ACCEL</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.topic} className="tr-cyber"
                      style={{ borderBottom: "1px solid var(--border)",
                        background: selectedTopic === t.topic ? "rgba(0,229,255,0.04)" : "transparent",
                        cursor: "pointer" }}
                      onClick={() => setSelectedTopic(selectedTopic === t.topic ? null : t.topic)}>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px",
                          background: selectedTopic === t.topic ? "var(--cyan)18" : "var(--bg-elevated)",
                          color: selectedTopic === t.topic ? "var(--cyan)" : "var(--text-secondary)",
                          border: `1px solid ${selectedTopic === t.topic ? "var(--cyan)" : "var(--border)"}`,
                          padding: "2px 8px", letterSpacing: "0.04em" }}>
                          #{t.topic}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right",
                        fontFamily: "var(--font-mono)", fontWeight: 600 }}>{t.repo_count}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right",
                        fontFamily: "var(--font-mono)" }}>{t.avg_trend_score.toFixed(4)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right",
                        fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--cyan)" }}>
                        +{t.total_star_velocity.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        color: t.avg_acceleration > 1 ? "var(--green)" : "var(--text-primary)" }}>
                        {t.avg_acceleration.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel — repos for selected topic */}
          {selectedTopic && (
            <div className="panel" style={{ position: "sticky", top: "72px",
              maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
              <div className="panel-header">
                <span className="panel-title" style={{ color: "var(--cyan)" }}>#{selectedTopic}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>REPOS</span>
              </div>

              {reposLoading && (
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
                  textAlign: "center", padding: "20px 0", letterSpacing: "0.06em" }}>
                  // LOADING<span className="terminal-cursor" />
                </div>
              )}
              {!reposLoading && (topicRepos ?? []).length === 0 && (
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
                  textAlign: "center", padding: "20px", letterSpacing: "0.06em" }}>
                  // NO REPOS FOUND FOR THIS TOPIC
                </div>
              )}

              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {!reposLoading &&
                  (topicRepos ?? []).map((repo: TopicRepo) => (
                    <div key={repo.repo_id}
                      onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                      style={{ padding: "12px", border: "1px solid var(--border)",
                        background: "var(--bg-elevated)", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--cyan)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", marginBottom: "6px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px",
                          fontWeight: 600, color: "var(--cyan)" }}>{repo.owner}/{repo.name}</span>
                        <SustainBadge label={repo.sustainability_label} />
                      </div>
                      <div style={{ display: "flex", gap: "12px", fontFamily: "var(--font-mono)",
                        fontSize: "10px", color: "var(--text-muted)" }}>
                        <span>★ {repo.stars?.toLocaleString() ?? "—"}</span>
                        <span>score: {repo.trend_score.toFixed(4)}</span>
                        <span>accel: {repo.acceleration.toFixed(2)}</span>
                      </div>
                      {repo.topics && repo.topics.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                          {repo.topics.slice(0, 6).map((tag) => (
                            <span key={tag} className="cyber-tag"
                              style={{ color: tag === selectedTopic ? "var(--cyan)" : undefined,
                                borderColor: tag === selectedTopic ? "var(--cyan)" : undefined }}>#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
