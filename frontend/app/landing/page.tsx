"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { HealthBadge } from "@/components/repo/HealthBadge";

// Define structured interface for the consolidated table grid
interface UnifiedGridRow {
  repo_id: string;
  owner: string;
  name: string;
  category: string;
  language: string | null;
  metricLabel: string;
  metricValue: string;
  sustainabilityLabel: string;
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [gridTab, setGridTab] = useState<"breakouts" | "gems" | "new">("breakouts");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [modalReason, setModalReason] = useState("");

  // Prevent client/server hydration mismatch on dynamically formatted elements
  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Live stats HUD query (Cached for 5 minutes)
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["landing-overview"],
    queryFn: api.getOverview,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Weekly Analyst Report query (Cached for 30 minutes)
  const { data: weeklyReport, isLoading: reportLoading } = useQuery({
    queryKey: ["landing-weekly-report"],
    queryFn: api.getWeeklyReport,
    staleTime: 30 * 60 * 1000,
  });

  // 3. Leaderboard query (Lazy-loaded: only dispatches if tab is active)
  const { data: breakouts, isLoading: breakoutsLoading } = useQuery({
    queryKey: ["grid-breakouts"],
    queryFn: () => api.getLeaderboard("7d", undefined, 10, "ai_ml"),
    enabled: gridTab === "breakouts",
    staleTime: 5 * 60 * 1000,
  });

  // 4. Hidden Gems query (Lazy-loaded: only dispatches if tab is active)
  const { data: gems, isLoading: gemsLoading } = useQuery({
    queryKey: ["grid-gems"],
    queryFn: () => api.getEarlyRadar({ max_stars: 3000, sort_by: "breakout_score", limit: 10 }),
    enabled: gridTab === "gems",
    staleTime: 5 * 60 * 1000,
  });

  // 5. Recently Indexed query (Lazy-loaded: only dispatches if tab is active)
  const { data: newRepos, isLoading: newReposLoading } = useQuery({
    queryKey: ["grid-new"],
    queryFn: () => api.getEarlyRadar({ sort_by: "novelty_score", limit: 10 }),
    enabled: gridTab === "new",
    staleTime: 5 * 60 * 1000,
  });

  // Helper to trigger centralized auth request modal
  const triggerAuthModal = (reason: string) => {
    setModalReason(reason);
    setShowAuthModal(true);
  };

  // Convert tab outputs into unified grid rows
  const getGridRows = (): UnifiedGridRow[] => {
    if (gridTab === "breakouts" && breakouts?.entries) {
      return breakouts.entries.map((entry) => ({
        repo_id: entry.repo_id,
        owner: entry.owner,
        name: entry.name,
        category: entry.category,
        language: entry.primary_language,
        metricLabel: "7D Delta",
        metricValue: `+${entry.star_gain.toLocaleString()}★`,
        sustainabilityLabel: entry.sustainability_label,
      }));
    }
    if (gridTab === "gems" && gems) {
      return gems.map((item) => ({
        repo_id: item.repo_id,
        owner: item.owner,
        name: item.name,
        category: item.category,
        language: item.primary_language,
        metricLabel: "Breakout Score",
        metricValue: (item.breakout_score ?? 0).toFixed(1),
        sustainabilityLabel: item.sustainability_label,
      }));
    }
    if (gridTab === "new" && newRepos) {
      return newRepos.map((item) => ({
        repo_id: item.repo_id,
        owner: item.owner,
        name: item.name,
        category: item.category,
        language: item.primary_language,
        metricLabel: "Novelty Score",
        metricValue: (item.novelty_score ?? 0).toFixed(2),
        sustainabilityLabel: item.sustainability_label,
      }));
    }
    return [];
  };

  const rows = getGridRows();
  const isGridLoading = breakoutsLoading || gemsLoading || newReposLoading;

  // Derive "Repository of the Day" dynamically from the #1 breakout repo
  const repoOfTheDay = overview?.top_breakout?.[0] || null;

