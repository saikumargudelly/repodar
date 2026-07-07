"use client";

import React from "react";

interface TechStackCardProps {
  techStack: string[];
}

export function TechStackCard({ techStack }: TechStackCardProps) {
  if (!techStack || techStack.length === 0) return null;

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
          🛠️ Tech stack
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
        {techStack.map((tech) => {
          const isTS = tech.toLowerCase() === "typescript";
          const isJS = tech.toLowerCase() === "javascript";
          const bg = isTS ? "rgba(88, 166, 255, 0.1)" : isJS ? "rgba(210, 153, 34, 0.1)" : "rgba(255,255,255,0.03)";
          const color = isTS ? "var(--text-primary)" : isJS ? "var(--accent-yellow)" : "var(--text-secondary)";
          const border = isTS ? "1px solid rgba(88,166,255,0.2)" : isJS ? "1px solid rgba(210,153,34,0.2)" : "1px solid var(--border)";
          
          return (
            <span 
              key={tech} 
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "4px",
                background: bg,
                color: color,
                border: border
              }}
            >
              {tech}
            </span>
          );
        })}
      </div>
    </div>
  );
}
