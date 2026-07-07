"use client";

import React from "react";
import { ComputedMetricPoint } from "@/lib/api";

interface SignalExplainerProps {
  scores: ComputedMetricPoint[];
}

export function SignalExplainer({ scores }: SignalExplainerProps) {
  if (!scores || scores.length < 1) return null;
  const latest = scores[scores.length - 1];
  const prior = scores.length >= 2 ? scores[scores.length - 2] : null;

  let trendChangePct = 0;
  if (latest.trend_score && prior?.trend_score && prior.trend_score > 0) {
    trendChangePct = ((latest.trend_score - prior.trend_score) / prior.trend_score) * 100;
  }

  let velChangePct = 0;
  if (latest.star_velocity_7d && prior?.star_velocity_7d && prior.star_velocity_7d > 0) {
    velChangePct = ((latest.star_velocity_7d - prior.star_velocity_7d) / prior.star_velocity_7d) * 100;
  }

  const accel = latest.acceleration ?? 0;
  const accelStatus = accel > 0.001 ? "Accelerating" : accel < -0.001 ? "Decelerating" : "Flat";

  return (
    <div 
      className="panel card-pad" 
      style={{ 
        height: "100%",
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          Signal explainer
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px", color: "var(--text-muted)", display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", minWidth: "110px" }}>7d star velocity</span>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--accent-green)", minWidth: "90px", fontFamily: "var(--font-mono)" }}>
            +{latest.star_velocity_7d?.toFixed(1)}/day
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {velChangePct >= 0 ? "+" : ""}{velChangePct.toFixed(0)}% vs prior week
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px", color: "var(--text-muted)", display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path><path d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path></svg>
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", minWidth: "110px" }}>Momentum</span>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-primary)", minWidth: "90px" }}>
            {accelStatus}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            accel: {accel.toFixed(4)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px", color: "var(--text-muted)", display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", minWidth: "110px" }}>Trend score</span>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--accent-yellow)", minWidth: "90px", fontFamily: "var(--font-mono)" }}>
            {latest.trend_score?.toFixed(4)}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {trendChangePct >= 0 ? "+" : ""}{trendChangePct.toFixed(1)}% vs prior snapshot
          </span>
        </div>

      </div>
    </div>
  );
}
