"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

export default function ChangelogPage() {
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
        .ld-changelog-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 100px 1.5rem 60px;
        }
        .ld-changelog-header {
          border-bottom: 1px solid var(--border);
          padding-bottom: 24px;
          margin-bottom: 32px;
        }
        .ld-changelog-title {
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        .ld-changelog-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        /* Timeline */
        .ld-timeline {
          position: relative;
          padding-left: 28px;
          border-left: 2px solid var(--border);
          margin-left: 8px;
        }
        .ld-timeline-item {
          position: relative;
          margin-bottom: 48px;
        }
        .ld-timeline-dot {
          position: absolute;
          left: -35px;
          top: 6px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent-yellow);
          border: 3px solid var(--bg-primary);
        }
        .ld-timeline-date {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-yellow);
          margin-bottom: 6px;
        }
        .ld-timeline-title {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 12px;
        }
        .ld-timeline-content {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
        }
        .ld-timeline-content ul {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ld-timeline-content li strong {
          color: #ffffff;
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

      {/* Changelog Body */}
      <div className="ld-changelog-container">
        <header className="ld-changelog-header">
          <h1 className="ld-changelog-title">Product Updates</h1>
          <p className="ld-changelog-subtitle">
            Chronological log of features, pipeline optimizations, and analytics engine releases.
          </p>
        </header>

        <main className="ld-timeline">
          {/* Update July 2026 */}
          <div className="ld-timeline-item">
            <div className="ld-timeline-dot" />
            <div className="ld-timeline-date">July 2026</div>
            <h2 className="ld-timeline-title">v2.1.0 — Product Trust Layer & Widescreen Scaling</h2>
            <div className="ld-timeline-content">
              <ul>
                <li><strong>Widescreen Layout Support:</strong> Expanded max-container margins to 1440px and pricing grid widths to 1000px, improving resolution layouts on high-res monitors.</li>
                <li><strong>Ingestion Telemetry Indicators:</strong> Added a verified ingestion status block showcasing active event sync, total indexed repository count, and last sync timestamp.</li>
                <li><strong>Methodology Documentation:</strong> Published the `/docs` route defining scoring criteria for Trend Score, Momentum, Velocity, Sustainability, and Breakouts.</li>
                <li><strong>Legal Standard Compliance:</strong> Added official, transparent Privacy Policy and Terms of Service pages.</li>
                <li><strong>Repository Reference Alignment:</strong> Updated footer links to refer directly to the Repodar project codebase.</li>
              </ul>
            </div>
          </div>

          {/* Update June 2026 */}
          <div className="ld-timeline-item">
            <div className="ld-timeline-dot" />
            <div className="ld-timeline-date">June 2026</div>
            <h2 className="ld-timeline-title">v2.0.0 — Repodar v2 Interactive Landing Page</h2>
            <div className="ld-timeline-content">
              <ul>
                <li><strong>Zero-Authentication Ecosystem Previews:</strong> Enabled live ecosystem radar sweeps and leaderboard directories directly on the homepage.</li>
                <li><strong>Read-Only Dashboard Viewport:</strong> Embedded a functional view of the main workspace interface, allowing immediate value exploration without registration friction.</li>
                <li><strong>Backend API Integration:</strong> Standardized client-side cache queries against public cached endpoints to maintain zero database overhead.</li>
              </ul>
            </div>
          </div>

          {/* Update May 2026 */}
          <div className="ld-timeline-item">
            <div className="ld-timeline-dot" />
            <div className="ld-timeline-date">May 2026</div>
            <h2 className="ld-timeline-title">v1.5.0 — Real-Time Event Pipeline & Alerts</h2>
            <div className="ld-timeline-content">
              <ul>
                <li><strong>2-Hour Interval Indexing:</strong> Deployed backend schedulers in the main worker cycle, polling repository changes every 2 hours.</li>
                <li><strong>Early Radar Classifier:</strong> Created classification logic to identify pre-viral "Hidden Gems" (spiking velocity but low total stars).</li>
                <li><strong>Pro User Alerts:</strong> Enabled custom Webhook, Slack, and Discord alert options.</li>
              </ul>
            </div>
          </div>

          {/* Update March 2026 */}
          <div className="ld-timeline-item">
            <div className="ld-timeline-dot" />
            <div className="ld-timeline-date">March 2026</div>
            <h2 className="ld-timeline-title">v1.0.0 — Initial Release of Repodar</h2>
            <div className="ld-timeline-content">
              <ul>
                <li><strong>Core Engine Launch:</strong> Introduced the GitHub Ecosystem Index tracking software momentum, developer adoption, and dependency sustainability.</li>
                <li><strong>Clerk Auth Integration:</strong> Secure authentication layer using Clerk OAuth credentials.</li>
              </ul>
            </div>
          </div>
        </main>

        {/* Simple Footer */}
        <footer className="ld-footer">
          <div>© {new Date().getFullYear()} Repodar. Real-Time GitHub Ecosystem Intelligence.</div>
          <div className="ld-footer-links">
            <Link href="/landing">Landing Page</Link>
            <Link href="/docs">Methodology Docs</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
