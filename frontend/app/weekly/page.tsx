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
    <div className="page-root">
      <div>
        <div className="section-title-cyber">WEEKLY SNAPSHOTS<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Historical archive of the top-25 AI/ML repos each week
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "40px 0" }}>
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
