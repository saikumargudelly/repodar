"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTheme, Theme } from "@/components/Providers";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/radar", label: "Breakout Radar" },
  { href: "/early-radar", label: "Early Radar" },
  { href: "/topics", label: "Topics" },
  { href: "/network", label: "Network" },
  { href: "/compare", label: "Compare" },
  { href: "/orgs", label: "Org Health" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/dev", label: "Dev API" },
];

const THEMES: { key: Theme; icon: string; label: string }[] = [
  { key: "dark",      icon: "🌑", label: "Dark" },
  { key: "semi-dark", icon: "🌓", label: "Semi-dark" },
  { key: "light",     icon: "🌕", label: "Light" },
];

export function Nav() {
  const pathname = usePathname();
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const { data: report, isLoading } = useQuery({
    queryKey: ["weekly-report"],
    queryFn: api.getWeeklyReport,
    enabled: reportOpen,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <>
      <nav
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            padding: "0 16px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          {/* Logo + Desktop Links */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
            <Link href="/" style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>
                Repodar
                <span className="nav-description">
                  Real-time GitHub AI Ecosystem Radar
                </span>
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="nav-links-desktop">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: pathname === link.href ? "var(--text-primary)" : "var(--text-secondary)",
                    background: pathname === link.href ? "var(--bg-elevated)" : "transparent",
                    textDecoration: "none",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side: Theme switcher + Report + Hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {/* Theme switcher */}
            <div style={{ display: "flex", gap: "2px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", padding: "3px" }}>
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  title={t.label}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    background: theme === t.key ? "var(--accent-blue)" : "transparent",
                    transition: "all 0.15s",
                    lineHeight: 1,
                  }}
                >
                  {t.icon}
                </button>
              ))}
            </div>

            {/* Weekly Report button */}
            <button
              onClick={() => setReportOpen(true)}
              style={{
                padding: "7px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                background: "var(--accent-blue)",
                color: "white",
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              <span className="nav-description" style={{ marginLeft: 0 }}>Weekly </span>Report
            </button>

            {/* Hamburger */}
            <button
              className="nav-hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`nav-mobile-menu${menuOpen ? " open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                color: pathname === link.href ? "var(--text-primary)" : "var(--text-secondary)",
                background: pathname === link.href ? "var(--bg-elevated)" : "transparent",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Report Modal */}
      {reportOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "40px 16px",
            overflowY: "auto",
          }}
          onClick={() => setReportOpen(false)}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "780px",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Weekly Repodar Intelligence Report</h2>
                {report && (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0" }}>
                    Week ending {report.week_ending}
                  </p>
                )}
              </div>
              <button
                onClick={() => setReportOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            {isLoading && (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "40px 0" }}>
                Generating report...
              </p>
            )}

            {report && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Strategic Insight */}
                <Section title="Strategic Insight">
                  <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "14px" }}>
                    {report.strategic_insight}
                  </p>
                </Section>

                {/* Top Breakout */}
                <Section title="Top Breakout Repos">
                  <div className="table-scroll">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                          <th style={{ padding: "4px 8px" }}>#</th>
                          <th style={{ padding: "4px 8px" }}>Repo</th>
                          <th style={{ padding: "4px 8px" }}>Category</th>
                          <th style={{ padding: "4px 8px", textAlign: "right" }}>Trend Score</th>
                          <th style={{ padding: "4px 8px", textAlign: "right" }}>Velocity/d</th>
                          <th style={{ padding: "4px 8px" }}>Sustain.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.top_breakout_repos.slice(0, 8).map((r) => (
                          <tr key={`${r.owner}/${r.name}`} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px", color: "var(--text-muted)" }}>{r.rank}</td>
                            <td style={{ padding: "8px" }}>
                              <a
                                href={`https://github.com/${r.owner}/${r.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--accent-blue)", textDecoration: "none" }}
                              >
                                {r.owner}/{r.name}
                              </a>
                            </td>
                            <td style={{ padding: "8px", color: "var(--text-secondary)" }}>{r.category}</td>
                            <td style={{ padding: "8px", textAlign: "right" }}>{r.trend_score.toFixed(4)}</td>
                            <td style={{ padding: "8px", textAlign: "right" }}>{r.star_velocity_7d.toFixed(1)}</td>
                            <td style={{ padding: "8px" }}>
                              <SustainBadge label={r.sustainability_label} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>

                {/* Category Momentum */}
                <Section title="Category Momentum">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {report.category_momentum.map((c) => (
                      <div key={c.category} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                        <span style={{ fontSize: "13px" }}>{c.category}</span>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                            {c.weekly_velocity.toFixed(0)} stars/wk
                          </span>
                          <span style={{ fontSize: "12px", color: c.mom_growth_pct >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                            {c.mom_growth_pct >= 0 ? "+" : ""}{c.mom_growth_pct.toFixed(1)}% MoM
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{c.signal}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Sustainability Watchlist */}
                {report.sustainability_watchlist.length > 0 && (
                  <Section title="Sustainability Watchlist">
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {report.sustainability_watchlist.slice(0, 5).map((w) => (
                        <div key={`${w.owner}/${w.name}`} style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "6px", borderLeft: "3px solid var(--accent-red)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600 }}>{w.owner}/{w.name}</span>
                            <SustainBadge label={w.sustainability_label} />
                          </div>
                          <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0" }}>{w.note}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function SustainBadge({ label }: { label: string }) {
  const color =
    label === "GREEN" ? "var(--accent-green)" :
    label === "RED" ? "var(--accent-red)" :
    "var(--accent-yellow)";
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: "4px", padding: "2px 6px", letterSpacing: "0.5px" }}>
      {label}
    </span>
  );
}
