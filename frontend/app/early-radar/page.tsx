"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, EarlyRadarRepo } from "@/lib/api";
import { StatusDot } from "@/components/ui/StatusDot";

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

  // Debounced parameters
  const [debouncedMaxAge, setDebouncedMaxAge] = useState(90);
  const [debouncedMaxStars, setDebouncedMaxStars] = useState(1000);
  const [debouncedMinAccel, setDebouncedMinAccel] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMaxAge(maxAge);
      setDebouncedMaxStars(maxStars);
      setDebouncedMinAccel(minAccel);
    }, 300);
    return () => clearTimeout(timer);
  }, [maxAge, maxStars, minAccel]);

  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<
    "breakout_score" | "acceleration" | "star_velocity_7d" | "velocity_ratio" | "novelty_score" | "trend_score"
  >("breakout_score");
  const [momentumStage, setMomentumStage] = useState<"all" | "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout">("all");
  const [preViralOnly, setPreViralOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["early-radar", debouncedMaxAge, debouncedMaxStars, debouncedMinAccel, category, sortBy, momentumStage, preViralOnly],
    queryFn: () =>
      api.getEarlyRadar({
        max_age_days: debouncedMaxAge,
        max_stars: debouncedMaxStars,
        min_acceleration: debouncedMinAccel,
        category: category !== "All" ? category : undefined,
        sort_by: sortBy,
        momentum_stage: momentumStage !== "all" ? momentumStage : undefined,
        require_pre_viral: preViralOnly,
        limit: 60,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const repos: EarlyRadarRepo[] = data ?? [];

  return (
    <div className="page-root">
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div className="page-eyebrow">Young repositories with strong momentum — catch the next breakout</div>
        <h1 className="page-title">Before It Trends</h1>
      </div>

      {/* Filters Toggle for Mobile */}
      <div className="filters-toggle-bar" style={{ display: "none" }}>
        <button 
          onClick={() => setShowFilters(!showFilters)} 
          className="btn-cyber btn-cyber-cyan" 
          style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px", padding: "8px" }}
        >
          {showFilters ? "HIDE FILTERS ▲" : "SHOW FILTERS ▼"}
        </button>
      </div>

      {/* Filters */}
      <div className={`panel early-radar-filters-panel ${showFilters ? "open" : ""}`}>
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

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>SORT BY</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="cyber-select">
            <option value="breakout_score">BREAKOUT SCORE</option>
            <option value="acceleration">ACCELERATION</option>
            <option value="star_velocity_7d">7D VELOCITY</option>
            <option value="velocity_ratio">VELOCITY RATIO</option>
            <option value="novelty_score">NOVELTY</option>
            <option value="trend_score">TREND SCORE</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>STAGE</label>
          <select value={momentumStage} onChange={(e) => setMomentumStage(e.target.value as typeof momentumStage)} className="cyber-select">
            <option value="all">ALL STAGES</option>
            <option value="dormant">DORMANT</option>
            <option value="emerging">EMERGING</option>
            <option value="accelerating">ACCELERATING</option>
            <option value="pre_viral">PRE-VIRAL</option>
            <option value="breakout">BREAKOUT</option>
          </select>
        </div>

        <label style={{ display: "flex", gap: "8px", alignItems: "center", fontFamily: "var(--font-mono)",
          fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}>
          <input type="checkbox" checked={preViralOnly} onChange={(e) => setPreViralOnly(e.target.checked)}
            style={{ accentColor: "var(--cyan)", cursor: "pointer" }} />
          PRE-VIRAL ONLY
        </label>

        <button onClick={() => refetch()} className="btn-cyber btn-cyber-cyan" style={{ padding: "8px 16px" }}>
          REFRESH
        </button>
      </div>

      {!isLoading && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "14px" }}>
          {`${repos.length} repositories matched`}
        </div>
      )}

      {isLoading && (
        <div style={{ color: "var(--text-muted)", padding: "40px 0", textAlign: "center", fontSize: "12px" }}>
          Scanning for early breakouts...
        </div>
      )}

      {error && (
        <div className="panel" style={{ border: "1px solid var(--pink)", textAlign: "center", marginBottom: "14px" }}>
          <span style={{ color: "var(--pink)", fontSize: "12px" }}>
            ✕ Failed to load data — backend may still be indexing
          </span>
        </div>
      )}

      {/* Grid */}
      {!isLoading && repos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {repos.map((repo) => {
            const isHot = repo.acceleration > 3;
            const stage = repo.momentum_stage ?? "emerging";
            const stageColor = stage === "breakout"
              ? "var(--pink)"
              : stage === "pre_viral"
                ? "var(--amber)"
                : stage === "accelerating"
                  ? "var(--cyan)"
                  : "var(--text-muted)";
            const breakoutScore = repo.breakout_score ?? repo.trend_score;
            const velocityRatio = repo.velocity_ratio ?? 0;
            const noveltyScore = repo.novelty_score ?? 0;
            const activeSignals = repo.active_signals ?? [];

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
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
                    color: stageColor, border: `1px solid ${stageColor}`, padding: "2px 6px",
                    letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {stage.replace(/_/g, " ")}
                  </span>
                  {repo.outpaces_category && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--green)",
                      border: "1px solid var(--green)", padding: "2px 6px", letterSpacing: "0.05em" }}>
                      OUTPACING CATEGORY
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: "var(--text-muted)" }}>{repo.age_days}d old</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "8px", marginBottom: "12px" }}>
                  <Stat label="STARS" value={repo.stars.toLocaleString()} />
                  <Stat label="VEL/D" value={`+${repo.star_velocity_7d.toFixed(1)}`} highlight />
                  <Stat label="ACCEL" value={repo.acceleration.toFixed(2)} highlight={isHot} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                  <Stat label="BREAKOUT" value={breakoutScore.toFixed(3)} highlight />
                  <Stat label="VEL RATIO" value={velocityRatio.toFixed(2)} />
                  <Stat label="NOVELTY" value={noveltyScore.toFixed(2)} />
                </div>

                {repo.estimated_viral_eta_days !== undefined && repo.estimated_viral_eta_days !== null && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--amber)",
                    letterSpacing: "0.05em", marginBottom: "10px" }}>
                    ETA TO 5K STARS: ~{repo.estimated_viral_eta_days}d
                  </div>
                )}

                {activeSignals.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
                    {activeSignals.slice(0, 4).map((signal) => (
                      <span key={signal} style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--amber)",
                        border: "1px solid var(--amber)", padding: "2px 5px", letterSpacing: "0.04em",
                        textTransform: "uppercase" }}>
                        {signal.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}

                {repo.topics && repo.topics.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
                    {repo.topics.slice(0, 5).map((t) => (
                      <span key={t} className="cyber-tag">#{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: "var(--text-muted)" }}>trend: {repo.trend_score.toFixed(4)}</span>
                  <StatusDot label={repo.sustainability_label} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !error && repos.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: "64px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No repositories matched. Try loosening filters.</div>
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
