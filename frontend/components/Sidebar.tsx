"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  {
    href: "/overview",
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
    href: "/explore",
    label: "Explore",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="11" y1="8" x2="11" y2="14"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    ),
  },
  {
    href: "/collections",
    label: "Collections",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
        <rect x="9" y="9" width="6" height="6"/>
        <line x1="9" y1="1" x2="9" y2="4"/>
        <line x1="15" y1="1" x2="15" y2="4"/>
        <line x1="9" y1="20" x2="9" y2="23"/>
        <line x1="15" y1="20" x2="15" y2="23"/>
        <line x1="20" y1="9" x2="23" y2="9"/>
        <line x1="20" y1="14" x2="23" y2="14"/>
        <line x1="1" y1="9" x2="4" y2="9"/>
        <line x1="1" y1="14" x2="4" y2="14"/>
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
    href: "/radar",
    label: "Radar",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/>
        <path d="M4 6h.01"/>
        <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/>
        <circle cx="12" cy="12" r="2"/>
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
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    href: "/research",
    label: "Research",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
      </svg>
    ),
  },
  {
    href: "/weekly",
    label: "Weekly",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
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
];

const ALL_VERTICALS = [
  { key: "ai_ml",      label: "AI / ML",        icon: "🤖" },
  { key: "devtools",   label: "DevTools",        icon: "🛠" },
  { key: "web_mobile", label: "Web & Mobile",    icon: "🌐" },
  { key: "data_infra", label: "Data & Infra",    icon: "📊" },
  { key: "security",   label: "Security",        icon: "🔒" },
  { key: "blockchain", label: "Blockchain",      icon: "⛓" },
  { key: "oss_tools",  label: "OSS Tools",       icon: "📦" },
  { key: "science",    label: "Science",          icon: "🔬" },
  { key: "creative",   label: "Creative",         icon: "🎨" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isLoaded: authLoaded, userId } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userVerticals, setUserVerticals] = useState<string[]>([]);
  const [showMyTopics, setShowMyTopics] = useState(false);

  // Detect breakpoints
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-collapse sidebar on tablet
  useEffect(() => {
    if (isTablet) setCollapsed(true);
    else if (!isMobile) setCollapsed(false);
  }, [isTablet, isMobile]);

  // Sync --sidebar-width CSS var
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isMobile ? "0px" : collapsed ? "64px" : "240px"
    );
  }, [collapsed, isMobile]);

  // Listen for hamburger toggle event from Nav
  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);
  useEffect(() => {
    window.addEventListener("mobile-sidebar-toggle", toggleMobile);
    return () => window.removeEventListener("mobile-sidebar-toggle", toggleMobile);
  }, [toggleMobile]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Load user preferred verticals
  useEffect(() => {
    if (!authLoaded || !userId) return;
    api.getOnboardingStatus(userId)
      .then((s) => {
        const prefs = s.selected_verticals ?? [];
        setUserVerticals(prefs);
        if (prefs.length > 0) setShowMyTopics(true);
      })
      .catch(() => {/* silent */});
  }, [authLoaded, userId]);

  const displayedVerticals = showMyTopics && userVerticals.length > 0
    ? ALL_VERTICALS.filter((v) => userVerticals.includes(v.key))
    : ALL_VERTICALS;

  const isVerticalActive = (key: string) =>
    pathname === "/overview" || pathname === "/leaderboard"
      ? false // those pages manage their own vertical state
      : false;

  // ── Shared nav content ─────────────────────────────────────
  const navContent = (
    <>
      {/* Logo / header */}
      <div
        onClick={() => !isMobile && setCollapsed((c) => !c)}
        style={{
          height: "56px",
          display: "flex",
          alignItems: "center",
          padding: collapsed && !isMobile ? "0 8px" : "0 14px",
          borderBottom: "1px solid var(--border)",
          gap: collapsed && !isMobile ? "0" : "10px",
          flexShrink: 0,
          justifyContent: collapsed && !isMobile ? "center" : "flex-start",
          cursor: isMobile ? "default" : "pointer",
          transition: "background 0.13s",
        }}
        onMouseEnter={(e) => { if (!isMobile) e.currentTarget.style.background = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { if (!isMobile) e.currentTarget.style.background = "transparent"; }}
        title={isMobile ? "" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <div style={{
          width: "32px", height: "32px",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          background: "var(--bg-elevated)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        {(!collapsed || isMobile) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", userSelect: "none" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "15px", letterSpacing: "0.01em", color: "var(--accent-blue)", whiteSpace: "nowrap" }}>Repodar</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>GitHub AI Radar</span>
          </div>
        )}
        {/* Close button on mobile */}
        {isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); setMobileOpen(false); }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px", lineHeight: 1, padding: "4px" }}
            aria-label="Close menu"
          >✕</button>
        )}
      </div>

      {/* ── Nav items ───────────────────────────────── */}
      <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="sidebar-nav-link"
              style={{
                padding: collapsed && !isMobile ? "9px 0" : "9px 10px",
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "var(--cyan)" : "var(--text-secondary)",
                background: isActive ? "var(--cyan)0f" : "transparent",
                justifyContent: "center",
                borderLeft: isActive ? "2px solid var(--cyan)" : "2px solid transparent",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? "var(--cyan)" : "var(--text-muted)", flexShrink: 0, width: "17px" }}>
                {item.icon}
              </span>
              <span className="sidebar-label" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "13px", letterSpacing: "0" }}>{item.label}</span>
              <span className="sidebar-tooltip">{item.label}</span>
            </Link>
          );
        })}

        {/* ── Vertical Domain Filter ─────────────────────── */}
        {(!collapsed || isMobile) && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            {/* Section header with My/All toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 6px 8px",
            }}>
              <span style={{
                fontFamily: "var(--font-sans)",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
              }}>
                Domains
              </span>
              {userVerticals.length > 0 && (
                <div style={{ display: "flex", gap: "2px", background: "var(--bg-elevated)", borderRadius: "20px", padding: "2px" }}>
                  <button
                    onClick={() => setShowMyTopics(true)}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      background: showMyTopics ? "var(--accent-blue)" : "transparent",
                      color: showMyTopics ? "#fff" : "var(--text-muted)",
                    }}
                    title="Show your preferred verticals"
                  >
                    Mine
                  </button>
                  <button
                    onClick={() => setShowMyTopics(false)}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      background: !showMyTopics ? "var(--accent-blue)" : "transparent",
                      color: !showMyTopics ? "#fff" : "var(--text-muted)",
                    }}
                    title="Show all verticals"
                  >
                    All
                  </button>
                </div>
              )}
            </div>

            {/* Vertical pills */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {displayedVerticals.map(({ key, label, icon }) => {
                const isPreferred = userVerticals.includes(key);
                return (
                  <Link
                    key={key}
                    href={`/overview?vertical=${key}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      transition: "background 0.13s",
                      background: "transparent",
                      borderLeft: isPreferred ? "2px solid var(--accent-blue)" : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.07)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: "13px", flexShrink: 0, lineHeight: 1 }}>{icon}</span>
                    <span style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: isPreferred ? "var(--accent-blue)" : "var(--text-secondary)",
                      fontWeight: isPreferred ? 600 : 400,
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {label}
                    </span>
                    {isPreferred && (
                      <span style={{ fontSize: "8px", color: "var(--accent-blue)", flexShrink: 0 }}>✦</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsed state: show icon-only vertical dots */}
        {collapsed && !isMobile && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
            {ALL_VERTICALS.map(({ key, label, icon }) => (
              <Link
                key={key}
                href={`/overview?vertical=${key}`}
                title={label}
                style={{
                  width: "36px", height: "32px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "background 0.13s",
                  borderLeft: userVerticals.includes(key) ? "2px solid var(--accent-blue)" : "2px solid transparent",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {icon}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div
        style={{ padding: collapsed && !isMobile ? "12px 10px" : "12px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: collapsed && !isMobile ? "center" : "flex-start", gap: "8px" }}
      >
        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent-green)", flexShrink: 0 }} />
        {(!collapsed || isMobile) && (
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--accent-green)", fontWeight: 600, whiteSpace: "nowrap" }}>v2.0 · Online</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", marginTop: "1px" }}>AI/ML Ecosystem Tracker</div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <style>{`
        .sidebar-nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          text-decoration: none;
          transition: background 0.13s, color 0.13s;
          position: relative;
          cursor: pointer;
          border-radius: 6px;
        }
        .sidebar-nav-link:hover {
          background: rgba(88,166,255,0.07) !important;
          color: var(--accent-blue) !important;
        }
        .sidebar-nav-link:hover svg {
          color: var(--accent-blue) !important;
          stroke: var(--accent-blue) !important;
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
          font-family: var(--font-sans);
          font-weight: 500;
          padding: 5px 10px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 200;
          border-radius: 5px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
      `}</style>

      {/* ── Desktop Sidebar ─────────────────────────── */}
      {!isMobile && (
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
            zIndex: 50,
          }}
        >
          {navContent}
        </div>
      )}

      {/* ── Mobile Drawer ───────────────────────────── */}
      {isMobile && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 60,
              opacity: mobileOpen ? 1 : 0,
              pointerEvents: mobileOpen ? "auto" : "none",
              transition: "opacity 0.25s ease",
            }}
          />
          {/* Drawer */}
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              height: "100vh",
              width: "280px",
              background: "var(--bg-surface)",
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              overflowX: "hidden",
              zIndex: 70,
              transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.25s ease",
            }}
          >
            {navContent}
          </div>
        </>
      )}
    </>
  );
}
