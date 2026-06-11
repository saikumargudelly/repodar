"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api, EarlyRadarRepo, LanguageStat, RadarRepo } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(","), ...data.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))];
  downloadBlob(rows.join("\n"), filename, "text/csv");
}

function exportJSON(data: Record<string, unknown>[], filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json");
}

// ─── Types ─────────────────────────────────────────────────
type RadarTab = "before" | "breakout" | "early";
type EstablishedSortKey = "trend_score" | "acceleration" | "star_velocity_7d" | "age_days" | "sustainability_score";
type EarlySortKey = "breakout_score" | "acceleration" | "star_velocity_7d" | "velocity_ratio" | "novelty_score" | "trend_score";
type EarlyStage = "all" | "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout";

// ─── Helpers ────────────────────────────────────────────────
function stageText(stage: string): string {
  return stage.replace(/_/g, " ").toUpperCase();
}

function stageColor(stage: string | undefined): string {
  if (stage === "breakout" || stage === "viral") return "var(--pink)";
  if (stage === "pre_viral") return "var(--amber)";
  if (stage === "accelerating" || stage === "rising") return "var(--cyan)";
  if (stage === "emerging") return "var(--text-muted)";
  return "var(--text-muted)";
}

const SORT_LABEL: Record<EstablishedSortKey, string> = {
  trend_score: "Trend score",
  acceleration: "Acceleration",
  star_velocity_7d: "Stars / day",
  sustainability_score: "Sustainability",
  age_days: "Age (lowest first)",
};

