"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/useAuthSession";
import { api, DeepSummary } from "@/lib/api";
import { RecommendationsPanel } from "@/components/recommendations/RecommendationsPanel";
import { useToast } from "@/components/ToastProvider";

// Redesigned Sub-components
import { RepoHeader } from "@/components/repo/RepoHeader";
import { StickyMetricsBar } from "@/components/repo/StickyMetricsBar";
import { AIIntelligenceCard } from "@/components/repo/AIIntelligenceCard";
import { TechStackCard } from "@/components/repo/TechStackCard";
import { UseCasesCard } from "@/components/repo/UseCasesCard";
import { LanguageBreakdown } from "@/components/repo/LanguageBreakdown";
import { SignalExplainer } from "@/components/repo/SignalExplainer";
import { CommitHeatmap } from "@/components/repo/CommitHeatmap";
import { ReleaseChangelog } from "@/components/repo/ReleaseChangelog";
import { SocialMentionsFeed } from "@/components/repo/SocialMentionsFeed";
import { ForecastChart } from "@/components/forecast/ForecastChart";
import { EcosystemOverview } from "@/components/repo/EcosystemOverview";
import {
  StarHistoryChart,
  DailyDeltaChart,
  ContributorChart,
  VelocityChart,
  ScoreTimeline,
} from "@/components/repo/RepoCharts";

function formatDateFriendly(dateStr: string) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

