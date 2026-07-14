"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

export default function PrivacyPage() {
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
          <h1 className="ld-legal-title">Privacy Policy</h1>
          <p className="ld-legal-subtitle">Effective Date: July 14, 2026</p>
        </header>

        <main>
          <section className="ld-legal-section">
            <h2>1. Introduction</h2>
            <p>
              Repodar ("we", "our", or "us") provides a real-time GitHub Ecosystem Intelligence platform. We respect your privacy and are committed to protecting it through compliance with this Privacy Policy.
            </p>
          </section>

          <section className="ld-legal-section">
            <h2>2. Information We Collect</h2>
            <p>
              We collect information to deliver our services, handle authentication, and process telemetry:
            </p>
            <ul>
              <li><strong>Account and Session Information:</strong> We use Clerk to handle user authentication, sign-ups, and session management. When you sign up, Clerk collects details such as your email address, profile picture, or public third-party account details (like GitHub, Google, or Discord) if you register through them.</li>
              <li><strong>Repository Telemetry:</strong> All developer growth statistics, star counts, commit histories, issues, and forks displayed on the platform are retrieved from public GitHub event streams and telemetry data. We do not index or access private repositories unless you explicitly connect them for dashboard alerts.</li>
            </ul>
          </section>

          <section className="ld-legal-section">
            <h2>3. How We Use Your Data</h2>
            <p>
              Your data is processed strictly for the following purposes:
            </p>
            <ul>
              <li>To initialize, run, and secure your personal user dashboard.</li>
              <li>To process and send custom Slack, Discord, or Webhook alerts that you configure.</li>
              <li>To evaluate aggregate, anonymized category metrics.</li>
            </ul>
          </section>

          <section className="ld-legal-section">
            <h2>4. Data Sharing & Security</h2>
            <p>
              <strong>We do not sell, rent, or trade user-identifiable data to third parties.</strong>
            </p>
            <p>
              We store and process data using industry-standard security patterns. Authentication tokens, session variables, and personal credentials are encrypted and stored via Clerk's secure servers.
            </p>
          </section>

          <section className="ld-legal-section">
            <h2>5. Contact Us</h2>
            <p>
              If you have any questions or feedback regarding this Privacy Policy, please reach out to us at:
            </p>
            <p style={{ fontWeight: 600, color: "var(--accent-yellow)" }}>
              support@repodar.com
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
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
