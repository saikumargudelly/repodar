"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, OrgHealthResponse, OrgRepoHealth } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";


// ─── Popular org quick-picks ─────────────────────────────────────────────────
const FEATURED_ORGS = [
  "microsoft", "google", "meta", "openai", "huggingface",
  "langchain-ai", "anthropics", "mistralai", "deepseek-ai",
];

// ─── Loading spinner ──────────────────────────────────────────────────────────
function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ padding: "48px 24px" }}>
      <ProfessionalLoader size={45} text={label} />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Trend indicator ─────────────────────────────────────────────────────────
function TrendPill({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>—</span>;
  const color = score > 0.5 ? "var(--accent-green)" : score > 0.2 ? "var(--accent-blue)" : "var(--text-muted)";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: "11px",
      color, fontWeight: 600,
    }}>
      {score.toFixed(3)}
    </span>
  );
}

// ─── Results panel ────────────────────────────────────────────────────────────
function OrgResults({ data }: { data: OrgHealthResponse }) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary KPI cards */}
      <div className="stat-grid-5">
        <StatCard label="Public Repos" value={data.total_repos} />
        <StatCard label="Total Stars" value={data.total_stars.toLocaleString()} />
        <StatCard label="Top Language" value={data.top_language ?? "—"} />
        <StatCard label="Tracked by Repodar" value={data.tracked_repos} sub={`of ${data.total_repos}`} />
        <StatCard
          label="Avg Sustainability"
          value={data.avg_sustainability_score !== null
            ? `${(data.avg_sustainability_score * 100).toFixed(0)}%`
            : "—"}
          sub={data.avg_sustainability_score !== null ? "tracked repos only" : "no tracked repos"}
        />
      </div>

      {/* Repo table */}
      <div className="panel">
        <div className="panel-header" style={{ justifyContent: "space-between" }}>
          <span className="panel-title">
            <span style={{ color: "var(--accent-blue)" }}>◈</span>
            {data.org.toUpperCase()} · REPOSITORIES
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--text-muted)", border: "1px solid var(--border)",
            padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.04em",
          }}>
            SORTED BY STARS
          </span>
        </div>

        {/* Scrollable table with sticky header */}
        <div style={{ overflowX: "auto", maxHeight: "600px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "740px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["REPOSITORY", "LANGUAGE", "STARS", "FORKS", "ISSUES", "AGE", "TREND", "HEALTH", ""].map((h) => {
                  let cls = "th-mono";
                  if (["LANGUAGE", "FORKS", "ISSUES", "TREND"].includes(h)) cls += " col-hide-mobile";
                  if (h === "AGE" || h === "") cls += " col-hide-tablet";
                  return (
                    <th key={h} className={cls}
                      style={{
                        textAlign: ["STARS", "FORKS", "ISSUES", "AGE"].includes(h) ? "right" : "left",
                        whiteSpace: "nowrap",
                        borderBottom: "1px solid var(--border)",
                      }}>
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.repos.map((repo, idx) => (
                <tr
                  key={repo.full_name}
                  className="tr-cyber"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                  }}
                  onClick={() => router.push(`/repo/${repo.full_name}`)}
                >
                  <td style={{ padding: "10px 14px", maxWidth: "280px" }}>
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: "12px",
                      color: "var(--cyan)", fontWeight: 600,
                    }}>
                      {repo.name}
                    </div>
                    {repo.description && (
                      <div style={{
                        fontSize: "10px", color: "var(--text-muted)",
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", maxWidth: "260px", marginTop: "2px",
                      }}>
                        {repo.description}
                      </div>
                    )}
                  </td>
                  <td className="col-hide-mobile" style={{
                    padding: "10px 14px", fontFamily: "var(--font-mono)",
                    fontSize: "11px", color: "var(--text-muted)",
                  }}>
                    {repo.language ?? "—"}
                  </td>
                  <td style={{
                    padding: "10px 14px", textAlign: "right",
                    fontFamily: "var(--font-mono)", fontWeight: 700,
                    color: "var(--amber)",
                  }}>
                    {repo.stars.toLocaleString()}
                  </td>
                  <td className="col-hide-mobile" style={{
                    padding: "10px 14px", textAlign: "right",
                    fontFamily: "var(--font-mono)", fontSize: "11px",
                    color: "var(--text-muted)",
                  }}>
                    {repo.forks.toLocaleString()}
                  </td>
                  <td className="col-hide-mobile" style={{
                    padding: "10px 14px", textAlign: "right",
                    fontFamily: "var(--font-mono)", fontSize: "11px",
                    color: "var(--text-muted)",
                  }}>
                    {repo.open_issues.toLocaleString()}
                  </td>
                  <td className="col-hide-tablet" style={{
                    padding: "10px 14px", textAlign: "right",
                    fontFamily: "var(--font-mono)", fontSize: "11px",
                    color: "var(--text-muted)",
                  }}>
                    {repo.age_days}d
                  </td>
                  <td className="col-hide-mobile" style={{ padding: "10px 14px", textAlign: "right" }}>
                    <TrendPill score={repo.trend_score} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {repo.sustainability_label
                      ? <SustainBadge label={repo.sustainability_label} />
                      : <span style={{
                          fontFamily: "var(--font-mono)", fontSize: "10px",
                          color: "var(--text-muted)",
                        }}>
                          {repo.is_tracked ? "—" : "untracked"}
                        </span>}
                  </td>
                  <td className="col-hide-tablet" style={{ padding: "10px 14px" }}>
                    {repo.is_tracked && (
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "9px",
                        color: "var(--green)", border: "1px solid var(--green)",
                        padding: "1px 5px", borderRadius: "3px", letterSpacing: "0.06em",
                      }}>
                        ◈ TRACKED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer row count */}
        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: "10px",
          color: "var(--text-muted)", letterSpacing: "0.05em",
        }}>
          {data.repos.length} repositories · {data.tracked_repos} tracked
        </div>
      </div>
    </div>
  );
}

