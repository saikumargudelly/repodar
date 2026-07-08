"use client";

import React from "react";

interface UseCasesCardProps {
  useCases: string[];
}

export function UseCasesCard({ useCases }: UseCasesCardProps) {
  if (!useCases || useCases.length === 0) return null;

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
        flex: 1
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          📋 Use cases
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
        {useCases.map((uc) => (
          <div key={uc} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <span style={{ color: "var(--accent-green)", fontWeight: 700, fontSize: "14px", lineHeight: "1" }}>✓</span>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.4" }}>{uc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
