"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

export default function TermsPage() {
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
          --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          
          font-family: var(--font-sans);
          background-color: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          overflow-x: hidden;
          line-height: 1.6;
        }

        /* Nav */
        .ld-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 56px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 2rem; background: rgba(30, 29, 28, 0.85);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
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
          background: linear-gradient(135deg, #d29922 0%, #b07e15 100%); color: var(--bg-primary); text-decoration: none;
          font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px;
          transition: transform 0.15s, opacity 0.15s;
        }
        .ld-btn-solid:hover { opacity: 0.95; transform: translateY(-0.5px); }

        /* Container */
        .ld-legal-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 100px 1.5rem 60px;
        }
        .ld-legal-header {
          border-bottom: 1px solid var(--border);
          padding-bottom: 24px;
          margin-bottom: 32px;
        }
        .ld-legal-title {
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        .ld-legal-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        /* Content */
        .ld-legal-section {
          margin-bottom: 32px;
        }
        .ld-legal-section h2 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 12px;
        }
        .ld-legal-section p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }
        .ld-legal-section ul {
          padding-left: 18px;
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Footer */
        .ld-footer {
          border-top: 1px solid var(--border);
          padding: 40px 0 20px;
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: var(--text-muted);
        }
        .ld-footer-links { display: flex; gap: 16px; }
        .ld-footer-links a { color: var(--text-muted); text-decoration: none; }
        .ld-footer-links a:hover { color: var(--text-primary); }
      `}</style>

      {/* Nav */}
      <nav className="ld-nav">
        <Link href="/landing" className="ld-logo">
          <Logo size={24} />
          Repodar
        </Link>
        <div className="ld-nav-right">
          <Link href="/sign-in" className="ld-btn-ghost">Sign In</Link>
          <Link href="/sign-up" className="ld-btn-solid">Get Started</Link>
        </div>
      </nav>

      {/* Legal Body */}
      <div className="ld-legal-container">
        <header className="ld-legal-header">
          <h1 className="ld-legal-title">Terms of Service</h1>
          <p className="ld-legal-subtitle">Effective Date: July 14, 2026</p>
        </header>

        <main>
          <section className="ld-legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Repodar platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section className="ld-legal-section">
            <h2>2. Account Registration and Security</h2>
            <p>
              To access advanced capabilities, including personalized watchlists, custom velocity alerts, and historical trends, you must register for an account. 
            </p>
            <ul>
              <li>You agree to provide accurate and complete registration information.</li>
              <li>Authentication is securely powered and managed by Clerk. You are responsible for keeping your login credentials confidential.</li>
              <li>You are responsible for all actions occurring under your account profile.</li>
            </ul>
          </section>

          <section className="ld-legal-section">
            <h2>3. License & Data Ingestion</h2>
            <p>
              Repodar indexes, parses, and aggregates telemetry metrics from public GitHub repositories.
            </p>
            <ul>
              <li>All aggregated index statistics (Trend Scores, Velocities, Sustainability Labels) are provided "as-is" for intelligence purposes.</li>
              <li>You may use public indexes for dependency evaluations, decision-making, and analysis.</li>
              <li>Any automated scraping, reverse-engineering of scoring APIs, or denial-of-service attempts against Repodar endpoints is strictly prohibited.</li>
            </ul>
          </section>

          <section className="ld-legal-section">
            <h2>4. Limitation of Liability</h2>
            <p>
              Repodar aggregates metrics based on public event streams, which are subject to GitHub API latency and availability. We do not guarantee 100% data correctness or service uptime. Under no circumstances shall Repodar be liable for any direct or indirect damages resulting from dependency decisions, database actions, or software deployments using our indicators.
            </p>
          </section>

          <section className="ld-legal-section">
            <h2>5. Modifications</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. Changes will be posted directly on this page with an updated effective date.
            </p>
          </section>
        </main>

        {/* Simple Footer */}
        <footer className="ld-footer">
          <div>© {new Date().getFullYear()} Repodar. Real-Time GitHub Ecosystem Intelligence.</div>
          <div className="ld-footer-links">
            <Link href="/landing">Landing Page</Link>
            <Link href="/docs">Methodology Docs</Link>
            <Link href="/changelog">Changelog</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