// ─── Empty / initial state ────────────────────────────────────────────────────
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
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>
        Enter a GitHub organization name to analyze its portfolio
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
        // e.g. <span style={{ color: "var(--cyan)" }}>microsoft</span> · <span style={{ color: "var(--cyan)" }}>huggingface</span> · <span style={{ color: "var(--cyan)" }}>openai</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function OrgPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [inputVal, setInputVal] = useState(searchParams.get("org") ?? "");
  const [selectedOrg, setSelectedOrg] = useState(searchParams.get("org") ?? "");

  const { data, isLoading, error } = useQuery({
    queryKey: ["org-health", selectedOrg],
    queryFn: () => api.getOrgHealth(selectedOrg),
    enabled: !!selectedOrg,
  });

  const search = () => {
    const org = inputVal.trim().toLowerCase();
    if (!org) return;
    setSelectedOrg(org);
    router.replace(`/orgs?org=${org}`);
  };

  return (
    <div className="page-root">
      {/* ── Header ── */}
      <div>
        <div className="section-title-cyber">
          ORG PORTFOLIO HEALTH<span className="terminal-cursor" />
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "11px",
          color: "var(--text-muted)", marginTop: "6px",
        }}>
          // Aggregate health dashboard for any GitHub organization
        </div>
      </div>

      {/* ── Search panel ── */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px 20px" }}>
        <div className="org-search-row">
          <input
            id="org-search-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. microsoft, huggingface, openai"
            className="cyber-input"
            style={{ flex: 1 }}
          />
          <button
            id="org-analyze-btn"
            onClick={search}
            className="btn-cyber btn-cyber-cyan"
            style={{ padding: "8px 20px" }}
          >
            ANALYZE
          </button>
        </div>

        {/* Quick-pick chips */}
        <div className="org-featured-scroll">
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--text-muted)", marginRight: "4px", letterSpacing: "0.06em",
            flexShrink: 0
          }}>
            QUICK:
          </span>
          {FEATURED_ORGS.map((org) => (
            <button
              key={org}
              id={`org-quick-${org}`}
              onClick={() => { setInputVal(org); setSelectedOrg(org); router.replace(`/orgs?org=${org}`); }}
              className={`filter-btn-cyber${selectedOrg === org ? " active" : ""}`}
            >
              {org}
            </button>
          ))}
        </div>
      </div>

      {/* ── States ── */}
      {isLoading && <Spinner label={`Fetching ${selectedOrg}`} />}

      {error && (
        <div className="panel" style={{ border: "1px solid var(--accent-red)", padding: "16px 20px" }}>
          <span style={{
            fontFamily: "var(--font-mono)", color: "var(--accent-red)", fontSize: "12px",
          }}>
            ✕ {String(error)}
          </span>
        </div>
      )}

      {!isLoading && !error && !data && !selectedOrg && <EmptyState />}

      {data && <OrgResults data={data} />}
    </div>
  );
}

export default function OrgPage() {
  return (
    <Suspense fallback={<Spinner label="Loading" />}>
      <OrgPageInner />
    </Suspense>
  );
}
