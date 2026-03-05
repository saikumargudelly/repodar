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

  const BLUE = "var(--accent-blue)";
  const MUTED = "#4a5568";

  return (
    <main
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "var(--font-sans, sans-serif)",
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "22px" }}>🏷️</span>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Topic Intelligence</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          GitHub topic tags ranked by combined star velocity across tracked repos.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search topics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "7px 12px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            fontSize: "13px",
            minWidth: "200px",
          }}
        />
        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          Min repos:
          <select
            value={minRepos}
            onChange={(e) => setMinRepos(Number(e.target.value))}
            style={{
              padding: "5px 8px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {selectedTopic && (
          <button
            onClick={() => setSelectedTopic(null)}
            style={{
              padding: "6px 14px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            ← Clear topic filter
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Analysing topics…
        </div>
      )}

      {!isLoading && topics && (
        <div style={{ display: "grid", gridTemplateColumns: selectedTopic ? "1fr 1fr" : "1fr", gap: "24px" }}>
          {/* Left panel — topic list + chart */}
          <div>
            {/* Bar Chart */}
            {chartData.length > 0 && (
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "20px",
                  marginBottom: "20px",
                }}
              >
                <h2 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>
                  Star Velocity by Topic (top 20)
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 60, left: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                      angle={-40}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Bar dataKey="velocity" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === selectedTopic ? "var(--accent-green)" : BLUE}
                          cursor="pointer"
                          onClick={() => setSelectedTopic(entry.name)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Topic table */}
            <div className="table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "8px 12px" }}>Topic</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Repos</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Avg Score</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Star Vel./d</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Avg Accel.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.topic}
                      style={{
                        borderTop: "1px solid var(--border)",
                        background: selectedTopic === t.topic ? "var(--bg-elevated)" : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedTopic(selectedTopic === t.topic ? null : t.topic)}
                    >
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            background: selectedTopic === t.topic ? "var(--accent-blue)" : "var(--bg-elevated)",
                            color: selectedTopic === t.topic ? "white" : "var(--text-secondary)",
                            border: `1px solid ${selectedTopic === t.topic ? "var(--accent-blue)" : "var(--border)"}`,
                            borderRadius: "10px",
                            padding: "2px 8px",
                          }}
                        >
                          #{t.topic}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{t.repo_count}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{t.avg_trend_score.toFixed(4)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent-blue)", fontWeight: 600 }}>
                        +{t.total_star_velocity.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: t.avg_acceleration > 1 ? "var(--accent-green)" : "var(--text-primary)" }}>
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
            <div>
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "20px",
                  position: "sticky",
                  top: "72px",
                  maxHeight: "calc(100vh - 100px)",
                  overflowY: "auto",
                }}
              >
                <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>
                  <span style={{ color: "var(--accent-blue)" }}>#{selectedTopic}</span> repos
                </h2>

                {reposLoading && (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                    Loading…
                  </p>
                )}

                {!reposLoading && (topicRepos ?? []).length === 0 && (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                    No repos found for this topic.
                  </p>
                )}

                {!reposLoading &&
                  (topicRepos ?? []).map((repo: TopicRepo) => (
                    <div
                      key={repo.repo_id}
                      onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        marginBottom: "10px",
                        cursor: "pointer",
                        background: "var(--bg-elevated)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-blue)" }}>
                          {repo.owner}/{repo.name}
                        </span>
                        <SustainBadge label={repo.sustainability_label} />
                      </div>
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                        <span>⭐ {repo.stars?.toLocaleString() ?? "—"}</span>
                        <span>Score: {repo.trend_score.toFixed(4)}</span>
                        <span>Accel: {repo.acceleration.toFixed(2)}</span>
                      </div>
                      {repo.topics && repo.topics.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                          {repo.topics.slice(0, 6).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: "10px",
                                background: tag === selectedTopic ? "var(--accent-blue)22" : "var(--bg-surface)",
                                border: `1px solid ${tag === selectedTopic ? "var(--accent-blue)" : "var(--border)"}`,
                                borderRadius: "10px",
                                padding: "1px 6px",
                                color: tag === selectedTopic ? "var(--accent-blue)" : "var(--text-muted)",
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
            </div>
          )}
        </div>
      )}
    </main>
  );
}
