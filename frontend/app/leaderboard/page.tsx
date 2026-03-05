"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Period } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

type View = "trending" | "top_score" | "sustainable";

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
];

export default function LeaderboardPage() {
  const [view, setView] = useState<View>("trending");
  const [period, setPeriod] = useState<Period>("7d");

  // Fetch leaderboard for all periods
  const { data: leaderboardData } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api.getLeaderboard(period, undefined, 100),
  });

  // Fetch overview for sustainability
  const { data: overview } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  const getDisplayData = () => {
    const lb = leaderboardData?.entries ?? [];

    switch (view) {
      case "trending":
        return lb.sort((a, b) => (b.star_gain ?? 0) - (a.star_gain ?? 0));
      case "top_score":
        return lb.sort((a, b) => (b.trend_score ?? 0) - (a.trend_score ?? 0));
      case "sustainable":
        return overview?.sustainability_ranking ?? [];
      default:
        return [];
    }
  };

  const data = getDisplayData();

  return (
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 8px" }}>
          🏆 Repository Leaderboard
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          Top AI/ML projects ranked by trending, acceleration, or health.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        {/* View tabs */}
        <div style={{ display: "flex", gap: "6px" }}>
          {(
            [
              { key: "trending", label: "📈 Star Gain" },
              { key: "top_score", label: "🚀 Trend Score" },
              { key: "sustainable", label: "💚 Sustainability" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: view === key ? "var(--accent-blue)" : "var(--bg-elevated)",
                color: view === key ? "#fff" : "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period selector - hidden for sustainability */}
        {view !== "sustainable" && (
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-primary)",
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {!data || data.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          Loading leaderboard...
        </div>
      ) : (
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)" }}>
                  Rank
                </th>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)" }}>
                  Repository
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                  {view === "trending"
                    ? `⭐ Star Gain (${period})`
                    : view === "top_score"
                      ? "🚀 Trend Score"
                      : "💚 Score"}
                </th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: "var(--text-muted)" }}>
                  Health
                </th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 50).map((entry: any, idx: number) => (
                <tr
                  key={entry.repo_id || entry.id}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 700, width: "40px" }}>
                    #{idx + 1}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <a
                      href={entry.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--accent-blue)",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      {entry.owner}/{entry.name}
                    </a>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                    {view === "trending"
                      ? `+${(entry.star_gain ?? 0).toLocaleString()} stars`
                      : view === "top_score"
                        ? entry.trend_score?.toFixed(4) ?? "N/A"
                        : entry.sustainability_score?.toFixed(4) ?? "N/A"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {entry.sustainability_label ? (
                      <SustainBadge label={entry.sustainability_label} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
