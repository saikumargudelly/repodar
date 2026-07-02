/**
 * StatusDot — the single, unified health/status badge for Repodar.
 *
 * Replaces: NinjaRankPill, SustainBadge, HealthBadge, TrendPill
 *
 * Usage:
 *   <StatusDot label="GREEN" />       → ● Healthy
 *   <StatusDot label="YELLOW" />      → ● Caution
 *   <StatusDot label="RED" />         → ● Critical
 *   <StatusDot label="GREEN" size="sm" />   (smaller variant)
 */

import React from "react";

export type HealthLabel = "GREEN" | "YELLOW" | "RED" | string | null | undefined;

export interface StatusDotProps {
  label: HealthLabel;
  /** "sm" = 10px text, "md" = 12px text (default) */
  size?: "sm" | "md";
  /** If true, renders without the dot — just the colored text label */
  textOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const CONFIG: Record<string, { dot: string; text: string; color: string }> = {
  GREEN:    { dot: "var(--accent-green)",  text: "Healthy",  color: "var(--accent-green)"  },
  YELLOW:   { dot: "var(--accent-yellow)", text: "Caution",  color: "var(--accent-yellow)" },
  RED:      { dot: "var(--accent-red)",    text: "Critical", color: "var(--accent-red)"    },
  // Legacy aliases
  HEALTHY:  { dot: "var(--accent-green)",  text: "Healthy",  color: "var(--accent-green)"  },
  CAUTION:  { dot: "var(--accent-yellow)", text: "Caution",  color: "var(--accent-yellow)" },
  CRITICAL: { dot: "var(--accent-red)",    text: "Critical", color: "var(--accent-red)"    },
  LOW:      { dot: "var(--accent-red)",    text: "Critical", color: "var(--accent-red)"    },
  // ANBU was a legacy NinjaRankPill tier — treated as Healthy
  ANBU:     { dot: "var(--accent-green)",  text: "Healthy",  color: "var(--accent-green)"  },
};

const FALLBACK = { dot: "var(--text-muted)", text: "Unknown", color: "var(--text-muted)" };

export function StatusDot({
  label,
  size = "md",
  textOnly = false,
  className,
  style,
}: StatusDotProps) {
  const key = (label ?? "").toUpperCase().trim();
  const cfg = CONFIG[key] ?? FALLBACK;

  const fontSize = size === "sm" ? "10px" : "12px";
  const dotSize  = size === "sm" ? "5px"  : "6px";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontFamily: "var(--font-sans)",
        fontSize,
        fontWeight: 500,
        color: cfg.color,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {!textOnly && (
        <span
          style={{
            display: "inline-block",
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: cfg.dot,
            flexShrink: 0,
          }}
        />
      )}
      {cfg.text}
    </span>
  );
}

/**
 * Compact variant — just the colored dot, no text. Useful in dense tables.
 */
export function StatusDotOnly({ label, size = "md" }: Pick<StatusDotProps, "label" | "size">) {
  const key = (label ?? "").toUpperCase().trim();
  const cfg = CONFIG[key] ?? FALLBACK;
  const dotSize = size === "sm" ? "5px" : "6px";

  return (
    <span
      title={cfg.text}
      style={{
        display: "inline-block",
        width: dotSize,
        height: dotSize,
        borderRadius: "50%",
        background: cfg.dot,
        flexShrink: 0,
      }}
    />
  );
}
