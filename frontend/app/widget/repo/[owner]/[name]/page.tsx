"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, WidgetData } from "@/lib/api";

// ─── Colour mapping ───────────────────────────────────────────────────────────
const LABEL_COLOR: Record<string, string> = {
  GREEN: "#22c55e",
  YELLOW: "#f59e0b",
  RED: "#ef4444",
};

// ─── Card ─────────────────────────────────────────────────────────────────────
function ScoreCard({ data }: { data: WidgetData }) {
  const labelColor = LABEL_COLOR[data.sustainability_label ?? "YELLOW"] ?? "#f59e0b";
  const ssPercent =
    data.sustainability_score !== null
      ? `${Math.round(data.sustainability_score * 100)}%`
      : null;

  return (
    <div style={{
      fontFamily: "'Inter', 'system-ui', sans-serif",
      background: "#0f1117",
      border: "1px solid #1e2230",
      borderRadius: "10px",
      padding: "16px 20px",
      color: "#f1f5f9",
      width: "340px",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
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
              {data.description.length > 80 ? data.description.slice(0, 79) + "…" : data.description}
            </p>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
        <div>
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Stars</p>
          <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#3b82f6" }}>
            {data.stars.toLocaleString()} ⭐
          </p>
        </div>
        <div>
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Forks</p>
          <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#94a3b8" }}>
            {data.forks.toLocaleString()}
          </p>
        </div>
        <div>
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Issues</p>
          <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#94a3b8" }}>
            {data.open_issues.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Repodar scores */}
      {data.is_tracked ? (
        <div style={{ borderTop: "1px solid #1e2230", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "20px" }}>
            {ssPercent && (
              <div>
                <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sustainability</p>
                <p style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: labelColor }}>{ssPercent}</p>
              </div>
            )}
            {data.star_velocity_7d !== null && (
              <div>
                <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Stars / 7d</p>
                <p style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#22c55e" }}>+{Math.round(data.star_velocity_7d * 7).toLocaleString()}</p>
              </div>
            )}
          </div>
          {data.sustainability_label && (
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              color: labelColor,
              border: `1.5px solid ${labelColor}`,
              borderRadius: "4px",
              padding: "3px 8px",
              letterSpacing: "0.5px",
            }}>
              {data.sustainability_label}
            </span>
          )}
        </div>
      ) : (
        <div style={{ borderTop: "1px solid #1e2230", paddingTop: "10px" }}>
          <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>
            Not tracked by Repodar — add to get sustainability scores
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
          powered by Repodar
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

  return (
    // Minimal page — no Nav, no padding — designed for iframe embed
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      padding: "8px",
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

      {/* Embed help (visible only when navigated to directly, not in iframe) */}
      {data && (
        <div style={{
          position: "fixed", bottom: "0", left: "0", right: "0",
          background: "#0f1117", borderTop: "1px solid #1e2230",
          padding: "12px 20px",
          fontSize: "11px", color: "#64748b",
          display: "flex", gap: "16px", alignItems: "center",
        }}>
          <span style={{ fontWeight: 600, color: "#94a3b8" }}>Embed this card:</span>
          <code style={{ background: "#1e2230", padding: "4px 8px", borderRadius: "4px", color: "#94a3b8" }}>
            {`<iframe src="${typeof window !== "undefined" ? window.location.href : ""}" width="360" height="180" frameborder="0" />`}
          </code>
          <span style={{ fontWeight: 600, color: "#94a3b8", marginLeft: "8px" }}>Badge:</span>
          <code style={{ background: "#1e2230", padding: "4px 8px", borderRadius: "4px", color: "#94a3b8" }}>
            {`![Repodar](https://api.repodar.app/widget/badge/${owner}/${name}.svg)`}
          </code>
        </div>
      )}
    </div>
  );
}