// Visual Repository Journey Timeline Component
function RepositoryJourney({ repo, dailyMetrics }: { repo: any; dailyMetrics?: any[] }) {
  if (!dailyMetrics || dailyMetrics.length < 1) return null;
  const first = dailyMetrics[0];
  const latest = dailyMetrics[dailyMetrics.length - 1];
  const midpoint = dailyMetrics[Math.floor(dailyMetrics.length / 2)];

  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div>
        <div style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
            📈 Repository lifecycle journey
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 20px 0" }}>
          Evolution and key snapshot points across the repository's tracked lifecycle.
        </p>

        {/* Timeline Line */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative", paddingLeft: "20px", borderLeft: "2px dashed var(--border)" }}>
          
          {/* Milestone 1: Origin */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "-26px", top: "3px", width: "10px", height: "10px", borderRadius: "50%", background: "var(--text-muted)", border: "2px solid var(--bg-primary)" }} />
            <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Project Origin</span>
            <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Created: {formatDateFriendly(repo.created_at)}
            </span>
          </div>

          {/* Milestone 2: Baseline */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "-26px", top: "3px", width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent-blue)", border: "2px solid var(--bg-primary)" }} />
            <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Observation Baseline</span>
            <span style={{ display: "block", fontSize: "10px", color: "var(--text-secondary)" }}>
              Stars: {first.stars.toLocaleString()} · {first.contributors} committers
            </span>
            <span style={{ display: "block", fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Snapshot: {formatDateFriendly(first.date)}
            </span>
          </div>

          {/* Milestone 3: Midpoint */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "-26px", top: "3px", width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent-yellow)", border: "2px solid var(--bg-primary)" }} />
            <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Snapshot Midpoint</span>
            <span style={{ display: "block", fontSize: "10px", color: "var(--text-secondary)" }}>
              Stars: {midpoint.stars.toLocaleString()} · {midpoint.releases} releases
            </span>
            <span style={{ display: "block", fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Snapshot: {formatDateFriendly(midpoint.date)}
            </span>
          </div>

          {/* Milestone 4: Current */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "-26px", top: "3px", width: "12px", height: "12px", borderRadius: "50%", background: "var(--accent-green)", border: "2px solid var(--bg-primary)", boxShadow: "0 0 6px var(--accent-green)" }} />
            <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--accent-green)" }}>Current Telemetry</span>
            <span style={{ display: "block", fontSize: "10px", color: "var(--text-secondary)" }}>
              Stars: {latest.stars.toLocaleString()} · Velocity: +{repo.star_velocity_7d?.toFixed(1)}/day
            </span>
            <span style={{ display: "block", fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Latest: {formatDateFriendly(latest.date)}
            </span>
          </div>

        </div>
      </div>

      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "8px", marginTop: "12px" }}>
        Source: Database Ingestion Tracker
      </div>
    </div>
  );
}

// Sustainability Health & Diagnostics Card Fallback
function SustainabilityDiagnostics({ repo }: { repo: any }) {
  const label = repo.sustainability_label || "UNKNOWN";
  const score = repo.sustainability_score ?? 50;
  const ageDays = repo.age_days ?? 0;
  
  let ageStr = `${ageDays} days`;
  if (ageDays > 365) {
    ageStr = `${(ageDays / 365).toFixed(1)} years`;
  } else if (ageDays > 30) {
    ageStr = `${(ageDays / 30).toFixed(1)} months`;
  }

  let ratingColor = "var(--text-muted)";
  let barColor = "var(--text-muted)";
  let explanation = "Diagnostics data pending analysis.";

  if (label.toUpperCase() === "GREEN" || label.toUpperCase() === "HEALTHY") {
    ratingColor = "var(--accent-green)";
    barColor = "var(--accent-green)";
    explanation = "This repository demonstrates solid contributor activity, consistent release frequency, and healthy issue resolution rates. Highly sustainable.";
  } else if (label.toUpperCase() === "CAUTION" || label.toUpperCase() === "YELLOW") {
    ratingColor = "var(--accent-yellow)";
    barColor = "var(--accent-yellow)";
    explanation = "Caution advised. Moderate risk flags detected. Contributor count or release activity has experienced mild deceleration over the last 90 days.";
  } else if (label.toUpperCase() === "RED" || label.toUpperCase() === "UNHEALTHY") {
    ratingColor = "var(--accent-red)";
    barColor = "var(--accent-red)";
    explanation = "High risk. Potential maintenance abandonment or severe bottlenecks. Commits have slowed drastically relative to open issues.";
  }

  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div>
        <div style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
            🛡️ Sustainability Diagnostics
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
          Dependency health diagnostics, code ownership risk, and developer retention metrics.
        </p>

        {/* Score Bar */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Health Score</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: ratingColor }}>{score} / 100</span>
          </div>
          <div style={{ height: "6px", background: "var(--bg-primary)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${score}%`, background: barColor, borderRadius: "3px" }} />
          </div>
        </div>

        {/* Telemetry Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px" }}>
            <span style={{ display: "block", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase" }}>Project Age</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{ageStr}</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px" }}>
            <span style={{ display: "block", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase" }}>Language</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{repo.primary_language || "N/A"}</span>
          </div>
        </div>

        {/* Recommendation explanation */}
        <div style={{ background: "rgba(255, 255, 255, 0.005)", border: `1px solid var(--border)`, borderLeft: `3px solid ${barColor}`, borderRadius: "4px", padding: "10px 12px" }}>
          <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: ratingColor, textTransform: "uppercase", marginBottom: "3px" }}>
            Rating: {label}
          </span>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            {explanation}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RepoDeepDive() {
  const { showToast } = useToast();
  const params = useParams<{ id: string[] }>();
  const repoId = Array.isArray(params.id) ? params.id.join("/") : params.id;

  const { userId, token, isReady } = useAuthSession();
  const getToken = useCallback(async () => token, [token]);
  const queryClient = useQueryClient();
  const [pinned, setPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<"metrics" | "ecosystem">("metrics");

  const { data: repo, isLoading: repoLoading } = useQuery({
    queryKey: ["repo", repoId],
    queryFn: () => api.getRepo(repoId),
    enabled: !!repoId,
  });

  const { data: dailyMetrics } = useQuery({
    queryKey: ["daily-metrics", repoId, 60],
    queryFn: () => api.getDailyMetrics(repoId, 60),
    enabled: !!repoId,
  });

  const { data: scores } = useQuery({
    queryKey: ["computed-scores", repoId, 60],
    queryFn: () => api.getComputedScores(repoId, 60),
    enabled: !!repoId,
  });

  const { data: releases } = useQuery({
    queryKey: ["releases", repoId],
    queryFn: () => api.getReleases(repoId, 10),
    enabled: !!repoId,
  });

  const owner = repo?.owner || (repoId.split("/")[0] ?? "");
  const repoName = repo?.name || (repoId.split("/").slice(1).join("/") ?? "");
  
  const { data: deepSummary, isLoading: deepLoading, isError: deepError } = useQuery<DeepSummary>({
    queryKey: ["deep-summary", repoId, owner, repoName],
    queryFn: () => api.getDeepSummary(owner, repoName),
    enabled: !!repoId && !!owner && !!repoName,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const { data: mentions } = useQuery({
    queryKey: ["mentions", repoId],
    queryFn: () => api.getSocialMentions(repoId, 20),
    enabled: !!repoId,
  });

  const { data: commitActivity } = useQuery({
    queryKey: ["commit-activity", repoId],
    queryFn: () => api.getCommitActivity(repoId),
    enabled: !!repoId,
  });

  const { data: watchStatus, refetch: refetchWatchStatus } = useQuery({
    queryKey: ["watch-status", userId, repoId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      return api.checkWatchlist(token, repoId);
    },
    enabled: isReady && !!repoId,
  });

  const toggleWatch = async () => {
    if (!userId) {
      showToast("Please sign in to watch repositories.", "warning");
      return;
    }
    const token = await getToken();
    if (!token) {
      showToast("Authentication token missing. Please sign in again.", "error");
      return;
    }
    try {
      if (watchStatus?.watching && watchStatus.item) {
        await api.removeFromWatchlist(token, watchStatus.item.id);
      } else {
        await api.addToWatchlist(token, { repo_id: repoId });
      }
      refetchWatchStatus();
      queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
    } catch (err) {
      console.error("Failed to toggle watchlist:", err);
    }
  };

  const [deltaRunState, setDeltaRunState] = useState<"idle"|"running"|"done"|"error">("idle");

  useEffect(() => {
    if (!repo || repo.category !== "untracked" || deltaRunState !== "idle") return;
    const runOwner = repo.owner || (repoId.split("/")[0] ?? "");
    const runName = repo.name || (repoId.split("/").slice(1).join("/") ?? "");
    if (!runOwner || !runName) return;
    setDeltaRunState("running");
    api.deltaRun(runOwner, runName)
      .then(() => {
        setDeltaRunState("done");
        queryClient.invalidateQueries({ queryKey: ["repo", repoId] });
        queryClient.invalidateQueries({ queryKey: ["daily-metrics", repoId, 60] });
        queryClient.invalidateQueries({ queryKey: ["computed-scores", repoId, 60] });
        queryClient.invalidateQueries({ queryKey: ["deep-summary", repoId] });
      })
      .catch(() => setDeltaRunState("error"));
  }, [repo, repoId, deltaRunState, queryClient]);

  if (repoLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING REPO DATA<span className="terminal-cursor" />
        </p>
      </div>
    );
  }

  if (!repo) {
    return <p style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", paddingTop: "40px", fontSize: "12px" }}>✕ REPOSITORY NOT FOUND</p>;
  }

  const latest = dailyMetrics?.[dailyMetrics.length - 1];

  const latestScore = scores?.[scores.length - 1];
  const priorScore = scores && scores.length >= 2 ? scores[scores.length - 2] : null;

  let trendChangePct = 0;
  if (latestScore?.trend_score && priorScore?.trend_score) {
    const lVal = latestScore.trend_score;
    const pVal = priorScore.trend_score;
    if (pVal > 0) {
      trendChangePct = ((lVal - pVal) / pVal) * 100;
    }
  }

  let velChangePct = 0;
  if (latestScore?.star_velocity_7d && priorScore?.star_velocity_7d) {
    const lVal = latestScore.star_velocity_7d;
    const pVal = priorScore.star_velocity_7d;
    if (pVal > 0) {
      velChangePct = ((lVal - pVal) / pVal) * 100;
    }
  }

  return (
    <div className="page-root page-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>
      
      {/* Row 1: Repository Hero & Snapshot Summary */}
      <RepoHeader 
        repo={repo} 
        watchStatus={watchStatus} 
        toggleWatch={toggleWatch} 
        pinned={pinned} 
        setPinned={setPinned}
        latest={latest}
        trendChangePct={trendChangePct}
        velChangePct={velChangePct}
      />

      {/* Row 2: Sticky Telemetry KPI Row */}
      <StickyMetricsBar 
        repo={repo} 
        latest={latest} 
        trendChangePct={trendChangePct} 
        velChangePct={velChangePct} 
      />

      {/* Tab Switcher */}
      <div 
        style={{
          display: "flex",
          gap: "24px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "1px",
        }}
      >
        <button
          onClick={() => setActiveTab("metrics")}
          style={{
            padding: "8px 4px 12px 4px",
            fontSize: "13.5px",
            fontWeight: activeTab === "metrics" ? 500 : 400,
            color: activeTab === "metrics" ? "var(--text-primary)" : "var(--text-muted)",
            borderBottom: activeTab === "metrics" ? "2px solid var(--text-primary)" : "2px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            transition: "all 0.15s ease",
            marginBottom: "-1px",
          }}
        >
          Metrics &amp; Analytics
        </button>
        <button
          onClick={() => setActiveTab("ecosystem")}
          style={{
            padding: "8px 4px 12px 4px",
            fontSize: "13.5px",
            fontWeight: activeTab === "ecosystem" ? 500 : 400,
            color: activeTab === "ecosystem" ? "var(--text-primary)" : "var(--text-muted)",
            borderBottom: activeTab === "ecosystem" ? "2px solid var(--text-primary)" : "2px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            transition: "all 0.15s ease",
            marginBottom: "-1px",
          }}
        >
          Ecosystem Intelligence
        </button>
      </div>

      {activeTab === "metrics" ? (
        <>
          {/* Row 3: AI Capabilities Summary & Journey Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-8">
              <AIIntelligenceCard 
                deepSummary={deepSummary} 
                deepLoading={deepLoading} 
                deepError={deepError}
                repoSummary={repo.repo_summary}
                formatDateFriendly={formatDateFriendly}
              />
            </div>
            <div className="lg:col-span-4">
              <RepositoryJourney repo={repo} dailyMetrics={dailyMetrics} />
            </div>
          </div>

          {/* Row 4: Metadata scope (Tech Stack + Use Cases side-by-side with Languages & Contributors) */}
          {deepSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left Column (2/3 width) - Tech Stack & Use Cases stacked */}
              <div className="lg:col-span-8" style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
                <TechStackCard techStack={deepSummary.tech_stack} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <UseCasesCard useCases={deepSummary.use_cases} />
                </div>
              </div>

              {/* Right Column (1/3 width) - Language Breakdown + Top Contributors stacked */}
              <div className="lg:col-span-4" style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
                <LanguageBreakdown languages={deepSummary.languages} />
                
                {deepSummary.contributors.length > 0 && (
                  <div 
                    className="panel card-pad"
                    style={{
                      background: "rgba(38, 37, 36, 0.2)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "16px 20px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                      flex: 1
                    }}
                  >
                    <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        Top contributors
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        by commit count
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
                      {deepSummary.contributors.slice(0, 6).map((c) => (
                        <a 
                          key={c.login} 
                          href={c.profile_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "8px", 
                            padding: "6px 12px", 
                            border: "1px solid var(--border)", 
                            borderRadius: "20px", 
                            background: "rgba(255,255,255,0.01)", 
                            textDecoration: "none", 
                            transition: "all 0.15s ease" 
                          }}
                          className="hover:bg-zinc-800"
                        >
                          <img src={c.avatar_url} alt={c.login} style={{ width: "20px", height: "20px", borderRadius: "50%" }} />
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{c.login}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{c.contributions} commits</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) }

          {/* Row 5: Star History & Star Forecast (No Double Nesting) */}
          {dailyMetrics && dailyMetrics.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              <StarHistoryChart data={dailyMetrics} mentions={mentions} />
              <ForecastChart owner={repo.owner} name={repo.name} />
            </div>
          )}

          {/* Row 6: Momentum Signals & Telemetry Overview (3-Column Row) */}
          {scores && scores.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
              <VelocityChart data={scores} />
              <ScoreTimeline data={scores} />
              <SignalExplainer scores={scores} />
            </div>
          )}

          {/* Row 7: Activity Grids & Commit Heatmap / Sustainability Diagnostics (3-Column Row) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {dailyMetrics && dailyMetrics.length > 0 && (
              <>
                <DailyDeltaChart data={dailyMetrics} />
                <ContributorChart data={dailyMetrics} />
              </>
            )}
            {commitActivity && commitActivity.length > 0 ? (
              <CommitHeatmap data={commitActivity} />
            ) : (
              <SustainabilityDiagnostics repo={repo} />
            )}
          </div>

          {/* Row 8: Community Feeds (Side-by-Side balanced scrollable feeds) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <SocialMentionsFeed mentions={mentions || []} />
            <ReleaseChangelog releases={releases || []} owner={repo.owner} name={repo.name} />
          </div>

          {/* Row 9: Recommendations Panel */}
          <RecommendationsPanel repoOwner={repo.owner} repoName={repo.name} />

          {/* Row 10: Raw Metrics Snapshot Table */}
          {dailyMetrics && dailyMetrics.length > 0 && (
            <div 
              className="panel table-scroll"
              style={{
                background: "rgba(38, 37, 36, 0.2)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
              }}
            >
              <div className="panel-header" style={{ borderBottom: "none", padding: "16px 20px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  Raw metrics — last 7 snapshots
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["DATE", "STARS", "+STARS", "FORKS", "CONTRIBUTORS", "OPEN ISSUES", "RELEASES"].map((h) => {
                      let cls = "th-mono";
                      if (["FORKS", "CONTRIBUTORS", "OPEN ISSUES"].includes(h)) cls += " col-hide-mobile";
                      if (h === "RELEASES") cls += " col-hide-tablet";
                      return <th key={h} className={cls} style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dailyMetrics.slice(-7).reverse().map((m) => (
                    <tr key={m.date} className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>{m.date}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{m.stars.toLocaleString()}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: m.daily_star_delta > 0 ? "var(--accent-green)" : "var(--text-muted)" }}>
                        {m.daily_star_delta > 0 ? `+${m.daily_star_delta}` : m.daily_star_delta}
                      </td>
                      <td className="col-hide-mobile" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.forks.toLocaleString()}</td>
                      <td className="col-hide-mobile" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.contributors}</td>
                      <td className="col-hide-mobile" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.open_issues}</td>
                      <td className="col-hide-tablet" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.releases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <EcosystemOverview repoId={repoId} repo={repo} />
      )}
    </div>
  );
}
