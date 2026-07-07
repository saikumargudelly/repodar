"use client";

import React from "react";
import { ForecastChart } from "@/components/forecast/ForecastChart";

interface ForecastCardProps {
  owner: string;
  name: string;
}

export function ForecastCard({ owner, name }: ForecastCardProps) {
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
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          🔮 90-day star forecast
        </span>
      </div>
      <div style={{ marginTop: "12px" }}>
        <ForecastChart owner={owner} name={name} />
      </div>
    </div>
  );
}
