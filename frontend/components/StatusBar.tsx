"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function StatusBar() {
  const { data: overview } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
    staleTime: 5 * 60 * 1000,
  });

  const alertCount = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.getAlerts(false, 20),
    staleTime: 60_000,
  });

  const unread = alertCount.data?.filter((a) => !a.is_read).length ?? 0;

  return (
    <div className="status-bar-cyber">
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span className="sharingan-dot-container" title="Sharingan live tracking">
          <span className="sharingan-glow-ring"></span>
          <svg className="sharingan-iris" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#C0392B" />
            <circle cx="12" cy="12" r="2.5" fill="#000000" />
            <circle cx="12" cy="12" r="8.5" stroke="#000000" strokeWidth="0.5" strokeDasharray="2 1" />
            <g className="sharingan-tomoe">
              <path d="M 12 7.5 A 1.1 1.1 0 1 0 11 8.5 C 11.3 9 12.5 9 13 8 C 13.5 7 12.8 6.2 12.3 5.8 C 12.1 5.6 11.8 6.2 11.8 6.6 Z" fill="#000" />
              <path d="M 12 7.5 A 1.1 1.1 0 1 0 11 8.5 C 11.3 9 12.5 9 13 8 C 13.5 7 12.8 6.2 12.3 5.8 C 12.1 5.6 11.8 6.2 11.8 6.6 Z" fill="#000" transform="rotate(120, 12, 12)" />
              <path d="M 12 7.5 A 1.1 1.1 0 1 0 11 8.5 C 11.3 9 12.5 9 13 8 C 13.5 7 12.8 6.2 12.3 5.8 C 12.1 5.6 11.8 6.2 11.8 6.6 Z" fill="#000" transform="rotate(240, 12, 12)" />
            </g>
          </svg>
        </span>
        LIVE
      </span>
      <span className="sep">|</span>
      <span>{overview?.total_repos ?? "—"} REPOS</span>
      <span className="sep col-hide-mobile">|</span>
      <span className="col-hide-mobile">AI/ML ECOSYSTEM</span>
      {unread > 0 && (
        <>
          <span className="sep">|</span>
          <span>{unread} ALERTS</span>
        </>
      )}
      <span className="sep col-hide-tablet">|</span>
      <span className="col-hide-tablet">REPODAR v2.0 — GITHUB AI RADAR</span>
    </div>
  );
}
