"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

export default function DocsPage() {
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
        .ld-docs-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 100px 1.5rem 60px;
        }
        .ld-docs-header {
          border-bottom: 1px solid var(--border);
          padding-bottom: 24px;
          margin-bottom: 32px;
        }
        .ld-docs-title {
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        .ld-docs-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        /* Content Sections */
        .ld-metric-section {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px 24px;
          margin-bottom: 24px;
        }
        .ld-metric-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .ld-metric-name {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent-yellow);
        }
        .ld-metric-type {
          font-family: monospace;
          font-size: 11px;
          color: var(--text-muted);
          background: var(--bg-elevated);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .ld-metric-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }
        .ld-metric-math {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px 16px;
          font-family: monospace;
          font-size: 11px;
          color: var(--text-primary);
          overflow-x: auto;
        }
        .ld-metric-math-title {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
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

      {/* Docs Body */}
      <div className="ld-docs-container">
        <header className="ld-docs-header">
          <h1 className="ld-docs-title">Ecosystem Indicators</h1>
          <p className="ld-docs-subtitle">
            An open specification of the algorithms, weights, and metrics used by the Repodar ingestion engine to classify developer traction and repository health.
          </p>
        </header>

        <main>
          {/* Trend Score */}
          <section className="ld-metric-section">
            <div className="ld-metric-header">
              <span className="ld-metric-name">Trend Score</span>
              <span className="ld-metric-type">Normalized Float (0.00 – 1.00)</span>
            </div>
            <p className="ld-metric-desc">
              Measures the overall momentum of a project by analyzing demand spikes and active developer contributions. To prevent newly indexed repositories from artificially crowding out established projects, the raw score is log-damped by project age.
            </p>
            <div className="ld-metric-math-title">Mathematical Formula Weights</div>
            <pre className="ld-metric-math">
{`TrendScore = RawScore / log(max(AgeDays, 2))

Where RawScore is calculated as:
• 7D Star Velocity:   30%
• Star Acceleration:  20%
• Commit Frequency:   15%
• Contributor Growth: 10%
• PR Activity:        10%
• Fork Growth:        10%
• Release Cadence:     3%
• Issue Volume:        2%`}
            </pre>
          </section>

          {/* Momentum */}
          <section className="ld-metric-section">
            <div className="ld-metric-header">
              <span className="ld-metric-name">Momentum</span>
              <span className="ld-metric-type">Classification Tag</span>
            </div>
            <p className="ld-metric-desc">
              Measures category-specific shifts over time. Momentum determines the rate of growth acceleration or deceleration by comparing 7-day velocity averages against 30-day velocity baselines.
            </p>
            <div className="ld-metric-math-title">Signal Classification Ranges</div>
            <pre className="ld-metric-math">
{`• Accelerating: MoM Growth Pct > +5%
• Decelerating: MoM Growth Pct < -5%
• Stable:       MoM Growth Pct falls between -5% and +5%`}
            </pre>
          </section>

          {/* Star Velocity */}
          <section className="ld-metric-section">
            <div className="ld-metric-header">
              <span className="ld-metric-name">Star Velocity</span>
              <span className="ld-metric-type">Daily Average Growth</span>
            </div>
            <p className="ld-metric-desc">
              Calculates the raw daily star gain normalized over distinct 7-day and 30-day periods. Helps filter out one-time spikes caused by single Hacker News or X features from sustained community acquisition.
            </p>
            <div className="ld-metric-math-title">Calculation</div>
            <pre className="ld-metric-math">
{`StarVelocity_7d = TotalStarsGained_7d / 7.0
StarVelocity_30d = TotalStarsGained_30d / 30.0`}
            </pre>
          </section>

          {/* Sustainability */}
          <section className="ld-metric-section">
            <div className="ld-metric-header">
              <span className="ld-metric-name">Sustainability</span>
              <span className="ld-metric-type">Status Rating</span>
            </div>
            <p className="ld-metric-desc">
              Measures project health and maintenance risk. By evaluating contributor decay (how many developers actively commit), issue close rates, and shipping consistency, the model warns developers of potential project abandonment.
            </p>
            <div className="ld-metric-math-title">Classification Rules</div>
            <pre className="ld-metric-math">
{`• Green (Healthy):    Health Score >= 0.60
• Yellow (Caution):   Health Score between 0.30 and 0.60
• Red (Unhealthy):    Health Score < 0.30`}
            </pre>
          </section>

          {/* Health Score */}
          <section className="ld-metric-section">
            <div className="ld-metric-header">
              <span className="ld-metric-name">Health Score</span>
              <span className="ld-metric-type">Float (0.00 – 1.00)</span>
            </div>
            <p className="ld-metric-desc">
              The underlying numerical index that computes the sustainability rating. Evaluates contributor engagement, developer activity, issue closure ratios, and code integration patterns.
            </p>
            <div className="ld-metric-math-title">Mathematical Formula Weights</div>
            <pre className="ld-metric-math">
{`HealthScore = 
  ContributorGrowth_Proxy * 0.30 +
  IssueClosureRate * 0.30 +
  ReleaseFrequency * 0.20 +
  ForkToStarRatio * 0.20`}
            </pre>
          </section>

          {/* Breakout Score */}
          <section className="ld-metric-section">
            <div className="ld-metric-header">
              <span className="ld-metric-name">Breakout Score</span>
              <span className="ld-metric-type">Composite Index (Weighted)</span>
            </div>
            <p className="ld-metric-desc">
              Measures velocity spikes relative to baseline stars. Used by the "Hidden Gems" crawler to highlight early-stage projects gaining substantial traction before they reach mainstream popularity.
            </p>
            <div className="ld-metric-math-title">Mathematical Formula Components</div>
            <pre className="ld-metric-math">
{`BreakoutScore =
  log(max(Acceleration, 0)) * W_accel +
  log(max(Velocity7d, 0))    * W_vel7d +
  VelocityInflection         * W_inflection +
  TrendScore                 * W_trend +
  Novelty                    * W_novelty +
  StarHeadroom               * W_headroom +
  ContributorGrowth          * W_contrib +
  ForkProxy                  * W_forks +
  ConsistencyScore           * W_consistency`}
            </pre>
          </section>

          {/* Novelty Score */}
          <section className="ld-metric-section">
            <div className="ld-metric-header">
              <span className="ld-metric-name">Novelty Score</span>
              <span className="ld-metric-type">Float (0.00 – 1.00)</span>
            </div>
            <p className="ld-metric-desc">
              Evaluates the relative youth of a repository since it was first created on GitHub. Newer repositories obtain scores approaching 1.00, while older, established codebases degrade toward 0.00.
            </p>
            <div className="ld-metric-math-title">Formula</div>
            <pre className="ld-metric-math">
{`NoveltyScore = 1.0 - min(AgeDays / MaxAgeDays, 1.0)
(Where MaxAgeDays is set to 180 days by default)`}
            </pre>
          </section>
        </main>

        {/* Simple Footer */}
        <footer className="ld-footer">
          <div>© {new Date().getFullYear()} Repodar. Real-Time GitHub Ecosystem Intelligence.</div>
          <div className="ld-footer-links">
            <Link href="/landing">Landing Page</Link>
            <Link href="/changelog">Changelog</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
