"use client";

import React from "react";

interface AIIntelligenceCardProps {
  deepSummary: any;
  deepLoading: boolean;
  repoSummary: string | null;
  formatDateFriendly: (dateStr: string) => string;
}

export function AIIntelligenceCard({
  deepSummary,
  deepLoading,
  repoSummary,
  formatDateFriendly,
}: AIIntelligenceCardProps) {
  if (deepLoading) {
    return (
      <div 
        className="panel card-pad" 
        style={{ 
          borderLeft: "3px solid var(--accent-blue)",
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderLeftWidth: "3px",
          borderLeftColor: "var(--accent-blue)",
          borderRadius: "8px",
          padding: "20px 24px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-blue)", boxShadow: "0 0 8px var(--accent-blue)", animation: "pulse 1.5s infinite" }} />
            AI DEEP ANALYSIS
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px", letterSpacing: "0.06em", margin: 0 }}>
          // GENERATING TELEMETRY ANALYSIS…<span className="terminal-cursor" />
        </p>
      </div>
    );
  }

  if (deepSummary) {
    return (
      <div 
        className="panel card-pad" 
        style={{ 
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderLeftWidth: "3px",
          borderLeftColor: "var(--accent-blue)",
          borderRadius: "8px",
          padding: "20px 24px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
        }}
      >
        <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-blue)" }} />
            AI deep analysis
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {formatDateFriendly(deepSummary.generated_at)}
          </span>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
          {[
            { key: "What", value: deepSummary.what, badgeBg: "rgba(88, 166, 255, 0.12)", badgeColor: "var(--text-primary)" },
            { key: "Why", value: deepSummary.why, badgeBg: "rgba(63, 185, 80, 0.12)", badgeColor: "var(--accent-green)" },
            { key: "How", value: deepSummary.how, badgeBg: "rgba(210, 153, 34, 0.12)", badgeColor: "var(--accent-yellow)" },
          ].map(({ key, value, badgeBg, badgeColor }) => value && (
            <div key={key} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: "bold",
                fontFamily: "var(--font-sans)",
                background: badgeBg,
                color: badgeColor,
                minWidth: "50px",
                textAlign: "center",
                flexShrink: 0,
                border: `1px solid rgba(${badgeColor === "var(--accent-green)" ? "63, 185, 80" : badgeColor === "var(--accent-yellow)" ? "210, 153, 34" : "255, 255, 255"}, 0.15)`
              }}>{key}</span>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6" }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (repoSummary) {
    return (
      <div 
        className="panel card-pad" 
        style={{ 
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderLeftWidth: "3px",
          borderLeftColor: "var(--accent-blue)",
          borderRadius: "8px",
          padding: "20px 24px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
        }}
      >
        <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
            AI summary
          </span>
        </div>
        <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "13px", margin: "12px 0 0 0" }}>
          {repoSummary}
        </p>
      </div>
    );
  }

  return null;
}
