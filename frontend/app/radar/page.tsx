"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api, EarlyRadarRepo, RadarRepo } from "@/lib/api";

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

// ─── Types ──────────────────────────────────────────────────
type RadarTab = "before" | "breakout" | "early";
type EstablishedSortKey = "trend_score" | "acceleration" | "star_velocity_7d" | "age_days" | "sustainability_score";
type EarlySortKey = "breakout_score" | "acceleration" | "star_velocity_7d" | "velocity_ratio" | "novelty_score" | "trend_score";
type EarlyStage = "all" | "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout";

// ─── Theme palette (B&W) ─────────────────────────────────────
const C = {
  text:       "#e6edf3",   // primary text — white-ish
  textSub:    "#8b949e",   // secondary text — gray
  textMuted:  "#6e7681",   // muted — dark gray
  border:     "#30363d",   // borders
  bgPrimary:  "#0d1117",   // darkest bg
  bgCard:     "#161b22",   // card/panel bg
  bgHover:    "#21262d",   // hover bg
  amber:      "#d29922",   // trend scores, ETA
  green:      "#3fb950",   // healthy, positive accel
  red:        "#f85149",   // critical
};

// Stage badge: border + text color (B&W palette — no blues)
function stagePalette(stage: string): { border: string; color: string; bg: string } {
  const s = stage as string;
  if (s === "breakout" || s === "viral")     return { border: C.green,  color: C.green,  bg: "rgba(63,185,80,0.08)" };
  if (s === "pre_viral")                      return { border: C.amber,  color: C.amber,  bg: "rgba(210,153,34,0.08)" };
  if (s === "accelerating" || s === "rising") return { border: C.text,   color: C.text,   bg: "rgba(230,237,243,0.05)" };
  if (s === "watch")                          return { border: C.amber,  color: C.amber,  bg: "rgba(210,153,34,0.08)" };
  // emerging / dormant / default
  return { border: C.border, color: C.textSub, bg: "transparent" };
}

function healthLabel(label: string): { dot: string; text: string } {
  if (label === "RED")    return { dot: C.red,   text: "Critical" };
  if (label === "YELLOW") return { dot: C.amber, text: "Caution" };
  return                         { dot: C.green,  text: "Healthy" };
}

const SORT_LABEL: Record<EstablishedSortKey, string> = {
  trend_score:          "Trend score",
  acceleration:         "Acceleration",
  star_velocity_7d:     "Stars / day",
  sustainability_score: "Sustainability",
  age_days:             "Age (lowest first)",
};

const EARLY_SORT_LABEL: Record<EarlySortKey, string> = {
  breakout_score:  "Breakout score",
  acceleration:    "Acceleration",
  star_velocity_7d:"7D velocity",
  velocity_ratio:  "Velocity ratio",
  novelty_score:   "Novelty",
  trend_score:     "Trend score",
};

// ─── Signal filter options ────────────────────────────────────
const SIGNAL_OPTS = [
  { key: "preViral",           label: "Pre-viral only (14d to 5k)" },
  { key: "consistentGrowth",   label: "Consistent growth (5+ of 7d)" },
  { key: "forkMomentum",       label: "Fork momentum" },
  { key: "sustainedVelocity",  label: "Sustained 30d velocity" },
] as const;
type SignalKey = typeof SIGNAL_OPTS[number]["key"];

