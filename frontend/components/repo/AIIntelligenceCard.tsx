"use client";

import React from "react";

interface AIIntelligenceCardProps {
  deepSummary: any;
  deepLoading: boolean;
  deepError?: any;
  repoSummary: string | null;
  /** LLM trend explanation from computed_metrics (3-5 sentences, top-20 repos only). */
  trendExplanation?: string | null;
  formatDateFriendly: (dateStr: string) => string;
}

export function AIIntelligenceCard({
  deepSummary,
  deepLoading,
  deepError,
  repoSummary,
  trendExplanation,
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

  if (deepError) {
    return (
      <div 
        className="panel card-pad" 
        style={{ 
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderLeftWidth: "3px",
          borderLeftColor: "var(--accent-red, #ff4d4f)",
          borderRadius: "8px",
          padding: "20px 24px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
        }}
      >
        <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-red, #ff4d4f)" }} />
            AI deep analysis unavailable
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
          <div style={{ background: "rgba(255, 77, 79, 0.08)", border: "1px solid rgba(255, 77, 79, 0.15)", borderRadius: "6px", padding: "12px 16px" }}>
            <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 600, margin: "0 0 4px 0" }}>
              ⚠️ Live Generation Failed
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: 0, lineHeight: "1.5" }}>
              The live AI analysis pipeline encountered rate limits or connection timeouts across configured LLM providers.
            </p>
          </div>
          {repoSummary && (
            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: "16px" }}>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", margin: "0 0 8px 0" }}>
                // Basic Repository Summary (Fallback)
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                {repoSummary}
              </p>
            </div>
          )}
          {/* Trend explanation as second fallback when neither deep summary section nor repoSummary is available */}
          {!repoSummary && trendExplanation && (
            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: "16px" }}>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", margin: "0 0 8px 0" }}>
                // AI Trend Insight (Pipeline)
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                {trendExplanation}
              </p>
            </div>
          )}
        </div>
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
            AI deep analysis (Verified Live LLM)
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

  // Tier 2: trendExplanation (from computed_metrics.explanation — pipeline-generated for top-20)
  if (trendExplanation) {
    return (
      <div
        className="panel card-pad"
        style={{
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderLeftWidth: "3px",
          borderLeftColor: "var(--accent-yellow)",
          borderRadius: "8px",
          padding: "20px 24px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        }}
      >
        <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-yellow)" }} />
            AI Trend Insight
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Pipeline · top-20 analysis
          </span>
        </div>
        <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "13px", margin: "12px 0 0 0" }}>
          {trendExplanation}
        </p>
      </div>
    );
  }

  // Tier 3: repoSummary (plain LLM repo summary — background job)
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
            Basic Repository Summary (Fallback)
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
