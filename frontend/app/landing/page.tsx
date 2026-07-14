"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { HealthBadge } from "@/components/repo/HealthBadge";
import Logo from "@/components/Logo";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. consolidated landing page data fetching
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["landing-overview"],
    queryFn: () => api.getOverview(),
    staleTime: 5 * 60 * 1000,
  });

  // 2. consolidated weekly report fetching
  const { data: weeklyReport, isLoading: reportLoading } = useQuery({
    queryKey: ["landing-weekly-report"],
    queryFn: () => api.getWeeklyReport(),
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

  return (
    <div className="ld-page">
      <style>{`
        .ld-page {
          --bg-primary: #1e1d1c;
          --bg-surface: #262524;
          --bg-elevated: #2e2d2c;
          --border: #31302f;
          --text-primary: #e6edf3;
          --text-secondary: #bac3cc;
          --text-muted: #8b949e;
          --accent-yellow: #d29922;
          --accent-green: #3fb950;
          --accent-red: #f85149;
          --brand-grad: linear-gradient(135deg, #d29922 0%, #b07e15 100%);
          --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          
          font-family: var(--font-sans);
          background-color: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          overflow-x: hidden;
          line-height: 1.5;
        }

        /* Nav */
        .ld-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 56px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 2rem; background: rgba(30, 29, 28, 0.85);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 640px) {
          .ld-nav { padding: 0 1rem; }
        }
        .ld-logo {
          display: flex; align-items: center; gap: 8px;
          text-decoration: none; color: var(--text-primary); font-weight: 700; font-size: 15px;
        }
        .ld-nav-right { display: flex; align-items: center; gap: 12px; }
        .ld-btn-ghost {
          color: var(--text-secondary); text-decoration: none; font-size: 12px; font-weight: 500;
          padding: 6px 12px; border-radius: 6px; transition: background 0.15s, color 0.15s;
        }
        .ld-btn-ghost:hover { background: var(--bg-surface); color: var(--text-primary); }
        .ld-btn-solid {
          background: var(--brand-grad); color: var(--bg-primary); text-decoration: none;
          font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px;
          transition: transform 0.15s, opacity 0.15s;
        }
        .ld-btn-solid:hover {
          opacity: 0.95;
          transform: translateY(-0.5px);
        }

        /* Main Container */
        .ld-container {
          max-width: 1200px; margin: 0 auto; padding: 90px 2rem 60px;
        }
        @media (max-width: 640px) {
          .ld-container { padding: 80px 1rem 40px; }
        }

        /* Hero */
        .ld-hero { text-align: center; margin-bottom: 56px; position: relative; }
        .ld-badge {
          display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600;
          color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border);
          padding: 4px 10px; border-radius: 100px; margin-bottom: 18px; text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ld-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-green); }
        .ld-h1 {
          font-size: 44px; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em;
          margin-bottom: 18px; color: #ffffff;
        }
        .ld-h1 em { font-style: normal; color: var(--accent-yellow); }
        @media (max-width: 768px) {
          .ld-h1 { font-size: 32px; }
        }
        .ld-desc {
          font-size: 14px; color: var(--text-secondary); max-width: 580px; margin: 0 auto 28px;
          line-height: 1.6;
        }
        .ld-hero-ctas { display: flex; justify-content: center; gap: 12px; }
        .ld-hero-ctas .ld-btn-ghost {
          border: 1px solid var(--border);
        }
        .ld-hero-ctas .ld-btn-ghost:hover {
          background: var(--bg-surface);
        }

        /* Side-by-Side Product Sections */
        .ld-preview-section {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 28px;
          margin-bottom: 56px;
        }
        @media (max-width: 1024px) {
          .ld-preview-section {
            grid-template-columns: 1fr;
          }
        }

        /* Left Side: Dynamic Grid Panel */
        .ld-grid-panel {
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        .ld-grid-title {
          font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .ld-grid-subtitle {
          font-size: 12px; color: var(--text-muted); margin-bottom: 16px;
        }
        .ld-tabs {
          display: inline-flex; background: var(--bg-surface); padding: 3px;
          border-radius: 8px; border: 1px solid var(--border); margin-bottom: 14px;
          align-self: flex-start;
        }
        .ld-tab {
          background: transparent; border: none; color: var(--text-secondary);
          font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 6px;
          cursor: pointer; transition: all 0.15s;
        }
        .ld-tab:hover { color: #ffffff; }
        .ld-tab.active {
          background: var(--bg-elevated); color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        /* Responsive Table */
        .ld-table-container {
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px;
          overflow-x: auto; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .ld-table { width: 100%; border-collapse: collapse; text-align: left; min-width: 500px; }
        .ld-th {
          padding: 10px 14px; font-size: 10px; font-weight: 700; color: var(--text-muted);
          border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.03em;
        }
        .ld-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .ld-tr:hover { background: rgba(255, 255, 255, 0.015); }
        .ld-tr:last-child { border-bottom: none; }
        .ld-td { padding: 10px 14px; font-size: 12px; color: var(--text-secondary); vertical-align: middle; }
        .ld-repo-link { font-weight: 600; color: #ffffff; text-decoration: none; transition: color 0.15s; }
        .ld-repo-link:hover { color: var(--accent-yellow); }
        .ld-action-btn {
          background: transparent; border: 1px solid var(--border); color: var(--text-secondary);
          font-size: 10px; padding: 3px 8px; border-radius: 4px; cursor: pointer; transition: all 0.15s;
        }
        .ld-action-btn:hover { background: var(--bg-elevated); color: var(--text-primary); border-color: var(--text-muted); }

        /* Right Side: Read-Only Overview Mockup */
        .ld-preview-browser {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        .ld-browser-header {
          background: var(--bg-elevated);
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .ld-browser-dots {
          display: flex;
          gap: 6px;
        }
        .ld-browser-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .ld-browser-address {
          flex: 1;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          font-family: monospace;
          font-size: 10px;
          color: var(--text-muted);
          padding: 2px 10px;
          user-select: none;
          max-width: 240px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ld-browser-body {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Mockup Interior Layout */
        .ld-mock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
        }
        .ld-mock-title {
          font-size: 13px; font-weight: 700; color: #ffffff;
        }
        .ld-mock-badge {
          background: rgba(63, 185, 80, 0.1);
          border: 1px solid rgba(63, 185, 80, 0.2);
          color: var(--accent-green);
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        
        /* Stats bento */
        .ld-mock-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .ld-mock-stat-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 10px;
        }
        .ld-mock-stat-label {
          font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em;
        }
        .ld-mock-stat-val {
          font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 2px;
        }
        .ld-mock-stat-trend {
          font-size: 9px; color: var(--accent-green); font-weight: 600; margin-top: 1px;
        }

        /* Live Analyst insight card */
        .ld-mock-intel {
          background: rgba(210, 153, 34, 0.03);
          border: 1px solid rgba(210, 153, 34, 0.15);
          border-radius: 6px;
          padding: 12px;
        }
        .ld-mock-intel-title {
          font-size: 9px; font-weight: 700; color: var(--accent-yellow);
          text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
          display: flex; align-items: center; gap: 4px;
        }
        .ld-mock-intel-text {
          font-size: 11px; color: var(--text-secondary); line-height: 1.5;
        }

        /* Mockup Category growth list */
        .ld-mock-categories {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ld-mock-cat-row {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ld-mock-cat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ld-mock-cat-name {
          font-size: 11px; font-weight: 700; color: #ffffff;
        }
        .ld-mock-cat-growth {
          font-size: 10px; font-weight: 600; color: var(--accent-green);
        }
        .ld-mock-progress-bg {
          height: 3px;
          background: var(--bg-primary);
          border-radius: 2px;
          overflow: hidden;
          width: 100%;
        }
        .ld-mock-progress-bar {
          height: 100%;
          background: var(--accent-yellow);
          border-radius: 2px;
        }

        /* Skeletons */
        .ld-skeleton-row { height: 38px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 14px; }
        .ld-skeleton-cell { background: var(--bg-elevated); border-radius: 3px; height: 12px; animation: pulse 1.5s infinite; }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }

        /* How it works */
        .ld-how-section { padding: 40px 0; border-top: 1px solid var(--border); margin-bottom: 40px; }
        .ld-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 24px; }
        @media (max-width: 768px) {
          .ld-how-grid { grid-template-columns: 1fr; }
        }
        .ld-how-card {
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;
          padding: 20px; text-align: left; position: relative;
        }
        .ld-how-num {
          font-size: 32px; font-weight: 900; color: var(--accent-yellow); opacity: 0.1;
          position: absolute; top: 12px; right: 16px; line-height: 1;
        }
        .ld-how-card h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #ffffff; }
        .ld-how-card p { font-size: 11px; color: var(--text-secondary); line-height: 1.6; }

        /* Pricing */
        .ld-pricing {
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px;
          padding: 36px; text-align: center; margin-bottom: 56px;
        }
        .ld-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 800px; margin: 28px auto 0; text-align: left; }
        @media (max-width: 640px) {
          .ld-pricing-grid { grid-template-columns: 1fr; }
        }
        .ld-pricing-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 24px; }
        .ld-pricing-card.featured { border-color: var(--accent-yellow); }
        .ld-pricing-name { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
        .ld-pricing-price { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
        .ld-pricing-features { list-style: none; padding: 0; margin: 16px 0 20px; font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px; }
        .ld-pricing-features li { display: flex; align-items: center; gap: 6px; }
        .ld-pricing-features li::before { content: "✓"; color: var(--accent-green); font-weight: bold; }
        .ld-pricing-features li.dim { color: var(--text-muted); }
        .ld-pricing-features li.dim::before { content: "×"; color: var(--text-muted); }

        /* Footer */
        .ld-footer {
          border-top: 1px solid var(--border); padding: 28px 0; display: flex; align-items: center;
          justify-content: space-between; font-size: 11px; color: var(--text-muted);
        }
        @media (max-width: 640px) {
          .ld-footer { flex-direction: column; gap: 16px; text-align: center; }
        }
        .ld-footer-links { display: flex; gap: 16px; }
        .ld-footer-links a { color: var(--text-muted); text-decoration: none; transition: color 0.15s; }
        .ld-footer-links a:hover { color: var(--text-primary); }

        /* Auth Modal */
        .ld-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
          display: grid; place-items: center; z-index: 200; padding: 1rem;
        }
        .ld-modal {
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px;
          padding: 24px; max-width: 380px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          text-align: center; animation: modal-scale 0.2s ease-out;
        }
        .ld-modal h3 { font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 6px; }
        .ld-modal p { font-size: 12px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5; }
        .ld-modal-btns { display: flex; flex-direction: column; gap: 8px; }
        .ld-modal-close {
          background: transparent; border: none; color: var(--text-muted); font-size: 10px;
          cursor: pointer; margin-top: 14px; text-decoration: underline;
        }
        .ld-modal-close:hover { color: var(--text-primary); }

        @keyframes modal-scale {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="ld-nav">
        <Link href="/" className="ld-logo" style={{ gap: "6px" }}>
          <Logo size={24} />
          Repodar
        </Link>
        <div className="ld-nav-right">
          <Link href="/sign-in" className="ld-btn-ghost">Sign In</Link>
          <Link href="/sign-up" className="ld-btn-solid">Get Started</Link>
        </div>
      </nav>

      {/* ── MAIN CONTAINER ── */}
      <div className="ld-container">
        {/* ── SECTION 1: HERO ── */}
        <header className="ld-hero">
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

        {/* ── SECTION 2: SIDE-BY-SIDE INTERACTIVE LAYOUT ── */}
        <div className="ld-preview-section" id="grid">
          
          {/* LEFT: Dynamic Intelligence Grid (Table) */}
          <div className="ld-grid-panel">
            <h2 className="ld-grid-title">Ecosystem Intelligence Grid</h2>
            <span className="ld-grid-subtitle">Real-time repository scoring and developer growth logs.</span>
            
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

            <div className="ld-table-container">
              {isGridLoading ? (
                <div>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="ld-skeleton-row">
                      <div className="ld-skeleton-cell" style={{ width: "8%", marginRight: "12px" }} />
                      <div className="ld-skeleton-cell" style={{ width: "40%", marginRight: "12px" }} />
                      <div className="ld-skeleton-cell" style={{ width: "20%", marginRight: "12px" }} />
                      <div className="ld-skeleton-cell" style={{ width: "20%" }} />
                    </div>
                  ))}
                </div>
              ) : (
                <table className="ld-table">
                  <thead>
                    <tr>
                      <th className="ld-th" style={{ width: "8%" }}>#</th>
                      <th className="ld-th" style={{ width: "45%" }}>Repository</th>
                      <th className="ld-th" style={{ width: "25%" }}>Sustainability</th>
                      <th className="ld-th" style={{ width: "22%" }}>{rows[0]?.metricLabel || "Metric"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((row, idx) => (
                      <tr key={row.repo_id || idx} className="ld-tr">
                        <td className="ld-td" style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                          {idx + 1}
                        </td>
                        <td className="ld-td">
                          <Link href={`/repo/${row.owner}/${row.name}`} className="ld-repo-link">
                            {row.owner}/{row.name}
                          </Link>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {row.category} • {row.language || "TypeScript"}
                          </div>
                        </td>
                        <td className="ld-td">
                          <HealthBadge label={row.sustainabilityLabel} />
                        </td>
                        <td className="ld-td" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {row.metricValue}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td className="ld-td" colSpan={4} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                          No active repositories found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>💡 Tip: Click repository names to inspect detailed timeseries charts and growth forecasts.</span>
            </div>
          </div>

          {/* RIGHT: Read-Only Overview Dashboard Mockup (Mini Product Demo) */}
          <div className="ld-preview-browser">
            <div className="ld-browser-header">
              <div className="ld-browser-dots">
                <span className="ld-browser-dot" style={{ background: "#ff5f56" }} />
                <span className="ld-browser-dot" style={{ background: "#ffbd2e" }} />
                <span className="ld-browser-dot" style={{ background: "#27c93f" }} />
              </div>
              <div className="ld-browser-address">repodar.com/overview</div>
            </div>
            
            <div className="ld-browser-body">
              <div className="ld-mock-header">
                <span className="ld-mock-title">Ecosystem Overview</span>
                <span className="ld-mock-badge">Read Only Preview</span>
              </div>

              {/* Bento Stats */}
              <div className="ld-mock-stats">
                <div className="ld-mock-stat-card">
                  <div className="ld-mock-stat-label">Monitored</div>
                  <div className="ld-mock-stat-val">
                    {overview?.total_repos ? overview.total_repos.toLocaleString() : "12,840"}
                  </div>
                  <div className="ld-mock-stat-trend">+2.1% MOM</div>
                </div>
                <div className="ld-mock-stat-card">
                  <div className="ld-mock-stat-label">Healthy</div>
                  <div className="ld-mock-stat-val">
                    {overview?.healthy_repos ? overview.healthy_repos.toLocaleString() : "4,200"}
                  </div>
                  <div className="ld-mock-stat-trend" style={{ color: "var(--accent-yellow)" }}>GREEN RATED</div>
                </div>
                <div className="ld-mock-stat-card">
                  <div className="ld-mock-stat-label">Ratio</div>
                  <div className="ld-mock-stat-val">
                    {overview?.healthy_repos && overview?.total_repos ? ((overview.healthy_repos / overview.total_repos) * 100).toFixed(1) + "%" : "32.8%"}
                  </div>
                  <div className="ld-mock-stat-trend">STABLE</div>
                </div>
              </div>

              {/* AI Strategic Insight brief */}
              <div className="ld-mock-intel">
                <div className="ld-mock-intel-title">
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-green)", display: "inline-block" }} />
                  Latest Weekly AI Insight Brief
                </div>
                <div className="ld-mock-intel-text">
                  {reportLoading ? (
                    "Decoding metadata indicators..."
                  ) : weeklyReport?.strategic_insight ? (
                    weeklyReport.strategic_insight.slice(0, 160) + "..."
                  ) : (
                    "Ecosystem growth remains strong. Multi-modal models and lightweight inference engines are experiencing positive acceleration, with star velocities showing upward inflections."
                  )}
                </div>
              </div>

              {/* Live Category metrics list */}
              <div className="ld-mock-categories">
                <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  Category Accelerations
                </div>
                {overviewLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} style={{ height: "30px", background: "var(--bg-elevated)", borderRadius: "4px" }} />
                    ))}
                  </div>
                ) : overview?.category_growth ? (
                  overview.category_growth.slice(0, 3).map((cat, idx) => (
                    <div key={idx} className="ld-mock-cat-row">
                      <div className="ld-mock-cat-header">
                        <span className="ld-mock-cat-name">{cat.category}</span>
                        <span className="ld-mock-cat-growth" style={{ color: cat.mom_growth_pct >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                          {cat.mom_growth_pct >= 0 ? "+" : ""}{cat.mom_growth_pct.toFixed(1)}% MOM
                        </span>
                      </div>
                      <div className="ld-mock-progress-bg">
                        <div className="ld-mock-progress-bar" style={{ width: `${Math.min(100, Math.max(15, cat.trend_composite * 8))}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="ld-mock-cat-row">
                    <div className="ld-mock-cat-header">
                      <span className="ld-mock-cat-name">Agent Frameworks</span>
                      <span className="ld-mock-cat-growth">+42.5% MOM</span>
                    </div>
                    <div className="ld-mock-progress-bg">
                      <div className="ld-mock-progress-bar" style={{ width: "82%" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: HOW IT WORKS ── */}
        <section className="ld-how-section">
          <h2 className="ld-section-title" style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", textAlign: "center", marginBottom: "6px" }}>
            Continuous Ingestion. Clear Signals.
          </h2>
          <p className="ld-desc" style={{ textAlign: "center", marginBottom: "32px" }}>
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

        {/* ── SECTION 4: SIMPLIFIED PRICING ── */}
        <section className="ld-pricing">
          <h2 className="ld-section-title" style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>
            Ecosystem tracking is free.
          </h2>
          <p className="ld-desc">Upgrade when you need alerts and personalized workflows.</p>

          <div className="ld-pricing-grid">
            <div className="ld-pricing-card">
              <div className="ld-pricing-name">Explorer</div>
              <div className="ld-pricing-price">$0</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-8px", marginBottom: "12px" }}>Free forever · No credit card required</div>
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
              <div className="ld-pricing-name" style={{ color: "var(--accent-yellow)" }}>Pro Dashboard</div>
              <div className="ld-pricing-price">
                <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: "8px", fontSize: "18px", fontWeight: "normal" }}>$12</span>
                $0
                <span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--text-secondary)" }}> / mo</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--accent-yellow)", marginTop: "-8px", marginBottom: "12px", fontWeight: 600 }}>Beta Promotion · Free during beta</div>
              <ul className="ld-pricing-features">
                <li>Everything in Explorer</li>
                <li>Custom star/fork acceleration alerts</li>
                <li>Save search presets and filters</li>
                <li>Personalized watchlist & dashboard</li>
                <li>Full 90-day historical timeseries data</li>
              </ul>
              <Link href="/sign-up" className="ld-btn-solid" style={{ display: "block", textAlign: "center", marginTop: "16px" }}>
                Get Free Pro Access
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
