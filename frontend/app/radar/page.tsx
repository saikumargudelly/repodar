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

const ESTABLISHED_CATEGORIES = [
  "All",
  "LLM Models",
  "Agent Frameworks",
  "Inference Engines",
  "Vector Databases",
  "Model Serving / Runtimes",
  "Distributed Compute / Infra",
  "Evaluation Frameworks",
  "Fine-tuning Toolkits",
];

const EARLY_CATEGORIES = [
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

type RadarMode = "established" | "early";
type EstablishedSortKey = "trend_score" | "acceleration" | "star_velocity_7d" | "age_days" | "sustainability_score";
type EarlySortKey = "breakout_score" | "acceleration" | "star_velocity_7d" | "velocity_ratio" | "novelty_score" | "trend_score";
type EarlyStage = "all" | "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout";

function stageColor(stage: string | undefined): string {
  if (stage === "breakout") return "var(--pink)";
  if (stage === "pre_viral") return "var(--amber)";
  if (stage === "accelerating") return "var(--cyan)";
  return "var(--text-muted)";
}

export default function RadarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: RadarMode = searchParams.get("stage") === "early" ? "early" : "established";

  const [mode, setMode] = useState<RadarMode>(initialMode);
  const [category, setCategory] = useState("All");

  // Established Radar controls
  const [newOnly, setNewOnly] = useState(false);
  const [establishedSort, setEstablishedSort] = useState<EstablishedSortKey>("trend_score");

  // Early Insights controls
  const [maxAge, setMaxAge] = useState(90);
  const [maxStars, setMaxStars] = useState(1000);
  const [minAccel, setMinAccel] = useState(0);
  const [earlySort, setEarlySort] = useState<EarlySortKey>("breakout_score");
  const [earlyStage, setEarlyStage] = useState<EarlyStage>("all");
  const [preViralOnly, setPreViralOnly] = useState(false);

  const { data: radarData, isLoading: radarLoading } = useQuery({
    queryKey: ["radar", newOnly],
    queryFn: () => api.getRadar(newOnly),
    enabled: mode === "established",
    staleTime: 5 * 60 * 1000,
  });

  const { data: earlyData, isLoading: earlyLoading } = useQuery({
    queryKey: ["radar-early", maxAge, maxStars, minAccel, category, earlySort, earlyStage, preViralOnly],
    queryFn: () =>
      api.getEarlyRadar({
        max_age_days: maxAge,
        max_stars: maxStars,
        min_acceleration: minAccel,
        category: category !== "All" ? category : undefined,
        sort_by: earlySort,
        momentum_stage: earlyStage !== "all" ? earlyStage : undefined,
        require_pre_viral: preViralOnly,
        limit: 100,
      }),
    enabled: mode === "early",
    staleTime: 5 * 60 * 1000,
  });

  const { data: langData } = useQuery({
    queryKey: ["language-radar"],
    queryFn: () => api.getLanguageRadar(2),
    enabled: mode === "established",
    staleTime: 15 * 60 * 1000,
  });

  const establishedRows = useMemo(() => {
    const rows = radarData ?? [];
    const filtered = rows.filter((r) => category === "All" || r.category === category);
    return [...filtered].sort((a, b) => {
      if (establishedSort === "age_days") return a.age_days - b.age_days;
      return (b[establishedSort] as number) - (a[establishedSort] as number);
    });
  }, [radarData, category, establishedSort]);

  const earlyRows = useMemo(() => {
    const rows = earlyData ?? [];
    return rows.filter((r) => category === "All" || r.category === category);
  }, [earlyData, category]);

  const activeLoading = mode === "early" ? earlyLoading : radarLoading;
  const activeCount = mode === "early" ? earlyRows.length : establishedRows.length;
  const activeCategories = mode === "early" ? EARLY_CATEGORIES : ESTABLISHED_CATEGORIES;

  const activeTrendAverage = useMemo(() => {
    const rows = mode === "early" ? earlyRows : establishedRows;
    if (rows.length === 0) return 0;
    return rows.reduce((sum, row) => sum + row.trend_score, 0) / rows.length;
  }, [mode, earlyRows, establishedRows]);

  const activeAccelerationAverage = useMemo(() => {
    const rows = mode === "early" ? earlyRows : establishedRows;
    if (rows.length === 0) return 0;
    return rows.reduce((sum, row) => sum + row.acceleration, 0) / rows.length;
  }, [mode, earlyRows, establishedRows]);

  const highMomentumCount = useMemo(() => {
    if (mode === "early") {
      return earlyRows.filter((row) => {
        const stage = row.momentum_stage;
        return stage === "pre_viral" || stage === "breakout" || (row.breakout_score ?? 0) > 1;
      }).length;
    }
    return establishedRows.filter((row) => row.acceleration > 1).length;
  }, [mode, earlyRows, establishedRows]);

  const exportRows: Record<string, unknown>[] = useMemo(() => {
    if (mode === "early") {
      return earlyRows.map((row) => ({
        repo: `${row.owner}/${row.name}`,
        category: row.category,
        stars: row.stars,
        trend_score: row.trend_score,
        breakout_score: row.breakout_score ?? null,
        acceleration: row.acceleration,
        stage: row.momentum_stage ?? null,
        velocity_7d: row.star_velocity_7d,
        velocity_ratio: row.velocity_ratio ?? null,
        eta_to_5k_days: row.estimated_viral_eta_days ?? null,
        sustainability_label: row.sustainability_label,
      }));
    }

    return establishedRows.map((row) => ({
      repo: `${row.owner}/${row.name}`,
      category: row.category,
      stars: row.stars,
      trend_score: row.trend_score,
      acceleration: row.acceleration,
      star_velocity_7d: row.star_velocity_7d,
      sustainability_score: row.sustainability_score,
      sustainability_label: row.sustainability_label,
      age_days: row.age_days,
    }));
  }, [mode, earlyRows, establishedRows]);

  const switchMode = (next: RadarMode) => {
    setMode(next);
    setCategory("All");
  };

  return (
    <div className="page-root">
      {/* Header */}
      <div className="radar-header">
        <div className="radar-header-copy">
          <div className="section-title-cyber">
            {mode === "early" ? "EARLY INSIGHT RADAR" : "BREAKOUT RADAR"}
            <span className="terminal-cursor" />
          </div>
          <div className="radar-subtitle" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
            {mode === "early"
              ? "// Emerging repos ranked by breakout probability"
              : "// Established repos ranked by signal strength"}
          </div>
        </div>

        <div className="radar-header-controls">
          <div className="radar-mode-toggle">
            <button
              onClick={() => switchMode("established")}
              className={`filter-btn-cyber${mode === "established" ? " active" : ""}`}
            >
              ESTABLISHED
            </button>
            <button
              onClick={() => switchMode("early")}
              className={`filter-btn-cyber${mode === "early" ? " active" : ""}`}
            >
              EARLY INSIGHTS
            </button>
          </div>

          <select value={category} onChange={(e) => setCategory(e.target.value)} className="cyber-select radar-category-select">
            {activeCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary strip */}
      <div className="radar-summary-grid">
        <MetricCard label="MATCHED REPOS" value={String(activeCount)} />
        <MetricCard label="AVG TREND SCORE" value={activeTrendAverage.toFixed(4)} highlight="var(--amber)" />
        <MetricCard label="AVG ACCELERATION" value={activeAccelerationAverage.toFixed(2)} highlight="var(--cyan)" />
        <MetricCard
          label={mode === "early" ? "PRE-VIRAL / BREAKOUT" : "HIGH MOMENTUM"}
          value={String(highMomentumCount)}
          highlight="var(--green)"
        />
      </div>

      {/* Controls */}
      <div className="panel radar-controls-panel">
        {mode === "established" && (
          <>
            <label className="radar-checkbox-inline" style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)",
              fontSize: "11px", color: "var(--text-muted)", cursor: "pointer", letterSpacing: "0.06em" }}>
              <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)}
                style={{ accentColor: "var(--cyan)" }} />
              NEW ONLY (&lt;180D)
            </label>

            <div className="radar-control-block" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                SORT BY
              </label>
              <select
                value={establishedSort}
                onChange={(e) => setEstablishedSort(e.target.value as EstablishedSortKey)}
                className="cyber-select"
              >
                <option value="trend_score">TREND SCORE</option>
                <option value="acceleration">ACCELERATION</option>
                <option value="star_velocity_7d">7D VELOCITY</option>
                <option value="sustainability_score">SUSTAINABILITY</option>
                <option value="age_days">AGE (LOWEST FIRST)</option>
              </select>
            </div>
          </>
        )}

        {mode === "early" && (
          <>
            <div className="radar-control-block" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "180px" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                MAX AGE - {maxAge}d
              </label>
              <input
                className="radar-range"
                type="range"
                min={7}
                max={180}
                step={7}
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                style={{ cursor: "pointer", accentColor: "var(--cyan)" }}
              />
            </div>

            <div className="radar-control-block" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "180px" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                MAX STARS - {maxStars.toLocaleString()}
              </label>
              <input
                className="radar-range"
                type="range"
                min={100}
                max={10000}
                step={100}
                value={maxStars}
                onChange={(e) => setMaxStars(Number(e.target.value))}
                style={{ cursor: "pointer", accentColor: "var(--cyan)" }}
              />
            </div>

            <div className="radar-control-block" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "180px" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                MIN ACCEL - {minAccel.toFixed(1)}
              </label>
              <input
                className="radar-range"
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={minAccel}
                onChange={(e) => setMinAccel(Number(e.target.value))}
                style={{ cursor: "pointer", accentColor: "var(--cyan)" }}
              />
            </div>

            <div className="radar-control-block" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                STAGE
              </label>
              <select value={earlyStage} onChange={(e) => setEarlyStage(e.target.value as EarlyStage)} className="cyber-select">
                <option value="all">ALL STAGES</option>
                <option value="dormant">DORMANT</option>
                <option value="emerging">EMERGING</option>
                <option value="accelerating">ACCELERATING</option>
                <option value="pre_viral">PRE-VIRAL</option>
                <option value="breakout">BREAKOUT</option>
              </select>
            </div>

            <div className="radar-control-block" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                SORT BY
              </label>
              <select value={earlySort} onChange={(e) => setEarlySort(e.target.value as EarlySortKey)} className="cyber-select">
                <option value="breakout_score">BREAKOUT SCORE</option>
                <option value="acceleration">ACCELERATION</option>
                <option value="star_velocity_7d">7D VELOCITY</option>
                <option value="velocity_ratio">VELOCITY RATIO</option>
                <option value="novelty_score">NOVELTY</option>
                <option value="trend_score">TREND SCORE</option>
              </select>
            </div>

            <label className="radar-checkbox-inline" style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)",
              fontSize: "11px", color: "var(--text-muted)", cursor: "pointer", letterSpacing: "0.06em" }}>
              <input type="checkbox" checked={preViralOnly} onChange={(e) => setPreViralOnly(e.target.checked)} style={{ accentColor: "var(--cyan)" }} />
              PRE-VIRAL ONLY
            </label>
          </>
        )}

        <div className="radar-export-actions" style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
          <button
            className="radar-export-btn"
            onClick={() => exportCSV(exportRows, `radar-${mode}-${category.replace(/ /g, "_")}.csv`)}
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", background: "transparent",
              border: "1px solid var(--border)", borderRadius: "4px", padding: "6px 10px", cursor: "pointer" }}
          >
            EXPORT CSV
          </button>
          <button
            className="radar-export-btn"
            onClick={() => exportJSON(exportRows, `radar-${mode}-${category.replace(/ /g, "_")}.json`)}
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", background: "transparent",
              border: "1px solid var(--border)", borderRadius: "4px", padding: "6px 10px", cursor: "pointer" }}
          >
            EXPORT JSON
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="panel table-scroll">
        {activeLoading ? (
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center", padding: "60px 0",
            fontSize: "12px", letterSpacing: "0.06em" }}>
            {"// LOADING RADAR DATA"}<span className="terminal-cursor" />
          </div>
        ) : mode === "early" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {[
                  "#",
                  "REPO",
                  "CATEGORY",
                  "STAGE",
                  "BREAKOUT",
                  "TREND",
                  "ACCEL.",
                  "ETA",
                  "SIGNALS",
                  "HEALTH",
                ].map((h) => (
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
                  <td colSpan={10} style={{ padding: "40px", textAlign: "center",
                    fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
                    {"// NO EARLY SIGNALS MATCH THE CURRENT FILTERS"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {["#", "REPO", "CATEGORY", "TREND SCORE", "STARS/D", "ACCEL.", "SUSTAIN.", "LABEL", "AGE"].map((h) => (
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
                  <td colSpan={9} style={{ padding: "40px", textAlign: "center",
                    fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
                    {"// NO DATA - RUN THE PIPELINE VIA POST /admin/run-all"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Language & Tech Stack Radar */}
      {mode === "established" && (
        <div className="panel table-scroll">
          <div className="panel-header">
            <div>
              <div className="panel-title">Language &amp; Tech Stack Radar</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
                {"// Languages ranked by combined 7-day star velocity"}
              </div>
            </div>
          </div>
          {!langData || langData.length === 0 ? (
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center",
              padding: "40px 0", fontSize: "11px", letterSpacing: "0.06em" }}>
              {"// NO LANGUAGE DATA"}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  {["#", "LANGUAGE", "REPOS", "WEEKLY STAR VEL.", "AVG TREND SCORE", "AVG SUSTAIN.", "TOP REPO", "CATEGORIES"].map((h) => (
                    <th key={h} className="th-mono">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {langData.map((lang) => <LangRow key={lang.language} lang={lang} />)}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="panel radar-metric-card" style={{ padding: "12px" }}>
      <div className="radar-metric-label" style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div className="radar-metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 700, color: highlight ?? "var(--text-primary)", marginTop: "4px" }}>
        {value}
      </div>
    </div>
  );
}

function EarlyRow({ repo, rank, onClick }: { repo: EarlyRadarRepo; rank: number; onClick: () => void }) {
  const stage = repo.momentum_stage ?? "emerging";
  const signals = repo.active_signals ?? [];

  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={onClick}>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>{String(rank).padStart(2, "0")}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>
        <span style={{ color: "var(--text-muted)" }}>{repo.owner}/</span><span style={{ fontWeight: 600, color: "var(--cyan)" }}>{repo.name}</span>
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
        {repo.category}
      </td>
      <td style={{ padding: "11px 16px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: stageColor(stage), border: `1px solid ${stageColor(stage)}`,
          padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {stage.replace(/_/g, " ")}
        </span>
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: "var(--cyan)", fontWeight: 700 }}>
        {(repo.breakout_score ?? repo.trend_score).toFixed(3)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: "var(--amber)" }}>
        {repo.trend_score.toFixed(4)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: repo.acceleration > 1 ? "var(--green)" : "var(--text-primary)" }}>
        {repo.acceleration.toFixed(2)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontSize: "11px" }}>
        {repo.estimated_viral_eta_days !== undefined && repo.estimated_viral_eta_days !== null
          ? `~${repo.estimated_viral_eta_days}d`
          : "-"}
      </td>
      <td style={{ padding: "11px 16px" }}>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {signals.slice(0, 2).map((signal) => (
            <span key={signal} className="cyber-tag" style={{ fontSize: "9px" }}>{signal.replace(/_/g, " ")}</span>
          ))}
          {signals.length > 2 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>+{signals.length - 2}</span>
          )}
        </div>
      </td>
      <td style={{ padding: "11px 16px" }}>
        <SustainBadge label={repo.sustainability_label} />
      </td>
    </tr>
  );
}

function LangRow({ lang }: { lang: LanguageStat }) {
  const vel = lang.weekly_star_velocity;
  const velColor = vel > 100 ? "var(--green)" : vel > 20 ? "var(--cyan)" : "var(--text-secondary)";
  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>{String(lang.growth_rank).padStart(2, "0")}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>{lang.language}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)" }}>{lang.repo_count}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: velColor }}>
        +{vel.toFixed(0)}/wk
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--amber)" }}>{lang.avg_trend_score.toFixed(4)}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)" }}>{(lang.avg_sustainability_score * 100).toFixed(0)}%</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
        {lang.top_repo ?? "—"}
      </td>
      <td style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {lang.categories.slice(0, 3).map((c) => (
            <span key={c} className="cyber-tag">{c}</span>
          ))}
          {lang.categories.length > 3 && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>+{lang.categories.length - 3}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function RadarRow({ repo, rank, onClick }: { repo: RadarRepo; rank: number; onClick: () => void }) {
  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={onClick}>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>{String(rank).padStart(2, "0")}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>
        <span style={{ color: "var(--text-muted)" }}>{repo.owner}/</span><span style={{ fontWeight: 600, color: "var(--cyan)" }}>{repo.name}</span>
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.04em" }}>{repo.category}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--amber)" }}>
        {repo.trend_score.toFixed(4)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>{repo.star_velocity_7d.toFixed(1)}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)",
        color: repo.acceleration > 0 ? "var(--green)" : "var(--pink)" }}>
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
