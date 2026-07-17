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
      }}
    >
      <style>{`
        @keyframes tooltip-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
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
                    bottom: "22px",
                    right: "-8px",
                    width: "200px",
                    background: "rgba(20, 20, 20, 0.95)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                    zIndex: 100,
                    pointerEvents: "none",
                    textAlign: "left",
                    textTransform: "none",
                    fontWeight: "normal",
                    lineHeight: "1.4",
                    fontSize: "11px",
                    color: "var(--text-primary)",
                    animation: "tooltip-fade-in 0.15s ease-out",
                  }}
                >
                  {tooltip}
                  <div 
                    style={{
                      position: "absolute",
                      bottom: "-5px",
                      right: "12px",
                      width: "8px",
                      height: "8px",
                      background: "rgba(20, 20, 20, 0.95)",
                      borderRight: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)",
                      transform: "rotate(45deg)",
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
