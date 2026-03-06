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
    <div className="page-root">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div className="section-title-cyber">BEFORE IT TRENDS<span className="terminal-cursor" /></div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700,
          color: "var(--cyan)", border: "1px solid var(--cyan)", padding: "2px 8px",
          letterSpacing: "0.1em" }}>EARLY RADAR</span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
        // Young repos with strong momentum — catch the next breakout
      </div>

      {/* Filters */}
      <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "180px" }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            MAX AGE — {maxAge}d
          </label>
          <input type="range" min={7} max={180} step={7} value={maxAge}
            onChange={(e) => setMaxAge(Number(e.target.value))}
            style={{ cursor: "pointer", accentColor: "var(--cyan)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)",
            fontSize: "10px", color: "var(--text-muted)" }}>
            <span>7d</span><span>180d</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            MAX STARS — {maxStars.toLocaleString()}
          </label>
          <input type="range" min={100} max={10000} step={100} value={maxStars}
            onChange={(e) => setMaxStars(Number(e.target.value))}
            style={{ cursor: "pointer", accentColor: "var(--cyan)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)",
            fontSize: "10px", color: "var(--text-muted)" }}>
            <span>100</span><span>10k</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            MIN ACCEL — {minAccel.toFixed(1)}
          </label>
          <input type="range" min={0} max={10} step={0.5} value={minAccel}
            onChange={(e) => setMinAccel(Number(e.target.value))}
            style={{ cursor: "pointer", accentColor: "var(--cyan)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)",
            fontSize: "10px", color: "var(--text-muted)" }}>
            <span>0</span><span>10</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>CATEGORY</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="cyber-select">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === "All" ? "ALL CATEGORIES" : c.replace(/_/g, " ").toUpperCase()}</option>
            ))}
          </select>
        </div>

        <button onClick={() => refetch()} className="btn-cyber btn-cyber-cyan" style={{ padding: "8px 16px" }}>
          REFRESH
        </button>
      </div>

      {!isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
          letterSpacing: "0.06em" }}>
          // {repos.length} REPOS MATCHED
        </div>
      )}

      {isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "60px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // SCANNING FOR EARLY BREAKOUTS<span className="terminal-cursor" />
        </div>
      )}

      {error && (
        <div className="panel" style={{ border: "1px solid var(--pink)", textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", fontSize: "12px" }}>
            ✕ FAILED TO LOAD — backend may still be indexing
          </span>
        </div>
      )}

      {/* Grid */}
      {!isLoading && repos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {repos.map((repo) => {
            const isHot = repo.acceleration > 3;
            return (
              <div key={repo.repo_id}
                style={{ background: "var(--bg-surface)",
                  border: `1px solid ${isHot ? "var(--pink)" : "var(--border)"}`,
                  padding: "16px", cursor: "pointer", position: "relative",
                  boxShadow: isHot ? "0 0 12px var(--pink)22" : "none" }}
                onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}>
                {isHot && (
                  <span style={{ position: "absolute", top: "10px", right: "10px",
                    fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700,
                    color: "var(--pink)", border: "1px solid var(--pink)", padding: "2px 6px",
                    letterSpacing: "0.08em" }}>HOT</span>
                )}
                <div style={{ marginBottom: "8px", paddingRight: isHot ? "60px" : "0" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px",
                    fontWeight: 600, color: "var(--cyan)" }}>
                    {repo.owner}/{repo.name}
                  </span>
                  {repo.primary_language && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                      color: "var(--text-muted)", marginLeft: "8px" }}>
                      {repo.primary_language}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="cyber-tag">{repo.category.replace(/_/g, " ")}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: "var(--text-muted)" }}>{repo.age_days}d old</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "8px", marginBottom: "12px" }}>
                  <Stat label="STARS" value={repo.stars.toLocaleString()} />
                  <Stat label="VEL/D" value={`+${repo.star_velocity_7d.toFixed(1)}`} highlight />
                  <Stat label="ACCEL" value={repo.acceleration.toFixed(2)} highlight={isHot} />
                </div>
                {repo.topics && repo.topics.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
                    {repo.topics.slice(0, 5).map((t) => (
                      <span key={t} className="cyber-tag">#{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: "var(--text-muted)" }}>score: {repo.trend_score.toFixed(4)}</span>
                  <SustainBadge label={repo.sustainability_label} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !error && repos.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)",
            letterSpacing: "0.08em" }}>// NO REPOS MATCHED — TRY LOOSENING FILTERS</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700,
        color: highlight ? "var(--cyan)" : "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
