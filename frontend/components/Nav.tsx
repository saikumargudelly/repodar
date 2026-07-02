"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";

export function Nav({ onOpenAlerts }: { onOpenAlerts?: () => void }) {
  const [isMobile, setIsMobile] = useState(false);
  const { isLoaded, userId } = useAuth();

  const { data: alertsData } = useQuery({
    queryKey: ["sidebar-alerts"],
    queryFn: () => api.getAlerts(true, 200),
    enabled: isLoaded && !!userId,
    refetchInterval: 30000,
  });
  const unreadCount = alertsData?.length ?? 0;

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
      <div style={{ display: "flex", alignItems: "center", gap: "10px", userSelect: "none" }}>
        <div className="brand-icon" style={{ width: "24px", height: "24px" }}>
          {/* Konoha Leaf brand symbol */}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path d="M12,4 C7.58,4 4,7.58 4,12 C4,16.42 7.58,20 12,20 C14,20 15.8,19.2 17.2,17.8 L18.5,19.1 C16.8,20.9 14.5,22 12,22 C6.48,22 2,17.52 2,12 C2,6.48 6.48,2 12,2 C17,2 20.5,5 21,5.5 L18,8.5 L22,9 L21.5,5 L19.5,7 C18.2,5.2 15.2,4 12,4 Z" fill="currentColor" />
            <path d="M12,8 C9.79,8 8,9.79 8,12 C8,14.21 9.79,16 12,16 C13.5,16 14.8,15.2 15.5,14 L13.5,13 C13.2,13.6 12.6,14 12,14 C10.9,14 10,13.1 10,12 C10,10.9 10.9,10 12,10 C13.1,10 14,10.9 14,12" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5,19 L3,21" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Repodar</span>
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
