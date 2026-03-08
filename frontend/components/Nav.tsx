"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTheme, Theme } from "@/components/Providers";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/insights", label: "Insights" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/topics", label: "Topics" },
  { href: "/network", label: "Network" },
  { href: "/compare", label: "Compare" },
  { href: "/orgs", label: "Org Health" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/dev", label: "Dev API" },
];

const THEMES: { key: Theme; label: string; color: string }[] = [
  { key: "dark",   label: "Ice",    color: "#58a6ff" },
  { key: "fire",   label: "Ember",  color: "#d4713a" },
  { key: "matrix", label: "Indigo", color: "#818cf8" },
];

export function Nav() {
  const pathname = usePathname();
  const [reportOpen, setReportOpen] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const { theme, setTheme } = useTheme();

  const handleThemeSwitch = (t: Theme) => {
    if (t === theme) return;
    setTheme(t);
    setFlashKey((k) => k + 1);
  };

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
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: "100%",
            paddingLeft: "var(--sidebar-width, 240px)",
            paddingRight: "16px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            transition: "padding-left 0.3s ease",
          }}
        >
          {/* Right side: Theme switcher + Report + Hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {/* Theme switcher */}
            <div style={{ display: "flex", gap: "2px", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "3px", borderRadius: "6px" }}>
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleThemeSwitch(t.key)}
                  title={`Switch to ${t.label} theme`}
                  style={{
                    padding: "4px 10px",
                    border: theme === t.key ? `1px solid ${t.color}` : "1px solid transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: theme === t.key ? `${t.color}18` : "transparent",
                    color: theme === t.key ? t.color : "var(--text-muted)",
                    transition: "all 0.15s",
                    lineHeight: 1,
                    borderRadius: "4px",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Weekly Report button */}
            <button
              onClick={() => setReportOpen(true)}
              className="btn-cyber btn-cyber-cyan"
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              <span className="nav-description" style={{ marginLeft: 0 }}>Weekly </span>Report
            </button>

            {/* Hamburger — mobile only, opens sidebar drawer */}
            <button
              className="nav-hamburger"
              onClick={() => window.dispatchEvent(new CustomEvent("mobile-sidebar-toggle"))}
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>
        </div>


      </nav>

      {/* Theme-switch full-viewport flash */}
      {flashKey > 0 && (
        <div
          key={flashKey}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            pointerEvents: "none",
            background: THEMES.find((t) => t.key === theme)?.color ?? "var(--cyan)",
            animation: "theme-flash 0.45s ease-out forwards",
          }}
        />
      )}

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
              borderRadius: "10px",
              width: "100%",
              maxWidth: "780px",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "16px",
                  color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  Weekly Intelligence Report
                </div>
                {report && (
                  <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0" }}>
                    Week ending {report.week_ending}
                  </div>
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
              <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", textAlign: "center", padding: "40px 0", fontSize: "13px" }}>
                Generating report<span className="terminal-cursor" />
              </div>
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
                                style={{ color: "var(--cyan)", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: "11px" }}
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
                          <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: c.mom_growth_pct >= 0 ? "var(--green)" : "var(--pink)" }}>
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
                        <div key={`${w.owner}/${w.name}`} style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderLeft: "3px solid var(--pink)" }}>
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
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
        color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em",
        marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
        ◈ {title}
      </div>
      {children}
    </div>
  );
}

export function SustainBadge({ label }: { label: string }) {
  const color =
    label === "GREEN" ? "var(--green)" :
    label === "RED" ? "var(--pink)" :
    "var(--amber)";
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color,
      border: `1px solid ${color}`, padding: "2px 6px", letterSpacing: "0.06em" }}>
      {label}
    </span>
  );
}
