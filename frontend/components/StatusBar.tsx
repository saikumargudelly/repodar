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
      <span>● LIVE</span>
      <span className="sep">|</span>
      <span>{overview?.total_repos ?? "—"} REPOS TRACKED</span>
      <span className="sep">|</span>
      <span>AI/ML ECOSYSTEM</span>
      {unread > 0 && (
        <>
          <span className="sep">|</span>
          <span>{unread} ALERTS</span>
        </>
      )}
      <span className="sep">|</span>
      <span>REPODAR v2.0 — GITHUB AI RADAR</span>
    </div>
  );
}
