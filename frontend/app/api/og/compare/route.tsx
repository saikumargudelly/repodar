import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ids = searchParams.getAll("id"); // ?id=owner/name&id=owner/name

  const repos = await Promise.all(
    ids.slice(0, 4).map(async (id) => {
      try {
        const res = await fetch(`${API_URL}/repos/${id}`, { cache: "no-store" });
        if (res.ok) return res.json();
      } catch {
        // ignore
      }
      return { owner: id.split("/")[0], name: id.split("/")[1] };
    })
  );

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
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "#8b5cf6", display: "flex" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ color: "#06b6d4", fontSize: "13px", letterSpacing: "0.2em" }}>REPODAR</span>
            <span style={{ color: "#e2e8f0", fontSize: "42px", fontWeight: 800, letterSpacing: "-0.02em", display: "flex" }}>
              REPO COMPARISON
            </span>
          </div>
          <span style={{ color: "#1e293b", fontSize: "12px", letterSpacing: "0.1em" }}>repodar.vercel.app/compare</span>
        </div>

        <div style={{
          display: "flex",
          gap: "16px",
          flex: 1,
        }}>
          {repos.map((repo: any, i: number) => (
            <div key={i} style={{
              flex: 1,
              background: "#0f0f1a",
              border: "1px solid #1e1e2e",
              borderRadius: "8px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}>
              <div style={{ color: "#06b6d4", fontSize: "18px", fontWeight: 700, display: "flex" }}>
                {repo.owner}/{repo.name}
              </div>
              {repo.category && (
                <div style={{ color: "#64748b", fontSize: "12px", letterSpacing: "0.08em", display: "flex" }}>
                  {repo.category}
                </div>
              )}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {repo.trend_score != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "flex" }}>TREND</span>
                    <span style={{ color: "#f59e0b", fontSize: "20px", fontWeight: 700, display: "flex" }}>
                      {Number(repo.trend_score).toFixed(3)}
                    </span>
                  </div>
                )}
                {repo.stars != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "flex" }}>STARS</span>
                    <span style={{ color: "#e2e8f0", fontSize: "18px", fontWeight: 600, display: "flex" }}>
                      ★ {Number(repo.stars).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
