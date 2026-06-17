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
    <div className="page-root" style={{ paddingBottom: "100px", maxWidth: "1200px", margin: "0 auto" }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Navigation / Breadcrumbs / Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "8px" }}>
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
          
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                padding: "6px 12px",
                cursor: "pointer",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                background: "var(--bg-surface)",
                color: "var(--text-primary)"
              }}
            >
              {/* Export Icon */}
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                fontSize: "11px",
                padding: "6px 12px",
                cursor: "pointer",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                background: "transparent",
                color: copied ? "var(--accent-green)" : "var(--text-secondary)"
              }}
            >
              {copied ? "✓ Link Copied" : "Copy Link"}
            </button>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "40px" }} className="weekly-layout-grid">
            <style>{`
              @media (min-width: 992px) {
                .weekly-layout-grid {
                  grid-template-columns: 2.2fr 1fr !important;
                }
              }
              .news-article-card {
                border-bottom: 1px solid var(--border);
                padding-bottom: 24px;
                margin-bottom: 24px;
              }
              .news-article-card:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
              }
              .trend-item-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 0;
                border-bottom: 1px dashed rgba(255,255,255,0.06);
              }
              .trend-item-row:last-child {
                border-bottom: none;
              }
            `}</style>

            {/* Left Column: News / Editorial feed */}
            <div>
              {/* Editorial Headline */}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--cyan)", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 800 }}>
                // REPODAR WEEKLY ANALYTICAL REPORT
              </span>
              <h1 style={{
                fontFamily: "var(--font-sans)",
                fontSize: "30px",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginTop: "4px",
                marginBottom: "12px",
                lineHeight: "1.2",
                letterSpacing: "-0.02em"
              }}>
                AI/ML Ecosystem Radar: Weekly Intelligence Briefing
              </h1>

              {/* Publisher Metadata Strip */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                <span>Published by <strong>Repodar Editorial Engine</strong></span>
                <span>•</span>
                <span>📅 {new Date(snapshot.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                <span>•</span>
                <span>⏱️ 5 min read</span>
              </div>

              {/* Lead/Executive Intro Paragraph */}
              <p style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "var(--text-secondary)",
                marginBottom: "32px",
                borderLeft: "2px solid var(--cyan)",
                paddingLeft: "16px"
              }}>
                A curated weekly analytical digest of the top-performing AI and Machine Learning open-source projects.
                Using our multi-dimensional ranking model, we evaluate velocity delta, breakout acceleration, and project community health.
                Below is our focused breakdown of the <strong>Top 10 Featured Highlights</strong>, followed by notable secondary breakouts in the sidebar.
              </p>

              {/* Featured highlights (Ranks 1 to 10) */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {featuredRepos.map((repo) => {
                  const healthColor =
                    repo.sustainability_label === "GREEN" ? "var(--accent-green)" :
                    repo.sustainability_label === "YELLOW" ? "var(--accent-yellow)" : "var(--accent-red)";

                  return (
                    <div key={repo.repo_id} className="news-article-card">
                      {/* Header row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
                          <span style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "15px",
                            fontWeight: 800,
                            color: "var(--cyan)",
                            minWidth: "24px"
                          }}>
                            {String(repo.rank).padStart(2, "0")}.
                          </span>
                          <div>
                            <Link href={`/repo/${repo.repo_id}`} style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: "17px",
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              textDecoration: "none"
                            }} className="hover-link-glow">
                              {repo.owner}/<span style={{ color: "var(--cyan)" }}>{repo.name}</span>
                            </Link>
                            <div style={{ display: "inline-flex", gap: "6px", marginLeft: "12px" }}>
                              {repo.category && (
                                <span style={{
                                  fontSize: "9px",
                                  color: "var(--text-secondary)",
                                  background: "rgba(255,255,255,0.04)",
                                  padding: "1px 5px",
                                  borderRadius: "3px",
                                  fontFamily: "var(--font-mono)",
                                  textTransform: "uppercase"
                                }}>
                                  {repo.category}
                                </span>
                              )}
                              {repo.primary_language && (
                                <span style={{
                                  fontSize: "9px",
                                  color: "var(--text-secondary)",
                                  background: "rgba(255,255,255,0.04)",
                                  padding: "1px 5px",
                                  borderRadius: "3px",
                                  fontFamily: "var(--font-mono)"
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
                          style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--cyan)",
                            textDecoration: "none"
                          }} 
                          className="hover-link-glow"
                        >
                          GitHub ↗
                        </a>
                      </div>

                      {/* Description */}
                      {repo.description && (
                        <p style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13.5px",
                          lineHeight: "1.5",
                          color: "var(--text-secondary)",
                          margin: "8px 0 10px 34px"
                        }}>
                          {repo.description}
                        </p>
                      )}

                      {/* Clean Single-line Metrics Strip */}
                      <div style={{
                        display: "flex",
                        gap: "16px",
                        flexWrap: "wrap",
                        fontSize: "11.5px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                        margin: "0 0 12px 34px",
                        background: "rgba(255,255,255,0.015)",
                        border: "1px solid rgba(255,255,255,0.02)",
                        padding: "6px 12px",
                        borderRadius: "4px"
                      }}>
                        <span>★ {repo.stars?.toLocaleString() || "—"} total stars</span>
                        <span>•</span>
                        <span style={{ color: "var(--amber)" }}>⚡ +{repo.star_velocity_7d?.toFixed(0)}/day velocity</span>
                        <span>•</span>
                        <span style={{ color: "var(--cyan)" }}>📈 {repo.acceleration?.toFixed(1)}x accel</span>
                        <span>•</span>
                        <span style={{ color: healthColor, fontWeight: 600 }}>🛡️ {repo.sustainability_label === "GREEN" ? "JONIN" : repo.sustainability_label === "YELLOW" ? "CHUNIN" : "GENIN"} health</span>
                      </div>

                      {/* Inline Analyst Take Commentary */}
                      <p style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        lineHeight: "1.55",
                        color: "var(--text-secondary)",
                        margin: "0 0 0 34px",
                        paddingLeft: "12px",
                        borderLeft: "2px solid rgba(255,255,255,0.08)",
                        fontStyle: "italic"
                      }}>
                        <strong>Analyst Note:</strong> {generateInsightCommentary(repo)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Sidebar (Ecosystem widgets) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {/* Stats Summary Widget */}
              <div style={{
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "16px",
                background: "rgba(255,255,255,0.01)"
              }}>
                <h3 style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--cyan)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "8px",
                  marginTop: 0,
                  marginBottom: "14px",
                  fontWeight: 700
                }}>
                  Weekly Intel Summary
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Tracked Repositories</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: "2px" }}>
                      {snapshot.repos?.length || 25} projects
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Peak Star Velocity</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--amber)", marginTop: "2px" }}>
                      +{maxVelocity.toFixed(0)} stars/day
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Average Acceleration</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--cyan)", marginTop: "2px" }}>
                      {avgAccel.toFixed(2)}x speedup
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Jonin-Tier Health</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-green)", marginTop: "2px" }}>
                      {healthyCount} healthy communities
                    </div>
                  </div>
                </div>
              </div>

              {/* Notable Breakouts widget (Ranks 11-25) */}
              {secondaryRepos.length > 0 && (
                <div style={{
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.01)"
                }}>
                  <h3 style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-primary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "8px",
                    marginTop: 0,
                    marginBottom: "8px",
                    fontWeight: 700
                  }}>
                    Notable Breakouts (11-25)
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {secondaryRepos.map((repo) => {
                      const healthColor =
                        repo.sustainability_label === "GREEN" ? "var(--accent-green)" :
                        repo.sustainability_label === "YELLOW" ? "var(--accent-yellow)" : "var(--accent-red)";
                      return (
                        <div key={repo.repo_id} className="trend-item-row">
                          <span style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                            minWidth: "20px"
                          }}>
                            #{repo.rank}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Link href={`/repo/${repo.repo_id}`} style={{
                              fontSize: "12.5px",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              textDecoration: "none",
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }} className="hover-link-glow">
                              {repo.owner}/{repo.name}
                            </Link>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px", display: "flex", gap: "6px" }}>
                              <span>{repo.primary_language || "Other"}</span>
                              <span>•</span>
                              <span style={{ color: "var(--amber)" }}>+{repo.star_velocity_7d?.toFixed(0)}/d</span>
                            </div>
                          </div>
                          <span style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: healthColor,
                            flexShrink: 0
                          }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
