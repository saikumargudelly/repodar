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

  // Derive "Repository of the Day" dynamically from the #1 breakout repo
  const repoOfTheDay = overview?.top_breakout?.[0] || null;

  return (
    <div className="ld-page">
      <style>{`
        .ld-page {
          --bg-primary: #0a0a09;
          --bg-surface: #141312;
          --bg-elevated: #1e1d1c;
          --bg-card: rgba(20, 19, 18, 0.6);
          --border: rgba(255, 255, 255, 0.06);
          --border-glow: rgba(0, 82, 255, 0.15);
          --text-primary: #f2f2f0;
          --text-secondary: #a3a39e;
          --text-muted: #6e6e69;
          --accent-blue: #0052FF;
          --accent-green: #00D48A;
          --brand-grad: linear-gradient(135deg, #0052FF 0%, #00D48A 100%);
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
          height: 64px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 3rem; background: rgba(10, 10, 9, 0.8);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 640px) {
          .ld-nav { padding: 0 1.5rem; }
        }
        .ld-logo {
          display: flex; align-items: center; gap: 8px;
          text-decoration: none; color: var(--text-primary); font-weight: 700; font-size: 16px;
          letter-spacing: -0.02em;
        }
        .ld-nav-right { display: flex; align-items: center; gap: 16px; }
        .ld-btn-ghost {
          color: var(--text-secondary); text-decoration: none; font-size: 13px; font-weight: 500;
          padding: 8px 16px; border-radius: 8px; transition: all 0.2s;
        }
        .ld-btn-ghost:hover { color: var(--text-primary); background: rgba(255, 255, 255, 0.04); }
        .ld-btn-solid {
          background: var(--brand-grad); color: #ffffff; text-decoration: none;
          font-size: 13px; font-weight: 600; padding: 8px 20px; border-radius: 8px;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(0, 82, 255, 0.2);
        }
        .ld-btn-solid:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 82, 255, 0.35);
        }

        /* Main Container */
        .ld-container {
          max-width: 1080px; margin: 0 auto; padding: 120px 2rem 60px;
        }
        @media (max-width: 640px) {
          .ld-container { padding: 100px 1.25rem 40px; }
        }

        /* Hero */
        .ld-hero { text-align: center; margin-bottom: 60px; position: relative; }
        .ld-hero-glow {
          position: absolute; top: -200px; left: 50%; transform: translateX(-50%);
          width: 800px; height: 500px; pointer-events: none; z-index: 0;
          background: radial-gradient(circle at 50% 0%, rgba(0, 82, 255, 0.15) 0%, rgba(0, 212, 138, 0.05) 50%, transparent 70%);
          filter: blur(50px);
        }
        .ld-badge {
          display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600;
          color: var(--text-primary); background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border);
          padding: 6px 14px; border-radius: 100px; margin-bottom: 24px; text-transform: uppercase;
          letter-spacing: 0.08em; position: relative; z-index: 1;
        }
        .ld-badge-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--accent-green);
          box-shadow: 0 0 10px var(--accent-green);
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .ld-h1 {
          font-size: 52px; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em;
          margin-bottom: 24px; position: relative; z-index: 1;
          background: linear-gradient(180deg, #ffffff 40%, #c2c2bd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .ld-h1 em {
          font-style: normal;
          background: var(--brand-grad);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        @media (max-width: 768px) {
          .ld-h1 { font-size: 38px; }
        }
        .ld-desc {
          font-size: 16px; color: var(--text-secondary); max-width: 640px; margin: 0 auto 36px;
          line-height: 1.6; position: relative; z-index: 1;
        }
        .ld-hero-ctas { display: flex; justify-content: center; gap: 16px; position: relative; z-index: 1; }
        .ld-hero-ctas .ld-btn-ghost {
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.02);
        }
        .ld-hero-ctas .ld-btn-ghost:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--text-secondary);
        }

        /* HUD Block */
        .ld-hud-container {
          display: grid;
          grid-template-columns: 1fr 1.2fr 1fr;
          gap: 20px;
          margin-bottom: 60px;
          position: relative;
          z-index: 1;
        }
        @media (max-width: 960px) {
          .ld-hud-container { grid-template-columns: 1fr; }
        }
        .ld-hud-card {
          background: var(--bg-card);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: border-color 0.3s;
        }
        .ld-hud-card:hover {
          border-color: rgba(0, 82, 255, 0.3);
        }
        .ld-hud-title {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 20px;
          display: flex; align-items: center; gap: 6px;
        }
        .ld-hud-stats-grid {
          display: grid; grid-template-columns: 1fr; gap: 20px;
        }
        .ld-hud-stat-box {
          display: flex; flex-direction: column;
        }
        .ld-hud-stat-num {
          font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1;
          letter-spacing: -0.02em;
        }
        .ld-hud-stat-num.green {
          background: linear-gradient(135deg, #ffffff 40%, var(--accent-green) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .ld-hud-stat-label {
          font-size: 11px; color: var(--text-muted); margin-top: 6px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .ld-hud-insight-text {
          font-size: 13px; color: var(--text-secondary); line-height: 1.6;
          font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
        }
        .ld-hud-live-tag {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(0, 212, 138, 0.1); border: 1px solid rgba(0, 212, 138, 0.2);
          color: var(--accent-green); font-size: 9px; font-weight: 700;
          padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em;
        }
        .ld-hud-spotlight-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px;
          margin-top: 12px;
        }
        .ld-hud-spotlight-name {
          font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none;
          display: block; margin-bottom: 8px; transition: color 0.2s;
        }
        .ld-hud-spotlight-name:hover {
          color: var(--accent-green);
        }
        .ld-hud-meta-row {
          display: flex; align-items: center; gap: 8px; font-size: 11px;
        }

        /* Unified Grid Section */
        .ld-section-title { font-size: 24px; font-weight: 800; text-align: center; margin-bottom: 8px; letter-spacing: -0.02em; }
        .ld-grid-header { text-align: center; margin-bottom: 32px; }
        .ld-tabs-container { display: flex; justify-content: center; margin-bottom: 20px; }
        .ld-tabs { display: inline-flex; background: rgba(255,255,255,0.02); padding: 4px; border-radius: 10px; border: 1px solid var(--border); }
        .ld-tab {
          background: transparent; border: none; color: var(--text-secondary);
          font-size: 12px; font-weight: 600; padding: 8px 18px; border-radius: 8px;
          cursor: pointer; transition: all 0.2s;
        }
        .ld-tab:hover { color: #ffffff; }
        .ld-tab.active { background: var(--bg-elevated); color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.03); }
        .ld-tab-desc { font-size: 13px; color: var(--text-secondary); max-width: 600px; margin: 0 auto 32px; text-align: center; line-height: 1.5; }

        /* Responsive Table styling */
        .ld-table-container {
          background: var(--bg-card); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border); border-radius: 14px;
          overflow-x: auto; width: 100%; margin-bottom: 80px; box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        }
        .ld-table { width: 100%; border-collapse: collapse; text-align: left; min-width: 800px; }
        .ld-th { padding: 16px 20px; font-size: 11px; font-weight: 700; color: var(--text-muted); border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.05em; }
        .ld-tr { border-bottom: 1px solid var(--border); transition: background 0.2s; }
        .ld-tr:hover { background: rgba(255,255,255,0.02); }
        .ld-tr:last-child { border-bottom: none; }
        .ld-td { padding: 16px 20px; font-size: 13px; color: var(--text-secondary); vertical-align: middle; }
        .ld-repo-link { font-weight: 600; color: #ffffff; text-decoration: none; transition: color 0.2s; }
        .ld-repo-link:hover { color: var(--accent-green); }
        .ld-action-btn {
          background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); color: #ffffff;
          font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer;
          transition: all 0.2s;
        }
        .ld-action-btn:hover { background: #ffffff; color: var(--bg-primary); border-color: #ffffff; }

        /* Loader & Error states */
        .ld-skeleton-row { height: 50px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px; }
        .ld-skeleton-cell { background: var(--bg-elevated); border-radius: 4px; height: 16px; animation: pulse 1.5s infinite; }

        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }

        /* How it works */
        .ld-how-section { padding: 60px 0; border-top: 1px solid var(--border); margin-bottom: 60px; }
        .ld-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; }
        @media (max-width: 768px) {
          .ld-how-grid { grid-template-columns: 1fr; }
        }
        .ld-how-card {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
          padding: 32px 24px; text-align: left; position: relative; overflow: hidden;
          transition: border-color 0.3s;
        }
        .ld-how-card:hover {
          border-color: rgba(0, 212, 138, 0.2);
        }
        .ld-how-num {
          font-size: 48px; font-weight: 900;
          background: var(--brand-grad);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          opacity: 0.15;
          position: absolute; top: 12px; right: 16px; line-height: 1;
        }
        .ld-how-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #ffffff; }
        .ld-how-card p { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        /* Pricing & Callout */
        .ld-pricing {
          background: radial-gradient(circle at 50% 100%, rgba(0, 82, 255, 0.05) 0%, rgba(0, 0, 0, 0) 70%), var(--bg-surface);
          border: 1px solid var(--border); border-radius: 16px; padding: 48px; text-align: center;
          margin-bottom: 80px; position: relative;
        }
        .ld-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; max-width: 800px; margin: 40px auto 0; text-align: left; }
        @media (max-width: 640px) {
          .ld-pricing-grid { grid-template-columns: 1fr; }
        }
        .ld-pricing-card {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 32px;
          transition: border-color 0.3s, transform 0.3s;
        }
        .ld-pricing-card:hover {
          transform: translateY(-2px);
        }
        .ld-pricing-card.featured {
          border-color: var(--accent-green);
          box-shadow: 0 8px 30px rgba(0, 212, 138, 0.05);
        }
        .ld-pricing-name { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.05em; }
        .ld-pricing-price { font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 16px; letter-spacing: -0.02em; }
        .ld-pricing-features { list-style: none; padding: 0; margin: 20px 0 28px; font-size: 13px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 10px; }
        .ld-pricing-features li { display: flex; align-items: center; gap: 8px; }
        .ld-pricing-features li::before { content: "✓"; color: var(--accent-green); font-weight: bold; }
        .ld-pricing-features li.dim { color: var(--text-muted); }
        .ld-pricing-features li.dim::before { content: "×"; color: var(--text-muted); }

        /* Footer */
        .ld-footer {
          border-top: 1px solid var(--border); padding: 40px 0 20px; display: flex; align-items: center;
          justify-content: space-between; font-size: 12px; color: var(--text-muted);
        }
        @media (max-width: 640px) {
          .ld-footer { flex-direction: column; gap: 16px; text-align: center; }
        }
        .ld-footer-links { display: flex; gap: 20px; }
        .ld-footer-links a { color: var(--text-muted); text-decoration: none; transition: color 0.2s; }
        .ld-footer-links a:hover { color: var(--text-primary); }

        /* Auth Modal */
        .ld-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px);
          display: grid; place-items: center; z-index: 200; padding: 1rem;
        }
        .ld-modal {
          background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px;
          padding: 36px 28px; max-width: 440px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          text-align: center; animation: modal-scale 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .ld-modal h3 { font-size: 20px; font-weight: 800; color: #ffffff; margin-bottom: 8px; letter-spacing: -0.01em; }
        .ld-modal p { font-size: 14px; color: var(--text-secondary); margin-bottom: 28px; line-height: 1.6; }
        .ld-modal-btns { display: flex; flex-direction: column; gap: 12px; }
        .ld-modal-close {
          background: transparent; border: none; color: var(--text-muted); font-size: 11px;
          cursor: pointer; margin-top: 20px; text-decoration: underline; transition: color 0.2s;
        }
        .ld-modal-close:hover { color: var(--text-primary); }

        @keyframes modal-scale {
          0% { transform: scale(0.96); opacity: 0; }
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

        {/* ── SECTION 1.5: INTEGRATED HUD DASHBOARD ── */}
        <div className="ld-hud-container">
          {/* Card 1: Platform Stats */}
          <div className="ld-hud-card">
            <div>
              <div className="ld-hud-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Ecosystem Metrics
              </div>
              <div className="ld-hud-stats-grid">
                <div className="ld-hud-stat-box">
                  <span className="ld-hud-stat-num">
                    {overview?.total_repos ? overview.total_repos.toLocaleString() : "12,800+"}
                  </span>
                  <span className="ld-hud-stat-label">Repos Monitored</span>
                </div>
                <div className="ld-hud-stat-box" style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  <span className="ld-hud-stat-num green">
                    {overview?.healthy_repos ? overview.healthy_repos.toLocaleString() : "4,200+"}
                  </span>
                  <span className="ld-hud-stat-label">Healthy Projects</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Strategic Analyst Insight */}
          <div className="ld-hud-card">
            <div>
              <div className="ld-hud-title" style={{ justifyContent: "space-between", width: "100%" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  AI Intel Feed
                </span>
                <span className="ld-hud-live-tag">
                  <span className="ld-badge-dot" />
                  LIVE
                </span>
              </div>
              <div className="ld-hud-insight-text">
                {reportLoading ? (
                  <span style={{ color: "var(--text-muted)" }}>Decoding metadata patterns...</span>
                ) : weeklyReport?.strategic_insight ? (
                  weeklyReport.strategic_insight
                ) : (
                  "Ecosystem growth remains strong. Multi-modal models and lightweight inference engines are experiencing positive acceleration, with star velocities showing upward inflections across major tooling layers."
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Breakout Spotlight */}
          <div className="ld-hud-card">
            <div>
              <div className="ld-hud-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Breakout Spotlight
              </div>
              {repoOfTheDay ? (
                <div>
                  <div className="ld-hud-spotlight-box">
                    <Link href={`/repo/${repoOfTheDay.owner}/${repoOfTheDay.name}`} className="ld-hud-spotlight-name">
                      {repoOfTheDay.owner}/{repoOfTheDay.name}
                    </Link>
                    <div className="ld-hud-meta-row" style={{ color: "var(--text-secondary)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-blue)" }} />
                        {repoOfTheDay.primary_language || "Python"}
                      </span>
                      <span>•</span>
                      <span>+{(repoOfTheDay.star_velocity_7d || 0).toLocaleString()}★ (7d)</span>
                    </div>
                  </div>
                  <div className="ld-hud-stat-label" style={{ marginTop: "12px" }}>
                    Spotlight repo chosen based on 7-day velocity acceleration.
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  Calculating spotlight metrics...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 2: UNIFIED INTELLIGENCE GRID ── */}
        <section id="grid" style={{ marginBottom: "60px" }}>
          <div className="ld-grid-header">
            <h2 className="ld-section-title">Ecosystem Intelligence Grid</h2>
            <div className="ld-tabs-container">
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
            </div>
            <p className="ld-tab-desc">
              {gridTab === "breakouts" && "Surfacing the highest accelerating repositories across the AI landscape by star velocity delta over the last 7 days."}
              {gridTab === "gems" && "Promising, early-stage libraries with low total stars (<3,000) experiencing explosive breakout scores and fork proxy activity."}
              {gridTab === "new" && "Newly indexed repositories with the highest novelty scores, tracking early signals before mainstream awareness."}
            </p>
          </div>

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
                    <tr key={row.repo_id || idx} className="ld-tr">
                      <td className="ld-td" style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                        {idx + 1}
                      </td>
                      <td className="ld-td">
                        <Link href={`/repo/${row.owner}/${row.name}`} className="ld-repo-link">
                          {row.owner}/{row.name}
                        </Link>
                      </td>
                      <td className="ld-td">
                        <span style={{ fontSize: "11px", background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: "6px", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                          {row.category}
                        </span>
                      </td>
                      <td className="ld-td">
                        <code style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-primary)" }}>
                          {row.language || "TypeScript"}
                        </code>
                      </td>
                      <td className="ld-td">
                        <div className="ld-badge-group">
                          <HealthBadge label={row.sustainabilityLabel} />
                        </div>
                      </td>
                      <td className="ld-td" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                        {row.metricValue}
                      </td>
                      <td className="ld-td">
                        <button
                          onClick={() => triggerAuthModal(`pin ${row.owner}/${row.name} to your watchlist`)}
                          className="ld-action-btn"
                        >
                          Pin
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="ld-td" colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
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
          <p className="ld-desc" style={{ textAlign: "center", marginBottom: "40px" }}>
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
              <div className="ld-pricing-name" style={{ color: "var(--accent-green)" }}>Pro Dashboard</div>
              <div className="ld-pricing-price">$12<span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--text-secondary)" }}> / mo</span></div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-8px" }}>Billed monthly · Cancel anytime</div>
              <ul className="ld-pricing-features">
                <li>Everything in Explorer</li>
                <li>Custom star/fork acceleration alerts</li>
                <li>Save search presets and filters</li>
                <li>Personalized watchlist & dashboard</li>
                <li>Full 90-day historical timeseries data</li>
              </ul>
              <Link href="/sign-up" className="ld-btn-solid" style={{ display: "block", textAlign: "center", marginTop: "16px" }}>
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
