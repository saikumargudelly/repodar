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
const COLORS = ["#58a6ff", "#d29922", "#f85149", "#3fb950", "#a78bfa"];

// ─── Animated spinner ─────────────────────────────────────────────────────────
function Spinner({ label }: { label?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "16px", padding: "48px 24px",
    }}>
      <div style={{
        width: "36px", height: "36px",
        border: "3px solid var(--border)",
        borderTop: "3px solid var(--accent-blue)",
        borderRadius: "50%",
        animation: "spin 0.9s linear infinite",
      }} />
      {label && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "11px",
          color: "var(--text-muted)", letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

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

// ─── Metric row ───────────────────────────────────────────────────────────────
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
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{
        padding: "10px 16px",
        fontFamily: "var(--font-mono)", fontSize: "10px",
        color: "var(--text-muted)", letterSpacing: "0.06em",
        textTransform: "uppercase", whiteSpace: "nowrap",
      }}>
        {label}
      </td>
      {vals.map((v, i) => {
        const isMax = max !== null && v === max && numerics.length > 1;
        return (
          <td key={i} style={{
            padding: "10px 16px", textAlign: "center",
            fontFamily: "var(--font-mono)", fontSize: "12px",
            fontWeight: isMax ? 700 : 400,
            color: isMax ? COLORS[i % COLORS.length] : "var(--text-secondary)",
          }}>
            {v !== null ? fmt(v) : "—"}
            {isMax && (
              <span style={{
                display: "inline-block", marginLeft: "4px",
                fontSize: "9px", color: COLORS[i % COLORS.length],
              }}>▲</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ─── Repo chip ────────────────────────────────────────────────────────────────
function RepoChip({ id, color, onRemove }: { id: string; color: string; onRemove: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      background: color + "18",
      border: `1px solid ${color}55`,
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
      <input
        id="compare-add-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handle()}
        placeholder="owner/repo-name"
        className="cyber-input"
        style={{ flex: 1 }}
      />
      <button
        id="compare-add-btn"
        onClick={handle}
        className="btn-cyber btn-cyber-cyan"
        style={{ padding: "7px 16px" }}
      >
        + ADD
      </button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="panel" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "12px", padding: "56px 32px", textAlign: "center",
    }}>
      <div style={{ fontSize: "36px", opacity: 0.4 }}>⚡</div>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: "14px",
        color: "var(--text-secondary)", fontWeight: 500,
      }}>
        Add at least 2 repositories to compare
      </div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "11px",
        color: "var(--text-muted)",
      }}>
        // e.g.{" "}
        <span style={{ color: "var(--cyan)" }}>langchain-ai/langchain</span>
        {" · "}
        <span style={{ color: "var(--cyan)" }}>openai/openai-python</span>
      </div>
    </div>
  );
}

