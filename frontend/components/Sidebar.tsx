"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: "/insights",
    label: "Insights",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    ),
  },
  {
    href: "/topics",
    label: "Topics",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
  {
    href: "/network",
    label: "Network",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2"/>
        <circle cx="19" cy="12" r="2"/>
        <circle cx="5" cy="12" r="2"/>
        <circle cx="12" cy="19" r="2"/>
        <path d="M12 7v4M12 15v2M14 5.5l4 5M10 5.5l-4 5"/>
      </svg>
    ),
  },
  {
    href: "/orgs",
    label: "Org Health",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/compare",
    label: "Compare",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
      </svg>
    ),
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    href: "/dev",
    label: "Dev API",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? "64px" : "240px"
    );
  }, [collapsed]);

  return (
    <>
      <style>{`
        .sidebar-nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 7px;
          font-size: 13px;
          text-decoration: none;
          transition: background 0.13s, color 0.13s;
          position: relative;
          cursor: pointer;
        }
        .sidebar-nav-link:hover {
          background: var(--bg-elevated) !important;
          color: var(--text-primary) !important;
        }
        .sidebar-tooltip {
          display: none;
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 200;
          box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        }
        .sidebar-tooltip::before {
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-right-color: var(--border);
        }
        .sidebar-collapsed .sidebar-nav-link:hover .sidebar-tooltip {
          display: block;
        }
        .sidebar-label {
          white-space: nowrap;
          overflow: hidden;
          transition: opacity 0.2s ease, max-width 0.25s ease;
          max-width: 160px;
          opacity: 1;
        }
        .sidebar-collapsed .sidebar-label {
          max-width: 0;
          opacity: 0;
        }
        .sidebar-collapse-btn {
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: background 0.13s, color 0.13s;
          padding: 0;
        }
        .sidebar-collapse-btn:hover {
          background: var(--bg-elevated) !important;
          color: var(--text-primary) !important;
        }
        .sidebar-collapsed .sidebar-nav-link:hover .sidebar-tooltip {
          display: block;
        }
      `}</style>

      <div
        className={collapsed ? "sidebar-collapsed" : ""}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          width: collapsed ? "64px" : "240px",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          overflowY: "auto",
          overflowX: "hidden",
          zIndex: 40,
        }}
      >
        {/* ── Brand Header ─────────────────────────────── */}
        <div
          style={{
            height: "56px",
            display: "flex",
            alignItems: "center",
            padding: collapsed ? "0 10px" : "0 14px",
            borderBottom: "1px solid var(--border)",
            gap: collapsed ? "6px" : "10px",
            flexShrink: 0,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>

          {/* Brand name + tagline (hidden when collapsed) */}
          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "-0.3px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                Repodar
              </span>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                GitHub AI Radar
              </span>
            </div>
          )}

          {/* Collapse toggle (only shown when not collapsed, or centered when collapsed) */}
          {!collapsed && (
            <button
              className="sidebar-collapse-btn"
              onClick={() => setCollapsed((c) => !c)}
              style={{ marginLeft: "auto", width: "22px", height: "22px", flexShrink: 0 }}
              title="Collapse sidebar"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M8 2L4 6l4 4"/>
              </svg>
            </button>
          )}

          {/* Collapse toggle for collapsed state - centered below logo */}
          {collapsed && (
            <button
              className="sidebar-collapse-btn"
              onClick={() => setCollapsed((c) => !c)}
              style={{
                position: "absolute",
                bottom: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "20px",
                height: "20px",
                flexShrink: 0,
              }}
              title="Expand sidebar"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                style={{
                  transform: "rotate(180deg)",
                }}
              >
                <path d="M8 2L4 6l4 4"/>
              </svg>
            </button>
          )}
        </div>

        {/* ── Nav Items ────────────────────────────────── */}
        <nav
          style={{
            flex: 1,
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-nav-link"
                style={{
                  padding: collapsed ? "9px 0" : "9px 10px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  background: isActive ? "var(--bg-elevated)" : "transparent",
                  justifyContent: "center",
                  borderLeft: isActive
                    ? "2px solid var(--accent-blue)"
                    : "2px solid transparent",
                }}
              >
                {/* Icon */}
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive ? "var(--accent-blue)" : "inherit",
                    flexShrink: 0,
                    width: "17px",
                  }}
                >
                  {item.icon}
                </span>

                {/* Label */}
                <span className="sidebar-label" style={{ flex: 1 }}>
                  {item.label}
                </span>

                {/* Tooltip (only shown when collapsed, via CSS) */}
                <span className="sidebar-tooltip">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ───────────────────────────────────── */}
        <div
          style={{
            padding: collapsed ? "12px 10px" : "12px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "8px",
          }}
          title="About"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {!collapsed && (
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                Repodar v2.0
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap", marginTop: "1px" }}>
                AI/ML ecosystem tracker
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