  return (
    <div className="ld-page">
      <style>{`
        .ld-page {
          --bg-primary: #1e1d1c;
          --bg-surface: #262524;
          --bg-elevated: #2e2d2c;
          --bg-dim: #383736;
          --border: #31302f;
          --text-primary: #e6edf3;
          --text-secondary: #bac3cc;
          --text-muted: #8b949e;
          --font-sans: 'Inter', sans-serif;
          
          font-family: var(--font-sans);
          background: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          overflow-x: hidden;
          line-height: 1.5;
        }

        /* Nav */
        .ld-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 58px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 2rem; background: rgba(30, 29, 28, 0.85);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        .ld-logo {
          display: flex; align-items: center; gap: 8px;
          text-decoration: none; color: var(--text-primary); font-weight: 700; font-size: 15px;
        }
        .ld-logo-mark {
          width: 22px; height: 22px; border-radius: 4px;
          background: linear-gradient(135deg, #d29922, #b07e15);
          border: 1.5px solid rgba(255, 255, 255, 0.2);
        }
        .ld-nav-right { display: flex; align-items: center; gap: 12px; }
        .ld-btn-ghost {
          color: var(--text-secondary); text-decoration: none; font-size: 12px; font-weight: 500;
          padding: 6px 12px; border-radius: 6px; transition: background 0.15s;
        }
        .ld-btn-ghost:hover { background: var(--bg-surface); color: var(--text-primary); }
        .ld-btn-solid {
          background: var(--text-primary); color: var(--bg-primary); text-decoration: none;
          font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px;
          border: 1px solid transparent; transition: opacity 0.15s;
        }
        .ld-btn-solid:hover { opacity: 0.9; }

        /* Main Container */
        .ld-container {
          max-width: 1080px; margin: 0 auto; padding: 100px 2rem 60px;
        }

        /* Hero */
        .ld-hero { text-align: center; margin-bottom: 48px; position: relative; }
        .ld-hero-glow {
          position: absolute; top: -150px; left: 50%; transform: translateX(-50%);
          width: 600px; height: 350px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(210, 153, 34, 0.08) 0%, transparent 70%);
        }
        .ld-badge {
          display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600;
          color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border);
          padding: 4px 10px; border-radius: 100px; margin-bottom: 16px; text-transform: uppercase;
          letter-spacing: 0.05em; position: relative; z-index: 1;
        }
        .ld-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #3fb950; }
        .ld-h1 {
          font-size: 40px; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em;
          margin-bottom: 16px; position: relative; z-index: 1;
        }
        .ld-h1 em { font-style: italic; font-weight: 400; color: #d29922; }
        .ld-desc {
          font-size: 14px; color: var(--text-secondary); max-width: 580px; margin: 0 auto 24px;
          line-height: 1.6; position: relative; z-index: 1;
        }
        .ld-hero-ctas { display: flex; justify-content: center; gap: 12px; position: relative; z-index: 1; }

        /* HUD Block */
        .ld-hud {
          display: grid; grid-template-columns: 1fr 1.8fr; gap: 24px;
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 24px; margin-bottom: 48px; text-align: left;
        }
        @media (max-width: 768px) {
          .ld-hud { grid-template-columns: 1fr; }
        }
        .ld-hud-left {
          display: flex; flex-direction: column; justify-content: space-between;
          border-right: 1px solid var(--border); padding-right: 24px;
        }
        @media (max-width: 768px) {
          .ld-hud-left { border-right: none; border-bottom: 1px solid var(--border); padding-right: 0; padding-bottom: 20px; }
        }
        .ld-hud-title { font-size: 11px; font-weight: 700; color: #d29922; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; }
        .ld-hud-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ld-hud-stat { font-size: 24px; font-weight: 800; color: var(--text-primary); line-height: 1.1; }
        .ld-hud-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-top: 4px; }
        .ld-hud-right { display: flex; flex-direction: column; justify-content: space-between; }
        .ld-hud-insight { font-size: 13px; color: var(--text-secondary); line-height: 1.65; margin-bottom: 14px; }
        .ld-hud-rotd {
          background: var(--bg-elevated); border: 1px solid var(--border);
          padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;
        }
        .ld-hud-rotd-label { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .ld-hud-rotd-val { font-size: 12px; font-weight: 600; color: var(--text-primary); text-decoration: none; }
        .ld-hud-rotd-val:hover { color: #d29922; }

        /* Unified Grid Section */
        .ld-section-title { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 24px; }
        .ld-tabs { display: inline-flex; background: var(--bg-surface); padding: 4px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 16px; }
        .ld-tab {
          background: transparent; border: none; color: var(--text-secondary);
          font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 6px;
          cursor: pointer; transition: all 0.15s;
        }
        .ld-tab.active { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.05); }
        .ld-tab-desc { font-size: 11px; color: var(--text-muted); margin-bottom: 16px; max-width: 600px; margin-left: auto; margin-right: auto; text-align: center; }

        /* Responsive Table styling */
        .ld-table-container {
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px;
          overflow-x: auto; width: 100%; margin-bottom: 48px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .ld-table { width: 100%; border-collapse: collapse; text-align: left; min-width: 600px; }
        .ld-th { padding: 12px 16px; font-size: 10px; font-weight: 700; color: var(--text-muted); border-bottom: 1px solid var(--border); text-transform: uppercase; }
        .ld-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .ld-tr:hover { background: rgba(255,255,255,0.015); }
        .ld-tr:last-child { border-bottom: none; }
        .ld-td { padding: 12px 16px; font-size: 12px; color: var(--text-secondary); vertical-align: middle; }
        .ld-repo-link { font-weight: 600; color: var(--text-primary); text-decoration: none; }
        .ld-repo-link:hover { color: #d29922; }
        .ld-badge-group { display: flex; align-items: center; gap: 8px; }
        .ld-action-btn {
          background: transparent; border: 1px solid var(--border); color: var(--text-secondary);
          font-size: 10px; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: all 0.15s;
        }
        .ld-action-btn:hover { background: var(--bg-elevated); color: var(--text-primary); border-color: var(--text-muted); }

        /* Loader & Error states */
        .ld-skeleton-row { height: 46px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 16px; }
        .ld-skeleton-cell { background: var(--bg-elevated); border-radius: 4px; height: 16px; animation: pulse 1.5s infinite; }

        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }

        /* How it works */
        .ld-how-section { padding: 48px 0; border-top: 1px solid var(--border); margin-bottom: 48px; }
        .ld-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 32px; }
        @media (max-width: 768px) {
          .ld-how-grid { grid-template-columns: 1fr; }
        }
        .ld-how-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 24px; text-align: left; }
        .ld-how-num { font-size: 32px; font-weight: 800; color: rgba(210, 153, 34, 0.15); margin-bottom: 12px; line-height: 1; }
        .ld-how-card h3 { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary); }
        .ld-how-card p { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }

        /* Pricing & Callout */
        .ld-pricing {
          background: linear-gradient(180deg, var(--bg-surface) 0%, rgba(38,37,36,0.3) 100%);
          border: 1px solid var(--border); border-radius: 12px; padding: 40px; text-align: center;
          margin-bottom: 60px; position: relative;
        }
        .ld-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; max-width: 800px; margin: 32px auto 0; text-align: left; }
        @media (max-width: 640px) {
          .ld-pricing-grid { grid-template-columns: 1fr; }
        }
        .ld-pricing-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 24px; }
        .ld-pricing-card.featured { border-color: #d29922; }
        .ld-pricing-name { font-size: 14px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px; }
        .ld-pricing-price { font-size: 28px; font-weight: 800; color: var(--text-primary); margin-bottom: 12px; }
        .ld-pricing-features { list-style: none; padding: 0; margin: 16px 0 24px; font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px; }
        .ld-pricing-features li { display: flex; align-items: center; gap: 6px; }
        .ld-pricing-features li::before { content: "✓"; color: #3fb950; font-weight: bold; }
        .ld-pricing-features li.dim { color: var(--text-muted); }
        .ld-pricing-features li.dim::before { content: "×"; color: var(--accent-red); }

        /* Footer */
        .ld-footer {
          border-top: 1px solid var(--border); padding: 32px 0; display: flex; align-items: center;
          justify-content: space-between; font-size: 11px; color: var(--text-muted);
        }
        @media (max-width: 640px) {
          .ld-footer { flex-direction: column; gap: 16px; text-align: center; }
        }
        .ld-footer-links { display: flex; gap: 16px; }
        .ld-footer-links a { color: var(--text-muted); text-decoration: none; }
        .ld-footer-links a:hover { color: var(--text-primary); }

        /* Auth Modal */
        .ld-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
          display: grid; place-items: center; z-index: 200; padding: 1rem;
        }
        .ld-modal {
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px;
          padding: 28px; max-width: 400px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          text-align: center; animation: modal-scale 0.2s ease-out;
        }
        .ld-modal h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
        .ld-modal p { font-size: 12px; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5; }
        .ld-modal-btns { display: flex; flex-direction: column; gap: 10px; }
        .ld-modal-close {
          background: transparent; border: none; color: var(--text-muted); font-size: 10px;
          cursor: pointer; margin-top: 16px; text-decoration: underline;
        }
        .ld-modal-close:hover { color: var(--text-primary); }

        @keyframes modal-scale {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="ld-nav">
        <Link href="/" className="ld-logo">
          <div className="ld-logo-mark" />
          Repodar
        </Link>
        <div className="ld-nav-right">
          <Link href="/sign-in" className="ld-btn-ghost">Sign In</Link>
          <Link href="/sign-up" className="ld-btn-solid">Get Started</Link>
        </div>
      </nav>

      {/* ── MAIN CONTAINER ── */}
      <div className="ld-container">
        {/* ── SECTION 1: HERO & INTEGRATED HUD ── */}
        <header className="ld-hero">
          <div className="ld-hero-glow" />
          <div className="ld-badge">
            <span className="ld-badge-dot" />
            Ecosystem Live Monitor
          </div>
          <h1 className="ld-h1">
            Analyze the <em>GitHub AI</em><br />ecosystem in real time.
          </h1>
          <p className="ld-desc">
            Repodar measures software momentum, developer adoption velocity, and dependency sustainability metrics—delivering clear signals directly to your browser.
          </p>
          <div className="ld-hero-ctas">
            <a href="#grid" className="ld-btn-solid">Explore Live Data</a>
            <Link href="/sign-up" className="ld-btn-ghost">Create Free Account →</Link>
          </div>
        </header>

        {/* ── INTEGRATED HUD PANEL ── */}
        <section className="ld-hud">
          <div className="ld-hud-left">
            <div>
              <div className="ld-hud-title">Ecosystem HUD</div>
              <div className="ld-hud-grid">
                <div>
                  <div className="ld-hud-stat">
                    {overview?.total_repos ? overview.total_repos.toLocaleString() : "12,800+"}
                  </div>
                  <div className="ld-hud-label">Repos Tracked</div>
                </div>
                <div>
                  <div className="ld-hud-stat" style={{ color: "var(--accent-green)" }}>
                    {overview?.healthy_repos ? overview.healthy_repos.toLocaleString() : "4,200+"}
                  </div>
                  <div className="ld-hud-label">Healthy Repos</div>
                </div>
              </div>
            </div>
          </div>
          <div className="ld-hud-right">
            <div>
              <div className="ld-hud-title">AI Analyst Insight</div>
              <div className="ld-hud-insight">
                {reportLoading ? (
                  <span style={{ color: "var(--text-muted)" }}>Analyzing ecosystem signals...</span>
                ) : weeklyReport?.strategic_insight ? (
                  weeklyReport.strategic_insight
                ) : (
                  "Ecosystem growth remains strong. Multi-modal models and lightweight inference engines are experiencing positive acceleration, with star velocities showing upward inflections across major tooling layers."
                )}
              </div>
            </div>
            {repoOfTheDay && (
              <div className="ld-hud-rotd">
                <span className="ld-hud-rotd-label">Breakout Spotlight</span>
                <Link href={`/repo/${repoOfTheDay.owner}/${repoOfTheDay.name}`} className="ld-hud-rotd-val">
                  {repoOfTheDay.owner}/{repoOfTheDay.name} ({repoOfTheDay.primary_language || "Python"}) ★
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION 2: UNIFIED INTELLIGENCE GRID ── */}
        <section id="grid" style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2 className="ld-section-title">Ecosystem Intelligence Grid</h2>
          <div className="ld-tabs">
            <button
              onClick={() => setGridTab("breakouts")}
              className={`ld-tab ${gridTab === "breakouts" ? "active" : ""}`}
            >
              🚀 Top Breakouts
            </button>
            <button
              onClick={() => setGridTab("gems")}
              className={`ld-tab ${gridTab === "gems" ? "active" : ""}`}
            >
              💎 Hidden Gems
            </button>
            <button
              onClick={() => setGridTab("new")}
              className={`ld-tab ${gridTab === "new" ? "active" : ""}`}
            >
              ✨ Recently Indexed
            </button>
          </div>
          <p className="ld-tab-desc">
            {gridTab === "breakouts" && "Surfacing the highest accelerating repositories across the AI landscape by star velocity delta over the last 7 days."}
            {gridTab === "gems" && "Promising, early-stage libraries with low total stars (<3,000) experiencing explosive breakout scores and fork proxy activity."}
            {gridTab === "new" && "Newly indexed repositories with the highest novelty scores, tracking early signals before mainstream awareness."}
          </p>

          <div className="ld-table-container">
            {isGridLoading ? (
              <div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="ld-skeleton-row">
                    <div className="ld-skeleton-cell" style={{ width: "8%", marginRight: "16px" }} />
                    <div className="ld-skeleton-cell" style={{ width: "35%", marginRight: "16px" }} />
                    <div className="ld-skeleton-cell" style={{ width: "15%", marginRight: "16px" }} />
                    <div className="ld-skeleton-cell" style={{ width: "12%", marginRight: "16px" }} />
                    <div className="ld-skeleton-cell" style={{ width: "15%", marginRight: "16px" }} />
                    <div className="ld-skeleton-cell" style={{ width: "10%" }} />
                  </div>
                ))}
              </div>
            ) : (
              <table className="ld-table">
                <thead>
                  <tr>
                    <th className="ld-th" style={{ width: "6%" }}>#</th>
                    <th className="ld-th" style={{ width: "34%" }}>Repository</th>
                    <th className="ld-th" style={{ width: "18%" }}>Category</th>
                    <th className="ld-th" style={{ width: "14%" }}>Language</th>
                    <th className="ld-th" style={{ width: "14%" }}>Sustainability</th>
                    <th className="ld-th" style={{ width: "14%" }}>{rows[0]?.metricLabel || "Metric"}</th>
                    <th className="ld-th" style={{ width: "10%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, idx) => (
                    <tr key={row.repo_id} className="ld-tr">
                      <td className="ld-td" style={{ fontWeight: 700, color: "var(--text-muted)" }}>
                        {idx + 1}
                      </td>
                      <td className="ld-td">
                        <Link href={`/repo/${row.owner}/${row.name}`} className="ld-repo-link">
                          {row.owner}/{row.name}
                        </Link>
                      </td>
                      <td className="ld-td">
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {row.category}
                        </span>
                      </td>
                      <td className="ld-td">
                        <code style={{ fontSize: "11px", fontFamily: "monospace" }}>
                          {row.language || "N/A"}
                        </code>
                      </td>
                      <td className="ld-td">
                        <HealthBadge label={row.sustainabilityLabel} />
                      </td>
                      <td className="ld-td" style={{ fontFamily: "monospace", fontWeight: 700 }}>
                        {row.metricValue}
                      </td>
                      <td className="ld-td">
                        <button
                          onClick={() => triggerAuthModal(`pin ${row.owner}/${row.name} to your custom watchlist`)}
                          className="ld-action-btn"
                        >
                          Pin
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="ld-td" colSpan={7} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                        No repositories found in this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── SECTION 3: HOW IT WORKS / CAPABILITIES ── */}
        <section className="ld-how-section">
          <h2 className="ld-section-title">Continuous Ingestion. Clear Signals.</h2>
          <p className="ld-desc" style={{ textAlign: "center" }}>
            Repodar processes the global software landscape to protect your infrastructure dependencies.
          </p>

          <div className="ld-how-grid">
            <div className="ld-how-card">
              <div className="ld-how-num">01</div>
              <h3>Continuous Stream Ingestion</h3>
              <p>We index developer events, releases, issues, and forks every single minute directly from the global stream.</p>
            </div>
            <div className="ld-how-card">
              <div className="ld-how-num">02</div>
              <h3>Acceleration Calculations</h3>
              <p>We analyze the second derivative of growth, surfacing viral inflections before they appear on basic trending pages.</p>
            </div>
            <div className="ld-how-card">
              <div className="ld-how-num">03</div>
              <h3>Sustainability Diagnostics</h3>
              <p>We evaluate contributor retention, push frequencies, and issue closures to label structural dependency risks.</p>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: SIMPLIFIED PRICING & CALLOUT ── */}
        <section className="ld-pricing">
          <h2 className="ld-section-title" style={{ marginBottom: "8px" }}>Ecosystem tracking is free.</h2>
          <p className="ld-desc">Upgrade when you need alerts and personalized workflows.</p>

          <div className="ld-pricing-grid">
            <div className="ld-pricing-card">
              <div className="ld-pricing-name">Explorer</div>
              <div className="ld-pricing-price">$0</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-8px" }}>Free forever · No credit card required</div>
              <ul className="ld-pricing-features">
                <li>Access to Ecosystem HUD</li>
                <li>Access to weekly AI analysis reports</li>
                <li>Live Breakout Leaderboard directories</li>
                <li className="dim">Custom Slack/Webhook alerts</li>
                <li className="dim">Personal saved watchlists</li>
              </ul>
              <Link href="/sign-up" className="ld-btn-ghost" style={{ display: "block", textAlign: "center", border: "1px solid var(--border)", marginTop: "16px" }}>
                Start Exploring Free
              </Link>
            </div>

            <div className="ld-pricing-card featured">
              <div className="ld-pricing-name" style={{ color: "#d29922" }}>Pro Dashboard</div>
              <div className="ld-pricing-price">$12<span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--text-secondary)" }}> / mo</span></div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-8px" }}>Billed monthly · Cancel anytime</div>
              <ul className="ld-pricing-features">
                <li>Everything in Explorer</li>
                <li>Custom star/fork acceleration alerts</li>
                <li>Save search presets and filters</li>
                <li>Personalized watchlist & dashboard</li>
                <li>Full 90-day historical timeseries data</li>
              </ul>
              <Link href="/sign-up" className="ld-btn-solid" style={{ display: "block", textAlign: "center", background: "#d29922", color: "#1e1d1c", marginTop: "16px" }}>
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="ld-footer">
          <div>© {mounted ? new Date().getFullYear() : "2026"} Repodar. Real-Time GitHub Ecosystem Intelligence.</div>
          <div className="ld-footer-links">
            <Link href="/sign-in">App Dashboard</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="#" onClick={(e) => { e.preventDefault(); triggerAuthModal("access the research workspace"); }}>API Access</a>
            <a href="#" onClick={(e) => { e.preventDefault(); triggerAuthModal("configure custom integrations"); }}>Webhooks</a>
          </div>
        </footer>
      </div>

      {/* ── AUTH TRIGGER MODAL ── */}
      {showAuthModal && (
        <div className="ld-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="ld-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Unlock Continuous Monitoring</h3>
            <p>
              Create a free Repodar account to {modalReason || "access advanced ecosystem features"}, set up custom velocity triggers, and export historical trends.
            </p>
            <div className="ld-modal-btns">
              <Link href="/sign-up" className="ld-btn-solid" style={{ display: "block", padding: "10px 0" }}>
                Create Free Account
              </Link>
              <Link href="/sign-in" className="ld-btn-ghost" style={{ display: "block", border: "1px solid var(--border)", padding: "10px 0" }}>
                Sign In
              </Link>
            </div>
            <button className="ld-modal-close" onClick={() => setShowAuthModal(false)}>
              Continue browsing data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
