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
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: "8px",
      padding: "16px 20px",
    }}>
      <p style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "3px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ─── Results panel ────────────────────────────────────────────────────────────
function OrgResults({ data }: { data: OrgHealthResponse }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
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
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            {data.org} / repositories
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "3px 10px", borderRadius: "4px" }}>
            Sorted by stars
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              {["Repository", "Language", "Stars", "Forks", "Issues", "Age", "Trend", "Sustainability", ""].map((h) => (
                <th key={h} style={{
                  padding: "9px 14px",
                  textAlign: ["Stars", "Forks", "Issues", "Age"].includes(h) ? "right" : "left",
                  fontWeight: 500, fontSize: "11px", letterSpacing: "0.4px", whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.repos.map((repo) => (
              <tr
                key={repo.full_name}
                style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => window.open(repo.github_url, "_blank", "noopener")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "10px 14px", maxWidth: "280px" }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{repo.name}</span>
                    {repo.description && (
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                        {repo.description}
                      </p>
                    )}
                  </div>
                </td>
                <td style={{ padding: "10px 14px", fontSize: "12px", color: "var(--text-muted)" }}>
                  {repo.language ?? "—"}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "var(--accent-blue)" }}>
                  {repo.stars.toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)" }}>
                  {repo.forks.toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)" }}>
                  {repo.open_issues.toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)" }}>
                  {repo.age_days}d
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontSize: "12px" }}>
                  {repo.trend_score !== null ? repo.trend_score.toFixed(3) : "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {repo.sustainability_label
                    ? <SustainBadge label={repo.sustainability_label} />
                    : <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{repo.is_tracked ? "—" : "not tracked"}</span>
                  }
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {repo.is_tracked && (
                    <span style={{ fontSize: "10px", color: "var(--accent-green)", border: "1px solid var(--accent-green)", borderRadius: "4px", padding: "1px 5px" }}>
                      tracked
                    </span>
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
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Org Portfolio Health</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          Aggregate health dashboard for any GitHub organization's public repositories
        </p>
      </div>

      {/* Search */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. microsoft, huggingface, openai"
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            onClick={search}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              border: "none",
              background: "var(--accent-blue)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Analyze
          </button>
        </div>

        {/* Featured orgs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "4px", alignSelf: "center" }}>Quick:</span>
          {FEATURED_ORGS.map((org) => (
            <button
              key={org}
              onClick={() => { setInputVal(org); setSelectedOrg(org); router.replace(`/orgs?org=${org}`); }}
              style={{
                padding: "3px 10px",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                background: selectedOrg === org ? "var(--accent-blue)" : "var(--bg-elevated)",
                color: selectedOrg === org ? "#fff" : "var(--text-secondary)",
                fontSize: "11px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {org}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
          Fetching {selectedOrg} portfolio from GitHub…
        </div>
      )}

      {error && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--accent-red)", borderRadius: "10px", padding: "20px 24px" }}>
          <p style={{ color: "var(--accent-red)", margin: 0, fontWeight: 600 }}>Error</p>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "6px 0 0" }}>
            {String(error)}. Check the org name and try again.
          </p>
        </div>
      )}

      {data && <OrgResults data={data} />}
    </div>
  );
}

export default function OrgPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>}>
      <OrgPageInner />
    </Suspense>
  );
}
