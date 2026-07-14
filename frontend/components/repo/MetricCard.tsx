"use client";

import React from "react";

interface MetricCardProps {
  label: string;
  interpretation: string;
  interpretationColor?: string;
  evidence: string;
  source: string;
  tooltip?: string;
  docsHash?: string;
}

export function MetricCard({
  label,
  interpretation,
  interpretationColor,
  evidence,
  source,
  tooltip,
  docsHash,
}: MetricCardProps) {
  return (
    <div 
      className="kpi-card" 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "space-between", 
        height: "100%", 
        padding: "14px 16px",
        background: "rgba(38, 37, 36, 0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div>
        <div 
          style={{ 
            fontSize: "11px", 
            color: "var(--text-muted)", 
            fontWeight: 600, 
            textTransform: "uppercase", 
            letterSpacing: "0.05em",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span 
            style={{ cursor: tooltip ? "help" : "default", borderBottom: tooltip ? "1px dotted var(--border)" : "none" }}
            title={tooltip}
          >
            {label}
          </span>
          {docsHash && (
            <a 
              href={`/docs#${docsHash}`} 
              style={{ color: "var(--accent-yellow)", textDecoration: "none", fontSize: "10px" }}
            >
              (?)
            </a>
          )}
        </div>
        <div 
          style={{ 
            display: "inline-block",
            fontSize: "12px", 
            fontWeight: 600, 
            color: interpretationColor || "var(--text-primary)", 
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--border)",
            padding: "2px 8px",
            borderRadius: "4px",
            marginBottom: "8px"
          }}
        >
          {interpretation}
        </div>
        <div 
          style={{ 
            fontSize: "13px", 
            fontWeight: 500, 
            color: "var(--text-secondary)",
            marginBottom: "8px",
            lineHeight: "1.3"
          }}
        >
          {evidence}
        </div>
      </div>
      <div 
        style={{ 
          fontSize: "10px", 
          color: "var(--text-muted)", 
          fontFamily: "var(--font-mono)",
          opacity: 0.7,
          marginTop: "4px"
        }}
      >
        {source}
      </div>
    </div>
  );
}
