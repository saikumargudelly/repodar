"use client";

import React from "react";

export function DashboardSkeleton() {
  return (
    <div className="page-fade-in" style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
      {/* Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="skeleton-box" style={{ width: "240px", height: "32px" }} />
        <div className="skeleton-box" style={{ width: "120px", height: "32px" }} />
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-box" style={{ height: "100px", padding: "16px" }}>
            <div className="skeleton-box" style={{ width: "60%", height: "12px", marginBottom: "12px", opacity: 0.6 }} />
            <div className="skeleton-box" style={{ width: "40%", height: "24px" }} />
          </div>
        ))}
      </div>

      {/* Bento Grid Rows */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", minHeight: "350px" }}>
        {/* Left Side: Large Chart box */}
        <div className="skeleton-box" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="skeleton-box" style={{ width: "30%", height: "16px" }} />
          <div className="skeleton-box" style={{ flex: 1, opacity: 0.5 }} />
        </div>
        {/* Right Side: List sidebar */}
        <div className="skeleton-box" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="skeleton-box" style={{ width: "50%", height: "16px", marginBottom: "8px" }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="skeleton-box" style={{ width: "24px", height: "24px", borderRadius: "50%" }} />
              <div className="skeleton-box" style={{ flex: 1, height: "12px" }} />
              <div className="skeleton-box" style={{ width: "40px", height: "12px" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="page-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "24px 0", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <div className="skeleton-box" style={{ width: "180px", height: "24px" }} />
        <div className="skeleton-box" style={{ width: "100px", height: "24px" }} />
      </div>
      <div className="skeleton-box" style={{ height: "40px" }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "6px 0" }}>
          <div className="skeleton-box" style={{ width: "32px", height: "20px", opacity: 0.5 }} />
          <div className="skeleton-box" style={{ flex: 2, height: "20px" }} />
          <div className="skeleton-box" style={{ flex: 1, height: "20px" }} />
          <div className="skeleton-box" style={{ flex: 1, height: "20px" }} />
        </div>
      ))}
    </div>
  );
}
