import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Repo {
  repo_id: number;
  owner: string;
  name: string;
  category: string;
  stars: number;
  star_velocity_7d: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ weekId: string }> }
) {
  const { weekId } = await params;
  let repos: Repo[] = [];
  try {
    const res = await fetch(`${API_URL}/snapshots/${weekId}`, { next: { revalidate: 900 } });
    if (res.ok) {
      const data = await res.json();
      repos = data.repos ?? [];
    }
  } catch (err) {
    console.error("Failed to fetch snapshot for OG image", err);
  }

  const featured = repos.slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0a0d14",
          display: "flex",
          flexDirection: "column",
          padding: "48px 64px",
          position: "relative",
          fontFamily: "sans-serif",
          color: "#fff",
        }}
      >
        {/* Blue accent top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, #00f0ff, #0072ff)" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ color: "#00f0ff", fontSize: "12px", letterSpacing: "0.25em", fontWeight: 700 }}>REPODAR RADAR</span>
            <span style={{ fontSize: "38px", fontWeight: 900, letterSpacing: "-0.02em", color: "#ffffff" }}>
              Weekly AI/ML Radar
            </span>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ border: "1px solid rgba(0,240,255,0.3)", background: "rgba(0,240,255,0.05)", color: "#00f0ff", padding: "6px 12px", borderRadius: "4px", fontSize: "13px", fontWeight: 700 }}>
              Edition #{weekId}
            </span>
            <span style={{ border: "1px solid #1e293b", background: "rgba(255,255,255,0.02)", color: "#94a3b8", padding: "6px 12px", borderRadius: "4px", fontSize: "13px", fontWeight: 700 }}>
              {repos.length} Repos
            </span>
          </div>
        </div>

        {/* Top 3 List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
          <span style={{ color: "#94a3b8", fontSize: "12px", letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>
            Top Breakout Highlights
          </span>
          {featured.map((repo, i) => (
            <div
              key={repo.repo_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                padding: "16px 24px",
                background: "#111827",
                borderRadius: "8px",
                border: "1px solid #1f2937",
              }}
            >
              <span style={{ color: "#4b5563", fontSize: "24px", fontWeight: 800, width: "36px" }}>
                #{String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ color: "#ffffff", fontSize: "20px", fontWeight: 700 }}>
                  {repo.owner}/<span style={{ color: "#00f0ff" }}>{repo.name}</span>
                </span>
                <span style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                  {repo.category}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                <span style={{ color: "#ffffff", fontSize: "16px", fontWeight: 700 }}>
                  {repo.stars?.toLocaleString()} ★
                </span>
                <span style={{ color: "#3fb950", fontSize: "13px", fontWeight: 700 }}>
                  +{repo.star_velocity_7d?.toFixed(0)}/day
                </span>
              </div>
            </div>
          ))}
          {featured.length === 0 && (
            <div style={{ color: "#64748b", fontSize: "18px", display: "flex" }}>Loading weekly snapshot data...</div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
