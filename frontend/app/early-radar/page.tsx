"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, EarlyRadarRepo } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

const CATEGORIES = [
  "All",
  "model_training",
  "inference_serving",
  "data_pipeline",
  "vector_database",
  "evaluation",
  "agents_orchestration",
  "fine_tuning",
  "multimodal",
  "rlhf_alignment",
  "deployment_infra",
];

export default function EarlyRadarPage() {
  const router = useRouter();
  const [maxAge, setMaxAge] = useState(90);
  const [maxStars, setMaxStars] = useState(1000);
  const [minAccel, setMinAccel] = useState(0);
  const [category, setCategory] = useState("All");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["early-radar", maxAge, maxStars, minAccel, category],
    queryFn: () =>
      api.getEarlyRadar({
        max_age_days: maxAge,
        max_stars: maxStars,
        min_acceleration: minAccel,
        category: category !== "All" ? category : undefined,
        limit: 60,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const repos: EarlyRadarRepo[] = data ?? [];

  return (
    <main
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "var(--font-sans, sans-serif)",
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "22px" }}>🚀</span>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Before It Trends</h1>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              background: "var(--accent-blue)",
              color: "white",
              borderRadius: "4px",
              padding: "2px 8px",
              letterSpacing: "0.4px",
            }}
          >
            EARLY RADAR
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          Young repos with strong momentum — catch the next breakout before the crowd.
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "20px",
          marginBottom: "28px",
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "flex-end",
        }}
      >
        {/* Max Age */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "180px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Max Age — {maxAge} days
          </label>
          <input
            type="range"
            min={7}
            max={180}
            step={7}
            value={maxAge}
            onChange={(e) => setMaxAge(Number(e.target.value))}
            style={{ cursor: "pointer", accentColor: "var(--accent-blue)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>7d</span><span>180d</span>
          </div>
        </div>

        {/* Max Stars */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Max Stars — {maxStars.toLocaleString()}
          </label>
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={maxStars}
            onChange={(e) => setMaxStars(Number(e.target.value))}
            style={{ cursor: "pointer", accentColor: "var(--accent-blue)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>100</span><span>10k</span>
          </div>
        </div>

        {/* Min Acceleration */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Min Acceleration — {minAccel.toFixed(1)}
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={minAccel}
            onChange={(e) => setMinAccel(Number(e.target.value))}
            style={{ cursor: "pointer", accentColor: "var(--accent-blue)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>0</span><span>10</span>
          </div>
        </div>

        {/* Category */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: "7px 10px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === "All" ? "All Categories" : c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          style={{
            padding: "8px 16px",
            background: "var(--accent-blue)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Count */}
      {!isLoading && (
        <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "12px" }}>
          {repos.length} repos matched your filters
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Scanning for early breakouts…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--accent-red)", fontSize: "13px" }}>
          Failed to load. The backend may still be indexing data.
        </div>
      )}

      {/* Grid */}
      {!isLoading && repos.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {repos.map((repo) => {
            const isHot = repo.acceleration > 3;
            return (
              <div
                key={repo.repo_id}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${isHot ? "var(--accent-blue)" : "var(--border)"}`,
                  borderRadius: "10px",
                  padding: "16px",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s",
                  position: "relative",
                }}
                onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
              >
                {/* Hot badge */}
                {isHot && (
                  <span
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "var(--accent-blue)",
                      color: "white",
                      borderRadius: "4px",
                      padding: "2px 6px",
                    }}
                  >
                    🔥 HOT
                  </span>
                )}

                {/* Title */}
                <div style={{ marginBottom: "8px", paddingRight: isHot ? "64px" : "0" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-blue)" }}>
                    {repo.owner}/{repo.name}
                  </span>
                  {repo.primary_language && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
                      {repo.primary_language}
                    </span>
                  )}
                </div>

                {/* Category + Age */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "4px",
                      padding: "2px 6px",
                    }}
                  >
                    {repo.category.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", padding: "2px 0" }}>
                    {repo.age_days}d old
                  </span>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                  <Stat label="Stars" value={repo.stars.toLocaleString()} />
                  <Stat label="Velocity/d" value={`+${repo.star_velocity_7d.toFixed(1)}`} highlight />
                  <Stat label="Accel." value={repo.acceleration.toFixed(2)} highlight={isHot} />
                </div>

                {/* Topics */}
                {repo.topics && repo.topics.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
                    {repo.topics.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: "10px",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          padding: "2px 7px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Score: {repo.trend_score.toFixed(4)}
                  </span>
                  <SustainBadge label={repo.sustainability_label} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && repos.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          No repos found for these filters. Try loosening the criteria.
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: highlight ? "var(--accent-blue)" : "var(--text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
