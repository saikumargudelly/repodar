"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect } from "react";
import { api, SnapshotDetail } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";
import { NinjaRankPill } from "@/components/NinjaRankPill";

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
    healthText = `⚠️ Under Genin-tier classification, this repo displays potential maintenance risks, such as high open-to-close issue ratios or low recent commit frequency, despite its current trend velocity.`;
  }

  return `This week, ${owner}/${name} captured a top spot on our radar, ${velocityText} ${accelText} ${healthText}`;
}

export default function WeeklyDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);

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

  return (
    <div className="page-root" style={{ paddingBottom: "100px" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/weekly" style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px"
          }}>
            ← All Snapshots
          </Link>
        </div>
        
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.15em",
          color: "var(--cyan)",
          fontWeight: 700,
          textTransform: "uppercase",
          marginTop: "16px"
        }}>
          // REPODAR WEEKLY INTELLIGENCE REPORT
        </div>

        <h1 className="section-title-cyber" style={{ fontSize: "32px", marginTop: "4px", marginBottom: "8px", lineHeight: "1.2" }}>
          AI/ML Ecosystem Digest: <span>{weekId}</span><span className="terminal-cursor" />
        </h1>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
          flexWrap: "wrap"
        }}>
          <span>Published by <strong>Repodar Intelligence Bot</strong></span>
          <span className="col-hide-mobile" style={{ color: "var(--border)" }}>|</span>
          <span>⏱️ 5 min read</span>
          <span className="col-hide-mobile" style={{ color: "var(--border)" }}>|</span>
          <span>📅 {snapshot ? new Date(snapshot.published_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "LOADING"}</span>
        </div>

        {snapshot && (
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--text-secondary)",
            lineHeight: "1.6",
            marginTop: "16px",
            maxWidth: "800px"
          }}>
            A curated weekly analytical digest of the top-performing AI and Machine Learning open-source projects.
            Using our multi-dimensional ranking model, we evaluate velocity delta, breakout acceleration, and project community health.
            Below is our focused breakdown of the <strong>Top 10 Featured Repositories</strong>, followed by other notable weekly breakouts.
          </p>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: "80px 0" }}>
          <ProfessionalLoader size={45} text="Generating weekly intelligence report..." />
        </div>
      ) : error ? (
        <div style={{
          fontFamily: "var(--font-mono)",
          color: "var(--red, #ef4444)",
          padding: "40px 0",
          fontSize: "12px",
          border: "1px dashed var(--border)",
          borderRadius: "8px",
          textAlign: "center"
        }}>
          // ERROR: Failed to retrieve Weekly Snapshot {weekId}. Please verify the identifier and try again.
        </div>
      ) : snapshot ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "48px", marginTop: "24px" }}>
          
          {/* SECTION 1: TOP 10 FEATURED REPOS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <h2 style={{
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <span style={{ color: "var(--cyan)" }}>★</span> Top 10 Featured Highlights
            </h2>

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
                  className="panel animate-fade-up"
                  style={{
                    borderLeft: `4px solid ${borderLeftColor}`,
                    display: "flex",
                    flexDirection: "column",
                    padding: "24px",
                    gap: "16px",
                    transition: "transform 0.2s ease, border-color 0.2s ease",
                  }}
                >
                  {/* Repo Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "24px",
                        fontWeight: 700,
                        color: "var(--cyan)",
                        opacity: 0.8
                      }}>
                        #{String(repo.rank).padStart(2, "0")}
                      </span>
                      <div>
                        <Link href={`/repo/${repo.repo_id}`} style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          textDecoration: "none"
                        }} className="hover-link-glow">
                          {repo.owner}/<span style={{ color: "var(--cyan)" }}>{repo.name}</span>
                        </Link>
                        
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                          {repo.category && (
                            <span style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "9px",
                              padding: "2px 6px",
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: "4px",
                              color: "var(--text-secondary)",
                              textTransform: "uppercase"
                            }}>
                              {repo.category}
                            </span>
                          )}
                          {repo.primary_language && (
                            <span style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "9px",
                              padding: "2px 6px",
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: "4px",
                              color: "var(--text-secondary)"
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
                        padding: "4px 10px",
                        fontSize: "11px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        textDecoration: "none"
                      }}
                    >
                      GitHub ↗
                    </a>
                  </div>

                  {/* Description */}
                  {repo.description && (
                    <p style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "14px",
                      color: "var(--text-primary)",
                      lineHeight: "1.5",
                      margin: 0
                    }}>
                      {repo.description}
                    </p>
                  )}

                  {/* Metrics Strip */}
                  <div className="weekly-metrics-strip">
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>★ TOTAL STARS</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                        {repo.stars?.toLocaleString() ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>7D VELOCITY</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: "var(--amber)", marginTop: "2px" }}>
                        +{repo.star_velocity_7d?.toFixed(1) ?? "—"} <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--text-muted)" }}>/day</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>ACCELERATION</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: "var(--cyan)", marginTop: "2px" }}>
                        {repo.acceleration?.toFixed(2) ?? "—"}x
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", marginBottom: "4px" }}>SUSTAINABILITY</div>
                      <NinjaRankPill label={repo.sustainability_label} />
                    </div>
                  </div>

                  {/* Digest Commentary */}
                  <div style={{
                    background: "rgba(0, 229, 255, 0.02)",
                    borderLeft: "2px solid var(--cyan)",
                    padding: "12px 16px",
                    borderRadius: "0 6px 6px 0",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start"
                  }}>
                    <div style={{ color: "var(--cyan)", marginTop: "2px", flexShrink: 0 }}>
                      {/* Leaf Brand Icon Inline */}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M12,4 C7.58,4 4,7.58 4,12 C4,16.42 7.58,20 12,20 C14,20 15.8,19.2 17.2,17.8 L18.5,19.1 C16.8,20.9 14.5,22 12,22 C6.48,22 2,17.52 2,12 C2,6.48 6.48,2 12,2 C17,2 20.5,5 21,5.5 L18,8.5 L22,9 L21.5,5 L19.5,7 C18.2,5.2 15.2,4 12,4 Z" />
                      </svg>
                    </div>
                    <div style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      lineHeight: "1.5",
                      color: "var(--text-secondary)",
                      fontStyle: "italic"
                    }}>
                      {generateInsightCommentary(repo)}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* SECTION 2: REMAINING RADAR (11-25) */}
          {secondaryRepos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <span style={{ color: "var(--text-muted)" }}>⬡</span> Ranks 11-25: Notable Breakouts
              </h2>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px"
              }}>
                {secondaryRepos.map((repo) => (
                  <div
                    key={repo.repo_id}
                    className="panel animate-fade-up"
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "12px",
                      position: "relative"
                    }}
                  >
                    <div>
                      {/* Top identity */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--text-muted)"
                        }}>
                          #{repo.rank}
                        </span>
                        
                        <div style={{ marginLeft: "auto" }}>
                          <NinjaRankPill label={repo.sustainability_label} />
                        </div>
                      </div>

                      <div style={{ marginTop: "8px" }}>
                        <Link href={`/repo/${repo.repo_id}`} style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          textDecoration: "none",
                          wordBreak: "break-all"
                        }} className="hover-link-glow">
                          {repo.owner}/{repo.name}
                        </Link>
                      </div>

                      {repo.description && (
                        <p style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          lineHeight: "1.4",
                          marginTop: "6px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          height: "30px"
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
                      paddingTop: "10px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)"
                    }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {repo.primary_language ?? "—"}
                      </span>
                      <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                        +{repo.star_velocity_7d?.toFixed(0) ?? "—"} <span style={{ color: "var(--text-muted)", fontSize: "9px" }}>/day</span>
                      </span>
                      <span style={{ color: "var(--cyan)" }}>
                        {repo.acceleration?.toFixed(1) ?? "—"}x
                      </span>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share Block */}
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
            <span>© Repodar Engine Analysis</span>
            <div style={{ display: "flex", gap: "12px" }}>
              Share Digest →{" "}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Repodar Weekly AI/ML Digest: ${weekId} 🚀 — check out the top 25 featured breakout repos at ${typeof window !== "undefined" ? window.location.href : ""}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--cyan)", textDecoration: "none" }}
                className="hover-link-glow"
              >
                Twitter/X
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
