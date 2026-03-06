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
  const [view, setView]     = useState<View>("trending");
  const [period, setPeriod] = useState<Period>("7d");

  const { data: leaderboardData } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api.getLeaderboard(period, undefined, 100),
  });
  const { data: overview } = useQuery({ queryKey: ["overview"], queryFn: api.getOverview });

  const data = (() => {
    const lb = leaderboardData?.entries ?? [];
    switch (view) {
      case "trending":    return [...lb].sort((a, b) => (b.star_gain ?? 0) - (a.star_gain ?? 0));
      case "top_score":   return [...lb].sort((a, b) => (b.trend_score ?? 0) - (a.trend_score ?? 0));
      case "sustainable": return overview?.sustainability_ranking ?? [];
      default:            return [];
    }
  })();

  return (
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">LEADERBOARD<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Top AI/ML repos ranked by star gain · trend score · sustainability
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {([
          { key: "trending"    as View, label: "◈ Star Gain"      },
          { key: "top_score"   as View, label: "▲ Trend Score"    },
          { key: "sustainable" as View, label: "⬡ Sustainability" },
        ]).map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)}
            className={`filter-btn-cyber${view === key ? " active" : ""}`}>
            {label}
          </button>
        ))}
        {view !== "sustainable" && (
          <>
            <span style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px", alignSelf: "center" }} />
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`filter-btn-cyber${period === p.key ? " active" : ""}`}>
                {p.label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Table */}
      {!data || data.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING DATA<span className="terminal-cursor" />
        </div>
      ) : (
        <div className="panel table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th className="th-mono" style={{ width: "48px" }}>#</th>
                <th className="th-mono">REPOSITORY</th>
                <th className="th-mono" style={{ textAlign: "right" }}>
                  {view === "trending"
                    ? `STAR GAIN (${period.toUpperCase()})`
                    : view === "top_score" ? "TREND SCORE" : "SUSTAIN SCORE"}
                </th>
                <th className="th-mono" style={{ textAlign: "center" }}>HEALTH</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 50).map((entry: any, idx: number) => (
                <tr key={entry.repo_id || entry.id} className="tr-cyber"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <a href={entry.github_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cyan)",
                        textDecoration: "none", fontWeight: 600 }}>
                      {entry.owner}/{entry.name}
                    </a>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right",
                    fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--amber)" }}>
                    {view === "trending"
                      ? `+${(entry.star_gain ?? 0).toLocaleString()}`
                      : view === "top_score"
                        ? (entry.trend_score?.toFixed(4) ?? "—")
                        : (entry.sustainability_score?.toFixed(4) ?? "—")}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                    {entry.sustainability_label
                      ? <SustainBadge label={entry.sustainability_label} />
                      : <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>—</span>}
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
