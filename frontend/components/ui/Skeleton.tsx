/**
 * Skeleton — unified shimmer loading component for Repodar.
 *
 * Replaces: DashboardSkeleton, TableSkeleton, ProfessionalLoader
 *
 * Usage:
 *   <Skeleton shape="kpi" />               — 4 KPI card shimmers
 *   <Skeleton shape="table" rows={8} />    — table header + N shimmer rows
 *   <Skeleton shape="chart" height={220} />— chart area shimmer
 *   <Skeleton shape="text" lines={3} />    — paragraph text shimmer
 *   <Skeleton shape="page" />              — full overview page skeleton
 */

import React from "react";

// ── Primitive: a single shimmer block ────────────────────────────────────────

interface ShimmerBoxProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function ShimmerBox({ width = "100%", height = 16, borderRadius = 6, style }: ShimmerBoxProps) {
  return (
    <div
      className="skeleton-box"
      style={{
        width,
        height,
        borderRadius,
        background: "var(--bg-elevated)",
        backgroundImage: "linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-dim) 50%, var(--bg-elevated) 75%)",
        backgroundSize: "800px 100%",
        animation: "skeleton-shimmer 1.4s ease-in-out infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// ── Shape variants ────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            background: "var(--bg-surface)",
          }}
        >
          <ShimmerBox width="55%" height={10} />
          <ShimmerBox width="40%" height={26} />
          <ShimmerBox width="70%" height={9} />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          padding: "9px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <ShimmerBox width={28} height={10} />
        <ShimmerBox width="30%" height={10} />
        <ShimmerBox width="15%" height={10} style={{ marginLeft: "auto" }} />
        <ShimmerBox width="12%" height={10} />
        <ShimmerBox width="10%" height={10} />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "9px 12px",
            borderBottom: "1px solid var(--border)",
            opacity: 1 - i * 0.06,
          }}
        >
          <ShimmerBox width={20} height={10} />
          <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "5px" }}>
            <ShimmerBox width="60%" height={11} />
            <ShimmerBox width="40%" height={9} />
          </div>
          <ShimmerBox width="12%" height={11} style={{ marginLeft: "auto" }} />
          <ShimmerBox width="10%" height={11} />
          <ShimmerBox width={48} height={18} borderRadius={20} />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <ShimmerBox width="25%" height={12} />
        <ShimmerBox width="10%" height={10} />
      </div>
      <ShimmerBox width="100%" height={height} borderRadius={8} />
    </div>
  );
}

function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBox
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height={12}
        />
      ))}
    </div>
  );
}

/** Full overview-page skeleton: KPI cards + 2-column chart placeholder. */
function PageSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingTop: "8px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <ShimmerBox width={100} height={10} />
          <ShimmerBox width={160} height={20} />
        </div>
        <ShimmerBox width={100} height={28} borderRadius={6} />
      </div>
      {/* KPIs */}
      <KpiSkeleton />
      {/* Chart area */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "20px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            background: "var(--bg-surface)",
          }}
        >
          <ShimmerBox width="60%" height={12} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ShimmerBox width={20} height={10} />
              <ShimmerBox width="55%" height={11} />
              <ShimmerBox width={36} height={11} style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
              background: "var(--bg-surface)",
            }}
          >
            <ChartSkeleton height={280} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export type SkeletonShape = "kpi" | "table" | "chart" | "text" | "page";

export interface SkeletonProps {
  shape: SkeletonShape;
  /** Number of rows (table shape only) */
  rows?: number;
  /** Chart height in px (chart shape only) */
  height?: number;
  /** Number of text lines (text shape only) */
  lines?: number;
}

export function Skeleton({ shape, rows = 8, height = 220, lines = 3 }: SkeletonProps) {
  switch (shape) {
    case "kpi":   return <KpiSkeleton />;
    case "table": return <TableSkeleton rows={rows} />;
    case "chart": return <ChartSkeleton height={height} />;
    case "text":  return <TextSkeleton lines={lines} />;
    case "page":  return <PageSkeleton />;
    default:      return null;
  }
}
