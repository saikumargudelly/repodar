"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, SnapshotSummary } from "@/lib/api";

export default function WeeklyIndexPage() {
  const { data: snapshots, isLoading } = useQuery<SnapshotSummary[]>({
    queryKey: ["snapshots"],
    queryFn: api.listSnapshots,
  });

  return (
    <div className="page-root">
      <div>
        <div className="section-title-cyber">WEEKLY SNAPSHOTS<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Historical archive of the top-25 AI/ML repos each week
        </div>
      </div>

      {isLoading ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING<span className="terminal-cursor" />
        </div>
      ) : !snapshots || snapshots.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "12px" }}>
          // NO SNAPSHOTS YET — first snapshot publishes Monday 06:00 UTC
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {snapshots.map((s) => (
            <Link
              key={s.week_id}
              href={`/weekly/${s.week_id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="panel" style={{
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}>
                <div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--cyan)", fontWeight: 700 }}>
                    {s.week_id}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginLeft: "14px" }}>
                    {new Date(s.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                  {s.repo_count} repos →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