// ─── Main page ───────────────────────────────────────────────
export default function RadarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<RadarTab>(
    tabParam === "breakout" ? "breakout" : tabParam === "early" ? "early" : "before"
  );

  // Before it trends controls
  const [beforeMaxAge,    setBeforeMaxAge]    = useState(90);
  const [beforeMaxStars,  setBeforeMaxStars]  = useState(1000);
  const [beforeMinAccel,  setBeforeMinAccel]  = useState(0);
  const [beforePreViral,  setBeforePreViral]  = useState(false);

  // Breakout radar controls
  const [newOnly,          setNewOnly]          = useState(false);
  const [establishedSort,  setEstablishedSort]  = useState<EstablishedSortKey>("trend_score");
  const [showSortDrop,     setShowSortDrop]     = useState(false);

  // Early insight controls
  const [maxAge,    setMaxAge]    = useState(180);
  const [maxStars,  setMaxStars]  = useState(50000);
  const [minAccel,  setMinAccel]  = useState(0);
  const [earlySort, setEarlySort] = useState<EarlySortKey>("breakout_score");
  const [earlyStage,setEarlyStage]= useState<EarlyStage>("all");
  const [signals,   setSignals]   = useState<Record<SignalKey, boolean>>({
    preViral: false, consistentGrowth: false, forkMomentum: false, sustainedVelocity: false,
  });


  const activeSignalCount = Object.values(signals).filter(Boolean).length;

  // ── Queries ──────────────────────────────────────────────
  const { data: beforeData, isLoading: beforeLoading, refetch: refetchBefore } = useQuery({
    queryKey: ["radar-before", beforeMaxAge, beforeMaxStars, beforeMinAccel, beforePreViral],
    queryFn: () => api.getEarlyRadar({
      max_age_days: beforeMaxAge, max_stars: beforeMaxStars,
      min_acceleration: beforeMinAccel, require_pre_viral: beforePreViral || undefined,
      sort_by: "breakout_score", limit: 50,
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
    queryKey: ["radar-early", maxAge, maxStars, minAccel, earlySort, earlyStage, signals],
    queryFn: () => api.getEarlyRadar({
      max_age_days: maxAge, max_stars: maxStars, min_acceleration: minAccel,
      sort_by: earlySort,
      momentum_stage: earlyStage !== "all" ? earlyStage : undefined,
      require_pre_viral:          signals.preViral          || undefined,
      require_consistent_growth:  signals.consistentGrowth  || undefined,
      require_fork_momentum:      signals.forkMomentum      || undefined,
      require_sustained_velocity: signals.sustainedVelocity || undefined,
      limit: 100,
    }),
    enabled: activeTab === "early",
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived ──────────────────────────────────────────────
  const beforeRows      = useMemo(() => beforeData      ?? [], [beforeData]);
  const establishedRows = useMemo(() => radarData       ?? [], [radarData]);
  const earlyRows       = useMemo(() => earlyData       ?? [], [earlyData]);

  const breakoutTrendAvg  = useMemo(() => !establishedRows.length ? 0 : establishedRows.reduce((s, r) => s + r.trend_score, 0)  / establishedRows.length, [establishedRows]);
  const breakoutAccelAvg  = useMemo(() => !establishedRows.length ? 0 : establishedRows.reduce((s, r) => s + r.acceleration, 0) / establishedRows.length, [establishedRows]);
  const breakoutHighMom   = useMemo(() => establishedRows.filter((r) => r.acceleration > 1).length, [establishedRows]);
  const earlyTrendAvg     = useMemo(() => !earlyRows.length ? 0 : earlyRows.reduce((s, r) => s + r.trend_score, 0)  / earlyRows.length, [earlyRows]);
  const earlyAccelAvg     = useMemo(() => !earlyRows.length ? 0 : earlyRows.reduce((s, r) => s + r.acceleration, 0) / earlyRows.length, [earlyRows]);
  const earlyPreViral     = useMemo(() => earlyRows.filter((r) => r.momentum_stage === "pre_viral" || r.momentum_stage === "breakout" || (r.breakout_score ?? 0) > 1).length, [earlyRows]);

  const breakoutExport = useMemo(() => establishedRows.map((r) => ({
    repo: `${r.owner}/${r.name}`, category: r.category, stars: r.stars,
    trend_score: r.trend_score, acceleration: r.acceleration, star_velocity_7d: r.star_velocity_7d,
    sustainability_score: r.sustainability_score, sustainability_label: r.sustainability_label, age_days: r.age_days,
  })), [establishedRows]);

  const earlyExport = useMemo(() => earlyRows.map((r) => ({
    repo: `${r.owner}/${r.name}`, category: r.category, stars: r.stars,
    trend_score: r.trend_score, breakout_score: r.breakout_score ?? null,
    acceleration: r.acceleration, stage: r.momentum_stage ?? null,
    velocity_7d: r.star_velocity_7d, velocity_ratio: r.velocity_ratio ?? null,
    eta_to_5k_days: r.estimated_viral_eta_days ?? null, sustainability_label: r.sustainability_label,
  })), [earlyRows]);

  const switchTab = (tab: RadarTab) => { setActiveTab(tab); setShowSortDrop(false); };

  // ─── Shared UI helpers ────────────────────────────────────
  const TD_MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", padding: "10px 12px" };
  const TH_STYLE: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.07em",
    color: C.textMuted, padding: "8px 12px", textAlign: "left", fontWeight: 600,
    borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };

  return (
    <div className="page-root">

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: "24px" }}>
        {(["before", "breakout", "early"] as RadarTab[]).map((tab, i) => {
          const labels: Record<RadarTab, string> = { before: "Before it trends", breakout: "Breakout radar", early: "Early insight radar" };
          const active = activeTab === tab;
          return (
            <button key={tab} onClick={() => switchTab(tab)} style={{
              padding: "10px 20px", fontFamily: "var(--font-sans)", fontSize: "13px",
              fontWeight: active ? 700 : 400,
              color: active ? C.text : C.textMuted,
              background: "transparent", border: "none",
              borderBottom: active ? `2px solid ${C.text}` : "2px solid transparent",
              borderRight: i < 2 ? `1px solid ${C.border}` : "none",
              cursor: "pointer", transition: "color 0.15s",
            }}>
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
          <SectionHeader eyebrow="EARLY RADAR" title="Before it trends" subtitle="Young repos with strong momentum — catch the next breakout" />

          {/* Filters bar */}
          <div className="panel" style={{ padding: "16px 20px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              <SliderBlock label="MAX AGE"   value={`${beforeMaxAge}D`}
                min={7} max={365} step={7} current={beforeMaxAge} onChange={setBeforeMaxAge}
                style={{ flex: "1 1 150px", borderRight: `1px solid ${C.border}`, paddingRight: "20px" }} />
              <SliderBlock label="MAX STARS" value={beforeMaxStars >= 1000 ? `${(beforeMaxStars/1000).toFixed(0)},000` : String(beforeMaxStars)}
                min={100} max={50000} step={100} current={beforeMaxStars} onChange={setBeforeMaxStars}
                style={{ flex: "1 1 150px", borderRight: `1px solid ${C.border}`, paddingRight: "20px" }} />
              <SliderBlock label="MIN ACCEL" value={beforeMinAccel.toFixed(1)}
                min={0} max={10} step={0.5} current={beforeMinAccel} onChange={setBeforeMinAccel}
                style={{ flex: "1 1 150px", borderRight: `1px solid ${C.border}`, paddingRight: "20px" }} />
              <label style={{ display: "flex", alignItems: "center", gap: "7px", fontFamily: "var(--font-sans)", fontSize: "13px", color: C.text, cursor: "pointer", whiteSpace: "nowrap" }}>
                <CheckBox checked={beforePreViral} onChange={setBeforePreViral} />
                Pre-viral only
              </label>
            </div>
          </div>

          {/* Count + Refresh */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: C.textMuted }}>
              {beforeLoading ? "Loading..." : `${beforeRows.length} repo${beforeRows.length !== 1 ? "s" : ""} matched`}
            </span>
            <GhostBtn onClick={() => refetchBefore()}>↻ Refresh ↗</GhostBtn>
          </div>

          {/* Cards */}
          {beforeLoading ? <LoadingMsg text="SCANNING FOR EARLY BREAKOUTS" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {beforeRows.map((repo) => (
                <BeforeCard key={repo.repo_id} repo={repo} onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)} />
              ))}
              {beforeRows.length === 0 && (
                <div className="panel" style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "12px" }}>
                  // NO REPOS MATCH — TRY INCREASING MAX AGE OR MAX STARS
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
          <SectionHeader eyebrow="BREAKOUT RADAR" title="Established repos" subtitle="Established repos ranked by signal strength" />

          {/* Metric cards */}
          <div className="radar-summary-grid" style={{ marginBottom: "20px" }}>
            <MetricCard label="MATCHED REPOS"   value={String(establishedRows.length)} />
            <MetricCard label="AVG TREND SCORE" value={breakoutTrendAvg.toFixed(4)} highlight={C.amber} />
            <MetricCard label="AVG ACCELERATION" value={breakoutAccelAvg.toFixed(2)} />
            <MetricCard label="HIGH MOMENTUM"   value={String(breakoutHighMom)} highlight={C.green} />
          </div>

          {/* Controls bar */}
          <div className="panel" style={{ padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "7px", fontFamily: "var(--font-sans)", fontSize: "13px", color: C.text, cursor: "pointer", whiteSpace: "nowrap" }}>
              <CheckBox checked={newOnly} onChange={setNewOnly} />
              New only (&lt;180D)
            </label>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textMuted }}>Sort by</span>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowSortDrop((p) => !p)} style={{
                display: "flex", alignItems: "center", gap: "8px",
                fontFamily: "var(--font-sans)", fontSize: "13px", color: C.text,
                background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "6px",
                padding: "6px 12px", cursor: "pointer", minWidth: "160px", justifyContent: "space-between",
              }}>
                {SORT_LABEL[establishedSort]}
                <span style={{ fontSize: "9px", color: C.textMuted }}>▼</span>
              </button>
              {showSortDrop && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "6px", zIndex: 50, minWidth: "190px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                  {(Object.keys(SORT_LABEL) as EstablishedSortKey[]).map((key) => (
                    <button key={key} onClick={() => { setEstablishedSort(key); setShowSortDrop(false); }} style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 14px",
                      fontFamily: "var(--font-sans)", fontSize: "13px",
                      color: key === establishedSort ? C.text : C.textMuted,
                      background: key === establishedSort ? C.bgHover : "transparent",
                      border: "none", cursor: "pointer",
                    }}>
                      {SORT_LABEL[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <GhostBtn onClick={() => exportCSV(breakoutExport, "radar-breakout.csv")}>⬇ CSV</GhostBtn>
              <GhostBtn onClick={() => exportJSON(breakoutExport, "radar-breakout.json")}>⬇ JSON</GhostBtn>
            </div>
          </div>

          {/* Table */}
          <div className="panel table-scroll">
            {radarLoading ? <LoadingMsg text="LOADING RADAR DATA" /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "REPO", "CATEGORY", "TREND", "STARS/D", "ACCEL", "SUSTAIN", "LABEL", "AGE"].map((h) => (
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {establishedRows.map((repo, i) => (
                    <RadarRow key={repo.repo_id} repo={repo} rank={i + 1} onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)} TDM={TD_MONO} />
                  ))}
                  {establishedRows.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "11px" }}>
                      // NO DATA — RUN THE PIPELINE VIA POST /admin/run-all
                    </td></tr>
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
          <SectionHeader eyebrow="EARLY INSIGHT RADAR" title="Emerging repos" subtitle="Emerging repos ranked by breakout probability" />

          {/* Metric cards */}
          <div className="radar-summary-grid" style={{ marginBottom: "20px" }}>
            <MetricCard label="MATCHED REPOS"     value={String(earlyRows.length)} />
            <MetricCard label="AVG TREND SCORE"   value={earlyTrendAvg.toFixed(4)} highlight={C.amber} />
            <MetricCard label="AVG ACCELERATION"  value={earlyAccelAvg.toFixed(2)} />
            <MetricCard label="PRE-VIRAL / BREAKOUT" value={String(earlyPreViral)} highlight={C.green} />
          </div>

          {/* Controls panel */}
          <div className="panel" style={{ padding: "16px 20px", marginBottom: "16px" }}>
            {/* Sliders row */}
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "16px" }}>
              <SliderBlock label="MAX AGE" value={`${maxAge}d`}
                min={7} max={365} step={7} current={maxAge} onChange={setMaxAge}
                minLabel="7d" maxLabel="365d"
                style={{ flex: "1 1 150px", borderRight: `1px solid ${C.border}`, paddingRight: "20px" }} />
              <SliderBlock label="MAX STARS" value={maxStars >= 1000 ? `${(maxStars/1000).toFixed(0)},000` : String(maxStars)}
                min={100} max={100000} step={500} current={maxStars} onChange={setMaxStars}
                minLabel="100" maxLabel="100k"
                style={{ flex: "1 1 150px", borderRight: `1px solid ${C.border}`, paddingRight: "20px" }} />
              <SliderBlock label="MIN ACCEL" value={minAccel.toFixed(1)}
                min={0} max={10} step={0.5} current={minAccel} onChange={setMinAccel}
                minLabel="0" maxLabel="10"
                style={{ flex: "1 1 150px" }} />
            </div>

            {/* Signal filters dropdown + Stage + Sort */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>

              {/* Signal filters — horizontal checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", marginBottom: "8px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted, letterSpacing: "0.07em" }}>
                  SIGNAL FILTERS
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  {SIGNAL_OPTS.map(({ key, label }) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13px", color: C.text, cursor: "pointer", whiteSpace: "nowrap" }}>
                      <CheckBox
                        checked={signals[key]}
                        onChange={(v) => setSignals((prev) => ({ ...prev, [key]: v }))}
                      />
                      {label}
                    </label>
                  ))}
                  {activeSignalCount > 0 && (
                    <button onClick={() => setSignals({ preViral: false, consistentGrowth: false, forkMomentum: false, sustainedVelocity: false })}
                      style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textMuted, background: "transparent", border: `1px dashed ${C.border}`, borderRadius: "4px", padding: "2px 8px", cursor: "pointer", marginLeft: "8px" }}>
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Stage select */}
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted, letterSpacing: "0.07em", marginBottom: "6px" }}>STAGE</div>
                <select value={earlyStage} onChange={(e) => setEarlyStage(e.target.value as EarlyStage)}
                  className="cyber-select" style={{ minWidth: "180px" }}>
                  <option value="all">All stages</option>
                  <option value="dormant">Dormant</option>
                  <option value="emerging">Emerging</option>
                  <option value="accelerating">Accelerating</option>
                  <option value="pre_viral">Pre-viral</option>
                  <option value="breakout">Breakout</option>
                </select>
              </div>

              {/* Sort by select */}
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted, letterSpacing: "0.07em", marginBottom: "6px" }}>SORT BY</div>
                <select value={earlySort} onChange={(e) => setEarlySort(e.target.value as EarlySortKey)}
                  className="cyber-select" style={{ minWidth: "180px" }}>
                  {(Object.keys(EARLY_SORT_LABEL) as EarlySortKey[]).map((k) => (
                    <option key={k} value={k}>{EARLY_SORT_LABEL[k]}</option>
                  ))}
                </select>
              </div>

              {/* Export buttons pushed right */}
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignSelf: "flex-end" }}>
                <GhostBtn onClick={() => exportCSV(earlyExport, "radar-early.csv")}>⬇ CSV</GhostBtn>
                <GhostBtn onClick={() => exportJSON(earlyExport, "radar-early.json")}>⬇ JSON</GhostBtn>
              </div>
            </div>
          </div>

          {/* Count row */}
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textMuted, marginBottom: "10px" }}>
            {earlyLoading ? "" : `${earlyRows.length} repos matched`}
          </div>

          {/* Table */}
          <div className="panel table-scroll">
            {earlyLoading ? <LoadingMsg text="SCANNING FOR EARLY BREAKOUTS" /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "REPO", "STAGE", "BREAKOUT", "TREND", "ACCEL", "ETA", "SIGNALS", "HEALTH"].map((h) => (
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {earlyRows.map((repo, i) => (
                    <EarlyRow key={repo.repo_id} repo={repo} rank={i + 1}
                      onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)} TDM={TD_MONO} />
                  ))}
                  {earlyRows.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-mono)", color: C.textMuted, fontSize: "11px" }}>
                      // NO EARLY SIGNALS MATCH THE CURRENT FILTERS
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", padding: "0 2px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textMuted }}>
              {earlyLoading ? "" : `Showing ${earlyRows.length} of ${earlyRows.length}`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <GhostBtn onClick={() => switchTab("breakout")}>Top breakouts ↗</GhostBtn>
              <GhostBtn onClick={() => router.push("/overview")}>Signal picks ↗</GhostBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared primitive components ─────────────────────────────

/** Custom checkbox that matches the dark B&W theme */
function CheckBox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(!checked); }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: "14px", height: "14px", borderRadius: "3px", flexShrink: 0,
        border: `1.5px solid ${checked ? C.text : C.border}`,
        background: checked ? C.text : "transparent",
        cursor: "pointer", transition: "all 0.12s",
      }}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke={C.bgPrimary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, letterSpacing: "0.08em", marginBottom: "6px" }}>{eyebrow}</div>
      <h1 style={{ fontSize: "26px", fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
      <p style={{ fontSize: "13px", color: C.textMuted, margin: "6px 0 0" }}>{subtitle}</p>
    </div>
  );
}

