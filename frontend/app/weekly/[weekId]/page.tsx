"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useState, useRef } from "react";
import { api, SnapshotDetail } from "@/lib/api";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";
import { NinjaRankPill } from "@/components/NinjaRankPill";
import { toPng } from "html-to-image";

function generateInsightCommentary(repo: any) {
  const name = repo.name;
  const owner = repo.owner;
  const velocity = repo.star_velocity_7d ?? 0;
  const accel = repo.acceleration ?? 0;
  const label = repo.sustainability_label || "GREEN";

  let velocityText = "";
  if (velocity > 250) {
    velocityText = `expanding rapidly at +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day, reflecting an intense wave of interest and developer engagement.`;
  } else if (velocity > 80) {
    velocityText = `maintaining a solid baseline expansion of +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day, indicating steady organic traction.`;
  } else {
    velocityText = `seeing consistent interest with +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day added to its community base.`;
  }

  let accelText = "";
  if (accel > 2.0) {
    accelText = `The project has experienced massive acceleration (${accel.toFixed(1)}x speedup over typical baseline interest), which suggests a major release, social media breakout, or a popular launch.`;
  } else if (accel > 1.2) {
    accelText = `Its acceleration rate (${accel.toFixed(1)}x) suggests positive growth compared to historical averages.`;
  } else {
    accelText = `Its growth profile remains stable with baseline acceleration characteristics.`;
  }

  let healthText = "";
  if (label === "GREEN") {
    healthText = `With a healthy Jonin-tier community score, this repository features robust maintenance hygiene, active issue resolution, and a dependable ecosystem for long-term integration.`;
  } else if (label === "YELLOW") {
    healthText = `Classified as Chunin-tier health, it indicates moderate activity, though some pull request response delays or contributor churn suggest keeping a watchful eye before production deployment.`;
  } else {
    healthText = `Under Genin-tier classification, this repo displays potential maintenance risks, such as high open-to-close issue ratios or low recent commit frequency, despite its current trend velocity.`;
  }

  return `This week, ${owner}/${name} captured a top spot on our radar, ${velocityText} ${accelText} ${healthText}`;
}

