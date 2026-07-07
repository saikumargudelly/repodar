"use client";

import React from "react";
import { ReleaseItem } from "@/lib/api";

interface ReleaseChangelogProps {
  releases: ReleaseItem[];
  owner: string;
  name: string;
}

export function ReleaseChangelog({ releases, owner, name }: ReleaseChangelogProps) {
  if (!releases || releases.length === 0) return null;

  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div>
        <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 12 }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            Recent releases
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "320px", overflowY: "auto", paddingRight: "8px" }}>
          {releases.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                <a
                  href={r.html_url || `https://github.com/${owner}/${name}/releases/tag/${r.tag_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    fontFamily: "var(--font-mono)", 
                    fontSize: "12px", 
                    fontWeight: 700, 
                    color: "#58a6ff", 
                    textDecoration: "none",
                    transition: "color 0.15s ease" 
                  }}
                  className="hover:text-blue-400"
                >
                  {r.tag_name}
                </a>
                {r.is_prerelease && (
                  <span 
                    style={{ 
                      fontSize: "10px", 
                      background: "rgba(210, 153, 34, 0.1)", 
                      color: "var(--accent-yellow)", 
                      padding: "1px 6px", 
                      borderRadius: "4px", 
                      fontFamily: "var(--font-mono)",
                      border: "1px solid rgba(210, 153, 34, 0.2)"
                    }}
                  >
                    PRE-RELEASE
                  </span>
                )}
                <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {r.published_at.slice(0, 10)}
                </span>
                {r.name && r.name !== r.tag_name && (
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{r.name}</span>
                )}
              </div>
              {r.body_truncated && (
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {r.body_truncated}
                  {r.body_truncated.length >= 500 ? "…" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