export default function RadarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive tab from URL ?tab=
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<RadarTab>(
    tabParam === "breakout" ? "breakout" : tabParam === "early" ? "early" : "before"
  );

  // ── "Before it trends" controls ──
  const [beforeMaxAge, setBeforeMaxAge] = useState(90);
  const [beforeMaxStars, setBeforeMaxStars] = useState(1000);
  const [beforeMinAccel, setBeforeMinAccel] = useState(0);
  const [beforePreViralOnly, setBeforePreViralOnly] = useState(false);

  // ── Breakout Radar controls ──
  const [newOnly, setNewOnly] = useState(false);
  const [establishedSort, setEstablishedSort] = useState<EstablishedSortKey>("trend_score");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // ── Early Insight controls ──
  const [maxAge, setMaxAge] = useState(180);
  const [maxStars, setMaxStars] = useState(50000);
  const [minAccel, setMinAccel] = useState(0);
  const [earlySort, setEarlySort] = useState<EarlySortKey>("breakout_score");
  const [earlyStage, setEarlyStage] = useState<EarlyStage>("all");
  const [preViralOnly, setPreViralOnly] = useState(false);
  const [requireConsistentGrowth, setRequireConsistentGrowth] = useState(false);
  const [requireForkMomentum, setRequireForkMomentum] = useState(false);
  const [requireSustainedVelocity, setRequireSustainedVelocity] = useState(false);

  // ── Queries ──────────────────────────────────────────────
  const { data: beforeData, isLoading: beforeLoading, refetch: refetchBefore } = useQuery({
    queryKey: ["radar-before", beforeMaxAge, beforeMaxStars, beforeMinAccel, beforePreViralOnly],
    queryFn: () => api.getEarlyRadar({
      max_age_days: beforeMaxAge,
      max_stars: beforeMaxStars,
      min_acceleration: beforeMinAccel,
      require_pre_viral: beforePreViralOnly || undefined,
      sort_by: "breakout_score",
      limit: 50,
    }),
    enabled: activeTab === "before",
    staleTime: 5 * 60 * 1000,
  });

  const { data: radarData, isLoading: radarLoading } = useQuery({
    queryKey: ["radar-breakout", newOnly, establishedSort],
    queryFn: () => api.getRadar(newOnly, "All", undefined, establishedSort, establishedSort === "age_days" ? "asc" : "desc", 100),
    enabled: activeTab === "breakout",
    staleTime: 5 * 60 * 1000,
  });

  const { data: earlyData, isLoading: earlyLoading } = useQuery({
    queryKey: ["radar-early", maxAge, maxStars, minAccel, earlySort, earlyStage, preViralOnly, requireConsistentGrowth, requireForkMomentum, requireSustainedVelocity],
    queryFn: () => api.getEarlyRadar({
      max_age_days: maxAge,
      max_stars: maxStars,
      min_acceleration: minAccel,
      sort_by: earlySort,
      momentum_stage: earlyStage !== "all" ? earlyStage : undefined,
      require_pre_viral: preViralOnly || undefined,
      require_consistent_growth: requireConsistentGrowth || undefined,
      require_fork_momentum: requireForkMomentum || undefined,
      require_sustained_velocity: requireSustainedVelocity || undefined,
      limit: 100,
    }),
    enabled: activeTab === "early",
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived data ─────────────────────────────────────────
  const beforeRows = useMemo(() => beforeData ?? [], [beforeData]);
  const establishedRows = useMemo(() => radarData ?? [], [radarData]);
  const earlyRows = useMemo(() => earlyData ?? [], [earlyData]);

  // Metric calculations for breakout
  const breakoutTrendAvg = useMemo(() => {
    if (!establishedRows.length) return 0;
    return establishedRows.reduce((s, r) => s + r.trend_score, 0) / establishedRows.length;
  }, [establishedRows]);
  const breakoutAccelAvg = useMemo(() => {
    if (!establishedRows.length) return 0;
    return establishedRows.reduce((s, r) => s + r.acceleration, 0) / establishedRows.length;
  }, [establishedRows]);
  const breakoutHighMomentum = useMemo(() => establishedRows.filter((r) => r.acceleration > 1).length, [establishedRows]);

  // Metric calculations for early
  const earlyTrendAvg = useMemo(() => {
    if (!earlyRows.length) return 0;
    return earlyRows.reduce((s, r) => s + r.trend_score, 0) / earlyRows.length;
  }, [earlyRows]);
  const earlyAccelAvg = useMemo(() => {
    if (!earlyRows.length) return 0;
    return earlyRows.reduce((s, r) => s + r.acceleration, 0) / earlyRows.length;
  }, [earlyRows]);
  const earlyPreViral = useMemo(() =>
    earlyRows.filter((r) => r.momentum_stage === "pre_viral" || r.momentum_stage === "breakout" || (r.breakout_score ?? 0) > 1).length,
  [earlyRows]);

  // Export rows
  const breakoutExportRows = useMemo(() => establishedRows.map((r) => ({
    repo: `${r.owner}/${r.name}`, category: r.category, stars: r.stars,
    trend_score: r.trend_score, acceleration: r.acceleration, star_velocity_7d: r.star_velocity_7d,
    sustainability_score: r.sustainability_score, sustainability_label: r.sustainability_label, age_days: r.age_days,
  })), [establishedRows]);

  const earlyExportRows = useMemo(() => earlyRows.map((r) => ({
    repo: `${r.owner}/${r.name}`, category: r.category, stars: r.stars,
    trend_score: r.trend_score, breakout_score: r.breakout_score ?? null,
    acceleration: r.acceleration, stage: r.momentum_stage ?? null,
    velocity_7d: r.star_velocity_7d, velocity_ratio: r.velocity_ratio ?? null,
    eta_to_5k_days: r.estimated_viral_eta_days ?? null, sustainability_label: r.sustainability_label,
  })), [earlyRows]);

  const switchTab = (tab: RadarTab) => {
    setActiveTab(tab);
    setShowSortDropdown(false);
  };

  return (
    <div className="page-root">

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "28px", borderBottom: "1px solid var(--border)" }}>
        {(["before", "breakout", "early"] as RadarTab[]).map((tab, i) => {
          const labels: Record<RadarTab, string> = {
            before: "Before it trends",
            breakout: "Breakout radar",
            early: "Early insight radar",
          };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              style={{
                padding: "10px 20px",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                background: isActive ? "var(--bg-secondary)" : "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid var(--text-primary)" : "2px solid transparent",
                borderRight: i < 2 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════
          TAB 1 — Before it trends
         ══════════════════════════════════════════════════ */}
      {activeTab === "before" && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: "6px" }}>
              EARLY RADAR
            </div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Before it trends</h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "6px 0 0" }}>
              Young repos with strong momentum — catch the next breakout
            </p>
          </div>

          {/* Filters inline bar */}
          <div className="panel" style={{ padding: "16px 20px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
              {/* MAX AGE */}
              <SliderBlock
                label="MAX AGE"
                value={`${beforeMaxAge}D`}
                min={7} max={365} step={7}
                current={beforeMaxAge}
                onChange={setBeforeMaxAge}
                style={{ flex: "1 1 180px", borderRight: "1px solid var(--border)", paddingRight: "20px", marginRight: "20px" }}
              />
              {/* MAX STARS */}
              <SliderBlock
                label="MAX STARS"
                value={beforeMaxStars >= 1000 ? `${(beforeMaxStars / 1000).toFixed(0)},000` : String(beforeMaxStars)}
                min={100} max={50000} step={100}
                current={beforeMaxStars}
                onChange={setBeforeMaxStars}
                style={{ flex: "1 1 180px", borderRight: "1px solid var(--border)", paddingRight: "20px", marginRight: "20px" }}
              />
              {/* MIN ACCEL */}
              <SliderBlock
                label="MIN ACCEL"
                value={beforeMinAccel.toFixed(1)}
                min={0} max={10} step={0.5}
                current={beforeMinAccel}
                onChange={setBeforeMinAccel}
                style={{ flex: "1 1 180px", borderRight: "1px solid var(--border)", paddingRight: "20px", marginRight: "20px" }}
              />
              {/* Pre-viral checkbox */}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={beforePreViralOnly}
                  onChange={(e) => setBeforePreViralOnly(e.target.checked)}
                  style={{ accentColor: "#58a6ff", width: "14px", height: "14px", cursor: "pointer" }}
                />
                Pre-viral only
              </label>
            </div>
          </div>

          {/* Count + Refresh row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)" }}>
              {beforeLoading ? "Loading..." : `${beforeRows.length} repo${beforeRows.length !== 1 ? "s" : ""} matched`}
            </span>
            <button
              onClick={() => refetchBefore()}
              style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }}
            >
              ↻ Refresh ↗
            </button>
          </div>

          {/* Cards */}
          {beforeLoading ? (
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center", padding: "60px 0", fontSize: "12px", letterSpacing: "0.06em" }}>
              // SCANNING FOR EARLY BREAKOUTS<span className="terminal-cursor" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {beforeRows.map((repo) => (
                <BeforeCard key={repo.repo_id} repo={repo} onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)} />
              ))}
              {beforeRows.length === 0 && (
                <div className="panel" style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px" }}>
                  // NO REPOS MATCH CURRENT FILTERS — TRY INCREASING MAX AGE OR MAX STARS
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 2 — Breakout radar
         ══════════════════════════════════════════════════ */}
      {activeTab === "breakout" && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: "6px" }}>
              BREAKOUT RADAR
            </div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Established repos</h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "6px 0 0" }}>
              Established repos ranked by signal strength
            </p>
          </div>

          {/* Metric cards */}
          <div className="radar-summary-grid" style={{ marginBottom: "20px" }}>
            <MetricCard label="MATCHED REPOS" value={String(establishedRows.length)} />
            <MetricCard label="AVG TREND SCORE" value={breakoutTrendAvg.toFixed(4)} highlight="var(--amber)" />
            <MetricCard label="AVG ACCELERATION" value={breakoutAccelAvg.toFixed(2)} />
            <MetricCard label="HIGH MOMENTUM" value={String(breakoutHighMomentum)} highlight="var(--green)" />
          </div>

          {/* Controls bar */}
          <div className="panel" style={{ padding: "14px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            {/* New only checkbox */}
            <label style={{ display: "flex", alignItems: "center", gap: "7px", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={newOnly}
                onChange={(e) => setNewOnly(e.target.checked)}
                style={{ accentColor: "#58a6ff", width: "14px", height: "14px", cursor: "pointer" }}
              />
              New only (&lt;180D)
            </label>

            {/* Sort by label */}
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)" }}>Sort by</span>

            {/* Sort dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowSortDropdown((p) => !p)}
                style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-primary)", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", minWidth: "160px", justifyContent: "space-between" }}
              >
                {SORT_LABEL[establishedSort]}
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>▼</span>
              </button>
              {showSortDropdown && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", zIndex: 50, minWidth: "180px", overflow: "hidden" }}>
                  {(Object.keys(SORT_LABEL) as EstablishedSortKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setEstablishedSort(key); setShowSortDropdown(false); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", fontFamily: "var(--font-sans)", fontSize: "13px", color: key === establishedSort ? "var(--text-primary)" : "var(--text-muted)", background: key === establishedSort ? "var(--bg-primary)" : "transparent", border: "none", cursor: "pointer" }}
                    >
                      {SORT_LABEL[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export buttons */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <ExportBtn label="Export CSV ↗" onClick={() => exportCSV(breakoutExportRows, "radar-breakout.csv")} />
              <ExportBtn label="Export JSON ↗" onClick={() => exportJSON(breakoutExportRows, "radar-breakout.json")} />
            </div>
          </div>

          {/* Table */}
          <div className="panel table-scroll">
            {radarLoading ? (
              <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center", padding: "60px 0", fontSize: "12px", letterSpacing: "0.06em" }}>
                // LOADING RADAR DATA<span className="terminal-cursor" />
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr>
                    {["#", "REPO", "CATEGORY", "TREND", "STARS/D", "ACCEL", "SUSTAIN", "LABEL", "AGE"].map((h) => (
                      <th key={h} className="th-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {establishedRows.map((repo, i) => (
                    <RadarRow key={repo.repo_id} repo={repo} rank={i + 1} onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)} />
                  ))}
                  {establishedRows.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
                        // NO DATA — RUN THE PIPELINE VIA POST /admin/run-all
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 3 — Early insight radar
         ══════════════════════════════════════════════════ */}
      {activeTab === "early" && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: "6px" }}>
              EARLY INSIGHT RADAR
            </div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Emerging repos</h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "6px 0 0" }}>
              Emerging repos ranked by breakout probability
            </p>
          </div>

          {/* Metric cards */}
          <div className="radar-summary-grid" style={{ marginBottom: "20px" }}>
            <MetricCard label="MATCHED REPOS" value={String(earlyRows.length)} />
            <MetricCard label="AVG TREND SCORE" value={earlyTrendAvg.toFixed(4)} highlight="var(--amber)" />
            <MetricCard label="AVG ACCELERATION" value={earlyAccelAvg.toFixed(2)} />
            <MetricCard label="PRE-VIRAL / BREAKOUT" value={String(earlyPreViral)} highlight="var(--green)" />
          </div>

          {/* Sliders + Signal Filters + Stage/Sort panel */}
          <div className="panel" style={{ padding: "16px 20px", marginBottom: "16px" }}>
            {/* Sliders row */}
            <div style={{ display: "flex", gap: "0", flexWrap: "wrap", marginBottom: "20px" }}>
              <SliderBlock
                label="MAX AGE"
                value={`${maxAge}d`}
                min={7} max={365} step={7}
                current={maxAge}
                onChange={setMaxAge}
                minLabel="7d" maxLabel="365d"
                style={{ flex: "1 1 160px", borderRight: "1px solid var(--border)", paddingRight: "20px", marginRight: "20px" }}
              />
              <SliderBlock
                label="MAX STARS"
                value={maxStars >= 1000 ? `${(maxStars / 1000).toFixed(0)},000` : String(maxStars)}
                min={100} max={100000} step={500}
                current={maxStars}
                onChange={setMaxStars}
                minLabel="100" maxLabel="100k"
                style={{ flex: "1 1 160px", borderRight: "1px solid var(--border)", paddingRight: "20px", marginRight: "20px" }}
              />
              <SliderBlock
                label="MIN ACCEL"
                value={minAccel.toFixed(1)}
                min={0} max={10} step={0.5}
                current={minAccel}
                onChange={setMinAccel}
                minLabel="0" maxLabel="10"
                style={{ flex: "1 1 160px" }}
              />
            </div>

            {/* Signal filters + Stage/Sort row */}
            <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* Signal filters checkboxes */}
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "10px" }}>
                  SIGNAL FILTERS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { label: "Pre-viral only (14D to 5K)", checked: preViralOnly, onChange: setPreViralOnly },
                    { label: "Consistent growth (5+ of 7D)", checked: requireConsistentGrowth, onChange: setRequireConsistentGrowth },
                    { label: "Fork momentum", checked: requireForkMomentum, onChange: setRequireForkMomentum },
                    { label: "Sustained 30D velocity", checked: requireSustainedVelocity, onChange: setRequireSustainedVelocity },
                  ].map(({ label, checked, onChange }) => (
                    <label key={label} style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onChange(e.target.checked)}
                        style={{ accentColor: "#58a6ff", width: "14px", height: "14px", cursor: "pointer", flexShrink: 0 }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Stage + Sort selects */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "240px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "6px" }}>
                    STAGE
                  </div>
                  <select
                    value={earlyStage}
                    onChange={(e) => setEarlyStage(e.target.value as EarlyStage)}
                    className="cyber-select"
                    style={{ width: "100%" }}
                  >
                    <option value="all">All stages</option>
                    <option value="dormant">Dormant</option>
                    <option value="emerging">Emerging</option>
                    <option value="accelerating">Accelerating</option>
                    <option value="pre_viral">Pre-viral</option>
                    <option value="breakout">Breakout</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "6px" }}>
                    SORT BY
                  </div>
                  <select
                    value={earlySort}
                    onChange={(e) => setEarlySort(e.target.value as EarlySortKey)}
                    className="cyber-select"
                    style={{ width: "100%" }}
                  >
                    <option value="breakout_score">Breakout score</option>
                    <option value="acceleration">Acceleration</option>
                    <option value="star_velocity_7d">7D velocity</option>
                    <option value="velocity_ratio">Velocity ratio</option>
                    <option value="novelty_score">Novelty</option>
                    <option value="trend_score">Trend score</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Count row + Export */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)" }}>
              {earlyLoading ? "Loading..." : `${earlyRows.length} repos matched`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <ExportBtn label="Export CSV ↗" onClick={() => exportCSV(earlyExportRows, "radar-early.csv")} />
              <ExportBtn label="Export JSON ↗" onClick={() => exportJSON(earlyExportRows, "radar-early.json")} />
            </div>
          </div>

          {/* Table */}
          <div className="panel table-scroll">
            {earlyLoading ? (
              <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center", padding: "60px 0", fontSize: "12px", letterSpacing: "0.06em" }}>
                // SCANNING FOR EARLY BREAKOUTS<span className="terminal-cursor" />
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr>
                    {["#", "REPO", "STAGE", "BREAKOUT", "TREND", "ACCEL", "ETA", "SIGNALS", "HEALTH"].map((h) => (
                      <th key={h} className="th-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {earlyRows.map((repo, i) => (
                    <EarlyRow
                      key={repo.repo_id}
                      repo={repo}
                      rank={i + 1}
                      onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                    />
                  ))}
                  {earlyRows.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
                        // NO EARLY SIGNALS MATCH THE CURRENT FILTERS
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer: Showing N of M + navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", padding: "0 4px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)" }}>
              {earlyLoading ? "" : `Showing ${Math.min(earlyRows.length, earlyRows.length)} of ${earlyRows.length}`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => router.push("/radar?tab=breakout")}
                style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 14px", cursor: "pointer", fontWeight: 500 }}
              >
                Top breakouts ↗
              </button>
              <button
                onClick={() => router.push("/overview")}
                style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 14px", cursor: "pointer", fontWeight: 500 }}
              >
                Signal picks ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function SliderBlock({
  label, value, min, max, step, current, onChange, minLabel, maxLabel, style,
}: {
  label: string; value: string; min: number; max: number; step: number;
  current: number; onChange: (v: number) => void;
  minLabel?: string; maxLabel?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.07em" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="radar-range"
        style={{ width: "100%", accentColor: "#58a6ff", cursor: "pointer" }}
      />
      {(minLabel || maxLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>{minLabel}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
    >
      {label}
    </button>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="panel radar-metric-card" style={{ padding: "14px 16px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color: highlight ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

// "Before it trends" card
function BeforeCard({ repo, onClick }: { repo: EarlyRadarRepo; onClick: () => void }) {
  const stage = repo.momentum_stage ?? "emerging";
  const signals = repo.active_signals ?? [];
  const accel = repo.acceleration ?? 0;
  const velRatio = repo.velocity_ratio ?? 0;
  const novelty = repo.novelty_score ?? 0;

  return (
    <div
      className="panel"
      onClick={onClick}
      style={{ padding: "16px 20px", cursor: "pointer" }}
    >
      {/* Top row: owner/name · language · category · stage · age */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
          <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>{repo.owner}/</span>{repo.name}
        </span>
        {repo.primary_language && (
          <span className="cyber-tag" style={{ fontSize: "11px" }}>{repo.primary_language}</span>
        )}
        {repo.category && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>{repo.category}</span>
        )}
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "10px", padding: "2px 8px",
          border: `1px solid ${stageColor(stage)}`, color: stageColor(stage),
          textTransform: "capitalize", borderRadius: "3px",
        }}>
          {stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, " ")}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
          {repo.age_days}d old
        </span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 24px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "3px" }}>STARS</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{repo.stars.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "3px" }}>VEL / D</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--green)" }}>+{repo.star_velocity_7d.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "3px" }}>ACCEL</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: accel > 0 ? "var(--amber)" : "var(--text-muted)" }}>
            {accel.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "3px" }}>BREAKOUT</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
            {(repo.breakout_score ?? repo.trend_score).toFixed(3)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "3px" }}>VEL RATIO</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{velRatio.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.07em", marginBottom: "3px" }}>NOVELTY</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{novelty.toFixed(2)}</div>
        </div>
      </div>

      {/* ETA row */}
      {repo.estimated_viral_eta_days !== undefined && repo.estimated_viral_eta_days !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
          ETA to 5k stars:{" "}
          <span style={{ color: "var(--amber)" }}>~{repo.estimated_viral_eta_days}d</span>
        </div>
      )}

      {/* Signals row */}
      {signals.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {signals.map((s) => (
            <span key={s} className="cyber-tag" style={{ fontSize: "11px", textTransform: "capitalize" }}>
              {s.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row: trend · health badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
          trend: {repo.trend_score.toFixed(4)}
        </span>
        <SustainBadge label={repo.sustainability_label} />
      </div>
    </div>
  );
}

// Early insight radar table row
function EarlyRow({ repo, rank, onClick }: { repo: EarlyRadarRepo; rank: number; onClick: () => void }) {
  const stage = repo.momentum_stage ?? "emerging";
  const signals = repo.active_signals ?? [];
  const accel = repo.acceleration ?? 0;
  const breakout = repo.breakout_score ?? repo.trend_score;
  const eta = repo.estimated_viral_eta_days;

  // Stage badge colors (cast to string to handle any API values)
  const stageStr = stage as string;
  let stageBg = "transparent";
  let stageBorder = "var(--border)";
  let stageTextColor = "var(--text-muted)";
  if (stageStr === "breakout" || stageStr === "viral") {
    stageBorder = "#3fb950"; stageTextColor = "#3fb950";
  } else if (stageStr === "pre_viral") {
    stageBorder = "#d29922"; stageTextColor = "#d29922";
  } else if (stageStr === "accelerating" || stageStr === "rising") {
    stageBorder = "#58a6ff"; stageTextColor = "#58a6ff";
  } else if (stageStr === "emerging") {
    stageBorder = "#58a6ff"; stageTextColor = "#58a6ff"; stageBg = "rgba(88,166,255,0.08)";
  } else if (stageStr === "watch") {
    stageBorder = "#d29922"; stageTextColor = "#d29922";
  }

  // Health indicator
  let healthDot = "#3fb950";
  let healthText = "Healthy";
  if (repo.sustainability_label === "RED") { healthDot = "#f85149"; healthText = "Critical"; }
  else if (repo.sustainability_label === "YELLOW") { healthDot = "#d29922"; healthText = "Caution"; }

  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={onClick}>
      {/* # */}
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px", whiteSpace: "nowrap" }}>
        {rank}
      </td>

      {/* REPO — two-line: name bold on top, category·stars on bottom */}
      <td style={{ padding: "10px 12px", maxWidth: "160px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>{repo.owner.slice(0, 1)}/</span>{repo.name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {repo.category}{repo.stars >= 1000 ? ` · ${(repo.stars / 1000).toFixed(1)}k st...` : ` · ${repo.stars} st`}
        </div>
      </td>

      {/* STAGE badge */}
      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500,
          padding: "2px 8px", borderRadius: "12px",
          border: `1px solid ${stageBorder}`,
          color: stageTextColor, background: stageBg,
        }}>
          {stage.replace(/_/g, " ")}
        </span>
      </td>

      {/* BREAKOUT */}
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "#7c6af7", fontWeight: 700, textAlign: "right" }}>
        {breakout.toFixed(3)}
      </td>

      {/* TREND */}
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "#d29922", textAlign: "right" }}>
        {repo.trend_score.toFixed(4)}
      </td>

      {/* ACCEL */}
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", textAlign: "right", color: accel > 0.05 ? "#3fb950" : "var(--text-muted)" }}>
        {accel > 0.05 ? `+${accel.toFixed(2)}` : "—"}
      </td>

      {/* ETA */}
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>
        {eta !== undefined && eta !== null ? `~${eta}d` : "—"}
      </td>

      {/* SIGNALS — stacked plain text, up to 2 + overflow count */}
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {signals.slice(0, 2).map((s) => (
            <span key={s} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {s.replace(/_/g, " ")}
            </span>
          ))}
          {signals.length > 2 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>+{signals.length - 2}</span>
          )}
        </div>
      </td>

      {/* HEALTH — dot + text */}
      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: healthDot }}>
          ● {healthText}
        </span>
      </td>
    </tr>
  );
}

// Breakout radar table row
function RadarRow({ repo, rank, onClick }: { repo: RadarRepo; rank: number; onClick: () => void }) {
  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={onClick}>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>{String(rank).padStart(2, "0")}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>
        <span style={{ color: "var(--text-muted)" }}>{repo.owner}/</span>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{repo.name}</span>
      </td>
      <td style={{ padding: "11px 16px" }}>
        <span className="cyber-tag" style={{ fontSize: "10px" }}>{repo.category}</span>
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--amber)" }}>
        {repo.trend_score.toFixed(4)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>{repo.star_velocity_7d.toFixed(1)}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: repo.acceleration > 0 ? "var(--green)" : "var(--pink)" }}>
        {repo.acceleration > 0 ? "▲" : "▼"} {Math.abs(repo.acceleration).toFixed(3)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>
        {(repo.sustainability_score * 100).toFixed(0)}%
      </td>
      <td style={{ padding: "11px 16px" }}>
        <SustainBadge label={repo.sustainability_label} />
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>{repo.age_days}d</td>
    </tr>
  );
}
