"use client";
import React from "react";
import Link from "next/link";

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
  const [showDetail, setShowDetail] = React.useState(false);

  return (
    <div 
      className="kpi-card" 
      onMouseLeave={() => setShowDetail(false)}
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
        borderRadius: "12px",
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Main KPI Card View */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
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
            <span style={{ cursor: "default" }}>{label}</span>
            {tooltip && (
              <button
                type="button"
                onMouseEnter={(e) => {
                  setShowDetail(true);
                  e.currentTarget.style.color = "var(--accent-yellow)";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetail(!showDetail);
                }}
                style={{ 
                  background: "none", 
                  border: "none", 
                  padding: 0, 
                  color: "var(--text-muted)", 
                  cursor: "pointer", 
                  display: "flex", 
                  alignItems: "center",
                  transition: "color 0.2s ease" 
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
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

      {/* Slide-up Premium Info Overlay Panel */}
      <div 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(20, 20, 19, 0.98)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: showDetail ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 10,
        }}
      >
        <div>
          <div 
            style={{ 
              fontSize: "10px", 
              color: "var(--accent-yellow)", 
              fontWeight: 700, 
              textTransform: "uppercase", 
              letterSpacing: "0.05em",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span>Metric Info</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetail(false);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: "color 0.2s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          
          <div style={{ fontSize: "11.5px", color: "var(--text-primary)", lineHeight: "1.45", fontWeight: 500 }}>
            {tooltip}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "8px" }}>
          <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {source.replace("Based on: ", "")}
          </span>
          {docsHash && (
            <Link 
              href={`/docs#${docsHash}`}
              style={{
                fontSize: "9.5px",
                color: "var(--cyan)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                fontWeight: 600,
                transition: "color 0.2s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-blue)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--cyan)"}
            >
              Docs ↗
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
