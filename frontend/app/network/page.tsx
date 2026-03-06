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
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">CONTRIBUTOR NETWORK<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Developers active across multiple high-momentum repos
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="SEARCH LOGIN…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="cyber-input" style={{ minWidth: "200px" }} />
        <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
          letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
          MIN REPOS:
          <select value={minRepos} onChange={(e) => setMinRepos(Number(e.target.value))}
            className="cyber-select" style={{ width: "60px" }}>
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {selectedLogin && (
          <button onClick={() => setSelectedLogin(null)} className="btn-cyber"
            style={{ padding: "5px 12px", fontSize: "10px" }}>
            ← CLEAR
          </button>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
          marginLeft: "auto", letterSpacing: "0.06em" }}>
          {contributors.length} CROSS-REPO CONTRIBUTOR{contributors.length !== 1 ? "S" : ""}
        </span>
      </div>

      {isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "60px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // MAPPING THE NETWORK<span className="terminal-cursor" />
        </div>
      )}

      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: selectedLogin ? "1fr 1.2fr" : "1fr", gap: "24px" }}>
          {/* Contributor list */}
          <div className="panel table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th className="th-mono">#</th>
                  <th className="th-mono">CONTRIBUTOR</th>
                  <th className="th-mono" style={{ textAlign: "right" }}>REPOS</th>
                  <th className="th-mono" style={{ textAlign: "right" }}>COMMITS</th>
                  <th className="th-mono">SAMPLE REPOS</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c, idx) => (
                  <tr key={c.login} className="tr-cyber"
                    onClick={() => setSelectedLogin(selectedLogin === c.login ? null : c.login)}
                    style={{ borderBottom: "1px solid var(--border)",
                      background: selectedLogin === c.login ? "rgba(0,229,255,0.04)" : "transparent",
                      cursor: "pointer" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)", width: "40px", fontSize: "10px" }}>
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.login}
                            style={{ width: "26px", height: "26px", borderRadius: "50%",
                              border: "1px solid var(--border)" }} />
                        ) : (
                          <div style={{ width: "26px", height: "26px", borderRadius: "50%",
                            background: "var(--bg-elevated)", display: "flex", alignItems: "center",
                            justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "11px",
                            border: "1px solid var(--border)" }}>
                            {c.login[0].toUpperCase()}
                          </div>
                        )}
                        <a href={`https://github.com/${c.login}`} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cyan)",
                            textDecoration: "none", fontWeight: 600 }}>
                          {c.login}
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right",
                      fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--cyan)" }}>
                      {c.repo_count}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right",
                      fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                      {c.total_contributions.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {c.repos.slice(0, 3).map((r) => (
                          <span key={r.repo_id} className="cyber-tag">{r.name}</span>
                        ))}
                        {c.repos.length > 3 && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                            color: "var(--text-muted)", padding: "2px 4px" }}>
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
              <div style={{ fontFamily: "var(--font-mono)", textAlign: "center", padding: "40px 0",
                color: "var(--text-muted)", fontSize: "11px", letterSpacing: "0.06em" }}>
                // NO CROSS-REPO CONTRIBUTORS FOUND
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedLogin && selectedContrib && (
            <div className="panel" style={{ position: "sticky", top: "72px",
              maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
              <div className="panel-header">
                {selectedContrib.avatar_url && (
                  <img src={selectedContrib.avatar_url} alt={selectedContrib.login}
                    style={{ width: "40px", height: "40px", borderRadius: "50%",
                      border: "1px solid var(--cyan)" }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px",
                    color: "var(--cyan)", fontWeight: 700 }}>{selectedContrib.login}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: "var(--text-muted)", marginTop: "2px" }}>
                    {selectedContrib.repo_count} repos · {selectedContrib.total_contributions.toLocaleString()} commits
                  </div>
                </div>
                <a href={`https://github.com/${selectedContrib.login}`} target="_blank" rel="noopener noreferrer"
                  className="btn-cyber" style={{ fontSize: "10px", padding: "5px 10px", textDecoration: "none" }}>
                  GITHUB ↗
                </a>
              </div>

              {reposLoading && (
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
                  textAlign: "center", padding: "20px 0", letterSpacing: "0.06em" }}>
                  // LOADING<span className="terminal-cursor" />
                </div>
              )}

              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {!reposLoading &&
                  (contribRepos ?? selectedContrib.repos).map((r: ContributorRepoEntry) => (
                    <div key={r.repo_id}
                      onClick={() => router.push(`/repo/${r.owner}/${r.name}`)}
                      style={{ padding: "10px 14px", border: "1px solid var(--border)",
                        background: "var(--bg-elevated)", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--cyan)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px",
                          fontWeight: 600, color: "var(--cyan)" }}>{r.owner}/{r.name}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                          color: "var(--text-muted)" }}>{r.contributions.toLocaleString()} commits</span>
                      </div>
                      <div style={{ display: "flex", gap: "12px", fontFamily: "var(--font-mono)",
                        fontSize: "10px", color: "var(--text-muted)" }}>
                        <span>★ {r.stars?.toLocaleString() ?? "—"}</span>
                        <span>score: {r.trend_score?.toFixed(4) ?? "—"}</span>
                        {r.primary_language && <span>{r.primary_language}</span>}
                        <span className="cyber-tag">{r.category.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
