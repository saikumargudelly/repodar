import React from "react";

interface ProfessionalLoaderProps {
  size?: number;
  text?: string;
}

export function ProfessionalLoader({ size = 50, text }: ProfessionalLoaderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <div style={{ position: "relative", width: `${size}px`, height: `${size}px` }}>
        {/* Outer Ring */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "2px solid rgba(56, 189, 248, 0.05)",
          borderTopColor: "var(--accent-blue, #38bdf8)",
          animation: "rotate-cw 1.2s linear infinite",
        }} />
        {/* Inner Ring */}
        <div style={{
          position: "absolute",
          inset: "6px",
          borderRadius: "50%",
          border: "1.5px solid rgba(0, 229, 255, 0.03)",
          borderBottomColor: "#00e5ff",
          animation: "rotate-ccw 0.8s linear infinite",
        }} />
      </div>
      {text && (
        <p style={{
          margin: 0,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.1em",
          color: "var(--color-text-secondary, #8b949e)",
          textTransform: "uppercase",
        }}>
          {text}
        </p>
      )}
    </div>
  );
}
