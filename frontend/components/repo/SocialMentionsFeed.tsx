"use client";

import React from "react";
import { SocialMentionItem } from "@/lib/api";

interface SocialMentionsFeedProps {
  mentions: SocialMentionItem[];
}

export function SocialMentionsFeed({ mentions }: SocialMentionsFeedProps) {
  if (!mentions || mentions.length === 0) return null;

  const platformIcon = (p: string) => p === "hn" ? "🔶" : "🟠";
  const platformLabel = (p: string, sub?: string | null) =>
    p === "hn" ? "Hacker News" : sub ? `r/${sub}` : "Reddit";

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
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            Community mentions — HN &amp; Reddit
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "320px", overflowY: "auto", paddingRight: "8px" }}>
          {mentions.slice(0, 8).map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
              <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "2px" }}>{platformIcon(m.platform)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={m.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    fontSize: "13px", 
                    fontWeight: 600, 
                    color: "#58a6ff", 
                    textDecoration: "none", 
                    display: "block", 
                    marginBottom: "4px",
                    lineHeight: "1.4",
                    transition: "color 0.15s ease" 
                  }}
                  className="hover:text-blue-400"
                >
                  {m.post_title || "(no title)"}
                </a>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {platformLabel(m.platform, m.subreddit)} · {m.upvotes} pts · {m.posted_at.slice(0, 10)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
