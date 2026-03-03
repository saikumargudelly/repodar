"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  api, Period, CategoryMetrics, SustainabilityEntry, LeaderboardEntry,
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

function CategoryHeatmap({ data }: { data: CategoryMetrics[] }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
      <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 20px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
        Category Heatmap — Total Stars
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" barSize={20} margin={{ left: 20, right: 80 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <YAxis type="category" dataKey="category" width={190} tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
          <Tooltip
            formatter={(val: number | undefined) => [`${(val ?? 0).toLocaleString()} stars`, "Total Stars"]}
            contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <Bar dataKey="total_stars" radius={[0, 4, 4, 0]}>
            {data.map((cat) => (
              <Cell key={cat.category} fill={CATEGORY_COLORS[cat.category] ?? "#6b7280"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
        {data.slice(0, 8).map((cat) => (
          <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: CATEGORY_COLORS[cat.category] ?? "#6b7280", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {cat.repo_count} repos
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardTable({
  entries,
  period,
  isLoading,
}: {
  entries: LeaderboardEntry[];
  period: Period;
  isLoading: boolean;
}) {
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
          Top AI/ML Repos on GitHub — {periodLabel}
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
              {["#", "Repo / Description", "Category", "Stars / Gained", "Forks", "Open Issues", "Age"].map((h) => (
                <th key={h} style={{
                  padding: "10px 16px",
                    textAlign: ["#", "Stars / Gained", "Forks", "Open Issues", "Age"].includes(h) ? "right" : "left",
                  fontWeight: 500, fontSize: "11px", letterSpacing: "0.5px", whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((repo) => (
              <tr
                key={repo.repo_id}
                style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => window.open(repo.github_url, "_blank", "noopener")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-muted)", width: "40px", verticalAlign: "top" }}>{repo.rank}</td>
                <td style={{ padding: "12px 16px", maxWidth: "340px" }}>
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
                        {repo.topics.slice(0, 5).map((t) => (
                          <span key={t} style={{ fontSize: "10px", color: "var(--accent-blue)", background: "rgba(59,130,246,0.1)", padding: "1px 5px", borderRadius: "3px" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px", verticalAlign: "top" }}>{repo.category}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "var(--accent-blue)", verticalAlign: "top" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                    <span>{repo.current_stars.toLocaleString()} ⭐</span>
                    {repo.star_gain_label && (
                      <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--accent-green)" }}>
                        +{repo.star_gain_label}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)", verticalAlign: "top" }}>
                  {repo.current_forks.toLocaleString()}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)", verticalAlign: "top" }}>
                  {repo.open_issues != null ? repo.open_issues.toLocaleString() : "—"}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-muted)", fontSize: "12px", verticalAlign: "top" }}>
                  {repo.age_days}d
                </td>
              </tr>
            ))}
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
  const [period, setPeriod] = useState<Period>("7d");

  const { data: overview, isLoading: overviewLoading, error } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api.getLeaderboard(period, undefined, 20),
  });

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

  return (
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Ecosystem Overview</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>As of {overview.as_of}</p>
        </div>
        <PeriodSelector selected={period} onChange={setPeriod} />
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
          label={`#1 This ${PERIODS.find(p => p.key === period)?.label ?? period}`}
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

      {/* Category Heatmap */}
      <CategoryHeatmap data={overview.category_growth} />

      {/* Period Leaderboard */}
      <LeaderboardTable
        entries={leaderboard?.entries ?? []}
        period={period}
        isLoading={leaderboardLoading}
      />

      {/* Sustainability Ranking */}
      <SustainabilityRanking repos={overview.sustainability_ranking} />
    </div>
  );
}
