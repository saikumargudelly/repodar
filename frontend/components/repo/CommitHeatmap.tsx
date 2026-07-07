"use client";

import React from "react";
import { CommitActivityPoint } from "@/lib/api";

interface CommitHeatmapProps {
  data: CommitActivityPoint[];
}

export function CommitHeatmap({ data }: CommitHeatmapProps) {
  if (!data || data.length === 0) return null;

  const countMap: Record<string, number> = {};
  let maxCount = 1;
  for (const p of data) {
    countMap[p.date] = p.count;
    if (p.count > maxCount) maxCount = p.count;
  }

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const weeks: CommitActivityPoint[][] = [];
  let week: CommitActivityPoint[] = [];
  for (const p of sorted) {
    week.push(p);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);

  const intensity = (count: number) => {
    if (count === 0) return "rgba(255, 255, 255, 0.03)";
    const pct = count / maxCount;
    if (pct < 0.25) return "rgba(63, 185, 80, 0.15)";
    if (pct < 0.5) return "rgba(63, 185, 80, 0.4)";
    if (pct < 0.75) return "rgba(63, 185, 80, 0.75)";
    return "var(--accent-green)";
  };

  return (
    <div 
      className="panel card-pad" 
      style={{ 
        overflowX: "auto",
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
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>
          Commit activity — last 52 weeks
        </span>
      </div>
      <div style={{ display: "flex", gap: "3px", marginTop: "12px" }}>
        {weeks.map((w, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {w.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} commit${day.count !== 1 ? "s" : ""}`}
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2.5px",
                  background: intensity(day.count),
                  border: "1px solid rgba(255, 255, 255, 0.01)",
                  cursor: "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "16px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Less
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <div key={i} style={{ width: "8px", height: "8px", borderRadius: "1.5px", background: intensity(Math.round(pct * maxCount)) }} />
        ))}
        More
      </div>
    </div>
  );
}
