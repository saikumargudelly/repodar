"use client";

import { useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { api, CompareEntry, RepoHistory } from "@/lib/api";
import { NinjaRankPill } from "@/components/NinjaRankPill";

// B&W Theme Palette
const C = {
  bg: "#0d1117",
  bgCard: "#161b22",
  bgHover: "#21262d",
  border: "#30363d",
  text: "#e6edf3",
  textSub: "#8b949e",
  textMuted: "#6e7681",
  green: "#3fb950",
  amber: "#d29922",
  red: "#f85149",
};

// Curated comparison colors: strictly B&W + status accents
const COLORS = ["#e6edf3", "#8b949e", "#d29922", "#3fb950", "#f85149"];

// Spinner component matching the B&W theme
function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "48px 24px" }}>
      <div style={{
        width: "36px", height: "36px",
        border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.text}`,
        borderRadius: "50%",
        animation: "spin 0.9s linear infinite",
      }} />
      {label && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textSub, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
      )}
    </div>
  );
}

// History data builder
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

// Radar data builder
function buildRadarData(repos: CompareEntry[]) {
  const axes = [
    { key: "trend_score",             label: "Trend" },
    { key: "sustainability_score",    label: "Sustainability" },
    { key: "star_velocity_7d",        label: "Star Velocity" },
    { key: "acceleration",            label: "Acceleration" },
    { key: "contributor_growth_rate", label: "Contributors" },
    { key: "fork_to_star_ratio",      label: "Fork Ratio" },
    { key: "issue_close_rate",        label: "Issue Close" },
  ] as const;

  return axes.map(({ key, label }) => {
    const vals = repos.map((r) => (r[key] as number | null) ?? 0);
    const max = Math.max(...vals, 0.0001);
    const entry: Record<string, number | string> = { axis: label };
    repos.forEach((r) => {
      entry[`${r.owner}/${r.name}`] = Math.round(((r[key] as number | null) ?? 0) / max * 100);
    });
    return entry;
  });
}

// Health status indicator
function HealthLabel({ label }: { label: string | null }) {
  if (!label) return <span style={{ color: C.textMuted, fontSize: "12px", fontFamily: "var(--font-mono)" }}>—</span>;
  return <NinjaRankPill label={label} />;
}

// Metric row
function MetricRow({
  label, repos, accessor, fmt = (v: number) => v.toFixed(2),
}: {
  label: string;
  repos: CompareEntry[];
  accessor: (r: CompareEntry) => number | null | undefined;
  fmt?: (v: number) => string;
}) {
  const vals = repos.map((r) => accessor(r) ?? null);
  const numerics = vals.filter((v): v is number => v !== null);
  const max = numerics.length > 0 ? Math.max(...numerics) : null;

  return (
    <tr className="tr-cyber" style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textSub, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {label}
      </td>
      {vals.map((v, i) => {
        const isMax = max !== null && v === max && numerics.length > 1;
        const activeColor = COLORS[i % COLORS.length];
        return (
          <td key={i} style={{ padding: "10px 16px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: isMax ? 700 : 400, color: isMax ? activeColor : C.textSub }}>
            {v !== null ? fmt(v) : "—"}
            {isMax && (
              <span style={{ display: "inline-block", marginLeft: "4px", fontSize: "9px", color: activeColor }}>▲</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// Repo chip
function RepoChip({ id, color, onRemove }: { id: string; color: string; onRemove: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      background: color + "14",
      border: `1px solid ${color}44`,
      borderRadius: "6px",
      padding: "5px 10px",
      fontSize: "11px",
      color, fontFamily: "var(--font-mono)", fontWeight: 600,
    }}>
      <span style={{ width: "6px", height: "6px", background: color, borderRadius: "50%", flexShrink: 0 }} />
      {id}
      <button
        onClick={onRemove}
        aria-label={`Remove ${id}`}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color, fontSize: "15px", padding: "0 0 0 4px", lineHeight: 1, opacity: 0.7,
        }}
      >
        ×
      </button>
    </div>
  );
}

// Add-repo search box
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
      <input
        id="compare-add-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handle()}
        placeholder="owner/repo-name"
        className="cyber-input"
        style={{ flex: 1, fontSize: "13px" }}
      />
      <button
        id="compare-add-btn"
        onClick={handle}
        style={{
          padding: "7px 16px", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600,
          color: C.text, background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: "6px",
          cursor: "pointer", transition: "background 0.15s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.border)}
        onMouseLeave={(e) => (e.currentTarget.style.background = C.bgHover)}
      >
        + Add
      </button>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "56px 32px", textAlign: "center" }}>
      <div className="narutorun-container" style={{ padding: "0 0 8px 0" }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="narutorun-svg">
          <circle cx="29" cy="12" r="3" />
          <path d="M 27 9 L 24 7 L 26 10 L 23 10 L 26 12" />
          <path d="M 29 9 L 32 6 L 31 10 L 34 8 L 32 11" />
          <path d="M 25 13 C 23 13, 21 11, 19 12 C 17 13, 16 15, 14 14" />
          <path d="M 29 15 L 18 28" />
          <path d="M 27 17 L 10 21" />
          <path d="M 27 17 L 8 23" />
          <path d="M 18 28 L 26 34 L 20 44" />
          <path d="M 18 28 L 10 35 L 4 33" />
        </svg>
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: C.textSub, fontWeight: 500 }}>
        Add at least 2 repositories to compare
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textMuted }}>
        // e.g. <span style={{ color: C.text }}>langchain-ai/langchain</span> · <span style={{ color: C.text }}>openai/openai-python</span>
      </div>
    </div>
  );
}

// Recharts legend with dark theme
function DarkLegend({ payload }: { payload?: Array<{ color: string; value: string }> }) {
  if (!payload?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", padding: "8px 0 0" }}>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "10px", color: entry.color, letterSpacing: "0.04em" }}>
          <span style={{ width: "10px", height: "2px", background: entry.color, display: "inline-block", borderRadius: "1px" }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

// Share / copy bar
function ShareBar({ ids }: { ids: string[] }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Comparing ${ids.join(" vs ")} on Repodar 📊`
  )}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;

  return (
    <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", flexWrap: "wrap", gap: "10px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textMuted, letterSpacing: "0.06em" }}>
        // SHARE THIS COMPARISON
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          id="compare-copy-url-btn"
          onClick={handleCopy}
          style={{
            padding: "6px 14px", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600,
            color: C.text, background: copied ? C.bgHover : "transparent", border: `1px solid ${C.border}`, borderRadius: "6px",
            minWidth: "100px", cursor: "pointer", transition: "background 0.15s"
          }}
          onMouseEnter={(e) => { if (!copied) e.currentTarget.style.background = C.bgHover; }}
          onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = "transparent"; }}
        >
          {copied ? "✓ Copied" : "Copy URL"}
        </button>
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600,
            color: C.textSub, border: `1px solid ${C.border}`,
            borderRadius: "6px", padding: "6px 14px",
            textDecoration: "none", display: "inline-flex",
            alignItems: "center", gap: "4px",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = C.text;
            e.currentTarget.style.borderColor = C.textSub;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.textSub;
            e.currentTarget.style.borderColor = C.border;
          }}
        >
          ↗ Tweet
        </a>
      </div>
    </div>
  );
}

