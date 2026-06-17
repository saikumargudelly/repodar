"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useState, useRef } from "react";
import { api, SnapshotDetail } from "@/lib/api";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";
import { toPng } from "html-to-image";

/* ─────────────────────────────────────────────────────────────
   Helper: generate per-repo analyst commentary
───────────────────────────────────────────────────────────── */
function generateInsightCommentary(repo: any) {
  const velocity = repo.star_velocity_7d ?? 0;
  const accel = repo.acceleration ?? 0;
  const label = repo.sustainability_label || "GREEN";
  const name = `${repo.owner}/${repo.name}`;

  let velocityText =
    velocity > 250
      ? `surging at +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day, signaling a viral breakout moment`
      : velocity > 80
      ? `growing steadily at +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day, driven by consistent organic traction`
      : `attracting +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day of baseline interest`;

  let accelText =
    accel > 2.0
      ? ` The ${accel.toFixed(1)}x acceleration indicates a major inflection — a new release, viral thread, or conference buzz.`
      : accel > 1.2
      ? ` Its ${accel.toFixed(1)}x acceleration suggests genuine positive momentum above historical norms.`
      : ` Growth remains in steady-state with no unusual acceleration signals.`;

  let healthText =
    label === "GREEN"
      ? ` Jonin-tier health score reflects robust maintenance, active issue resolution, and an ecosystem safe for production integration.`
      : label === "YELLOW"
      ? ` Chunin-tier health warrants monitoring — pull-request delays or contributor flux have been detected.`
      : ` Genin-tier health flags maintenance risk; high issue-to-close ratios or low commit frequency despite trending velocity.`;

  return `${name} is ${velocityText}.${accelText}${healthText}`;
}

