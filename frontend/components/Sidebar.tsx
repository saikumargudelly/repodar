"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { useUnreadAlerts } from "@/lib/useUnreadAlerts";
import Logo from "@/components/Logo";

// Icons matching the design mockup and spec
const OverviewIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-overview">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);

const ExploreIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-explore">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="11" y1="8" x2="11" y2="14"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);

const TopicsIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-topics">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const RadarIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-radar">
    <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/>
    <path d="M4 6h.01"/>
    <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const LeaderboardIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-leaderboard">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const CompareIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-compare">
    <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
  </svg>
);

const ResearchIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-research">
    <path d="M6 18h8M3 22h18M14 22a7 7 0 1 0-14 0M9 14h2M9 12a3 3 0 0 1 6 0V6" />
    <path d="M12 2v4M11 4h2" />
  </svg>
);

const CollectionsIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-collections">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>
);

const WatchlistIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-watchlist">
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const OrgHealthIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-orgs">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <path d="m17 9-3-3-3 6-3-3" />
  </svg>
);

const WeeklyIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-weekly">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const ProfileIcon = (
  <svg width="17" height="17" viewBox="0 0 14 14" fill="none" className="nav-icon-profile">
    <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M2 12c0-2.21 2.24-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: OverviewIcon },
  { href: "/radar", label: "Radar", icon: RadarIcon },
  { href: "/watchlist", label: "Watchlist", icon: WatchlistIcon },
  { href: "/research", label: "Research", icon: ResearchIcon, badge: { text: "β", type: "dark" } },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isLoaded: authLoaded, userId } = useAuth();
  const { user } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [moreToolsMenuOpen, setMoreToolsMenuOpen] = useState(false);
  const moreToolsMenuRef = useRef<HTMLDivElement>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Fetch unread alerts for dynamic radar badge
  const { unreadCount } = useUnreadAlerts();

  // Sync tab title with alert count
  useEffect(() => {
    if (typeof document !== "undefined") {
      const baseTitle = "Repodar";
      const currentTitle = document.title.replace(/^\(\d+\+?\)\s*/, "");
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) ${currentTitle || baseTitle}`;
      } else {
        document.title = currentTitle || baseTitle;
      }
    }
  }, [unreadCount]);

  // Extract user details
  const profileName = user?.firstName ?? user?.fullName ?? "Saikumar";
  const profileEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const profileInitials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || profileName.slice(0, 2).toUpperCase();

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
      isMobile ? "0px" : collapsed ? "56px" : "240px"
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

  // Click outside listener for profile menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  // Click outside listener for more tools menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreToolsMenuRef.current && !moreToolsMenuRef.current.contains(e.target as Node)) {
        setMoreToolsMenuOpen(false);
      }
    }
    if (moreToolsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [moreToolsMenuOpen]);

  // Whether a nav item is the active route (supports nested paths like /collections/xyz)
  const isNavActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

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
          padding: collapsed && !isMobile ? "0" : "0 14px",
          borderBottom: "1px solid var(--border)",
          gap: collapsed && !isMobile ? "0" : "10px",
          flexShrink: 0,
          justifyContent: collapsed && !isMobile ? "center" : "flex-start",
          cursor: isMobile ? "default" : "pointer",
          transition: "background 0.13s, padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), gap 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onMouseEnter={(e) => { if (!isMobile) e.currentTarget.style.background = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { if (!isMobile) e.currentTarget.style.background = "transparent"; }}
        title={isMobile ? "" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <div className="brand-icon" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "24px" }}>
          <Logo size={22} />
        </div>
        <div 
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            userSelect: "none",
            maxHeight: collapsed && !isMobile ? "0" : "40px",
            maxWidth: collapsed && !isMobile ? "0" : "160px",
            opacity: collapsed && !isMobile ? 0 : 1,
            overflow: "hidden",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            marginLeft: collapsed && !isMobile ? "0" : "10px",
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "15px", letterSpacing: "0.01em", color: "var(--text-primary)", whiteSpace: "nowrap" }}>Repodar</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>GitHub AI Radar</span>
        </div>
        {/* Close button on mobile */}
        {isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); setMobileOpen(false); }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px", lineHeight: 1, padding: "4px" }}
            aria-label="Close menu"
          >✕</button>
        )}
      </div>

      {/* Search shortcut button (command palette) */}
      <div style={{ padding: "0 10px", margin: "8px 0" }}>
        <button
          onClick={() => setCommandPaletteOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-muted)",
            fontSize: "12.5px",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "var(--font-sans)",
            justifyContent: collapsed && !isMobile ? "center" : "space-between",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.borderColor = "var(--text-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          {collapsed && !isMobile ? (
            <span>🔍</span>
          ) : (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>🔍 <span style={{ color: "var(--text-muted)" }}>Search...</span></span>
              <kbd style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid var(--border)",
                borderRadius: "3px",
                padding: "1px 5px",
                fontSize: "9px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                lineHeight: 1
              }}>⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Nav items ───────────────────────────────── */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = isNavActive(item.href);
          const badgeText = item.badge?.text ?? null;
          const badgeType = item.badge?.type ?? "dark";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-link ${isActive ? "active" : ""}`}
              style={{
                padding: collapsed && !isMobile ? "9px 0" : "9px 12px",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "rgba(255, 255, 255, 0.035)" : "transparent",
                justifyContent: collapsed && !isMobile ? "center" : "flex-start",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? "var(--text-primary)" : "var(--text-muted)", flexShrink: 0, width: "17px" }}>
                {item.icon}
              </span>
              <span className="sidebar-label" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "13px", letterSpacing: "0" }}>{item.label}</span>
              {badgeText && (
                <span style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: collapsed && !isMobile ? "0" : (badgeText === "β" ? "1px 5px" : "2px 8px"),
                  borderRadius: "10px",
                  lineHeight: 1,
                  marginRight: collapsed && !isMobile ? "0" : "4px",
                  display: collapsed && !isMobile ? "none" : "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  maxHeight: collapsed && !isMobile ? "0" : "18px",
                  maxWidth: collapsed && !isMobile ? "0" : "40px",
                  opacity: collapsed && !isMobile ? 0 : 1,
                  overflow: "hidden",
                  transition: "all 0.25s ease",
                  flexShrink: 0,
                  ...(badgeType === "peach" ? {
                    background: "#ffebe9",
                    color: "#a51d24",
                  } : {
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  })
                }}>
                  {badgeText}
                </span>
              )}
              {collapsed && !isMobile && (
                <span className="sidebar-tooltip">{item.label}</span>
              )}
            </Link>
          );
        })}

        {/* More Tools Dropdown and Trigger */}
        <div ref={moreToolsMenuRef} style={{ position: "relative", width: "100%" }}>
          <button
            onClick={() => setMoreToolsMenuOpen(!moreToolsMenuOpen)}
            className={`sidebar-nav-link ${moreToolsMenuOpen ? "active" : ""}`}
            style={{
              width: "100%",
              border: "none",
              background: moreToolsMenuOpen ? "rgba(255, 255, 255, 0.035)" : "transparent",
              cursor: "pointer",
              padding: collapsed && !isMobile ? "9px 0" : "9px 12px",
              fontWeight: 400,
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed && !isMobile ? "center" : "flex-start",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0, width: "17px" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="6" height="6" rx="1" />
                <rect x="14" y="4" width="6" height="6" rx="1" />
                <rect x="4" y="14" width="6" height="6" rx="1" />
                <polygon points="14 17 17 14 20 17 17 20" />
              </svg>
            </span>
            <span className="sidebar-label" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "13px", letterSpacing: "0", textAlign: "left", marginLeft: collapsed && !isMobile ? "0" : "10px", display: collapsed && !isMobile ? "none" : "block" }}>More Tools</span>
            {!collapsed && (
              <span style={{ fontSize: "9px", color: "var(--text-muted)", marginRight: "4px" }}>
                {moreToolsMenuOpen ? "▼" : "▶"}
              </span>
            )}
            {collapsed && !isMobile && (
              <span className="sidebar-tooltip">More Tools</span>
            )}
          </button>

          {/* More Tools Dropdown Popup */}
          {moreToolsMenuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: collapsed && !isMobile ? "0px" : "auto",
                top: collapsed && !isMobile ? "auto" : "calc(100% + 4px)",
                left: collapsed && !isMobile ? "calc(100% + 8px)" : "0px",
                right: collapsed && !isMobile ? "auto" : "0px",
                minWidth: "180px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                zIndex: 200,
                overflow: "hidden",
                animation: "fadeSlideDown 0.15s ease",
              }}
            >
              {/* Explore Link */}
              <Link
                href="/explore"
                onClick={() => setMoreToolsMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  background: pathname === "/explore" ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (pathname !== "/explore") (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (pathname !== "/explore") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  {ExploreIcon}
                </span>
                Explore
              </Link>

              {/* Topics Link */}
              <Link
                href="/topics"
                onClick={() => setMoreToolsMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  background: pathname === "/topics" ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (pathname !== "/topics") (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (pathname !== "/topics") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  {TopicsIcon}
                </span>
                Topics
              </Link>

              {/* Org Scanner Link */}
              <Link
                href="/orgs"
                onClick={() => setMoreToolsMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  background: pathname === "/orgs" ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (pathname !== "/orgs") (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (pathname !== "/orgs") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  {OrgHealthIcon}
                </span>
                Org Scanner
              </Link>

              {/* WeeklySnapshots Link */}
              <Link
                href="/weekly"
                onClick={() => setMoreToolsMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  background: pathname === "/weekly" ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (pathname !== "/weekly") (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (pathname !== "/weekly") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  {WeeklyIcon}
                </span>
                Weekly Digests
              </Link>

              {/* Collections Link */}
              <Link
                href="/collections"
                onClick={() => setMoreToolsMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  background: pathname === "/collections" ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (pathname !== "/collections") (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (pathname !== "/collections") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  {CollectionsIcon}
                </span>
                Collections
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer Profile Card */}
      {authLoaded && userId && (
        <div 
          ref={profileMenuRef} 
          style={{ 
            position: "relative", 
            borderTop: "1px solid var(--border)", 
            padding: collapsed && !isMobile ? "8px 8px 36px 8px" : "10px 10px 36px 10px", 
            flexShrink: 0,
            transition: "padding 0.25s ease",
          }}
        >
          {/* Profile Card Button */}
          <div
            onClick={() => setProfileMenuOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: collapsed && !isMobile ? "4px 0" : "6px 8px",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "background 0.15s, padding 0.25s ease",
              background: profileMenuOpen ? "var(--bg-elevated)" : "transparent",
              justifyContent: collapsed && !isMobile ? "center" : "flex-start",
              gap: collapsed && !isMobile ? "0" : "10px",
              width: "100%",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
            onMouseLeave={(e) => { if (!profileMenuOpen) e.currentTarget.style.background = "transparent"; }}
          >
            {/* Avatar circle */}
            <div style={{
              width: collapsed && !isMobile ? "30px" : "38px",
              height: collapsed && !isMobile ? "30px" : "38px",
              borderRadius: "50%",
              background: "#ffffff",
              color: "#0d1117",
              border: "1.5px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: collapsed && !isMobile ? "11px" : "13px",
              flexShrink: 0,
              transition: "all 0.25s ease",
            }}>
              {profileInitials}
            </div>

            <div 
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
                maxHeight: collapsed && !isMobile ? "0" : "36px",
                maxWidth: collapsed && !isMobile ? "0" : "140px",
                opacity: collapsed && !isMobile ? 0 : 1,
                overflow: "hidden",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                marginLeft: collapsed && !isMobile ? "0" : "10px",
              }}
            >
              <span style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: "13px",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {profileName}
              </span>
              <span style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                marginTop: "1px",
              }}>
                v2.0 · Pro
              </span>
            </div>

            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                maxHeight: collapsed && !isMobile ? "0" : "24px",
                maxWidth: collapsed && !isMobile ? "0" : "24px",
                opacity: collapsed && !isMobile ? 0 : 1,
                overflow: "hidden",
                transition: "all 0.25s ease",
              }}
            >
              {/* Vertical ellipsis ⋮ */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.2" />
                <circle cx="12" cy="5" r="1.2" />
                <circle cx="12" cy="19" r="1.2" />
              </svg>
            </button>
          </div>

          {/* Popup Dropdown Menu */}
          {profileMenuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: collapsed && !isMobile ? "36px" : "calc(100% + 8px)",
                left: collapsed && !isMobile ? "calc(100% + 8px)" : "8px",
                right: collapsed && !isMobile ? "auto" : "8px",
                minWidth: "180px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                zIndex: 200,
                overflow: "hidden",
                animation: "fadeSlideDown 0.15s ease",
              }}
            >
              {/* User info header */}
              <div
                style={{
                  padding: "12px 14px 10px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
                  {profileName}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profileEmail}
                </div>
              </div>

              {/* Profile Link */}
              <Link
                href="/profile"
                onClick={() => setProfileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  background: pathname === "/profile" ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (pathname !== "/profile") (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (pathname !== "/profile") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M2 12c0-2.21 2.24-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Profile
              </Link>

              {/* Settings Link */}
              <Link
                href="/settings"
                onClick={() => setProfileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  background: pathname === "/settings" ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (pathname !== "/settings") (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (pathname !== "/settings") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
              </Link>

              {/* Divider */}
              <div style={{ height: "1px", background: "var(--border)", margin: "0 10px" }} />

              {/* Sign out */}
              <SignOutButton redirectUrl="/landing">
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    color: "#f87171",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M9.5 9.5L12 7l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Sign out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      )}

      {authLoaded && !userId && (
        <div style={{ borderTop: "1px solid var(--border)", padding: collapsed && !isMobile ? "12px 6px 36px 6px" : "16px 12px 36px 12px", flexShrink: 0 }}>
          <Link
            href="/sign-in"
            style={{
              display: "block",
              textAlign: "center",
              fontSize: "12px",
              fontWeight: 600,
              padding: "8px 12px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #d29922 0%, #b07e15 100%)",
              color: "var(--bg-primary)",
              textDecoration: "none",
            }}
          >
            {collapsed && !isMobile ? "🔑" : "Sign In"}
          </Link>
        </div>
      )}
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
          transition: background 0.13s, color 0.13s, padding 0.25s ease, border-left 0.25s ease;
          position: relative;
          cursor: pointer;
          border-radius: 6px;
        }
        .sidebar-nav-link:hover {
          background: rgba(255,255,255,0.05) !important;
          color: var(--text-primary) !important;
        }
        .sidebar-nav-link svg {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .sidebar-nav-link:hover .nav-icon-overview {
          animation: overview-wiggle 0.6s ease-in-out infinite;
        }
        .sidebar-nav-link:hover .nav-icon-explore {
          animation: explore-scan 0.8s ease-in-out infinite;
        }
        .sidebar-nav-link:hover .nav-icon-topics {
          animation: topics-swing 0.6s ease-in-out infinite;
          transform-origin: top left;
        }
        .sidebar-nav-link:hover .nav-icon-radar {
          animation: radar-sweep 1.5s linear infinite;
        }
        .sidebar-nav-link:hover .nav-icon-leaderboard {
          animation: leaderboard-trophy 0.8s ease-in-out infinite;
        }
        .sidebar-nav-link:hover .nav-icon-compare {
          animation: compare-bars 0.6s ease-in-out infinite;
          transform-origin: bottom;
        }
        .sidebar-nav-link:hover .nav-icon-research {
          animation: research-float 0.8s ease-in-out infinite;
        }
        .sidebar-nav-link:hover .nav-icon-collections {
          animation: collections-bookmark 0.6s ease-in-out infinite;
        }
        .sidebar-nav-link:hover .nav-icon-watchlist {
          animation: watchlist-eye 0.7s ease-in-out infinite;
        }
        .sidebar-nav-link:hover .nav-icon-orgs {
          animation: orgs-pulse 0.7s ease-in-out infinite;
        }
        .sidebar-nav-link:hover .nav-icon-weekly {
          animation: weekly-shake 0.5s ease-in-out infinite;
        }
        @keyframes overview-wiggle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15) rotate(5deg); }
        }
        @keyframes explore-scan {
          0%, 100% { transform: translate(0, 0) scale(1.1); }
          25% { transform: translate(2px, -2px) scale(1.1); }
          75% { transform: translate(-1px, 1px) scale(1.1); }
        }
        @keyframes topics-swing {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-12deg); }
        }
        @keyframes radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes leaderboard-trophy {
          0%, 100% { transform: translateY(0) scale(1.1); }
          50% { transform: translateY(-3px) scale(1.15) rotate(5deg); }
        }
        @keyframes compare-bars {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.25); }
        }
        @keyframes research-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px) rotate(-3deg); }
        }
        @keyframes collections-bookmark {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15) rotate(-5deg); }
        }
        @keyframes watchlist-eye {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2) rotate(10deg); }
        }
        @keyframes orgs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1) translate(1px, -1px); }
        }
        @keyframes weekly-shake {
          0%, 100% { transform: rotate(0deg); }
          20%, 60% { transform: rotate(-8deg); }
          40%, 80% { transform: rotate(8deg); }
        }
        .sidebar-nav-link.active svg {
          animation: icon-bounce 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        @keyframes icon-bounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.2) translateY(-1px); }
          100% { transform: scale(1) translateY(0); }
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
          transition: opacity 0.2s ease, max-width 0.25s ease, margin-left 0.25s ease;
          max-width: 160px;
          opacity: 1;
          margin-left: 10px;
        }
        .sidebar-collapsed .sidebar-label {
          max-width: 0;
          opacity: 0;
          margin-left: 0;
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
            width: collapsed ? "56px" : "240px",
            background: "var(--bg-surface)",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
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

      <CommandPalette isOpen={commandPaletteOpen} setIsOpen={setCommandPaletteOpen} />
    </>
  );
}
