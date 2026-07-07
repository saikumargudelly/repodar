"use client";

import React from "react";
import { HealthBadge } from "./HealthBadge";

interface RepoHeaderProps {
  repo: any;
  watchStatus: any;
  toggleWatch: () => void;
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
  latest: any;
  trendChangePct: number;
  velChangePct: number;
}

function formatDateFriendly(dateStr: string) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

export function RepoHeader({
  repo,
  watchStatus,
  toggleWatch,
  pinned,
  setPinned,
  latest,
  trendChangePct,
  velChangePct,
}: RepoHeaderProps) {
  const getVelocityText = (vel: number) => {
    if (vel >= 10) return "Growing";
    if (vel >= 1) return "Stable";
    return "Flat";
  };

  const getSustainabilityText = (score: number) => {
    if (score >= 0.7) return "Healthy";
    if (score >= 0.4) return "Medium Risk";
    return "High Risk";
  };

  const contributorCount = latest?.contributors ?? 0;
  const lastFetched = repo.last_fetched_at ? formatDateFriendly(repo.last_fetched_at) : "Recent";

  return (
    <div 
      className="repo-hero-container"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px 20px",
        background: "rgba(38, 37, 36, 0.2)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Row 1: Title & Action Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1 
            style={{ 
              fontSize: "20px", 
              fontWeight: 700, 
              color: "var(--text-primary)", 
              fontFamily: "var(--font-sans)",
              letterSpacing: "-0.02em",
              margin: 0
            }}
          >
            {repo.owner}/<span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{repo.name}</span>
          </h1>
          {repo.sustainability_label && (
            <HealthBadge label={repo.sustainability_label} />
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={toggleWatch}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: watchStatus?.watching ? "1px solid var(--accent-green)" : "1px solid var(--border)",
              background: watchStatus?.watching ? "rgba(63, 185, 80, 0.1)" : "rgba(255, 255, 255, 0.02)",
              color: watchStatus?.watching ? "var(--accent-green)" : "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            {watchStatus?.watching ? "Watching" : "Watch"}
          </button>

          <button
            onClick={() => setPinned(!pinned)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: pinned ? "1px solid var(--accent-yellow)" : "1px solid var(--border)",
              background: pinned ? "rgba(210, 153, 34, 0.1)" : "rgba(255, 255, 255, 0.02)",
              color: pinned ? "var(--accent-yellow)" : "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="22" y2="12"></line><path d="M12 2L2 12h10L12 2z"></path></svg>
            {pinned ? "Pinned" : "Pin"}
          </button>

          <a
            href={repo.github_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "rgba(255, 255, 255, 0.02)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              textDecoration: "none",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>

      {/* Row 2: Description */}
      <p 
        style={{ 
          fontSize: "13px", 
          color: "var(--text-secondary)", 
          marginTop: "10px", 
          marginBottom: "12px",
          lineHeight: "1.5",
          maxWidth: "900px"
        }}
      >
        {repo.description || "No project description available in database."}
      </p>

      {/* Row 3: Divider */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0 12px 0" }} />

      {/* Row 4: High-Density Intelligence Snapshot Strip */}
      <div 
        className="grid grid-cols-2 md:grid-cols-5 gap-4" 
        style={{ 
          fontFamily: "var(--font-mono)", 
          fontSize: "11px",
          color: "var(--text-muted)"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>Category</span>
          <span style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{repo.category}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>Health Status</span>
          <div>
            <span style={{ color: "var(--accent-green)", fontWeight: 600, marginRight: "6px" }}>
              {getSustainabilityText(repo.sustainability_score ?? 0)}
            </span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              ({repo.sustainability_score?.toFixed(2) ?? "—"})
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>Adoption Growth</span>
          <div>
            <span style={{ color: "var(--text-primary)", fontWeight: 600, marginRight: "6px" }}>
              {getVelocityText(repo.star_velocity_7d ?? 0)}
            </span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              (+{repo.star_velocity_7d?.toFixed(1) ?? "—"}/d)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>Community Scope</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            {contributorCount.toLocaleString()} committers
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>Last Ingested</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lastFetched}</span>
        </div>
      </div>

    </div>
  );
}