// Inner Component
function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialIds = (searchParams.get("repos") ?? searchParams.get("ids") ?? "")
    .split(",")
    .filter((x) => /^[^/\s]+\/[^/\s]+$/.test(x.trim()));
  const [ids, setIds] = useState<string[]>(initialIds.slice(0, 5));

  const { data: repos, isLoading, error } = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => api.compareRepos(ids),
    enabled: ids.length > 0,
    staleTime: 3 * 60 * 1000,
  });

  const { data: histories } = useQuery({
    queryKey: ["compare-history", ids],
    queryFn: () => api.compareHistory(ids, 60),
    enabled: ids.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const historyData = useMemo(() => {
    return histories && histories.length > 0 ? buildHistoryData(histories) : [];
  }, [histories]);

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

  const radarData = useMemo(() => {
    return repos && repos.length >= 2 ? buildRadarData(repos) : [];
  }, [repos]);

  const repoNames = useMemo(() => {
    return repos?.map((r) => `${r.owner}/${r.name}`) ?? [];
  }, [repos]);

  return (
    <div className="page-root" style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div className="section-title-cyber">
          REPO COMPARISON<span className="terminal-cursor" />
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textMuted, marginTop: "6px" }}>
          // Side-by-side analysis — select up to 5 repos
        </div>
      </div>

      {/* Add repos panel */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px 20px", marginBottom: "20px" }}>
        {/* Active repo chips */}
        {ids.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {ids.map((id, i) => (
              <RepoChip
                key={id}
                id={id}
                color={COLORS[i % COLORS.length]}
                onRemove={() => removeRepo(id)}
              />
            ))}
          </div>
        )}

        {/* Input row */}
        {ids.length < 5 && <AddRepoBox onAdd={addRepo} />}

        {/* Hint */}
        {ids.length < 2 && (
          <div style={{ fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "11px" }}>
            // Add at least 2 repos to start comparing · e.g. <span style={{ color: C.text }}>langchain-ai/langchain</span>
          </div>
        )}

        {/* Slot count indicator */}
        <div style={{ display: "flex", justifyContent: "flex-end", fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, letterSpacing: "0.06em" }}>
          {ids.length}/5 REPOS
        </div>
      </div>

      {/* Loading / Error states */}
      {isLoading && <Spinner label="Loading comparison data" />}

      {error && (
        <div className="panel" style={{ border: `1px solid ${C.red}`, padding: "16px 20px" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: C.red, fontSize: "12px" }}>
            ✕ {String(error)}
          </span>
        </div>
      )}

      {/* Empty state when less than 2 repos */}
      {!isLoading && !error && ids.length < 2 && <EmptyState />}

      {/* Main comparison content */}
      {repos && repos.length >= 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Star History Chart */}
          {historyData.length > 1 && (
            <div className="panel">
              <div className="panel-header" style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 16px" }}>
                <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700 }}>
                  <span style={{ color: C.text }}>◈</span>
                  STAR HISTORY
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, letterSpacing: "0.06em" }}>
                  60 days
                </span>
              </div>
              <div style={{ padding: "16px 20px 20px" }}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: C.textMuted, fontFamily: "var(--font-mono)" }}
                      tickFormatter={(v) => v.slice(5)}
                      stroke={C.border}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: C.textMuted, fontFamily: "var(--font-mono)" }}
                      width={52}
                      stroke={C.border}
                      tickFormatter={(v: any) => typeof v === "number" ? (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)) : String(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: C.bgCard, border: `1px solid ${C.border}`,
                        borderRadius: "8px", fontSize: "12px",
                        fontFamily: "var(--font-mono)", color: C.text,
                      }}
                      formatter={(v: any, name: any) => [
                        typeof v === "number" && v != null ? v.toLocaleString() : v != null ? String(v) : "—", name ?? "",
                      ]}
                      labelStyle={{ color: C.textMuted, marginBottom: "4px" }}
                    />
                    <Legend content={(props) => <DarkLegend payload={props.payload as Array<{ color: string; value: string }>} />} />
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
            </div>
          )}

          {/* Radar Chart */}
          <div className="panel">
            <div className="panel-header" style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 16px" }}>
              <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700 }}>
                <span style={{ color: C.text }}>▲</span>
                SCORE RADAR
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, letterSpacing: "0.04em" }}>
                All axes normalised 0–100 relative to set
              </span>
            </div>
            <div style={{ padding: "8px 20px 24px" }}>
              <ResponsiveContainer width="100%" height={360}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.border} />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 12, fill: C.textSub, fontFamily: "var(--font-mono)" }}
                  />
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
                    contentStyle={{
                      background: C.bgCard, border: `1px solid ${C.border}`,
                      borderRadius: "8px", fontSize: "12px",
                      fontFamily: "var(--font-mono)", color: C.text,
                    }}
                  />
                  <Legend content={(props) => <DarkLegend payload={props.payload as Array<{ color: string; value: string }>} />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metrics Breakdown Table */}
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="panel-header" style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 16px" }}>
              <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700 }}>
                <span style={{ color: C.text }}>⬡</span>
                METRICS BREAKDOWN
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
                <thead>
                  <tr style={{ background: C.bgCard }}>
                    <th className="th-mono" style={{ width: "180px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: "10px", padding: "12px 16px", textAlign: "left", letterSpacing: "0.06em" }}>
                      METRIC
                    </th>
                    {repos.map((r, i) => {
                      const activeColor = COLORS[i % COLORS.length];
                      return (
                        <th key={r.repo_id} style={{
                          padding: "12px 16px", textAlign: "center",
                          fontFamily: "var(--font-mono)", fontSize: "11px",
                          fontWeight: 700, color: activeColor,
                          letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}`,
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                            <span style={{ display: "inline-block", width: "8px", height: "8px", background: activeColor, borderRadius: "50%" }} />
                            {r.owner}/{r.name}
                            {r.is_tracked && (
                              <span style={{ fontSize: "9px", fontWeight: 400, color: C.green, letterSpacing: "0.06em" }}>
                                ◈ TRACKED
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
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

                  {/* Sustainability health label row */}
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textSub, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Health Label
                    </td>
                    {repos.map((r, i) => (
                      <td key={i} style={{ padding: "10px 16px", textAlign: "center" }}>
                        <HealthLabel label={r.sustainability_label} />
                      </td>
                    ))}
                  </tr>

                  {/* Language row */}
                  <tr>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textSub, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Language
                    </td>
                    {repos.map((r, i) => (
                      <td key={i} style={{ padding: "10px 16px", textAlign: "center", fontSize: "12px", color: C.textSub, fontFamily: "var(--font-mono)" }}>
                        {r.primary_language ?? "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Share bar */}
          <ShareBar ids={ids} />
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<Spinner label="Loading" />}>
      <ComparePageInner />
    </Suspense>
  );
}
