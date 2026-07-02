"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, SnapshotSummary } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

export default function WeeklyIndexPage() {
  const { data: snapshots, isLoading } = useQuery<SnapshotSummary[]>({
    queryKey: ["snapshots"],
    queryFn: api.listSnapshots,
  });

  return (
    <div className="page-root">
      <div>
        <div className="page-eyebrow">Archive index · Published weekly</div>
        <h1 className="page-title">Weekly Intelligence Digests</h1>
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
        <div style={{ padding: "24px 0" }}>
          <Skeleton shape="table" />
        </div>
      ) : !snapshots || snapshots.length === 0 ? (
        <div className="panel" style={{ padding: "64px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)" }}>
            No snapshots available yet
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Snapshots publish automatically every Monday at 06:00 UTC.
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
