"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { api, CompareEntry, RepoHistory } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

// ─── Colour palette per repo slot ────────────────────────────────────────────
const COLORS = ["#00e5ff", "#ffab00", "#ff3d6b", "#39ff14", "#a78bfa"];

// ─── History data builder ────────────────────────────────────────────────────
function buildHistoryData(histories: RepoHistory[]) {
  const dateMap: Record<string, Record<string, number>> = {};
  for (const h of histories) {
    const key = `${h.owner}/${h.name}`;
    for (const pt of h.history) {
      if (!dateMap[pt.date]) dateMap[pt.date] = {};
      dateMap[pt.date][key] = pt.stars;
    }
  }
  return Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));
}

// ─── Radar data builder ───────────────────────────────────────────────────────
function buildRadarData(repos: CompareEntry[]) {
  const axes = [
    { key: "trend_score",            label: "Trend" },
    { key: "sustainability_score",   label: "Sustainability" },
    { key: "star_velocity_7d",       label: "Star Velocity" },
    { key: "acceleration",           label: "Acceleration" },
    { key: "contributor_growth_rate",label: "Contributors" },
    { key: "fork_to_star_ratio",     label: "Fork Ratio" },
    { key: "issue_close_rate",       label: "Issue Close" },
  ] as const;

  // Normalise each axis to 0–100 across all repos
  return axes.map(({ key, label }) => {
    const vals = repos.map((r) => (r[key] as number | null) ?? 0);
    const max = Math.max(...vals, 0.0001);
    const entry: Record<string, number | string> = { axis: label };
    repos.forEach((r, i) => {
      entry[`${r.owner}/${r.name}`] = Math.round(((r[key] as number | null) ?? 0) / max * 100);
    });
    return entry;
  });
}

// ─── Metric row ───────────────────────────────────────────────────────────────
function MetricRow({ label, repos, accessor, fmt = (v: number) => v.toFixed(2) }: {
  label: string;
  repos: CompareEntry[];
  accessor: (r: CompareEntry) => number | null | undefined;
  fmt?: (v: number) => string;
}) {
  const vals = repos.map((r) => accessor(r) ?? null);
  const max = Math.max(...vals.filter((v): v is number => v !== null));
  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px",
        color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</td>
      {vals.map((v, i) => (
        <td key={i} style={{ padding: "10px 16px", textAlign: "center",
          fontFamily: "var(--font-mono)", fontSize: "12px",
          fontWeight: v !== null && v === max ? 700 : 400,
          color: v !== null && v === max ? COLORS[i % COLORS.length] : "var(--text-secondary)" }}>
          {v !== null ? fmt(v) : "—"}
        </td>
      ))}
    </tr>
  );
}

