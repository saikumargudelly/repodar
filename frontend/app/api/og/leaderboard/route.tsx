import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? "7d";

  let entries: Array<{ owner: string; name: string; star_gain?: number; trend_score?: number }> = [];
  try {
    const res = await fetch(`${API_URL}/dashboard/leaderboard?period=${period}&limit=5`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      entries = data.entries ?? [];
    }
  } catch {
    // render fallback
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0a0a0f",
          display: "flex",
          flexDirection: "column",
          padding: "56px 72px",
          fontFamily: "monospace",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "#06b6d4", display: "flex" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ color: "#06b6d4", fontSize: "13px", letterSpacing: "0.2em" }}>REPODAR</span>
            <span style={{ color: "#e2e8f0", fontSize: "42px", fontWeight: 800, letterSpacing: "-0.02em", display: "flex" }}>
              TOP REPOS — {period.toUpperCase()}
            </span>
          </div>
          <span style={{ color: "#1e293b", fontSize: "12px", letterSpacing: "0.1em" }}>repodar.vercel.app/leaderboard</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
          {entries.slice(0, 5).map((entry, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              padding: "12px 20px",
              background: "#0f0f1a",
              borderRadius: "6px",
              border: "1px solid #1e1e2e",
            }}>
              <span style={{ color: "#2d2d44", fontSize: "22px", fontWeight: 700, width: "32px" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color: "#e2e8f0", fontSize: "20px", fontWeight: 600, flex: 1, display: "flex" }}>
                {entry.owner}/{entry.name}
              </span>
              <span style={{ color: "#f59e0b", fontSize: "18px", fontWeight: 700, display: "flex" }}>
                +{(entry.star_gain ?? 0).toLocaleString()} ★
              </span>
            </div>
          ))}
          {entries.length === 0 && (
            <div style={{ color: "#64748b", fontSize: "18px", display: "flex" }}>No data yet</div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
