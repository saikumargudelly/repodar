"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { SignOutButton, useAuth, useUser } from "@clerk/nextjs";
import { useTheme, Theme } from "@/components/Providers";

const NAV_LINKS = [
  { href: "/overview", label: "Overview" },
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
  const [flashKey, setFlashKey] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const profileActive = pathname === "/profile";
  const profileName = user?.firstName ?? user?.fullName ?? "Profile";
  const profileInitials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || profileName.slice(0, 2).toUpperCase();

  const handleThemeSwitch = (t: Theme) => {
    if (t === theme) return;
    setTheme(t);
    setFlashKey((k) => k + 1);
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

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
          {/* Right side: Theme switcher + Report + User menu + Hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {isLoaded && userId ? (
              /* ── Avatar button + dropdown ─────────────────────────────── */
              <div ref={userMenuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  title={profileName}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "4px 10px 4px 5px",
                    borderRadius: "20px",
                    border: userMenuOpen
                      ? "1px solid var(--accent-blue)"
                      : "1px solid var(--border)",
                    background: userMenuOpen
                      ? "var(--accent-blue)1a"
                      : "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {/* Initials avatar */}
                  <span
                    style={{
                      width: "26px",
                      height: "26px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      background: "var(--accent-blue)",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                      flexShrink: 0,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {profileInitials}
                  </span>
                  <span className="nav-description">{profileName}</span>
                  {/* Chevron */}
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    style={{
                      transition: "transform 0.2s",
                      transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      minWidth: "170px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
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
                        {user?.primaryEmailAddress?.emailAddress ?? ""}
                      </div>
                    </div>

                    {/* Profile link */}
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        color: profileActive ? "var(--accent-blue)" : "var(--text-primary)",
                        background: profileActive ? "var(--accent-blue)12" : "transparent",
                        textDecoration: "none",
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        fontWeight: 500,
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => { if (!profileActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                      onMouseLeave={(e) => { if (!profileActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M2 12c0-2.21 2.24-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      Profile
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
            ) : (
              <Link
                href="/sign-in"
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Sign in
              </Link>
            )}

            {/* Theme switcher */}
            <div className="nav-theme-switcher" style={{ display: "flex", gap: "2px", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "3px", borderRadius: "6px" }}>
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
                  <span className="nav-theme-label">{t.label}</span>
                  <span style={{ display: "none" }} className="nav-theme-dot" aria-hidden="true">●</span>
                </button>
              ))}
            </div>

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

    </>
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
