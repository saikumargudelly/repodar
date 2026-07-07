"use client";

import React from "react";

interface LanguageBreakdownProps {
  languages: Record<string, number>;
}

export function LanguageBreakdown({ languages }: LanguageBreakdownProps) {
  if (!languages || Object.keys(languages).length === 0) return null;

  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(languages).sort(([, a], [, b]) => b - a);
  const COLORS = ["#818cf8", "#ff9f43", "var(--accent-green)", "var(--accent-red)", "#9d7fff", "#ff9944", "#44aaff", "#ff44aa"];

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
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
          &lt;/ &gt; Language breakdown
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "12px" }}>
        <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", width: "100%" }}>
          {sorted.map(([lang, bytes], i) => (
            <div 
              key={lang} 
              title={`${lang}: ${((bytes / total) * 100).toFixed(1)}%`}
              style={{ 
                width: `${(bytes / total) * 100}%`, 
                background: COLORS[i % COLORS.length], 
                minWidth: "2px" 
              }} 
            />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: "16px" }}>
          {sorted.slice(0, 6).map(([lang, bytes], i) => (
            <div 
              key={lang} 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                fontSize: "12px", 
                fontFamily: "var(--font-sans)" 
              }}
            >
              <span style={{ color: COLORS[i % COLORS.length], fontSize: "14px", lineHeight: "1" }}>●</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {lang} <span style={{ color: "var(--text-muted)", marginLeft: "4px" }}>{((bytes / total) * 100).toFixed(1)}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
