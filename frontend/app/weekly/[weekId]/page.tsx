"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { api, SnapshotDetail } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

export default function WeeklyDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);

  const { data: snapshot, isLoading, error } = useQuery<SnapshotDetail>({
    queryKey: ["snapshot", weekId],
    queryFn: () => api.getSnapshot(weekId),
    enabled: !!weekId,
  });

  return (
    <div className="page-root">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/weekly" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)",
            textDecoration: "none" }}>
            ← All Snapshots
          </Link>
        </div>
        <div className="section-title-cyber" style={{ marginTop: "8px" }}>
          {weekId}<span className="terminal-cursor" />
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          {snapshot ? `Published ${new Date(snapshot.published_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}` : "// LOADING"}
        </div>
      </div>

      {isLoading ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING SNAPSHOT<span className="terminal-cursor" />
        </div>
      ) : error ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--red, #ef4444)", padding: "20px 0",
          fontSize: "12px" }}>
          // ERROR: snapshot not found
        </div>
      ) : snapshot ? (
        <>
          <div className="panel table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  {["#", "REPO", "CATEGORY", "LANGUAGE", "TREND SCORE", "SUSTAIN SCORE", "HEALTH"].map((h) => (
                    <th key={h} className="th-mono">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.repos.map((repo) => (
                  <tr key={repo.repo_id} className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
                      {String(repo.rank).padStart(2, "0")}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <Link href={`/repo/${repo.repo_id}`}
                        style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cyan)",
                          textDecoration: "none", fontWeight: 600 }}>
                        {repo.owner}/{repo.name}
                      </Link>
                      {repo.description && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
                          marginTop: "2px", maxWidth: "360px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {repo.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
                      {repo.category}
                    </td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
                      {repo.primary_language ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--amber)" }}>
                      {repo.trend_score?.toFixed(3) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)" }}>
                      {repo.sustainability_score?.toFixed(3) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {(repo as any).sustainability_label
                        ? <SustainBadge label={(repo as any).sustainability_label} />
                        : <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Share */}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
            Share →{" "}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Top AI/ML repos for ${weekId} 🚀 — check out the full snapshot at ${typeof window !== "undefined" ? window.location.href : ""}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--cyan)", textDecoration: "none" }}
            >
              Twitter/X
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
