"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, OrgHealthResponse, OrgRepoHealth } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

// ─── Popular org quick-picks ─────────────────────────────────────────────────
const FEATURED_ORGS = [
  "microsoft", "google", "meta", "openai", "huggingface",
  "langchain-ai", "anthropics", "mistralai", "deepseek-ai",
];

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

// ─── Results panel ────────────────────────────────────────────────────────────
function OrgResults({ data }: { data: OrgHealthResponse }) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary cards */}
      <div className="stat-grid-5">
        <StatCard label="Public Repos" value={data.total_repos} />
        <StatCard label="Total Stars" value={data.total_stars.toLocaleString()} />
        <StatCard label="Top Language" value={data.top_language ?? "—"} />
        <StatCard label="Tracked by Repodar" value={data.tracked_repos} sub={`of ${data.total_repos}`} />
        <StatCard
          label="Avg Sustainability"
          value={data.avg_sustainability_score !== null ? `${(data.avg_sustainability_score * 100).toFixed(0)}%` : "—"}
          sub={data.avg_sustainability_score !== null ? "tracked repos only" : "no tracked repos"}
        />
      </div>

      {/* Repo table */}
      <div className="panel table-scroll">
        <div className="panel-header" style={{ justifyContent: "space-between" }}>
          <span className="panel-title">◈ {data.org.toUpperCase()} / REPOSITORIES</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            border: "1px solid var(--border)", padding: "2px 8px", letterSpacing: "0.04em" }}>
            SORTED BY STARS
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr>
              {["REPOSITORY", "LANGUAGE", "STARS", "FORKS", "ISSUES", "AGE", "TREND", "HEALTH", ""].map((h) => (
                <th key={h} className="th-mono"
                  style={{ textAlign: ["STARS", "FORKS", "ISSUES", "AGE"].includes(h) ? "right" : "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.repos.map((repo) => (
              <tr key={repo.full_name} className="tr-cyber"
                style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => router.push(`/repo/${repo.full_name}`)}>  
                <td style={{ padding: "10px 14px", maxWidth: "280px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px",
                    color: "var(--cyan)", fontWeight: 600 }}>{repo.name}</div>
                  {repo.description && (
                    <div style={{ fontSize: "10px", color: "var(--text-muted)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      maxWidth: "260px", marginTop: "2px" }}>
                      {repo.description}
                    </div>
                  )}
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)",
                  fontSize: "11px", color: "var(--text-muted)" }}>{repo.language ?? "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right",
                  fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--amber)" }}>
                  {repo.stars.toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right",
                  fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                  {repo.forks.toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right",
                  fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                  {repo.open_issues.toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right",
                  fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                  {repo.age_days}d
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right",
                  fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--cyan)" }}>
                  {repo.trend_score !== null ? repo.trend_score.toFixed(3) : "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {repo.sustainability_label
                    ? <SustainBadge label={repo.sustainability_label} />
                    : <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                        color: "var(--text-muted)" }}>{repo.is_tracked ? "—" : "untracked"}</span>}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {repo.is_tracked && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px",
                      color: "var(--green)", border: "1px solid var(--green)",
                      padding: "1px 5px", letterSpacing: "0.06em" }}>◈ TRACKED</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      {/* Header */}
      <div>
        <div className="section-title-cyber">ORG PORTFOLIO HEALTH<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Aggregate health dashboard for any GitHub organization
        </div>
      </div>

      {/* Search */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={inputVal} onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. microsoft, huggingface, openai"
            className="cyber-input" style={{ flex: 1 }} />
          <button onClick={search} className="btn-cyber btn-cyber-cyan" style={{ padding: "8px 20px" }}>
            ANALYZE
          </button>
        </div>
        {/* Featured orgs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            marginRight: "4px", letterSpacing: "0.06em" }}>QUICK:</span>
          {FEATURED_ORGS.map((org) => (
            <button key={org}
              onClick={() => { setInputVal(org); setSelectedOrg(org); router.replace(`/orgs?org=${org}`); }}
              className={`filter-btn-cyber${selectedOrg === org ? " active" : ""}`}>
              {org}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "32px",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // FETCHING {selectedOrg.toUpperCase()} FROM GITHUB<span className="terminal-cursor" />
        </div>
      )}

      {error && (
        <div className="panel" style={{ border: "1px solid var(--pink)" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", fontSize: "12px" }}>✕ {String(error)}</span>
        </div>
      )}

      {data && <OrgResults data={data} />}
    </div>
  );
}

export default function OrgPage() {
  return (
    <Suspense fallback={
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px",
        textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
        // LOADING<span className="terminal-cursor" />
      </div>
    }>
      <OrgPageInner />
    </Suspense>
  );
}