// ─── Add-repo search box ──────────────────────────────────────────────────────
function AddRepoBox({ onAdd }: { onAdd: (id: string) => void }) {
  const [val, setVal] = useState("");
  const handle = () => {
    const trimmed = val.trim();
    if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) {
      onAdd(trimmed);
      setVal("");
    }
  };
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <input value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handle()}
        placeholder="owner/repo-name" className="cyber-input" style={{ flex: 1 }} />
      <button onClick={handle} className="btn-cyber btn-cyber-cyan" style={{ padding: "7px 16px" }}>
        + ADD
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialIds = (searchParams.get("repos") ?? searchParams.get("ids") ?? "").split(",").filter((x) => /^[^/\s]+\/[^/\s]+$/.test(x.trim()));
  const [ids, setIds] = useState<string[]>(initialIds.slice(0, 5));

  const { data: repos, isLoading, error } = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => api.compareRepos(ids),
    enabled: ids.length > 0,
  });

  const { data: histories } = useQuery({
    queryKey: ["compare-history", ids],
    queryFn: () => api.compareHistory(ids, 60),
    enabled: ids.length >= 2,
  });

  const historyData = histories && histories.length > 0 ? buildHistoryData(histories) : [];

  const addRepo = (id: string) => {
    if (!ids.includes(id) && ids.length < 5) {
      const next = [...ids, id];
      setIds(next);
      router.replace(`/compare?repos=${next.join(",")}`);
    }
  };

  const removeRepo = (id: string) => {
    const next = ids.filter((x) => x !== id);
    setIds(next);
    router.replace(`/compare?repos=${next.join(",")}`);
  };

  const radarData = repos && repos.length >= 2 ? buildRadarData(repos) : [];
  const repoNames = repos?.map((r) => `${r.owner}/${r.name}`) ?? [];

  return (
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">REPO COMPARISON<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Side-by-side analysis — select up to 5 repos
        </div>
      </div>

      {/* Add repos + chips */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {ids.map((id, i) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: "6px",
              background: COLORS[i % COLORS.length] + "18",
              border: `1px solid ${COLORS[i % COLORS.length]}55`,
              padding: "4px 10px", fontSize: "11px",
              color: COLORS[i % COLORS.length], fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              <span style={{ width: "6px", height: "6px", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              {id}
              <button onClick={() => removeRepo(id)}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: COLORS[i % COLORS.length], fontSize: "14px", padding: "0 0 0 4px", lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
        {ids.length < 5 && <AddRepoBox onAdd={addRepo} />}
        {ids.length < 2 && (
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
            // Add at least 2 repos · e.g. <span style={{ color: "var(--cyan)" }}>langchain-ai/langchain</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "32px", textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING DATA<span className="terminal-cursor" />
        </div>
      )}

      {error && (
        <div className="panel" style={{ border: "1px solid var(--pink)" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", fontSize: "12px" }}>✕ {String(error)}</span>
        </div>
      )}

      {repos && repos.length >= 2 && (
        <>
          {/* Star History Chart */}
          {historyData.length > 1 && (
            <div className="panel">
              <div className="panel-header"><span className="panel-title">◈ STAR HISTORY</span></div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={48} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" }}
                    formatter={(v: number | undefined, name: string | undefined) => [v != null ? v.toLocaleString() : "—", name ?? ""]}
                  />
                  <Legend />
                  {ids.map((id, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Radar chart */}
          <div className="panel">
            <div className="panel-header"><span className="panel-title">▲ SCORE RADAR</span></div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", padding: "0 20px 12px", letterSpacing: "0.04em" }}>
              // All axes normalised 0–100 relative to set · tracked repos only
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                {repoNames.map((name, i) => (
                  <Radar
                    key={name}
                    name={name}
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip
                  contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" }}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Metrics table */}
          <div className="panel table-scroll">
            <div className="panel-header"><span className="panel-title">⬡ METRICS BREAKDOWN</span></div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="th-mono" style={{ width: "180px" }}>METRIC</th>
                  {repos.map((r, i) => (
                    <th key={r.repo_id} style={{ padding: "10px 16px", textAlign: "center",
                      fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700,
                      color: COLORS[i % COLORS.length], letterSpacing: "0.04em" }}>
                      {r.owner}/{r.name}
                      {r.is_tracked && (
                        <span style={{ display: "block", fontSize: "9px", fontWeight: 400,
                          color: "var(--green)", letterSpacing: "0.06em" }}>◈ TRACKED</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Stars" repos={repos} accessor={(r) => r.current_stars} fmt={(v) => v.toLocaleString()} />
                <MetricRow label="Forks" repos={repos} accessor={(r) => r.current_forks} fmt={(v) => v.toLocaleString()} />
                <MetricRow label="Age (days)" repos={repos} accessor={(r) => r.age_days} fmt={(v) => `${v}d`} />
                <MetricRow label="Trend Score" repos={repos} accessor={(r) => r.trend_score} />
                <MetricRow label="Sustainability" repos={repos} accessor={(r) => r.sustainability_score} fmt={(v) => `${(v * 100).toFixed(0)}%`} />
                <MetricRow label="Star Velocity / 7d" repos={repos} accessor={(r) => r.star_velocity_7d} fmt={(v) => v.toFixed(0)} />
                <MetricRow label="Acceleration" repos={repos} accessor={(r) => r.acceleration} />
                <MetricRow label="Contributor Growth" repos={repos} accessor={(r) => r.contributor_growth_rate} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
                <MetricRow label="Fork / Star Ratio" repos={repos} accessor={(r) => r.fork_to_star_ratio} fmt={(v) => (v * 100).toFixed(1) + "%"} />
                <MetricRow label="Issue Close Rate" repos={repos} accessor={(r) => r.issue_close_rate} fmt={(v) => `${(v * 100).toFixed(0)}%`} />
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Sustainability Label</td>
                  {repos.map((r, i) => (
                    <td key={i} style={{ padding: "10px 16px", textAlign: "center" }}>
                      {r.sustainability_label ? <SustainBadge label={r.sustainability_label} /> : <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Language</td>
                  {repos.map((r, i) => (
                    <td key={i} style={{ padding: "10px 16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary)" }}>
                      {r.primary_language ?? "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Share link */}
          <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)",
              letterSpacing: "0.06em" }}>// SHARE THIS COMPARISON</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="btn-cyber" style={{ padding: "5px 14px", fontSize: "11px" }}>
                COPY URL
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Comparing ${ids.join(" vs ")} on Repodar 📊`)}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "5px 14px",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                ↗ Tweet
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px",
        textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
        // LOADING<span className="terminal-cursor" />
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  );
}