/* ─────────────────────────────────────────────────────────────
   Health display helpers
───────────────────────────────────────────────────────────── */
function healthLabel(label: string) {
  if (label === "GREEN") return "Jonin";
  if (label === "YELLOW") return "Chunin";
  return "Genin";
}
function healthColor(label: string) {
  if (label === "GREEN") return "#3fb950";
  if (label === "YELLOW") return "#d29922";
  return "#f85149";
}
function healthDot(label: string) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: healthColor(label),
        marginRight: 5,
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   Page component
───────────────────────────────────────────────────────────── */
export default function WeeklyDetailPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = use(params);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (weekId)
      document.title = `Repodar Weekly Digest: ${weekId} | AI/ML Ecosystem Radar`;
  }, [weekId]);

  const {
    data: snapshot,
    isLoading,
    error,
  } = useQuery<SnapshotDetail>({
    queryKey: ["snapshot", weekId],
    queryFn: () => api.getSnapshot(weekId),
    enabled: !!weekId,
  });

  const featuredRepos = snapshot?.repos?.slice(0, 10) ?? [];
  const secondaryRepos = snapshot?.repos?.slice(10) ?? [];
  const maxVelocity = snapshot?.repos
    ? Math.max(...snapshot.repos.map((r) => r.star_velocity_7d || 0))
    : 0;
  const avgAccel = snapshot?.repos
    ? snapshot.repos.reduce((a, r) => a + (r.acceleration || 0), 0) /
      snapshot.repos.length
    : 0;
  const healthyCount = snapshot?.repos
    ? snapshot.repos.filter(
        (r) =>
          r.sustainability_label === "GREEN" ||
          r.sustainability_label === "HEALTHY"
      ).length
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

  /* ── Page-scoped styles ── */
  const pageStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');

    .wd-root { max-width: 900px; margin: 0 auto; padding: 0 16px 120px; }

    /* Masthead */
    .wd-masthead {
      border-bottom: 3px double var(--border);
      padding-bottom: 12px;
      margin-bottom: 20px;
      text-align: center;
    }
    .wd-pub-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(28px, 5vw, 48px);
      font-weight: 900;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      line-height: 1;
      margin: 0;
    }
    .wd-pub-tagline {
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      margin-top: 4px;
    }
    .wd-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      margin-top: 10px;
    }
    .wd-edition-badge {
      font-weight: 700;
      color: var(--text-secondary);
      letter-spacing: 0.06em;
      font-size: 10px;
      text-transform: uppercase;
      background: rgba(255,255,255,0.04);
      padding: 3px 8px;
      border-radius: 3px;
      border: 1px solid var(--border);
    }

    /* Section labels */
    .wd-section-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
      margin-bottom: 20px;
    }

    /* Lead story */
    .wd-lead-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(22px, 4vw, 34px);
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      margin: 0 0 10px 0;
    }
    .wd-lead-deck {
      font-size: 15px;
      line-height: 1.6;
      color: var(--text-secondary);
      font-family: 'Inter', sans-serif;
      margin: 0 0 14px;
      font-style: italic;
    }

    /* Byline row */
    .wd-byline {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 8px 0;
      margin-bottom: 28px;
    }
    .wd-byline-sep { opacity: 0.3; }

    /* Stats strip */
    .wd-stats-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 32px;
    }
    @media (max-width: 600px) { .wd-stats-strip { grid-template-columns: repeat(2, 1fr); } }
    .wd-stat-cell {
      background: var(--bg-surface);
      padding: 12px 16px;
      text-align: center;
    }
    .wd-stat-val {
      font-family: 'Inter', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
    }
    .wd-stat-key {
      font-size: 9px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* Grid layout */
    .wd-grid { display: grid; grid-template-columns: 1fr; gap: 32px; }
    @media (min-width: 900px) { .wd-grid { grid-template-columns: 1.9fr 1fr; gap: 40px; } }

    /* Article card */
    .wd-article {
      padding: 0 0 24px 0;
      border-bottom: 1px solid var(--border);
    }
    .wd-article:last-child { border-bottom: none; padding-bottom: 0; }

    .wd-art-rank {
      font-family: 'Inter', sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .wd-art-headline {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(16px, 2.5vw, 21px);
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      text-decoration: none;
      display: block;
      margin-bottom: 6px;
      transition: opacity 0.15s;
    }
    .wd-art-headline:hover { opacity: 0.75; }

    .wd-art-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 10.5px;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      margin-bottom: 10px;
    }
    .wd-art-tag {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      padding: 1px 6px;
      border-radius: 2px;
      font-size: 9px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .wd-art-body {
      font-size: 13.5px;
      line-height: 1.7;
      color: var(--text-secondary);
      font-family: 'Inter', sans-serif;
      margin: 0 0 10px;
    }

    /* Metric row */
    .wd-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      font-size: 11px;
      font-family: 'Inter', sans-serif;
      color: var(--text-muted);
    }
    .wd-metric-item { display: flex; align-items: center; gap: 4px; }
    .wd-metric-icon { font-size: 11px; }
    .wd-metric-val { font-weight: 600; color: var(--text-secondary); }

    /* Pull quote */
    .wd-pullquote {
      border-left: 3px solid var(--border);
      padding: 2px 14px;
      margin: 12px 0 0;
      font-size: 12.5px;
      line-height: 1.6;
      color: var(--text-muted);
      font-style: italic;
      font-family: 'Inter', sans-serif;
    }
    .wd-pullquote strong { font-style: normal; color: var(--text-secondary); font-weight: 600; }

    /* GitHub link */
    .wd-gh-link {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-decoration: none;
      letter-spacing: 0.05em;
      font-family: 'Inter', sans-serif;
      transition: color 0.15s;
    }
    .wd-gh-link:hover { color: var(--text-primary); }

    /* Sidebar */
    .wd-sidebar { display: flex; flex-direction: column; gap: 28px; }

    .wd-sidebar-block { border-top: 2px solid var(--text-muted); padding-top: 14px; }
    .wd-sidebar-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      margin: 0 0 14px;
    }

    /* Sidebar stat */
    .wd-sb-stat { margin-bottom: 14px; }
    .wd-sb-stat-val {
      font-size: 22px;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      color: var(--text-primary);
      line-height: 1;
    }
    .wd-sb-stat-key {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 2px;
      font-family: 'Inter', sans-serif;
    }

    /* Sidebar repo row */
    .wd-sb-repo {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 9px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .wd-sb-repo:last-child { border-bottom: none; }
    .wd-sb-rank {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      min-width: 18px;
      padding-top: 1px;
    }
    .wd-sb-name {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-primary);
      font-family: 'Inter', sans-serif;
      text-decoration: none;
      display: block;
      line-height: 1.3;
    }
    .wd-sb-name:hover { opacity: 0.7; }
    .wd-sb-sub {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 2px;
      font-family: 'Inter', sans-serif;
    }

    /* Nav bar */
    .wd-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      font-size: 11px;
      font-family: 'Inter', sans-serif;
    }
    .wd-nav-back {
      color: var(--text-muted);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
      transition: color 0.15s;
    }
    .wd-nav-back:hover { color: var(--text-primary); }
    .wd-nav-actions { display: flex; gap: 8px; }
    .wd-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 11px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      transition: all 0.15s;
    }
    .wd-btn:hover { border-color: var(--text-muted); color: var(--text-primary); }
    .wd-btn-primary {
      background: var(--text-primary);
      color: var(--bg-primary);
      border-color: var(--text-primary);
    }
    .wd-btn-primary:hover { opacity: 0.85; }

    /* Footer rule */
    .wd-footer {
      border-top: 3px double var(--border);
      padding-top: 20px;
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      flex-wrap: wrap;
      gap: 8px;
    }
  `;

  return (
    <div className="wd-root" style={{ paddingTop: 0 }}>
      <style>{pageStyles}</style>

      {/* ── Off-screen 4K Poster ── */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "8px", background: "linear-gradient(135deg, #00f0ff 0%, #0072ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0d14", fontWeight: 800, fontSize: "20px" }}>R</div>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.05em", color: "#ffffff" }}>REPODAR</div>
                <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#8b949e", letterSpacing: "0.1em" }}>INTELLIGENCE SYSTEM</div>
              </div>
            </div>
            <div style={{ border: "1px solid rgba(0,240,255,0.3)", background: "rgba(0,240,255,0.05)", color: "#00f0ff", padding: "6px 14px", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace", fontWeight: 700 }}>WEEK {weekId}</div>
          </div>
          <div style={{ height: "2px", background: "linear-gradient(to right, #00f0ff, transparent)", marginTop: "24px", marginBottom: "40px" }} />
          <h1 style={{ fontSize: "42px", fontWeight: 900, letterSpacing: "-0.02em", color: "#ffffff", margin: "0 0 12px 0", lineHeight: "1.1" }}>Weekly AI/ML Ecosystem Breakthroughs</h1>
          <p style={{ fontSize: "16px", color: "#8b949e", margin: "0 0 48px 0", lineHeight: "1.5", maxWidth: "800px" }}>Automated intelligence telemetry capturing the highest velocity open-source projects, community health metrics, and growth acceleration.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {featuredRepos.slice(0, 5).map((repo) => {
              const bc = repo.sustainability_label === "GREEN" ? "#3fb950" : repo.sustainability_label === "YELLOW" ? "#d29922" : "#f85149";
              return (
                <div key={repo.repo_id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `5px solid ${bc}`, borderRadius: "0 8px 8px 0", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1 }}>
                    <span style={{ fontSize: "28px", fontWeight: 800, color: "#00f0ff", opacity: 0.6, width: "40px", fontFamily: "monospace" }}>#{String(repo.rank).padStart(2, "0")}</span>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>{repo.owner}/<span style={{ color: "#00f0ff" }}>{repo.name}</span></div>
                      <div style={{ fontSize: "13px", color: "#8b949e", marginTop: "6px" }}>{repo.description || "No description available."}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "32px", textAlign: "right" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", letterSpacing: "0.05em" }}>7D VELOCITY</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#d29922", marginTop: "2px" }}>+{repo.star_velocity_7d?.toFixed(0)} <span style={{ fontSize: "11px", fontWeight: 400, color: "#8b949e" }}>/day</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", letterSpacing: "0.05em" }}>HEALTH</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: bc, marginTop: "2px" }}>{healthLabel(repo.sustainability_label)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", marginBottom: "32px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "12px", color: "#8b949e", fontFamily: "monospace", letterSpacing: "0.1em" }}>AUTOMATED DATA ANALYSIS • GENERATED BY REPODAR ENGINE</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "4px", background: "#00f0ff" }} />
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#ffffff" }}>repodar.io</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav bar ── */}
      <div className="wd-nav">
        <Link href="/weekly" className="wd-nav-back">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" /></svg>
          All Editions
        </Link>
        <div className="wd-nav-actions">
          <button className="wd-btn" onClick={() => setIsModalOpen(true)}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Poster
          </button>
          <button className="wd-btn" onClick={handleCopyLink}>
            {copied ? "✓ Copied" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* ── Masthead ── */}
      <div className="wd-masthead">
        <p className="wd-pub-tagline">The Open-Source Intelligence Brief</p>
        <h1 className="wd-pub-name">Repodar Weekly</h1>
        <p className="wd-pub-tagline" style={{ marginTop: 8, letterSpacing: "0.1em" }}>AI · ML · OPEN SOURCE · DEVELOPER ECOSYSTEM</p>
        <div className="wd-top-bar">
          <span>
            {snapshot?.published_at
              ? new Date(snapshot.published_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Loading..."}
          </span>
          <span className="wd-edition-badge">Edition #{weekId}</span>
          <span>repodar.io</span>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div style={{ padding: "80px 0" }}>
          <ProfessionalLoader size={40} text="Generating weekly intelligence report..." />
        </div>
      ) : error ? (
        <div style={{ fontFamily: "Inter, sans-serif", color: "var(--accent-red)", padding: "48px", fontSize: "12px", border: "1px dashed var(--border)", borderRadius: "8px", textAlign: "center" }}>
          Failed to retrieve Weekly Snapshot {weekId}. Please verify the identifier and try again.
        </div>
      ) : snapshot ? (
        <>
          {/* ── Story lead ── */}
          <div style={{ marginBottom: 28 }}>
            <p className="wd-section-label">Top Story</p>
            <h2 className="wd-lead-title">
              AI &amp; ML Open-Source Momentum Report: Week {weekId}
            </h2>
            <p className="wd-lead-deck">
              Our telemetry engine scanned {snapshot.repos?.length ?? 25} repositories across the AI and Machine Learning ecosystem, ranking each by star velocity, growth acceleration, and community health — surfacing the breakout projects developers are moving toward this week.
            </p>
            <div className="wd-byline">
              <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Repodar Editorial Engine</span>
              <span className="wd-byline-sep">|</span>
              <span>
                {snapshot.published_at
                  ? new Date(snapshot.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : ""}
              </span>
              <span className="wd-byline-sep">|</span>
              <span>5 min read</span>
              <span className="wd-byline-sep">|</span>
              <span>{snapshot.repos?.length ?? 25} repositories tracked</span>
            </div>
          </div>

          {/* ── Cohort stats strip ── */}
          <div className="wd-stats-strip" style={{ marginBottom: 32 }}>
            <div className="wd-stat-cell">
              <div className="wd-stat-val">{snapshot.repos?.length ?? 25}</div>
              <div className="wd-stat-key">Repos Tracked</div>
            </div>
            <div className="wd-stat-cell">
              <div className="wd-stat-val" style={{ color: "#d29922" }}>+{maxVelocity.toFixed(0)}</div>
              <div className="wd-stat-key">Peak Stars/Day</div>
            </div>
            <div className="wd-stat-cell">
              <div className="wd-stat-val" style={{ color: "var(--text-secondary)" }}>{avgAccel.toFixed(1)}x</div>
              <div className="wd-stat-key">Avg Acceleration</div>
            </div>
            <div className="wd-stat-cell">
              <div className="wd-stat-val" style={{ color: "#3fb950" }}>{healthyCount}</div>
              <div className="wd-stat-key">Jonin Health</div>
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div className="wd-grid">
            {/* Left: Editorial feed */}
            <div>
              <p className="wd-section-label">Featured Highlights — Ranks 1–10</p>
              {featuredRepos.map((repo, idx) => (
                <article key={repo.repo_id} className="wd-article">
                  <div className="wd-art-rank">
                    #{String(repo.rank).padStart(2, "0")} &nbsp;·&nbsp; Featured Breakout
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <Link href={`/repo/${repo.repo_id}`} className="wd-art-headline">
                      {repo.owner}/{repo.name}
                    </Link>
                    <a href={repo.github_url} target="_blank" rel="noopener noreferrer" className="wd-gh-link" style={{ flexShrink: 0, paddingTop: 4 }}>
                      GitHub ↗
                    </a>
                  </div>
                  <div className="wd-art-meta">
                    {healthDot(repo.sustainability_label || "RED")}
                    <span style={{ color: healthColor(repo.sustainability_label || "RED"), fontWeight: 600, fontSize: 10 }}>
                      {healthLabel(repo.sustainability_label || "RED")} Health
                    </span>
                    {repo.category && <span className="wd-art-tag">{repo.category}</span>}
                    {repo.primary_language && <span className="wd-art-tag">{repo.primary_language}</span>}
                  </div>
                  {repo.description && (
                    <p className="wd-art-body">{repo.description}</p>
                  )}
                  <div className="wd-metrics">
                    <span className="wd-metric-item">
                      <span className="wd-metric-icon">★</span>
                      <span className="wd-metric-val">{repo.stars?.toLocaleString() || "—"}</span>
                      <span> total</span>
                    </span>
                    <span className="wd-metric-item">
                      <span className="wd-metric-icon" style={{ color: "#d29922" }}>⚡</span>
                      <span className="wd-metric-val" style={{ color: "#d29922" }}>+{repo.star_velocity_7d?.toFixed(0)}/day</span>
                    </span>
                    <span className="wd-metric-item">
                      <span className="wd-metric-icon">📈</span>
                      <span className="wd-metric-val">{repo.acceleration?.toFixed(1)}x</span>
                      <span> accel</span>
                    </span>
                  </div>
                  <div className="wd-pullquote">
                    <strong>Analyst note —</strong> {generateInsightCommentary(repo)}
                  </div>
                </article>
              ))}
            </div>

            {/* Right: Sidebar */}
            <div className="wd-sidebar">
              {/* Cohort summary */}
              <div className="wd-sidebar-block">
                <p className="wd-sidebar-title">This Week in Numbers</p>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val" style={{ color: "#d29922" }}>+{maxVelocity.toFixed(0)}</div>
                  <div className="wd-sb-stat-key">Peak star velocity (per day)</div>
                </div>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val">{avgAccel.toFixed(2)}x</div>
                  <div className="wd-sb-stat-key">Average acceleration across cohort</div>
                </div>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val" style={{ color: "#3fb950" }}>{healthyCount}</div>
                  <div className="wd-sb-stat-key">Repositories with Jonin-tier health</div>
                </div>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val">{snapshot.repos?.length ?? 25}</div>
                  <div className="wd-sb-stat-key">Total repositories scanned</div>
                </div>
              </div>

              {/* Notable breakouts */}
              {secondaryRepos.length > 0 && (
                <div className="wd-sidebar-block">
                  <p className="wd-sidebar-title">Also Trending — Ranks 11–{10 + secondaryRepos.length}</p>
                  {secondaryRepos.map((repo) => (
                    <div key={repo.repo_id} className="wd-sb-repo">
                      <span className="wd-sb-rank">#{repo.rank}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/repo/${repo.repo_id}`} className="wd-sb-name">
                          {repo.owner}/{repo.name}
                        </Link>
                        <div className="wd-sb-sub">
                          {healthDot(repo.sustainability_label || "RED")}
                          {repo.primary_language || "Other"}
                          &nbsp;·&nbsp;
                          <span style={{ color: "#d29922", fontWeight: 600 }}>+{repo.star_velocity_7d?.toFixed(0)}/d</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* About section */}
              <div className="wd-sidebar-block">
                <p className="wd-sidebar-title">About This Digest</p>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-muted)", fontFamily: "Inter, sans-serif", margin: 0 }}>
                  Repodar is an automated intelligence system that continuously monitors open-source repository signals — tracking star velocity, community health, and growth acceleration to surface the most significant projects before they go mainstream.
                </p>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="wd-footer">
            <span>© {new Date().getFullYear()} Repodar Intelligence System — automated analysis, not human editorial</span>
            <span>repodar.io · Edition #{weekId}</span>
          </div>
        </>
      ) : null}

      {/* ── Export Modal ── */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,13,20,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px", boxSizing: "border-box" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", width: "100%", maxWidth: "560px", padding: "28px", display: "flex", flexDirection: "column", gap: "18px", boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text-primary)", fontFamily: "Inter, sans-serif" }}>Social Media Poster</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontFamily: "Inter, sans-serif" }}>High-resolution 4K export for LinkedIn &amp; Twitter</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            {/* Thumbnail */}
            <div style={{ border: "1px solid var(--border)", background: "#0d1117", borderRadius: "8px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
              <div style={{ width: 220, height: 293, background: "radial-gradient(circle at 50% 50%, #171d2b 0%, #0a0d14 100%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 2, background: "#00f0ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 800, fontSize: 7 }}>R</div>
                      <span style={{ fontSize: 8, fontWeight: 800, color: "#fff" }}>REPODAR</span>
                    </div>
                    <span style={{ fontSize: 7, background: "rgba(0,240,255,0.1)", color: "#00f0ff", padding: "2px 4px", borderRadius: 2, fontFamily: "monospace" }}>W{weekId}</span>
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 8 }} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", marginBottom: 8, lineHeight: 1.2 }}>Weekly AI/ML Radar</div>
                  {featuredRepos.slice(0, 5).map((r) => (
                    <div key={r.repo_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 7, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ color: "#ccc" }}>#{r.rank} {r.name}</span>
                      <span style={{ color: "#d29922" }}>+{r.star_velocity_7d?.toFixed(0)}/d</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 6, color: "#555", fontFamily: "monospace", paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.05)" }}>repodar.io</div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
              Exports a pixel-perfect <strong>1200×1600 px</strong> vertical graphic card at 3× scaling — ideal for LinkedIn and Twitter/X mobile feeds.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleExportPoster} disabled={exporting} className="wd-btn wd-btn-primary" style={{ flex: 1, padding: "10px 0", fontSize: 13, justifyContent: "center", borderRadius: 6 }}>
                {exporting ? "⏳ Rendering..." : "📥 Download 4K Poster"}
              </button>
              <button onClick={() => setIsModalOpen(false)} className="wd-btn" style={{ padding: "10px 16px", fontSize: 13, borderRadius: 6 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
