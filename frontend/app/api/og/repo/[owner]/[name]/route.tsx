import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string }> }
) {
  const { owner, name } = await params;
  const repoId = `${owner}/${name}`;

  let repo: {
    owner: string;
    name: string;
    category?: string;
    primary_language?: string | null;
    trend_score?: number | null;
    stars?: number | null;
    repo_summary?: string | null;
    sustainability_label?: string | null;
  } | null = null;

  try {
    const res = await fetch(`${API_URL}/repos/${repoId}`, { cache: "no-store" });
    if (res.ok) repo = await res.json();
  } catch {
    // render fallback
  }

  const displayName   = repo ? `${repo.owner}/${repo.name}` : repoId;
  const category      = repo?.category ?? "AI / ML";
  const language      = repo?.primary_language ?? "";
  const trendScore    = repo?.trend_score != null ? repo.trend_score.toFixed(3) : "—";
  const stars         = repo?.stars != null ? repo.stars.toLocaleString() : "—";
  const summary       = repo?.repo_summary ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0a0a0f",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          fontFamily: "monospace",
          border: "1px solid #1e1e2e",
          position: "relative",
        }}
      >
        {/* Accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "#06b6d4", display: "flex" }} />

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ color: "#06b6d4", fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              REPODAR
            </span>
            <span style={{ color: "#2d2d44", fontSize: "13px" }}>|</span>
            <span style={{ color: "#64748b", fontSize: "13px", letterSpacing: "0.1em" }}>{category}</span>
            {language && (
              <>
                <span style={{ color: "#2d2d44", fontSize: "13px" }}>|</span>
                <span style={{ color: "#64748b", fontSize: "13px" }}>{language}</span>
              </>
            )}
          </div>
          <div style={{ color: "#e2e8f0", fontSize: "52px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: "1.1", display: "flex" }}>
            {displayName}
          </div>
          {summary && (
            <div style={{
              color: "#94a3b8",
              fontSize: "18px",
              lineHeight: "1.5",
              maxWidth: "900px",
              display: "flex",
              // clamp to 2 lines via overflow hidden on container
            }}>
              {summary.length > 180 ? summary.slice(0, 177) + "…" : summary}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "48px", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ color: "#64748b", fontSize: "11px", letterSpacing: "0.15em" }}>TREND SCORE</span>
            <span style={{ color: "#f59e0b", fontSize: "40px", fontWeight: 700 }}>{trendScore}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ color: "#64748b", fontSize: "11px", letterSpacing: "0.15em" }}>STARS</span>
            <span style={{ color: "#e2e8f0", fontSize: "40px", fontWeight: 700 }}>★ {stars}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            <span style={{ color: "#1e293b", fontSize: "13px", letterSpacing: "0.12em" }}>repodar.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
