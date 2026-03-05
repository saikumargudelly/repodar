"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, CrossRepoContributor, ContributorRepoEntry } from "@/lib/api";

export default function NetworkPage() {
  const router = useRouter();
  const [minRepos, setMinRepos] = useState(2);
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: network, isLoading } = useQuery({
    queryKey: ["contributor-network", minRepos],
    queryFn: () => api.getContributorNetwork(minRepos),
    staleTime: 10 * 60 * 1000,
  });

  const { data: contribRepos, isLoading: reposLoading } = useQuery({
    queryKey: ["contributor-repos", selectedLogin],
    queryFn: () => api.getContributorRepos(selectedLogin!),
    enabled: !!selectedLogin,
    staleTime: 5 * 60 * 1000,
  });

  const contributors: CrossRepoContributor[] = (network ?? []).filter((c) =>
    c.login.toLowerCase().includes(search.toLowerCase())
  );

  const selectedContrib = network?.find((c) => c.login === selectedLogin);

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
          <span style={{ fontSize: "22px" }}>🕸️</span>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Contributor Network</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          Developers active across multiple high-momentum repos — the builders shaping the ecosystem.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by login…"
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
          Min repos active in:
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
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {selectedLogin && (
          <button
            onClick={() => setSelectedLogin(null)}
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
            ← Clear selection
          </button>
        )}
        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "auto" }}>
          {contributors.length} cross-repo contributor{contributors.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Mapping the network…
        </div>
      )}

      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: selectedLogin ? "1fr 1.2fr" : "1fr", gap: "24px" }}>
          {/* Contributor list */}
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "8px 12px" }}>#</th>
                  <th style={{ padding: "8px 12px" }}>Contributor</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Repos Active</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Commits</th>
                  <th style={{ padding: "8px 12px" }}>Sample Repos</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c, idx) => (
                  <tr
                    key={c.login}
                    onClick={() => setSelectedLogin(selectedLogin === c.login ? null : c.login)}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: selectedLogin === c.login ? "var(--bg-elevated)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)", width: "40px" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {c.avatar_url ? (
                          <img
                            src={c.avatar_url}
                            alt={c.login}
                            style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid var(--border)" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "var(--bg-elevated)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {c.login[0].toUpperCase()}
                          </div>
                        )}
                        <a
                          href={`https://github.com/${c.login}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}
                        >
                          {c.login}
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--accent-blue)" }}>
                      {c.repo_count}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {c.total_contributions.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {c.repos.slice(0, 3).map((r) => (
                          <span
                            key={r.repo_id}
                            style={{
                              fontSize: "10px",
                              background: "var(--bg-elevated)",
                              border: "1px solid var(--border)",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              color: "var(--text-secondary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.name}
                          </span>
                        ))}
                        {c.repos.length > 3 && (
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", padding: "2px 4px" }}>
                            +{c.repos.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contributors.length === 0 && !isLoading && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                No cross-repo contributors found. Enrichment may still be running — check back after the next ingestion cycle.
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedLogin && selectedContrib && (
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                {selectedContrib.avatar_url && (
                  <img
                    src={selectedContrib.avatar_url}
                    alt={selectedContrib.login}
                    style={{ width: "48px", height: "48px", borderRadius: "50%", border: "1px solid var(--border)" }}
                  />
                )}
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>{selectedContrib.login}</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0" }}>
                    {selectedContrib.repo_count} repos · {selectedContrib.total_contributions.toLocaleString()} total contributions
                  </p>
                </div>
                <a
                  href={`https://github.com/${selectedContrib.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: "auto",
                    padding: "6px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  GitHub ↗
                </a>
              </div>

              {reposLoading && (
                <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                  Loading repos…
                </p>
              )}

              {!reposLoading &&
                (contribRepos ?? selectedContrib.repos).map((r: ContributorRepoEntry) => (
                  <div
                    key={r.repo_id}
                    onClick={() => router.push(`/repo/${r.owner}/${r.name}`)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      marginBottom: "8px",
                      cursor: "pointer",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-blue)" }}>
                        {r.owner}/{r.name}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {r.contributions.toLocaleString()} commits
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                      <span>⭐ {r.stars?.toLocaleString() ?? "—"}</span>
                      <span>Score: {r.trend_score?.toFixed(4) ?? "—"}</span>
                      {r.primary_language && <span>{r.primary_language}</span>}
                      <span style={{ fontSize: "11px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "4px", padding: "1px 6px" }}>
                        {r.category.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
