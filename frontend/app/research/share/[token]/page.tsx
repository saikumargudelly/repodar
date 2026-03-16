"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api, ResearchSharedView } from "@/lib/api";
import ReactMarkdown from "react-markdown";

function MD({ children }: { children: string }) {
  try { return <ReactMarkdown>{children}</ReactMarkdown>; }
  catch { return <div style={{ whiteSpace: "pre-wrap" }}>{children}</div>; }
}

const TREND_COLORS: Record<string, string> = {
  HIGH: "#3fb950", MID: "#e3b341", LOW: "#f85149",
};

export default function SharedResearchPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ResearchSharedView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.research.getShared(token)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "48px" }}>🔒</div>
        <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-primary)", fontWeight: 700, fontSize: "18px" }}>Share link not found or expired</div>
        <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "13px" }}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "14px" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "40px 24px", maxWidth: "900px", margin: "0 auto" }}>
      <style>{`
        .shared-md p { margin: 0 0 10px; }
        .shared-md h1,.shared-md h2,.shared-md h3 { margin: 14px 0 8px; font-family: var(--font-sans); }
        .shared-md ul,.shared-md ol { padding-left: 22px; margin: 8px 0; }
        .shared-md li { margin-bottom: 6px; }
        .shared-md code { background: rgba(88,166,255,0.1); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
        .shared-md pre { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin: 10px 0; overflow-x: auto; }
        .shared-md blockquote { border-left: 3px solid var(--accent-blue); padding-left: 14px; color: var(--text-muted); margin: 8px 0; }
        .shared-md strong { color: var(--text-primary); }
        .shared-md a { color: var(--accent-blue); }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <span style={{ fontSize: "24px" }}>🔬</span>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            {data.title}
          </h1>
        </div>
        {data.description && (
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)", margin: "0 0 10px" }}>{data.description}</p>
        )}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
            Created {new Date(data.created_at).toLocaleDateString()}
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
            {data.message_count} research turns
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
            {data.pins.length} repos pinned
          </span>
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", padding: "6px 12px", background: "rgba(88,166,255,0.06)", border: "1px solid rgba(88,166,255,0.2)", borderRadius: "6px", display: "inline-block" }}>
          🔒 Read-only shared view · Powered by <strong style={{ color: "var(--accent-blue)" }}>Repodar</strong>
        </div>
      </div>

      {/* Report */}
      {data.report ? (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "28px", marginBottom: "32px" }}>
          <div className="shared-md" style={{ fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.75, color: "var(--text-primary)" }}>
            <MD>{data.report.content_md}</MD>
          </div>
          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)", fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
            Report generated {new Date(data.report.generated_at).toLocaleString()} · {data.report.repos_count} repos analyzed
          </div>
        </div>
      ) : (
        /* No report — show pinboard only */
        data.pins.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "16px", color: "var(--text-primary)", marginBottom: "16px" }}>
              📌 Pinned Repositories ({data.pins.length})
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
              {data.pins.map((pin) => {
                const r = pin.repo_data;
                const starsK = r?.stars >= 1000 ? `${(r.stars / 1000).toFixed(1)}k` : String(r?.stars ?? 0);
                return (
                  <a key={pin.id} href={r?.github_url ?? `https://github.com/${pin.repo_full_name}`} target="_blank" rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "var(--bg-surface)", border: `1px solid var(--border)`,
                      borderLeft: `3px solid ${TREND_COLORS[r?.trend_label ?? "MID"] ?? "var(--border)"}`,
                      borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px",
                      transition: "border-color 0.13s", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-blue)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                    >
                      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "13px", color: "var(--accent-blue)" }}>{pin.repo_full_name}</div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>{r?.description?.slice(0, 100)}</div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-secondary)" }}>⭐ {starsK}</span>
                        {r?.trend_label && <span style={{ fontSize: "10px", fontWeight: 700, color: TREND_COLORS[r.trend_label] }}>{r.trend_label}</span>}
                        {r?.primary_language && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{r.primary_language}</span>}
                        {pin.stage !== "watch" && (
                          <span style={{ marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "4px", padding: "1px 6px" }}>
                            {pin.stage}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
        <a href="/" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}>
          Powered by <strong style={{ color: "var(--accent-blue)" }}>Repodar</strong> · GitHub AI Ecosystem Radar
        </a>
      </div>
    </div>
  );
}