function LoadingMsg({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", color: C.textMuted, textAlign: "center", padding: "60px 0", fontSize: "12px", letterSpacing: "0.06em" }}>
      // {text}<span className="terminal-cursor" />
    </div>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub,
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "6px",
      padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap",
      transition: "border-color 0.15s, color 0.15s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textMuted; e.currentTarget.style.color = C.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
    >
      {children}
    </button>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="panel radar-metric-card" style={{ padding: "14px 16px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted, letterSpacing: "0.07em", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color: highlight ?? C.text }}>{value}</div>
    </div>
  );
}

function SliderBlock({ label, value, min, max, step, current, onChange, minLabel, maxLabel, style }: {
  label: string; value: string; min: number; max: number; step: number;
  current: number; onChange: (v: number) => void;
  minLabel?: string; maxLabel?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted, letterSpacing: "0.07em" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.text, fontWeight: 600 }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="radar-range"
        style={{ width: "100%", accentColor: C.text, cursor: "pointer" }} />
      {(minLabel || maxLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted }}>{minLabel}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted }}>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

// "Before it trends" card — clean B&W card design
function BeforeCard({ repo, onClick }: { repo: EarlyRadarRepo; onClick: () => void }) {
  const stage = repo.momentum_stage ?? "emerging";
  const sp = stagePalette(stage);
  const signals = repo.active_signals ?? [];
  const accel = repo.acceleration ?? 0;
  const velRatio = repo.velocity_ratio ?? 0;
  const novelty = repo.novelty_score ?? 0;

  return (
    <div className="panel" onClick={onClick}
      style={{ padding: "16px 20px", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.textMuted)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: C.text }}>
          <span style={{ fontWeight: 400, color: C.textMuted }}>{repo.owner}/</span>{repo.name}
        </span>
        {repo.primary_language && (
          <span className="cyber-tag" style={{ fontSize: "11px" }}>{repo.primary_language}</span>
        )}
        {repo.category && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textMuted }}>{repo.category}</span>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", padding: "2px 8px", borderRadius: "10px", border: `1px solid ${sp.border}`, color: sp.color, background: sp.bg }}>
          {stage.replace(/_/g, " ")}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textMuted }}>{repo.age_days}d old</span>
      </div>

      {/* Metrics 3×2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 24px", marginBottom: "12px" }}>
        {[
          { label: "STARS",     val: repo.stars.toLocaleString(), color: C.text },
          { label: "VEL / D",   val: `+${repo.star_velocity_7d.toFixed(1)}`, color: C.green },
          { label: "ACCEL",     val: accel.toFixed(2), color: accel > 0 ? C.amber : C.textMuted },
          { label: "BREAKOUT",  val: (repo.breakout_score ?? repo.trend_score).toFixed(3), color: C.text },
          { label: "VEL RATIO", val: velRatio.toFixed(2), color: C.text },
          { label: "NOVELTY",   val: novelty.toFixed(2), color: C.text },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: C.textMuted, letterSpacing: "0.07em", marginBottom: "2px" }}>{label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {repo.estimated_viral_eta_days != null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textMuted, marginBottom: "8px" }}>
          ETA to 5k stars: <span style={{ color: C.amber }}>~{repo.estimated_viral_eta_days}d</span>
        </div>
      )}

      {signals.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
          {signals.map((s) => (
            <span key={s} className="cyber-tag" style={{ fontSize: "11px", textTransform: "capitalize" }}>{s.replace(/_/g, " ")}</span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: C.textMuted }}>trend: {repo.trend_score.toFixed(4)}</span>
        <HealthBadge label={repo.sustainability_label} />
      </div>
    </div>
  );
}

// Breakout radar table row
function RadarRow({ repo, rank, onClick, TDM }: { repo: RadarRepo; rank: number; onClick: () => void; TDM: React.CSSProperties }) {
  const accel = repo.acceleration;
  const hl = healthLabel(repo.sustainability_label);
  return (
    <tr className="tr-cyber" style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onClick={onClick}>
      <td style={{ ...TDM, color: C.textMuted, fontSize: "11px" }}>{rank}</td>
      {/* REPO — two-line */}
      <td style={{ ...TDM, maxWidth: "180px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 400, color: C.textMuted }}>{repo.owner}/</span>{repo.name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {repo.stars >= 1000 ? `${(repo.stars/1000).toFixed(1)}k stars` : `${repo.stars} stars`} · {repo.age_days}d old
        </div>
      </td>
      <td style={{ ...TDM, fontSize: "11px", color: C.textMuted }}>{repo.category}</td>
      <td style={{ ...TDM, fontWeight: 700, color: C.amber }}>{repo.trend_score.toFixed(4)}</td>
      <td style={{ ...TDM }}>{repo.star_velocity_7d.toFixed(1)}</td>
      <td style={{ ...TDM, color: accel > 0 ? C.green : C.red }}>{accel > 0 ? "▲" : "▼"} {Math.abs(accel).toFixed(3)}</td>
      <td style={{ ...TDM }}>{(repo.sustainability_score * 100).toFixed(0)}%</td>
      <td style={{ ...TDM, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: hl.dot }}>● {hl.text}</span>
      </td>
      <td style={{ ...TDM, fontSize: "11px", color: C.textMuted, whiteSpace: "nowrap" }}>{repo.age_days}d</td>
    </tr>
  );
}

