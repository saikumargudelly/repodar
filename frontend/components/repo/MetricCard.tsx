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
  const [showTooltip, setShowTooltip] = React.useState(false);

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
        overflow: "visible", // Overrides overflow: hidden from global CSS
      }}
    >
      <style>{`
        @keyframes tooltip-fade-in {
          from { opacity: 0; transform: translateY(4px) translateX(-50%); }
          to { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
      `}</style>
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
          <span style={{ cursor: "default" }}>
            {label}
          </span>
          {tooltip && (
            <div 
              style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
            >
              <button
                type="button"
                style={{ 
                  background: "none", 
                  border: "none", 
                  padding: 0, 
                  color: showTooltip ? "var(--accent-yellow)" : "var(--text-muted)", 
                  cursor: "pointer", 
                  display: "flex", 
                  alignItems: "center",
                  transition: "color 0.2s ease" 
                }}
              >
                <svg 
                  width="13" 
                  height="13" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </button>
              
              {showTooltip && (
                <div 
                  style={{
                    position: "absolute",
                    bottom: "24px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "210px",
                    background: "rgba(15, 15, 15, 0.96)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.6)",
                    zIndex: 100,
                    pointerEvents: "none",
                    textAlign: "center",
                    textTransform: "none",
                    fontWeight: 500,
                    lineHeight: "1.45",
                    fontSize: "11px",
                    color: "var(--text-primary)",
                    animation: "tooltip-fade-in 0.15s ease-out forwards",
                  }}
                >
                  {tooltip}
                  <div 
                    style={{
                      position: "absolute",
                      bottom: "-5px",
                      left: "50%",
                      transform: "translateX(-50%) rotate(45deg)",
                      width: "8px",
                      height: "8px",
                      background: "rgba(15, 15, 15, 0.96)",
                      borderRight: "1px solid rgba(255, 255, 255, 0.15)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
                    }}
                  />
                </div>
              )}
            </div>
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
