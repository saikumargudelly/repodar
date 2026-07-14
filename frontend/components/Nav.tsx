"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { useUnreadAlerts } from "@/lib/useUnreadAlerts";
import Logo from "@/components/Logo";

export function Nav({ onOpenAlerts }: { onOpenAlerts?: () => void }) {
  const [isMobile, setIsMobile] = useState(false);
  const { isLoaded, userId } = useAuth();

  const { unreadCount } = useUnreadAlerts();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile) return null;

  return (
    <nav
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "56px",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", userSelect: "none" }}>
        <Logo size={22} showText={true} />
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Bell button */}
        <button
          onClick={onOpenAlerts}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px",
          }}
          aria-label="Alerts"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: "15px",
              height: "15px",
              borderRadius: "8px",
              background: "var(--accent-red)",
              color: "#ffffff",
              fontSize: "9px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
              boxShadow: "0 0 0 2px var(--bg-surface)",
            }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Hamburger toggle */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("mobile-sidebar-toggle"))}
          aria-label="Open menu"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: "24px",
            lineHeight: 1,
            padding: "4px 8px",
          }}
        >
          ☰
        </button>
      </div>
    </nav>
  );
}

/**
 * SustainBadge — DEPRECATED shim.
 * All callers should migrate to: import { StatusDot } from "@/components/ui/StatusDot"
 */
export function SustainBadge({ label }: { label: string }) {
  const { StatusDot } = require("@/components/ui/StatusDot");
  return <StatusDot label={label} size="sm" />;
}