// Early insight radar table row
function EarlyRow({ repo, rank, onClick, TDM }: { repo: EarlyRadarRepo; rank: number; onClick: () => void; TDM: React.CSSProperties }) {
  const stage = repo.momentum_stage ?? "emerging";
  const sp = stagePalette(stage);
  const signals = repo.active_signals ?? [];
  const accel = repo.acceleration ?? 0;
  const eta = repo.estimated_viral_eta_days;
  const breakout = repo.breakout_score ?? repo.trend_score;
  const hl = healthLabel(repo.sustainability_label);

  return (
    <tr className="tr-cyber" style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onClick={onClick}>
      <td style={{ ...TDM, color: C.textMuted, fontSize: "11px" }}>{rank}</td>

      {/* REPO — two-line */}
      <td style={{ ...TDM, maxWidth: "160px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 400, color: C.textMuted }}>{repo.owner.slice(0,1)}/</span>{repo.name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {repo.category}{repo.stars >= 1000 ? ` · ${(repo.stars/1000).toFixed(1)}k st` : ` · ${repo.stars} st`}
        </div>
      </td>

      {/* STAGE pill */}
      <td style={{ ...TDM, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500, padding: "2px 8px", borderRadius: "10px", border: `1px solid ${sp.border}`, color: sp.color, background: sp.bg }}>
          {stage.replace(/_/g, " ")}
        </span>
      </td>

      {/* BREAKOUT */}
      <td style={{ ...TDM, fontWeight: 700, color: C.text, textAlign: "right" }}>{breakout.toFixed(3)}</td>

      {/* TREND */}
      <td style={{ ...TDM, color: C.amber, textAlign: "right" }}>{repo.trend_score.toFixed(4)}</td>

      {/* ACCEL */}
      <td style={{ ...TDM, textAlign: "right", color: accel > 0.05 ? C.green : C.textMuted }}>
        {accel > 0.05 ? `+${accel.toFixed(2)}` : "—"}
      </td>

      {/* ETA */}
      <td style={{ ...TDM, fontSize: "11px", color: C.textSub, textAlign: "right", whiteSpace: "nowrap" }}>
        {eta != null ? `~${eta}d` : "—"}
      </td>

      {/* SIGNALS */}
      <td style={{ ...TDM }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {signals.slice(0, 2).map((s) => (
            <span key={s} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textSub, whiteSpace: "nowrap" }}>{s.replace(/_/g, " ")}</span>
          ))}
          {signals.length > 2 && <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: C.textMuted }}>+{signals.length - 2}</span>}
        </div>
      </td>

      {/* HEALTH */}
      <td style={{ ...TDM, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: hl.dot }}>● {hl.text}</span>
      </td>
    </tr>
  );
}

// Health dot+text badge
function HealthBadge({ label }: { label: string }) {
  const hl = healthLabel(label);
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: hl.dot }}>● {hl.text}</span>;
}
