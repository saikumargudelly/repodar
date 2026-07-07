"use client";

import React from "react";

export function HealthBadge({ label }: { label: string | null }) {
  if (!label) return null;
  const norm = label.toUpperCase().trim();
  let text = "Caution";
  let color = "var(--accent-yellow)";
  let bg = "rgba(210, 153, 34, 0.1)";
  let dotColor = "#d29922";
  
  if (norm === "GREEN" || norm === "HEALTHY") {
    text = "Healthy";
    color = "var(--accent-green)";
    bg = "rgba(63, 185, 80, 0.08)";
    dotColor = "#2ea043";
  } else if (norm === "RED" || norm === "CRITICAL" || norm === "LOW") {
    text = "Critical";
    color = "var(--accent-red)";
    bg = "rgba(248, 81, 73, 0.08)";
    dotColor = "#f85149";
  }
  
  return (
    <span style={{
      fontFamily: "var(--font-sans)",
      fontSize: "10px",
      fontWeight: 600,
      color,
      backgroundColor: bg,
      border: `1px solid rgba(${dotColor === "#2ea043" ? "63, 185, 80" : dotColor === "#f85149" ? "248, 81, 73" : "210, 153, 34"}, 0.25)`,
      padding: "3px 8px",
      borderRadius: "9999px",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      display: "inline-flex",
      alignItems: "center",
      gap: "5px"
    }}>
      <span style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        backgroundColor: dotColor,
        boxShadow: `0 0 6px ${dotColor}`
      }} />
      {text}
    </span>
  );
}
