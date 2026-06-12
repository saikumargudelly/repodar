"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, SnapshotSummary } from "@/lib/api";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";

export default function WeeklyIndexPage() {
  const { data: snapshots, isLoading } = useQuery<SnapshotSummary[]>({
    queryKey: ["snapshots"],
    queryFn: api.listSnapshots,
  });

  return (
    <div className="page-root" style={{ maxWidth: "800px", margin: "0 auto", paddingLeft: "16px", paddingRight: "16px" }}>
      <div>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.15em",
          color: "var(--cyan)",
          fontWeight: 700,
          textTransform: "uppercase",
          marginTop: "16px"
        }}>
          // INTEL ARCHIVE
        </div>
        <div className="section-title-cyber" style={{ fontSize: "32px", marginTop: "4px" }}>
          Weekly Intelligence Digests<span className="terminal-cursor" />
        </div>
        <p style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: "var(--text-secondary)",
          lineHeight: "1.6",
          marginTop: "10px",
        }}>
          Our automated intelligence engine compiles a snapshot of the top-25 open-source AI and machine learning repositories every Monday.
          Explore the archive of weekly editions containing detailed community health scoring, star velocities, and breakout trend commentary.
        </p>
      </div>

      {isLoading ? (
        <div style={{ padding: "80px 0" }}>
          <ProfessionalLoader size={45} text="Loading weekly snapshots..." />
        </div>
      ) : !snapshots || snapshots.length === 0 ? (
        <div className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "56px 32px", textAlign: "center" }}>
          <div className="narutorun-container" style={{ padding: "0 0 8px 0" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="narutorun-svg">
              <circle cx="29" cy="12" r="3" />
              <path d="M 27 9 L 24 7 L 26 10 L 23 10 L 26 12" />
              <path d="M 29 9 L 32 6 L 31 10 L 34 8 L 32 11" />
              <path d="M 25 13 C 23 13, 21 11, 19 12 C 17 13, 16 15, 14 14" />
              <path d="M 29 15 L 18 28" />
              <path d="M 27 17 L 10 21" />
              <path d="M 27 17 L 8 23" />
              <path d="M 18 28 L 26 34 L 20 44" />
              <path d="M 18 28 L 10 35 L 4 33" />
            </svg>
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>
            No snapshots available yet
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
            // Snapshots publish automatically every Monday at 06:00 UTC.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
          {snapshots.map((s) => (
            <Link
              key={s.week_id}
              href={`/weekly/${s.week_id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="panel hover-link-glow"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  cursor: "pointer",
                  transition: "transform 0.2s ease, border-color 0.15s ease",
                }}
              >
                {/* Title and date row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "18px",
                      color: "var(--cyan)",
                      fontWeight: 700
                    }}>
                      Edition {s.week_id}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      background: "rgba(255,255,255,0.05)",
                      padding: "2px 6px",
                      borderRadius: "4px"
                    }}>
                      {new Date(s.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    {s.repo_count} repos tracked →
                  </span>
                </div>

                {/* Subtext description */}
                <p style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  lineHeight: "1.5",
                  margin: 0
                }}>
                  Weekly ecosystem telemetry analysis featuring the top-{s.repo_count} breakout AI/ML developer projects. Includes velocity trends, acceleration analysis, and sustainability health audits.
                </p>

              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
