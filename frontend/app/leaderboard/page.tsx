"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatCompactNumber } from "@/lib/utils";
import { api, Period, CrossRepoContributor, ContributorRepoEntry } from "@/lib/api";
import { StatusDot } from "@/components/ui/StatusDot";
import { Skeleton } from "@/components/ui/Skeleton";

// B&W Theme Palette
const C = {
  bg: "var(--bg-primary)",
  bgCard: "var(--bg-surface)",
  bgHover: "var(--bg-elevated)",
  border: "var(--border)",
  text: "var(--text-primary)",
  textSub: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  green: "var(--accent-green)",
  amber: "var(--accent-yellow)",
  red: "var(--accent-red)",
};

// Types
type LeaderboardView = "trending" | "top_score" | "sustainable";
type NetworkSort = "repos" | "commits";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(data: any[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [
    keys.join(","),
    ...data.map((row) => keys.map((k) => JSON.stringify(row[k] ?? "")).join(",")),
  ];
  downloadBlob(rows.join("\n"), filename, "text/csv");
}

function exportJSON(data: any[], filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json");
}

function LeaderboardAndNetworkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "network" ? "network" : "leaderboard";

  const setActiveTab = (tab: "leaderboard" | "network") => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`/leaderboard?${params.toString()}`);
  };

  // --- LEADERBOARD STATE ---
  const [view, setView] = useState<LeaderboardView>("trending");
  const [period, setPeriod] = useState<Period>("7d");

  // --- NETWORK STATE ---
  const [minRepos, setMinRepos] = useState(2);
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [networkSort, setNetworkSort] = useState<NetworkSort>("repos");

  // --- QUERIES ---
  const { data: lbData, isLoading: lbLoading } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api.getLeaderboard(period, undefined, 100),
    enabled: activeTab === "leaderboard",
    staleTime: 5 * 60 * 1000,
  });

  const { data: overviewData } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
    enabled: activeTab === "leaderboard",
    staleTime: 10 * 60 * 1000,
  });

  const { data: networkData, isLoading: networkLoading } = useQuery({
    queryKey: ["contributor-network", minRepos],
    queryFn: () => api.getContributorNetwork(minRepos),
    enabled: activeTab === "network",
    staleTime: 10 * 60 * 1000,
  });

  const { data: contribRepos, isLoading: reposLoading } = useQuery({
    queryKey: ["contributor-repos", selectedLogin],
    queryFn: () => api.getContributorRepos(selectedLogin!),
    enabled: !!selectedLogin,
    staleTime: 5 * 60 * 1000,
  });

  // --- LEADERBOARD DATA DERIVATION ---
  const leaderboardRows = useMemo<any[]>(() => {
    const lb = lbData?.entries ?? [];
    switch (view) {
      case "trending":
        return [...lb].sort((a, b) => (b.star_gain ?? 0) - (a.star_gain ?? 0));
      case "top_score":
        return [...lb].sort((a, b) => (b.trend_score ?? 0) - (a.trend_score ?? 0));
      case "sustainable":
        return overviewData?.sustainability_ranking ?? lb;
      default:
        return [];
    }
  }, [lbData, view, overviewData]);

  // Metric aggregates for Leaderboard
  const totalStarGain = useMemo(() => {
    return leaderboardRows.reduce((acc, row) => acc + (row.star_gain ?? 0), 0);
  }, [leaderboardRows]);

  const avgTrendScore = useMemo(() => {
    if (!leaderboardRows.length) return 0;
    const scoredRows = leaderboardRows.filter((r) => r.trend_score != null);
    if (!scoredRows.length) return 0;
    return scoredRows.reduce((acc, row) => acc + (row.trend_score ?? 0), 0) / scoredRows.length;
  }, [leaderboardRows]);

  const highMomentumCount = useMemo(() => {
    return leaderboardRows.filter((row) => (row.trend_score ?? 0) > 0.1).length;
  }, [leaderboardRows]);

  // --- NETWORK DATA DERIVATION ---
  const filteredContributors = useMemo(() => {
    const list = networkData ?? [];
    const filtered = list.filter((c) =>
      c.login.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Sort
    if (networkSort === "repos") {
      return [...filtered].sort((a, b) => b.repo_count - a.repo_count);
    } else {
      return [...filtered].sort((a, b) => b.total_contributions - a.total_contributions);
    }
  }, [networkData, searchQuery, networkSort]);

  // Metric aggregates for Contributor Network
  const topContributorRepos = useMemo(() => {
    if (!filteredContributors.length) return 0;
    return Math.max(...filteredContributors.map((c) => c.repo_count));
  }, [filteredContributors]);

  const totalCommitsCount = useMemo(() => {
    return filteredContributors.reduce((acc, c) => acc + c.total_contributions, 0);
  }, [filteredContributors]);

  const selectedContrib = networkData?.find((c) => c.login === selectedLogin);

  // --- EXPORTS ---
  const lbExportData = useMemo(() => {
    return leaderboardRows.map((r) => ({
      repo: `${r.owner}/${r.name}`,
      category: r.category,
      star_gain: r.star_gain ?? 0,
      trend_score: r.trend_score ?? 0,
      sustainability_score: r.sustainability_score ?? 0,
      sustainability_label: r.sustainability_label ?? "—",
    }));
  }, [leaderboardRows]);

  const networkExportData = useMemo(() => {
    return filteredContributors.map((c) => ({
      login: c.login,
      repo_count: c.repo_count,
      total_commits: c.total_contributions,
      repos: c.repos.map((r) => r.name).join("; "),
    }));
  }, [filteredContributors]);

  // --- HELPERS ---
  const getAvatarInitials = (login: string) => {
    return login.slice(0, 2).toUpperCase();
  };

  const getAvatarBg = (login: string) => {
    // Generate a consistent dark B&W palette background based on login string hash
    let hash = 0;
    for (let i = 0; i < login.length; i++) {
      hash = login.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.abs(hash % 3);
    if (color === 0) return "#21262d";
    if (color === 1) return "#30363d";
    return "#161b22";
  };

  const healthLabel = (label: string | null) => {
    if (label === "GREEN") return { dot: C.green, text: "Healthy" };
    if (label === "YELLOW") return { dot: C.amber, text: "Caution" };
    return { dot: C.red, text: "Critical" };
  };

  const formatCommits = (val: number) => {
    return formatCompactNumber(val);
  };

  // Styled shared headers/elements
  const TH_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "0.07em",
    color: C.textMuted,
    padding: "8px 12px",
    textAlign: "left",
    fontWeight: 600,
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "var(--bg-surface)",
  };

  const TD_STYLE: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: `1px solid ${C.border}`,
    verticalAlign: "middle",
  };

  return (
    <div className="page-root page-fade-in" style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="leaderboard-header-row">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "20px", fontWeight: 700, margin: 0 }}>
            Leaderboard & contributor network
          </h1>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            padding: "2px 10px",
            borderRadius: "12px",
            color: C.textSub
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.green }} />
            Live · 1,301 repos
          </span>
        </div>

        <div className="leaderboard-actions-row">
          <button
            onClick={() => exportCSV(activeTab === "leaderboard" ? lbExportData : networkExportData, activeTab === "leaderboard" ? "leaderboard.csv" : "contributor-network.csv")}
            style={{
              fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: C.text,
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "6px",
              padding: "6px 12px", cursor: "pointer", transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.bgCard)}
          >
            ⬇ CSV
          </button>
          <button
            onClick={() => exportJSON(activeTab === "leaderboard" ? leaderboardRows : filteredContributors, activeTab === "leaderboard" ? "leaderboard.json" : "contributor-network.json")}
            style={{
              fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: C.text,
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "6px",
              padding: "6px 12px", cursor: "pointer", transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.bgCard)}
          >
            &lt;/&gt; JSON
          </button>
          <button
            style={{
              fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: C.text,
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "6px",
              padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.bgCard)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* ─── Tab Bar ───────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("leaderboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: activeTab === "leaderboard" ? 700 : 400,
            color: activeTab === "leaderboard" ? C.text : C.textMuted,
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "leaderboard" ? `2px solid ${C.text}` : "2px solid transparent",
            cursor: "pointer",
            transition: "color 0.15s",
          }}
        >
          <span style={{ display: "inline-flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </span>
          Leaderboard
        </button>

        <button
          onClick={() => setActiveTab("network")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: activeTab === "network" ? 700 : 400,
            color: activeTab === "network" ? C.text : C.textMuted,
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "network" ? `2px solid ${C.text}` : "2px solid transparent",
            cursor: "pointer",
            transition: "color 0.15s",
          }}
        >
          <span style={{ display: "inline-flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="2" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
              <path d="M12 7v4M12 15v2M14 5.5l4 5M10 5.5l-4 5" />
            </svg>
          </span>
          Contributor network
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════
          TAB 1: LEADERBOARD
         ═════════════════════════════════════════════════════════ */}
      {activeTab === "leaderboard" && (
        <div>
          {/* Metric cards */}
          <div className="radar-summary-grid" style={{ marginBottom: "20px" }}>
            <div className="kpi-card">
              <div className="kpi-label">REPOS RANKED</div>
              <div className="kpi-value" style={{ color: C.text }}>
                {leaderboardRows.length}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">TOP STAR GAIN (7D)</div>
              <div className="kpi-value" style={{ color: C.green }}>
                +{totalStarGain.toLocaleString()}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">AVG TREND SCORE</div>
              <div className="kpi-value" style={{ color: C.amber }}>
                {avgTrendScore.toFixed(4)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">HIGH MOMENTUM</div>
              <div className="kpi-value" style={{ color: C.text }}>
                {highMomentumCount}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="panel leaderboard-controls-panel" style={{ padding: "10px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* View selectors */}
            <div className="leaderboard-scroll-wrapper" style={{ display: "flex", gap: "6px" }}>
              {(["trending", "top_score", "sustainable"] as LeaderboardView[]).map((v) => {
                const labels: Record<LeaderboardView, string> = {
                  trending: "Star gain",
                  top_score: "Trend score",
                  sustainable: "Sustainability",
                };
                const active = view === v;
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: active ? C.text : C.textSub,
                      background: active ? C.bgHover : "transparent",
                      border: `1px solid ${active ? C.textSub : C.border}`,
                      borderRadius: "16px",
                      padding: "5px 12px",
                      cursor: "pointer",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = C.textSub; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = C.border; }}
                  >
                    {labels[v]}
                  </button>
                );
              })}
            </div>

            {view !== "sustainable" && (
              <>
                <span className="col-hide-mobile" style={{ width: "1px", height: "18px", background: C.border, margin: "0 6px" }} />
                <div className="leaderboard-scroll-wrapper" style={{ display: "flex", gap: "6px" }}>
                  {(["7d", "30d", "90d"] as Period[]).map((p) => {
                    const labels: Record<string, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };
                    const active = period === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: active ? C.text : C.textSub,
                          background: active ? C.bgHover : "transparent",
                          border: `1px solid ${active ? C.textSub : C.border}`,
                          borderRadius: "16px",
                          padding: "5px 12px",
                          cursor: "pointer",
                          transition: "background 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = C.textSub; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = C.border; }}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Table */}
          {lbLoading ? (
            <Skeleton shape="table" />
          ) : (
            <div className="panel table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH_STYLE, width: "50px" }}>#</th>
                    <th style={TH_STYLE}>REPOSITORY</th>
                    <th style={{ ...TH_STYLE, textAlign: "right" }}>STAR GAIN</th>
                    <th className="col-hide-mobile" style={{ ...TH_STYLE, textAlign: "right" }}>TREND SCORE</th>
                    <th className="col-hide-mobile" style={{ ...TH_STYLE, textAlign: "right" }}>SUSTAIN</th>
                    <th style={{ ...TH_STYLE, textAlign: "right" }}>HEALTH</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardRows.slice(0, 50).map((row: any, idx) => {
                    const hl = healthLabel(row.sustainability_label);
                    return (
                      <tr
                        key={row.repo_id || row.id}
                        className="tr-cyber"
                        style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                        onClick={() => router.push(`/repo/${row.owner}/${row.name}`)}
                      >
                        <td style={{ ...TD_STYLE, fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "11px" }}>
                          {idx + 1}
                        </td>
                        <td className="leaderboard-repo-cell" style={TD_STYLE}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 400, color: C.textMuted }}>{row.owner}/</span>{row.name}
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.category} · {formatCompactNumber(row.stars)} st
                          </div>
                        </td>
                        <td style={{ ...TD_STYLE, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: C.green }}>
                          +{row.star_gain?.toLocaleString() ?? "0"}
                        </td>
                        <td className="col-hide-mobile" style={{ ...TD_STYLE, textAlign: "right", fontFamily: "var(--font-mono)", color: C.text }}>
                          {row.trend_score?.toFixed(4) ?? "—"}
                        </td>
                        <td className="col-hide-mobile" style={{ ...TD_STYLE, textAlign: "right", fontFamily: "var(--font-mono)", color: C.text }}>
                          {row.sustainability_score ? `${(row.sustainability_score * 100).toFixed(0)}%` : "—"}
                        </td>
                        <td style={{ ...TD_STYLE, textAlign: "right", whiteSpace: "nowrap" }}>
                          <StatusDot label={row.sustainability_label} />
                        </td>
                      </tr>
                    );
                  })}
                  {leaderboardRows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "11px" }}>
                        // NO REPOS FOUND MATCHING CRITERIA
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: C.textMuted }}>
              Showing {Math.min(50, leaderboardRows.length)} of {leaderboardRows.length}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setView("trending")}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: C.text,
                  background: "transparent", border: `1px solid ${C.border}`, borderRadius: "6px",
                  padding: "6px 12px", cursor: "pointer", transition: "border-color 0.15s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.textSub)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                Star spikes ↗
              </button>
              <button
                onClick={() => setView("sustainable")}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: C.text,
                  background: "transparent", border: `1px solid ${C.border}`, borderRadius: "6px",
                  padding: "6px 12px", cursor: "pointer", transition: "border-color 0.15s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.textSub)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                Most sustainable ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          TAB 2: CONTRIBUTOR NETWORK
         ═════════════════════════════════════════════════════════ */}
      {activeTab === "network" && (
        <div>
          {/* Metric cards */}
          <div className="radar-summary-grid" style={{ marginBottom: "20px" }}>
            <div className="kpi-card">
              <div className="kpi-label">CROSS-REPO CONTRIBUTORS</div>
              <div className="kpi-value" style={{ color: C.text }}>
                {filteredContributors.length}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">TOP CONTRIBUTOR REPOS</div>
              <div className="kpi-value" style={{ color: C.green }}>
                {topContributorRepos}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">TOP COMMIT COUNT</div>
              <div className="kpi-value" style={{ color: C.amber }}>
                {totalCommitsCount.toLocaleString()}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">MIN REPOS FILTER</div>
              <div className="kpi-value" style={{ color: C.text }}>
                {minRepos}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="panel" style={{ padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" style={{ position: "absolute", left: "10px" }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search contr"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="cyber-input"
                style={{ paddingLeft: "30px", minWidth: "180px", fontSize: "13px" }}
              />
            </div>

            {/* Min repos filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub }}>Min repos</span>
              <input
                type="number"
                min={2}
                max={10}
                value={minRepos}
                onChange={(e) => setMinRepos(Math.max(2, Number(e.target.value)))}
                className="cyber-input"
                style={{ width: "50px", textAlign: "center", fontSize: "13px", padding: "6px" }}
              />
            </div>

            {/* Sort Toggles */}
            <div style={{ display: "flex", gap: "6px" }}>
              {(["repos", "commits"] as NetworkSort[]).map((sort) => {
                const active = networkSort === sort;
                return (
                  <button
                    key={sort}
                    onClick={() => setNetworkSort(sort)}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: active ? C.text : C.textSub,
                      background: active ? C.bgHover : "transparent",
                      border: `1px solid ${active ? C.textSub : C.border}`,
                      borderRadius: "16px",
                      padding: "5px 12px",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = C.textSub; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = C.border; }}
                  >
                    {sort}
                  </button>
                );
              })}
            </div>

            {selectedLogin && (
              <button
                onClick={() => setSelectedLogin(null)}
                style={{
                  marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: "12px",
                  fontWeight: 600, color: C.text, background: "transparent",
                  border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 12px", cursor: "pointer"
                }}
              >
                ← Clear selection
              </button>
            )}
          </div>

          {/* Grid Layout (List + Detail) */}
          <div className={`network-grid${selectedLogin ? " has-selection" : ""}`}>
            {/* List */}
            {networkLoading ? (
              <Skeleton shape="table" />
            ) : (
              <div className="panel table-scroll">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH_STYLE, width: "40px" }}>#</th>
                      <th style={TH_STYLE}>CONTRIBUTOR</th>
                      <th style={{ ...TH_STYLE, textAlign: "right" }}>REPOS</th>
                      <th className="col-hide-mobile" style={{ ...TH_STYLE, textAlign: "right" }}>COMMITS</th>
                      <th className="col-hide-mobile" style={TH_STYLE}>SAMPLE REPOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContributors.slice(0, 50).map((c, idx) => (
                      <tr
                        key={c.login}
                        className="tr-cyber"
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          cursor: "pointer",
                          background: selectedLogin === c.login ? "rgba(255,255,255,0.03)" : "transparent",
                        }}
                        onClick={() => setSelectedLogin(selectedLogin === c.login ? null : c.login)}
                      >
                        <td style={{ ...TD_STYLE, fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "11px" }}>
                          {idx + 1}
                        </td>
                        <td style={TD_STYLE}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {c.avatar_url ? (
                              <img
                                src={c.avatar_url}
                                alt={c.login}
                                style={{ width: "24px", height: "24px", borderRadius: "50%", border: `1px solid ${C.border}` }}
                              />
                            ) : (
                              <div style={{
                                width: "24px", height: "24px", borderRadius: "50%",
                                background: getAvatarBg(c.login), display: "flex", alignItems: "center",
                                justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "10px",
                                border: `1px solid ${C.border}`, color: C.text
                              }}>
                                {getAvatarInitials(c.login)}
                              </div>
                            )}
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: C.text, fontWeight: 600 }}>
                              {c.login}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...TD_STYLE, textAlign: "right", fontFamily: "var(--font-mono)", color: C.green, fontWeight: 700 }}>
                          {c.repo_count}
                        </td>
                        <td className="col-hide-mobile" style={{ ...TD_STYLE, textAlign: "right", fontFamily: "var(--font-mono)", color: C.text }}>
                          {formatCommits(c.total_contributions)}
                        </td>
                        <td className="col-hide-mobile" style={TD_STYLE}>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {c.repos.slice(0, 3).map((r, rIdx) => (
                              <span key={`${c.login}-${r.repo_id}-${rIdx}`} className="cyber-tag" style={{ fontSize: "10px" }}>
                                {r.name}
                              </span>
                            ))}
                            {c.repos.length > 3 && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, padding: "2px 4px" }}>
                                +{c.repos.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredContributors.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "11px" }}>
                          // NO CROSS-REPO CONTRIBUTORS MATCHED
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Selected Contributor Detail Panel */}
            {selectedLogin && selectedContrib && (
              <div className="panel" style={{ position: "sticky", top: "20px", alignSelf: "start", border: `1px solid ${C.border}`, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", borderBottom: `1px solid ${C.border}`, paddingBottom: "12px", marginBottom: "12px" }}>
                  {selectedContrib.avatar_url ? (
                    <img
                      src={selectedContrib.avatar_url}
                      alt={selectedContrib.login}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", border: `1px solid ${C.border}` }}
                    />
                  ) : (
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: getAvatarBg(selectedContrib.login), display: "flex", alignItems: "center",
                      justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "12px",
                      border: `1px solid ${C.border}`, color: C.text
                    }}>
                      {getAvatarInitials(selectedContrib.login)}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: C.text }}>
                      {selectedContrib.login}
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: C.textSub }}>
                      Active in {selectedContrib.repo_count} repositories · {selectedContrib.total_contributions.toLocaleString()} commits
                    </div>
                  </div>
                  <a
                    href={`https://github.com/${selectedContrib.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600, color: C.text,
                      background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: "4px",
                      padding: "4px 8px", textDecoration: "none"
                    }}
                  >
                    GITHUB ↗
                  </a>
                </div>

                {reposLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 0" }}>
                    <div className="skeleton-box" style={{ height: "16px", width: "80%" }} />
                    <div className="skeleton-box" style={{ height: "16px", width: "60%" }} />
                    <div className="skeleton-box" style={{ height: "16px", width: "70%" }} />
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto" }}>
                    {(contribRepos ?? selectedContrib.repos).map((r: ContributorRepoEntry) => (
                      <div
                        key={r.repo_id}
                        onClick={() => router.push(`/repo/${r.owner}/${r.name}`)}
                        style={{
                          padding: "10px 12px", border: `1px solid ${C.border}`,
                          background: C.bgCard, cursor: "pointer", transition: "border-color 0.15s"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.textSub)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: C.text }}>
                            {r.owner}/{r.name}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textSub }}>
                            {r.contributions.toLocaleString()} commits
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted }}>
                          <span>★ {r.stars?.toLocaleString() ?? "—"}</span>
                          <span>score: {r.trend_score?.toFixed(4) ?? "—"}</span>
                          {r.primary_language && <span>{r.primary_language}</span>}
                          <span className="cyber-tag" style={{ fontSize: "9px" }}>{r.category.replace(/_/g, " ")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: C.textMuted }}>
              Showing {Math.min(50, filteredContributors.length)} of {filteredContributors.length}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setNetworkSort("repos")}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: C.text,
                  background: "transparent", border: `1px solid ${C.border}`, borderRadius: "6px",
                  padding: "6px 12px", cursor: "pointer", transition: "border-color 0.15s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.textSub)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                Top contributors ↗
              </button>
              <button
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: C.text,
                  background: "transparent", border: `1px solid ${C.border}`, borderRadius: "6px",
                  padding: "6px 12px", cursor: "pointer", transition: "border-color 0.15s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.textSub)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                Bots vs humans ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING RESOURCE<span className="terminal-cursor" />
        </div>
      </div>
    }>
      <LeaderboardAndNetworkContent />
    </Suspense>
  );
}
