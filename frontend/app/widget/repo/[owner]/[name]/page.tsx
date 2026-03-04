"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, WidgetData } from "@/lib/api";

// ─── Colour mapping ───────────────────────────────────────────────────────────
const LABEL_COLOR: Record<string, string> = {
  GREEN:  "#22c55e",
  YELLOW: "#f59e0b",
  RED:    "#ef4444",
};

// ─── Circular TrendScore gauge ────────────────────────────────────────────────
function TrendGauge({ pct, label }: { pct: number; label: string | null }) {
  const color = LABEL_COLOR[label ?? "YELLOW"] ?? "#f59e0b";
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#1e2230" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
        />
        <text x="30" y="34" textAnchor="middle" fill="#f1f5f9" fontSize="13" fontWeight="700"
          fontFamily="'Inter','system-ui',sans-serif">
          {pct}
        </text>
      </svg>
      <span style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>
        TrendScore
      </span>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function ScoreCard({ data }: { data: WidgetData }) {
  const labelColor = LABEL_COLOR[data.sustainability_label ?? "YELLOW"] ?? "#f59e0b";
  const ssPercent =
    data.sustainability_score !== null
      ? `${Math.round(data.sustainability_score * 100)}%`
      : null;
  const vel7d = data.star_velocity_7d != null
    ? `+${Math.round(data.star_velocity_7d * 7).toLocaleString()}`
    : null;
  const accelArrow = data.acceleration != null
    ? data.acceleration > 0 ? " ↑" : data.acceleration < 0 ? " ↓" : ""
    : "";

  return (
    <div style={{
      fontFamily: "'Inter','system-ui',sans-serif",
      background: "#0f1117",
      border: "1px solid #1e2230",
      borderRadius: "10px",
      padding: "16px 20px",
      color: "#f1f5f9",
      width: "360px",
      boxSizing: "border-box",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
          <a
            href={data.github_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 700, fontSize: "14px", color: "#f1f5f9", textDecoration: "none" }}
          >
            <span style={{ color: "#94a3b8" }}>{data.owner}/</span>
            {data.name}
          </a>
          {data.language && (
            <span style={{ marginLeft: "8px", fontSize: "11px", background: "#1e2230", color: "#94a3b8", padding: "2px 6px", borderRadius: "4px" }}>
              {data.language}
            </span>
          )}
          {data.description && (
            <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0", lineHeight: "1.4" }}>
              {data.description.length > 75 ? data.description.slice(0, 74) + "…" : data.description}
            </p>
          )}
        </div>
        {/* TrendScore gauge — only for tracked repos */}
        {data.is_tracked && data.trend_score_pct != null && (
          <TrendGauge pct={data.trend_score_pct} label={data.sustainability_label} />
        )}
      </div>

      {/* Star / Fork / Issue metrics row */}
      <div style={{ display: "flex", gap: "18px", marginBottom: "12px" }}>
        <div>
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Stars</p>
          <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#3b82f6" }}>
            {data.stars.toLocaleString()} ⭐
          </p>
        </div>
        {vel7d && (
          <div>
            <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>This week</p>
            <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#22c55e" }}>{vel7d}{accelArrow}</p>
          </div>
        )}
        <div>
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Forks</p>
          <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#94a3b8" }}>
            {data.forks.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Repodar scores row */}
      {data.is_tracked ? (
        <div style={{ borderTop: "1px solid #1e2230", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "20px" }}>
            {ssPercent && (
              <div>
                <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sustainability</p>
                <p style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: labelColor }}>{ssPercent}</p>
              </div>
            )}
          </div>
          {data.sustainability_label && (
            <span style={{
              fontSize: "11px", fontWeight: 700, color: labelColor,
              border: `1.5px solid ${labelColor}`, borderRadius: "4px",
              padding: "3px 8px", letterSpacing: "0.5px",
            }}>
              {data.sustainability_label}
            </span>
          )}
        </div>
      ) : (
        <div style={{ borderTop: "1px solid #1e2230", paddingTop: "10px" }}>
          <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>
            Not tracked by Repodar — add to get TrendScore + sustainability scoring
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <a
          href="https://repodar.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "10px", color: "#475569", textDecoration: "none" }}
        >
          powered by Repodar ↗
        </a>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WidgetPage({ params }: { params: Promise<{ owner: string; name: string }> }) {
  const { owner, name } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["widget", owner, name],
    queryFn: () => api.getWidgetData(owner, name),
  });

  const embedSrc = typeof window !== "undefined"
    ? `${window.location.origin}/widget/repo/${owner}/${name}`
    : `https://repodar.app/widget/repo/${owner}/${name}`;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      padding: "8px",
      gap: "16px",
    }}>
      {isLoading && (
        <div style={{ fontSize: "12px", color: "#64748b" }}>Loading…</div>
      )}
      {error && (
        <div style={{ fontSize: "12px", color: "#ef4444", background: "#0f1117", border: "1px solid #1e2230", borderRadius: "8px", padding: "12px 16px" }}>
          Repo not found
        </div>
      )}
      {data && <ScoreCard data={data} />}

      {/* Embed help panel */}
      {data && (
        <div style={{
          background: "#0f1117",
          border: "1px solid #1e2230",
          borderRadius: "8px",
          padding: "14px 20px",
          width: "360px",
          boxSizing: "border-box",
          fontSize: "11px",
          color: "#64748b",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#94a3b8" }}>Embed this card in your README:</p>
          <code style={{ background: "#1e2230", padding: "6px 10px", borderRadius: "4px", color: "#94a3b8", display: "block", wordBreak: "break-all", lineHeight: "1.5" }}>
            {`<iframe src="${embedSrc}" width="380" height="200" frameborder="0" />`}
          </code>
          <p style={{ margin: "4px 0 0", fontWeight: 600, color: "#94a3b8" }}>Or use the SVG badge:</p>
          <code style={{ background: "#1e2230", padding: "6px 10px", borderRadius: "4px", color: "#94a3b8", display: "block", wordBreak: "break-all", lineHeight: "1.5" }}>
            {`![Repodar](https://api.repodar.app/widget/badge/${owner}/${name}.svg)`}
          </code>
        </div>
      )}
    </div>
  );
}
