"use client";

import { useState, useEffect } from "react";

export function Nav() {
  const [isMobile, setIsMobile] = useState(false);

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
        background: "var(--bg-surface)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        height: "56px",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", userSelect: "none" }}>
        <div style={{
          width: "28px", height: "28px",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          background: "var(--bg-elevated)",
        }}>
          {/* Concentric circle logo */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
          </svg>
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Repodar</span>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("mobile-sidebar-toggle"))}
        aria-label="Open menu"
        style={{
          marginLeft: "auto",
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
    </nav>
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