// ─── Recharts legend with dark theme ──────────────────────────────────────────
function DarkLegend({ payload }: { payload?: Array<{ color: string; value: string }> }) {
  if (!payload?.length) return null;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "12px",
      justifyContent: "center", padding: "8px 0 0",
    }}>
      {payload.map((entry, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: "6px",
          fontFamily: "var(--font-mono)", fontSize: "10px",
          color: entry.color, letterSpacing: "0.04em",
        }}>
          <span style={{
            width: "10px", height: "2px", background: entry.color,
            display: "inline-block", borderRadius: "1px",
          }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

// ─── Share / copy bar ─────────────────────────────────────────────────────────
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
    <div className="panel" style={{
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 20px", flexWrap: "wrap", gap: "10px",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "11px",
        color: "var(--text-muted)", letterSpacing: "0.06em",
      }}>
        // SHARE THIS COMPARISON
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          id="compare-copy-url-btn"
          onClick={handleCopy}
          className="btn-cyber btn-cyber-cyan"
          style={{ padding: "5px 14px", fontSize: "11px", minWidth: "100px" }}
        >
          {copied ? "✓ COPIED" : "COPY URL"}
        </button>
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            color: "var(--text-muted)", border: "1px solid var(--border)",
            borderRadius: "6px", padding: "5px 14px",
            textDecoration: "none", display: "inline-flex",
            alignItems: "center", gap: "4px",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--accent-blue)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-blue)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          ↗ Tweet
        </a>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
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
      {/* ── Header ── */}
      <div>
        <div className="section-title-cyber">
          REPO COMPARISON<span className="terminal-cursor" />
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "11px",
          color: "var(--text-muted)", marginTop: "6px",
        }}>
          // Side-by-side analysis — select up to 5 repos
        </div>
      </div>

      {/* ── Add repos panel ── */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px 20px" }}>
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
          <div style={{
            fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
          }}>
            // Add at least 2 repos to start comparing · e.g.{" "}
            <span style={{ color: "var(--cyan)" }}>langchain-ai/langchain</span>
          </div>
        )}

        {/* Slot count indicator */}
        <div style={{
          display: "flex", justifyContent: "flex-end",
          fontFamily: "var(--font-mono)", fontSize: "10px",
          color: "var(--text-muted)", letterSpacing: "0.06em",
        }}>
          {ids.length}/5 REPOS
        </div>
      </div>

      {/* ── Loading / Error states ── */}
      {isLoading && <Spinner label="Loading comparison data" />}

      {error && (
        <div className="panel" style={{ border: "1px solid var(--accent-red)", padding: "16px 20px" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-red)", fontSize: "12px" }}>
            ✕ {String(error)}
          </span>
        </div>
      )}

      {/* ── Empty state when less than 2 repos ── */}
      {!isLoading && !error && ids.length < 2 && <EmptyState />}

      {/* ── Main comparison content ── */}
      {repos && repos.length >= 2 && (
        <>
          {/* Star History Chart */}
          {historyData.length > 1 && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  <span style={{ color: "var(--accent-blue)" }}>◈</span>
                  STAR HISTORY
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "10px",
                  color: "var(--text-muted)", letterSpacing: "0.06em",
                }}>
                  60 days
                </span>
              </div>
              <div style={{ padding: "16px 20px 20px" }}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                      tickFormatter={(v) => v.slice(5)}
                      stroke="var(--border)"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                      width={52}
                      stroke="var(--border)"
                      tickFormatter={(v: any) => typeof v === "number" ? (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)) : String(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-elevated)", border: "1px solid var(--border)",
                        borderRadius: "8px", fontSize: "12px",
                        fontFamily: "var(--font-mono)", color: "var(--text-primary)",
                      }}
                      formatter={(v: any, name: any) => [
                        typeof v === "number" && v != null ? v.toLocaleString() : v != null ? String(v) : "—", name ?? "",
                      ]}
                      labelStyle={{ color: "var(--text-muted)", marginBottom: "4px" }}
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
            <div className="panel-header">
              <span className="panel-title">
                <span style={{ color: "var(--accent-blue)" }}>▲</span>
                SCORE RADAR
              </span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "10px",
                color: "var(--text-muted)", letterSpacing: "0.04em",
              }}>
                All axes normalised 0–100 relative to set
              </span>
            </div>
            <div style={{ padding: "8px 20px 24px" }}>
              <ResponsiveContainer width="100%" height={360}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 12, fill: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
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
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "8px", fontSize: "12px",
                      fontFamily: "var(--font-mono)", color: "var(--text-primary)",
                    }}
                  />
                  <Legend content={(props) => <DarkLegend payload={props.payload as Array<{ color: string; value: string }>} />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metrics Breakdown Table */}
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="panel-header">
              <span className="panel-title">
                <span style={{ color: "var(--accent-blue)" }}>⬡</span>
                METRICS BREAKDOWN
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    <th className="th-mono" style={{
                      width: "180px", borderBottom: "1px solid var(--border)",
                    }}>
                      METRIC
                    </th>
                    {repos.map((r, i) => (
                      <th key={r.repo_id} style={{
                        padding: "12px 16px", textAlign: "center",
                        fontFamily: "var(--font-mono)", fontSize: "11px",
                        fontWeight: 700, color: COLORS[i % COLORS.length],
                        letterSpacing: "0.04em", borderBottom: "1px solid var(--border)",
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                          <span style={{
                            display: "inline-block", width: "8px", height: "8px",
                            background: COLORS[i % COLORS.length], borderRadius: "50%",
                          }} />
                          {r.owner}/{r.name}
                          {r.is_tracked && (
                            <span style={{
                              fontSize: "9px", fontWeight: 400,
                              color: "var(--accent-green)", letterSpacing: "0.06em",
                            }}>
                              ◈ TRACKED
                            </span>
                          )}
                        </div>
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

                  {/* Sustainability label row */}
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{
                      padding: "10px 16px", fontFamily: "var(--font-mono)",
                      fontSize: "10px", color: "var(--text-muted)",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>
                      Health Label
                    </td>
                    {repos.map((r, i) => (
                      <td key={i} style={{ padding: "10px 16px", textAlign: "center" }}>
                        {r.sustainability_label
                          ? <SustainBadge label={r.sustainability_label} />
                          : <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Language row */}
                  <tr>
                    <td style={{
                      padding: "10px 16px", fontFamily: "var(--font-mono)",
                      fontSize: "10px", color: "var(--text-muted)",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>
                      Language
                    </td>
                    {repos.map((r, i) => (
                      <td key={i} style={{
                        padding: "10px 16px", textAlign: "center",
                        fontSize: "12px", color: "var(--text-secondary)",
                        fontFamily: "var(--font-mono)",
                      }}>
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
        </>
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