export default function WeeklyDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (weekId) {
      document.title = `Repodar Weekly Digest: ${weekId} | AI/ML Ecosystem Radar`;
    }
  }, [weekId]);

  const { data: snapshot, isLoading, error } = useQuery<SnapshotDetail>({
    queryKey: ["snapshot", weekId],
    queryFn: () => api.getSnapshot(weekId),
    enabled: !!weekId,
  });

  const featuredRepos = snapshot?.repos?.slice(0, 10) ?? [];
  const secondaryRepos = snapshot?.repos?.slice(10) ?? [];
  
  // Stats for the cohort
  const maxVelocity = snapshot?.repos ? Math.max(...snapshot.repos.map(r => r.star_velocity_7d || 0)) : 0;
  const avgAccel = snapshot?.repos 
    ? snapshot.repos.reduce((acc, r) => acc + (r.acceleration || 0), 0) / snapshot.repos.length 
    : 0;
  const healthyCount = snapshot?.repos
    ? snapshot.repos.filter(r => r.sustainability_label === "GREEN" || r.sustainability_label === "HEALTHY").length
    : 0;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPoster = async () => {
    const node = posterRef.current;
    if (!node) return;
    setExporting(true);
    try {
      // 3.2 pixelRatio transforms our 1200x1600 styled poster container into 3840x5120 (4K+ resolution)
      const dataUrl = await toPng(node, {
        pixelRatio: 3.2,
        quality: 1.0,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `repodar-weekly-${weekId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate 4K image", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-root" style={{ paddingBottom: "120px" }}>
      {/* Off-screen Poster Container (Used only for generating the 4K poster image) */}
      <div 
        ref={posterRef}
        id="repodar-social-poster"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: "1200px",
          height: "1600px",
          background: "radial-gradient(circle at 50% 50%, #171d2b 0%, #0a0d14 100%)",
          color: "#e6edf3",
          padding: "64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Inter, -apple-system, sans-serif",
          boxSizing: "border-box",
          border: "1px solid #30363d",
        }}
      >
        <div>
          {/* Poster Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #00f0ff 0%, #0072ff 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0a0d14",
                fontWeight: 800,
                fontSize: "20px"
              }}>
                R
              </div>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.05em", color: "#ffffff" }}>REPODAR</div>
                <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#8b949e", letterSpacing: "0.1em" }}>INTELLIGENCE SYSTEM</div>
              </div>
            </div>
            <div style={{
              border: "1px solid rgba(0,240,255,0.3)",
              background: "rgba(0,240,255,0.05)",
              color: "#00f0ff",
              padding: "6px 14px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: "monospace",
              fontWeight: 700
            }}>
              WEEK {weekId}
            </div>
          </div>

          <div style={{ height: "2px", background: "linear-gradient(to right, #00f0ff, transparent)", marginTop: "24px", marginBottom: "40px" }} />

          {/* Title */}
          <h1 style={{ fontSize: "42px", fontWeight: 900, letterSpacing: "-0.02em", color: "#ffffff", margin: "0 0 12px 0", lineHeight: "1.1" }}>
            Weekly AI/ML Ecosystem Breakthroughs
          </h1>
          <p style={{ fontSize: "16px", color: "#8b949e", margin: "0 0 48px 0", lineHeight: "1.5", maxWidth: "800px" }}>
            Automated intelligence telemetry capturing the highest velocity open-source projects, community health metrics, and growth acceleration.
          </p>

          {/* Top 5 Repos List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {featuredRepos.slice(0, 5).map((repo) => {
              const borderLeftColor = 
                repo.sustainability_label === "GREEN" ? "#3fb950" : 
                repo.sustainability_label === "YELLOW" ? "#d29922" : "#f85149";
              return (
                <div 
                  key={repo.repo_id}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderLeft: `5px solid ${borderLeftColor}`,
                    borderRadius: "0 8px 8px 0",
                    padding: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1 }}>
                    <span style={{ fontSize: "28px", fontWeight: 800, color: "#00f0ff", opacity: 0.6, width: "40px", fontFamily: "monospace" }}>
                      #{String(repo.rank).padStart(2, "0")}
                    </span>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                        {repo.owner}/<span style={{ color: "#00f0ff" }}>{repo.name}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "#8b949e", marginTop: "6px", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {repo.description || "No description available."}
                      </div>
                    </div>
                  </div>

                  {/* Metrics block */}
                  <div style={{ display: "flex", gap: "32px", textAlign: "right" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", letterSpacing: "0.05em" }}>7D VELOCITY</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#d29922", marginTop: "2px" }}>
                        +{repo.star_velocity_7d?.toFixed(0)} <span style={{ fontSize: "11px", fontWeight: 400, color: "#8b949e" }}>/day</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", letterSpacing: "0.05em" }}>HEALTH</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: borderLeftColor, marginTop: "2px", letterSpacing: "0.05em" }}>
                        {repo.sustainability_label === "GREEN" ? "JONIN" : 
                         repo.sustainability_label === "YELLOW" ? "CHUNIN" : "GENIN"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Poster Footer */}
        <div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", marginBottom: "32px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "12px", color: "#8b949e", fontFamily: "monospace", letterSpacing: "0.1em" }}>
              AUTOMATED DATA ANALYSIS • GENERATED BY REPODAR ENGINE
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "4px", background: "#00f0ff" }}></div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#ffffff" }}>repodar.io</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main page content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        
        {/* Navigation / Breadcrumbs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/weekly" style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }} className="hover-link-glow">
            ← BACK TO ARCHIVES
          </Link>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            padding: "3px 8px",
            borderRadius: "4px"
          }}>
            SYSTEM: OK
          </span>
        </div>

        {/* Editorial News Header / Hero */}
        <div style={{
          background: "linear-gradient(135deg, rgba(22, 27, 34, 0.6) 0%, rgba(13, 17, 23, 0.8) 100%)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "36px",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Neon corner accent */}
          <div style={{ position: "absolute", top: 0, right: 0, width: "120px", height: "120px", background: "radial-gradient(circle at 100% 0%, rgba(0, 240, 255, 0.08) 0%, transparent 70%)" }} />

          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.15em",
            color: "var(--cyan)",
            fontWeight: 800,
            textTransform: "uppercase"
          }}>
            // REPODAR BRIEFING SYSTEM
          </div>

          <h1 style={{
            fontFamily: "var(--font-sans)",
            fontSize: "36px",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginTop: "8px",
            marginBottom: "12px",
            lineHeight: "1.15"
          }}>
            AI/ML Ecosystem Radar: Weekly Intel <span style={{ color: "var(--cyan)" }}>{weekId}</span>
          </h1>

          {/* Publisher Metadata Strip */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--cyan) 0%, var(--border) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--bg-primary)",
                fontFamily: "var(--font-mono)",
                fontWeight: 900,
                fontSize: "13px"
              }}>
                R
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Repodar Editorial Engine</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", gap: "8px" }}>
                  <span>📅 {snapshot ? new Date(snapshot.published_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "Loading..."}</span>
                  <span>•</span>
                  <span>⏱️ 5 min read</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="btn-cyber btn-cyber-cyan" 
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  padding: "6px 14px",
                  cursor: "pointer",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)"
                }}
              >
                {/* Export Icon */}
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Poster
              </button>

              <button 
                onClick={handleCopyLink}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  padding: "6px 14px",
                  cursor: "pointer",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  background: "transparent",
                  color: copied ? "var(--accent-green)" : "var(--text-secondary)"
                }}
              >
                {copied ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: "80px 0" }}>
            <ProfessionalLoader size={45} text="Generating weekly intelligence report..." />
          </div>
        ) : error ? (
          <div style={{
            fontFamily: "var(--font-mono)",
            color: "var(--accent-red)",
            padding: "40px",
            fontSize: "12px",
            border: "1px dashed var(--border)",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            // ERROR: Failed to retrieve Weekly Snapshot {weekId}. Please verify the identifier and try again.
          </div>
        ) : snapshot ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
            
            {/* Key Ecosystem Stats Strip */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px"
            }}>
              <div className="kpi-card">
                <div className="kpi-label">Cohorts Analyzed</div>
                <div className="kpi-value">{snapshot.repos?.length || 25}</div>
                <div className="kpi-sub">Total repositories tracked this week</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Peak Velocity</div>
                <div className="kpi-value" style={{ color: "var(--amber)" }}>+{maxVelocity.toFixed(0)}</div>
                <div className="kpi-sub">Stars added/day (leading breakout)</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Average Acceleration</div>
                <div className="kpi-value" style={{ color: "var(--cyan)" }}>{avgAccel.toFixed(2)}x</div>
                <div className="kpi-sub">Speedup against typical baseline</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Jonin-Tier Health</div>
                <div className="kpi-value" style={{ color: "var(--accent-green)" }}>{healthyCount}</div>
                <div className="kpi-sub">Repos with robust maintenance hygiene</div>
              </div>
            </div>

            {/* SECTION 1: TOP 10 FEATURED REPOS */}
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              <h2 style={{
                fontFamily: "var(--font-sans)",
                fontSize: "20px",
                fontWeight: 800,
                color: "var(--text-primary)",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: 0
              }}>
                <span style={{ color: "var(--cyan)", fontSize: "20px" }}>✦</span> Top 10 Featured Highlights
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {featuredRepos.map((repo) => {
                  const borderLeftColor =
                    repo.sustainability_label === "GREEN"
                      ? "var(--accent-green)"
                      : repo.sustainability_label === "YELLOW"
                      ? "var(--accent-yellow)"
                      : "var(--accent-red)";

                  return (
                    <div
                      key={repo.repo_id}
                      className="panel"
                      style={{
                        borderLeft: `4px solid ${borderLeftColor}`,
                        display: "flex",
                        flexDirection: "column",
                        padding: "28px",
                        gap: "20px",
                        borderRadius: "8px",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        borderLeftWidth: "4px"
                      }}
                    >
                      {/* Repo Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <span style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "28px",
                            fontWeight: 900,
                            color: "var(--cyan)",
                            opacity: 0.8
                          }}>
                            #{String(repo.rank).padStart(2, "0")}
                          </span>
                          <div>
                            <Link href={`/repo/${repo.repo_id}`} style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: "20px",
                              fontWeight: 800,
                              color: "var(--text-primary)",
                              textDecoration: "none"
                            }} className="hover-link-glow">
                              {repo.owner}/<span style={{ color: "var(--cyan)" }}>{repo.name}</span>
                            </Link>
                            
                            <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                              {repo.category && (
                                <span style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "9px",
                                  padding: "2px 8px",
                                  background: "rgba(255,255,255,0.04)",
                                  borderRadius: "4px",
                                  color: "var(--text-secondary)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  border: "1px solid rgba(255,255,255,0.03)"
                                }}>
                                  {repo.category}
                                </span>
                              )}
                              {repo.primary_language && (
                                <span style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "9px",
                                  padding: "2px 8px",
                                  background: "rgba(255,255,255,0.04)",
                                  borderRadius: "4px",
                                  color: "var(--text-secondary)",
                                  border: "1px solid rgba(255,255,255,0.03)"
                                }}>
                                  {repo.primary_language}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <a
                          href={repo.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-cyber btn-cyber-cyan"
                          style={{
                            padding: "6px 12px",
                            fontSize: "11px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            textDecoration: "none",
                            borderRadius: "4px",
                            fontFamily: "var(--font-mono)"
                          }}
                        >
                          GitHub ↗
                        </a>
                      </div>

                      {/* Description */}
                      {repo.description && (
                        <p style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "14.5px",
                          color: "var(--text-primary)",
                          lineHeight: "1.6",
                          margin: 0,
                          maxWidth: "800px"
                        }}>
                          {repo.description}
                        </p>
                      )}

                      {/* Dashboard Metrics Strip */}
                      <div className="weekly-metrics-strip" style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                        gap: "16px",
                        background: "rgba(0,0,0,0.15)",
                        padding: "16px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "4px" }}>
                            {/* Star Icon */}
                            <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Total Stars
                          </span>
                          <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: "4px" }}>
                            {repo.stars?.toLocaleString() ?? "—"}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "4px" }}>
                            {/* Lightning icon */}
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            7D Velocity
                          </span>
                          <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--amber)", marginTop: "4px" }}>
                            +{repo.star_velocity_7d?.toFixed(1) ?? "—"} <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--text-muted)" }}>/day</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "4px" }}>
                            {/* Accel icon */}
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            Acceleration
                          </span>
                          <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--cyan)", marginTop: "4px" }}>
                            {repo.acceleration?.toFixed(2) ?? "—"}x
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                            {/* Shield icon */}
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Eco-Health
                          </span>
                          <NinjaRankPill label={repo.sustainability_label} />
                        </div>
                      </div>

                      {/* Editorial Commentary Quote Box */}
                      <div style={{
                        background: "rgba(0, 229, 255, 0.01)",
                        borderLeft: "2px solid var(--cyan)",
                        padding: "16px 20px",
                        borderRadius: "0 8px 8px 0",
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                        border: "1px solid rgba(0,240,255,0.04)",
                        borderLeftWidth: "3px"
                      }}>
                        <div style={{ color: "var(--cyan)", marginTop: "2px", flexShrink: 0 }}>
                          {/* Spark/Brain icon */}
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M12,4 C7.58,4 4,7.58 4,12 C4,16.42 7.58,20 12,20 C14,20 15.8,19.2 17.2,17.8 L18.5,19.1 C16.8,20.9 14.5,22 12,22 C6.48,22 2,17.52 2,12 C2,6.48 6.48,2 12,2 C17,2 20.5,5 21,5.5 L18,8.5 L22,9 L21.5,5 L19.5,7 C18.2,5.2 15.2,4 12,4 Z" />
                          </svg>
                        </div>
                        <div style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13.5px",
                          lineHeight: "1.6",
                          color: "var(--text-secondary)",
                          fontStyle: "italic",
                          margin: 0
                        }}>
                          {generateInsightCommentary(repo)}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: REMAINING RADAR (11-25) */}
            {secondaryRepos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <h2 style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  margin: 0
                }}>
                  <span style={{ color: "var(--text-muted)" }}>⬡</span> Ranks 11-25: Notable Breakouts
                </h2>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px"
                }}>
                  {secondaryRepos.map((repo) => (
                    <div
                      key={repo.repo_id}
                      className="panel hover-link-glow"
                      style={{
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "16px",
                        borderRadius: "8px",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        transition: "transform 0.2s ease, border-color 0.2s ease",
                      }}
                    >
                      <div>
                        {/* Top identity */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "14px",
                            fontWeight: 800,
                            color: "var(--cyan)"
                          }}>
                            #{repo.rank}
                          </span>
                          
                          <NinjaRankPill label={repo.sustainability_label} />
                        </div>

                        <div style={{ marginTop: "12px" }}>
                          <Link href={`/repo/${repo.repo_id}`} style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            textDecoration: "none",
                            wordBreak: "break-all"
                          }} className="hover-link-glow">
                            {repo.owner}/<span style={{ color: "var(--cyan)" }}>{repo.name}</span>
                          </Link>
                        </div>

                        {repo.description && (
                          <p style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            lineHeight: "1.5",
                            marginTop: "8px",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            height: "36px",
                            margin: "8px 0 0 0"
                          }}>
                            {repo.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom metrics row */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderTop: "1px solid var(--border)",
                        paddingTop: "12px",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)"
                      }}>
                        <span style={{ color: "var(--text-muted)" }}>
                          {repo.primary_language ?? "Other"}
                        </span>
                        <span style={{ color: "var(--amber)", fontWeight: 700 }}>
                          +{repo.star_velocity_7d?.toFixed(0) ?? "—"} <span style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 400 }}>/day</span>
                        </span>
                        <span style={{ color: "var(--cyan)", fontWeight: 700 }}>
                          {repo.acceleration?.toFixed(1) ?? "—"}x
                        </span>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer metadata */}
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border)",
              paddingTop: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px"
            }}>
              <span>© Repodar Automated Telemetry Engine</span>
              <span>All snapshots are static records of github.com at the time of execution.</span>
            </div>

          </div>
        ) : null}

      </div>

      {/* Poster Preview & Export Modal */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 13, 20, 0.85)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
          boxSizing: "border-box",
        }}>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            width: "100%",
            maxWidth: "600px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                Social Media Poster Preview (4K)
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "18px"
                }}
              >
                ✕
              </button>
            </div>

            {/* Downscaled preview of the poster */}
            <div style={{
              border: "1px solid var(--border)",
              background: "#0d1117",
              borderRadius: "8px",
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "16px"
            }}>
              <div style={{
                width: "300px",
                height: "400px",
                background: "radial-gradient(circle at 50% 50%, #171d2b 0%, #0a0d14 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "6px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transform: "scale(0.8)",
                transformOrigin: "center",
                boxSizing: "border-box",
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: "16px", height: "16px", borderRadius: "2px", background: "var(--cyan)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 800, fontSize: "8px" }}>R</div>
                      <span style={{ fontSize: "8px", fontWeight: 800, color: "#fff" }}>REPODAR</span>
                    </div>
                    <span style={{ fontSize: "7px", background: "rgba(0,240,255,0.1)", color: "var(--cyan)", padding: "2px 4px", borderRadius: "2px", fontFamily: "monospace" }}>W {weekId}</span>
                  </div>
                  <h4 style={{ fontSize: "13px", fontWeight: 800, color: "#fff", margin: "14px 0 4px 0", lineHeight: "1.1" }}>Weekly AI/ML Radar</h4>
                  <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "8px 0" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {featuredRepos.slice(0, 5).map((r) => (
                      <div key={r.repo_id} style={{ display: "flex", justifyContent: "space-between", fontSize: "7.5px", background: "rgba(255,255,255,0.01)", padding: "4px", borderRadius: "2px" }}>
                        <span style={{ color: "#fff", fontWeight: 700 }}>#{r.rank} {r.owner}/{r.name}</span>
                        <span style={{ color: "var(--amber)", fontWeight: 700 }}>+{r.star_velocity_7d?.toFixed(0)}/d</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: "6px", color: "var(--text-muted)", fontFamily: "monospace", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                  GENERATED AUTOMATICALLY BY REPODAR.IO
                </div>
              </div>
            </div>

            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              The exported image is a high-resolution, pixel-perfect 4K vertical graphic card (1200x1600 px scaled up to 3840x5120 pixels) built specifically for LinkedIn and Twitter mobile feeds.
            </p>

            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button 
                onClick={handleExportPoster}
                disabled={exporting}
                className="btn-cyber btn-cyber-cyan"
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: exporting ? "wait" : "pointer",
                  borderRadius: "6px",
                  border: "none",
                  background: "var(--cyan)",
                  color: "var(--bg-primary)"
                }}
              >
                {exporting ? "⏳ Rendering 4K Image..." : "📥 Download 4K Poster"}
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
