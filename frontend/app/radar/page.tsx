"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, EarlyRadarRepo, LanguageStat, RadarRepo } from "@/lib/api";

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
type EstablishedSortKey = "trend_score" | "star_velocity_7d" | "acceleration" | "sustainability_score" | "age_days";
type EarlySortKey = "breakout_score" | "acceleration" | "star_velocity_7d" | "velocity_ratio" | "novelty_score" | "trend_score";
type EarlyStage = "all" | "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout";

// Helpers
const formatAge = (days: number) => {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) {
    return `${years}y ${months}m`;
  }
  return `${months}m`;
};

export default function RadarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: RadarMode = searchParams.get("stage") === "early" ? "early" : "established";
  const [category, setCategory] = useState("All");

  // Limits
  const [limitRadar, setLimitRadar] = useState(20);
  const [limitLang, setLimitLang] = useState(20);

  // Established Radar controls
  const [newOnly, setNewOnly] = useState(false);
  const [establishedSort, setEstablishedSort] = useState<EstablishedSortKey>("trend_score");

  // Early Insights controls
  const [maxAge, setMaxAge] = useState(180);
  const [maxStars, setMaxStars] = useState(50000);
  const [minAccel, setMinAccel] = useState(0);
  const [earlySort, setEarlySort] = useState<EarlySortKey>("breakout_score");
  const [earlyStage, setEarlyStage] = useState<EarlyStage>("all");
  const [preViralOnly, setPreViralOnly] = useState(false);
  const [requireConsistentGrowth, setRequireConsistentGrowth] = useState(false);
  const [requireForkMomentum, setRequireForkMomentum] = useState(false);
  const [requireSustainedVelocity, setRequireSustainedVelocity] = useState(false);

  // Queries
  const { data: radarData, isLoading: radarLoading } = useQuery({
    queryKey: ["radar", newOnly, category, establishedSort],
    queryFn: () => api.getRadar(newOnly, category, undefined, establishedSort, establishedSort === "age_days" ? "asc" : "desc", 100),
    enabled: mode === "established",
    staleTime: 5 * 60 * 1000,
  });

  const { data: earlyData, isLoading: earlyLoading } = useQuery({
    queryKey: ["radar-early", maxAge, maxStars, minAccel, category, earlySort, earlyStage, preViralOnly, requireConsistentGrowth, requireForkMomentum, requireSustainedVelocity],
    queryFn: () =>
      api.getEarlyRadar({
        max_age_days: maxAge,
        max_stars: maxStars,
        min_acceleration: minAccel,
        category: category !== "All" ? category : undefined,
        sort_by: earlySort,
        momentum_stage: earlyStage !== "all" ? earlyStage : undefined,
        require_pre_viral: preViralOnly,
        require_consistent_growth: requireConsistentGrowth,
        require_fork_momentum: requireForkMomentum,
        require_sustained_velocity: requireSustainedVelocity,
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
    return radarData ?? [];
  }, [radarData]);

  const earlyRows = useMemo(() => {
    const rows = earlyData ?? [];
    return rows.filter((r) => category === "All" || r.category === category);
  }, [earlyData, category]);

  const activeLoading = mode === "early" ? earlyLoading : radarLoading;
  const activeCount = mode === "early" ? earlyRows.length : establishedRows.length;
  const activeCategories = mode === "early" ? EARLY_CATEGORIES : ESTABLISHED_CATEGORIES;

  // Header Metrics Calculations
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
    const params = new URLSearchParams(searchParams.toString());
    if (next === "early") {
      params.set("stage", "early");
    } else {
      params.delete("stage");
    }
    const query = params.toString();
    router.replace(query ? `/radar?${query}` : "/radar");
    setCategory("All");
    setLimitRadar(20);
  };

  // Slicing arrays to respect limits
  const visibleEstablished = establishedRows.slice(0, limitRadar);
  const visibleEarly = earlyRows.slice(0, limitRadar);
  const visibleLang = (langData ?? []).slice(0, limitLang);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === "early" ? "Early insight radar" : "Breakout radar"}
          </h1>
          <p className="text-xs text-gray-500 font-medium font-sans mt-1">
            {mode === "early"
              ? "Emerging repos ranked by breakout probability"
              : "Repos ranked by signal strength"}
          </p>
        </div>

        {/* Button selection group & category select */}
        <div className="flex items-center gap-3">
          <div className="flex border border-[#2d2d34] rounded-md overflow-hidden bg-[#18181b]">
            <button
              onClick={() => switchMode("established")}
              className={`px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                mode === "established"
                  ? "bg-[#27272a] text-white border-r border-[#2d2d34]"
                  : "text-gray-400 hover:text-white border-r border-[#2d2d34]"
              }`}
            >
              Established
            </button>
            <button
              onClick={() => switchMode("early")}
              className={`px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                mode === "early"
                  ? "bg-[#27272a] text-white border-r border-[#2d2d34]"
                  : "text-gray-400 hover:text-white border-r border-[#2d2d34]"
              }`}
            >
              Early insights
            </button>
            <button
              onClick={() => { setCategory("All"); }}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
            >
              All
            </button>
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-[#18181b] border border-[#2d2d34] rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gray-500 font-semibold cursor-pointer"
          >
            {activeCategories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All categories" : c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Matched repos" value={String(activeCount)} />
        <MetricCard label="Avg trend score" value={activeTrendAverage.toFixed(4)} highlight="#d29922" />
        <MetricCard label="Avg acceleration" value={activeAccelerationAverage.toFixed(2)} />
        <MetricCard
          label={mode === "early" ? "Pre-viral / breakout" : "High momentum"}
          value={String(highMomentumCount)}
          highlight="#3fb950"
        />
      </div>

      {/* ── Established Radar View ── */}
      {mode === "established" && (
        <div className="space-y-6">
          {/* Controls toolbar */}
          <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl p-4 flex flex-wrap items-center gap-3">
            {/* New Only Checkbox */}
            <label className="radar-checkbox-inline flex items-center gap-2 text-xs font-bold font-mono text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={(e) => setNewOnly(e.target.checked)}
              />
              New only (&lt;180d)
            </label>

            {/* Sorting Buttons */}
            <div className="flex items-center border border-[#2d2d34] rounded-md overflow-hidden bg-[#18181b] ml-4">
              <button
                onClick={() => setEstablishedSort("trend_score")}
                className={`px-3 py-1.5 text-xs font-semibold border-r border-[#2d2d34] transition-all cursor-pointer ${
                  establishedSort === "trend_score" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Trend score
              </button>
              <button
                onClick={() => setEstablishedSort("star_velocity_7d")}
                className={`px-3 py-1.5 text-xs font-semibold border-r border-[#2d2d34] transition-all cursor-pointer ${
                  establishedSort === "star_velocity_7d" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Stars/d
              </button>
              <button
                onClick={() => setEstablishedSort("acceleration")}
                className={`px-3 py-1.5 text-xs font-semibold border-r border-[#2d2d34] transition-all cursor-pointer ${
                  establishedSort === "acceleration" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Accel
              </button>
              <button
                onClick={() => setEstablishedSort("sustainability_score")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  establishedSort === "sustainability_score" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Sustain
              </button>
            </div>

            {/* Export buttons */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => exportCSV(exportRows, `radar-established-${category}.csv`)}
                className="px-3 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
              <button
                onClick={() => exportJSON(exportRows, `radar-established-${category}.json`)}
                className="px-3 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                JSON
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl overflow-hidden shadow-sm">
            {radarLoading ? (
              <div className="py-12 text-center text-gray-500 font-mono text-xs animate-pulse">// LOADING RADAR DATA</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#2d2d34] text-gray-500 font-bold uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Repo</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Trend score</th>
                      <th className="py-3 px-4 text-right">Stars/d</th>
                      <th className="py-3 px-4 text-right">Accel</th>
                      <th className="py-3 px-4 text-center">Sustain</th>
                      <th className="py-3 px-4 text-center">Signal</th>
                      <th className="py-3 px-4 text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2d34]/60">
                    {visibleEstablished.map((repo, idx) => {
                      const trendScore = repo.trend_score || 0;
                      const accel = repo.acceleration || 0;
                      
                      // Calculate Signal status
                      let signalLabel = "LOW";
                      let signalColor = "text-gray-400 border-gray-800 bg-[#1f1f23]";
                      if (trendScore >= 1.0 || accel >= 2.0) {
                        signalLabel = "HIGH";
                        signalColor = "text-[#3fb950] border-[#3fb950]/30 bg-[#3fb950]/10";
                      } else if (trendScore >= 0.2) {
                        signalLabel = "MID";
                        signalColor = "text-[#d29922] border-[#d29922]/30 bg-[#d29922]/10";
                      }

                      return (
                        <tr
                          key={repo.repo_id}
                          onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                          className="hover:bg-[#232328] transition-colors cursor-pointer text-gray-300 font-medium"
                        >
                          <td className="py-3.5 px-4 text-center text-gray-500 font-semibold font-mono">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-sans text-sm">
                            <span className="text-gray-400 font-normal">{repo.owner}/</span>
                            <span className="text-white font-bold">{repo.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-400">{repo.category}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-[#d29922] font-semibold">{repo.trend_score.toFixed(4)}</td>
                          <td className="py-3.5 px-4 text-right font-mono">{repo.star_velocity_7d.toFixed(1)}</td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${accel > 0 ? "text-[#3fb950]" : "text-gray-500"}`}>
                            {accel > 0 ? `+${accel.toFixed(3)}` : "—"}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-indigo-400">•</span>
                              {(repo.sustainability_score * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${signalColor}`}>
                              {signalLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-gray-400">{formatAge(repo.age_days)}</td>
                        </tr>
                      );
                    })}
                    {establishedRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-500 font-mono text-xs">
                          // NO ESTABLISHED SIGNALS MATCH THE CURRENT FILTERS
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer row inside card */}
            <div className="p-4 border-t border-[#2d2d34] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1b1b1f]">
              <div className="flex items-center gap-3 text-xs text-gray-500 font-medium font-sans">
                <span>Showing {visibleEstablished.length} of {establishedRows.length}</span>
                {establishedRows.length > 20 && (
                  <button
                    onClick={() => setLimitRadar(limitRadar === 20 ? 50 : 20)}
                    className="px-2.5 py-1 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-[10px] font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    {limitRadar === 20 ? "See all" : "Show less"}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/early-radar"
                  className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  Acceleration leaders <span className="text-xs">↗</span>
                </Link>
                <button
                  onClick={() => switchMode("early")}
                  className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  Early insights <span className="text-xs">↗</span>
                </button>
              </div>
            </div>
          </div>

          {/* Language stack section */}
          <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl overflow-hidden shadow-sm space-y-2">
            <div className="p-4 border-b border-[#2d2d34] flex items-center justify-between bg-[#1b1b1f]/20">
              <div>
                <h3 className="text-sm font-bold text-white">Language &amp; tech stack radar</h3>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">// Languages ranked by combined 7-day star velocity</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#2d2d34] text-gray-500 font-bold uppercase tracking-wider font-mono">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Language</th>
                    <th className="py-3 px-4 text-center w-20">Repos</th>
                    <th className="py-3 px-4 text-right w-36">Weekly star vel.</th>
                    <th className="py-3 px-4 text-right w-32">Avg trend score</th>
                    <th className="py-3 px-4">Top repo</th>
                    <th className="py-3 px-4">Categories</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2d34]/60">
                  {visibleLang.map((lang, idx) => (
                    <tr key={lang.language} className="hover:bg-[#232328] transition-colors text-gray-300 font-medium">
                      <td className="py-3 px-4 text-center text-gray-500 font-mono font-semibold">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-white text-sm">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${
                          lang.language.toLowerCase() === "python" ? "bg-emerald-500" :
                          lang.language.toLowerCase() === "typescript" ? "bg-blue-500" :
                          lang.language.toLowerCase() === "javascript" ? "bg-yellow-500" :
                          lang.language.toLowerCase() === "go" ? "bg-teal-500" :
                          lang.language.toLowerCase() === "rust" ? "bg-orange-500" : "bg-gray-400"
                        }`} />
                        {lang.language}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{lang.repo_count}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#3fb950] font-bold">+{lang.weekly_star_velocity.toFixed(0)}/wk</td>
                      <td className="py-3 px-4 text-right font-mono text-[#d29922] font-semibold">{lang.avg_trend_score.toFixed(4)}</td>
                      <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">{lang.top_repo || "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {lang.categories.slice(0, 2).map((c) => (
                            <span key={c} className="bg-[#2a2a2f] text-gray-400 px-2 py-0.5 rounded text-[9px] font-bold">
                              {c.replace(" Frameworks", "").replace(" Models", "")}
                            </span>
                          ))}
                          {lang.categories.length > 2 && (
                            <span className="text-[10px] text-gray-500 font-mono font-bold">+{lang.categories.length - 2}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lang footer */}
            <div className="p-4 border-t border-[#2d2d34] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1b1b1f]">
              <div className="flex items-center gap-3 text-xs text-gray-500 font-medium font-sans">
                <span>Showing {visibleLang.length} of {langData?.length ?? 0}</span>
                {langData && langData.length > 20 && (
                  <button
                    onClick={() => setLimitLang(limitLang === 20 ? 50 : 20)}
                    className="px-2.5 py-1 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-[10px] font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    {limitLang === 20 ? "See all" : "Show less"}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/overview"
                  className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  By category <span className="text-xs">↗</span>
                </Link>
                <Link
                  href="/topics"
                  className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  Compare langs <span className="text-xs">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Early Insights View ── */}
      {mode === "early" && (
        <div className="space-y-6">
          {/* Sliders and filters panel */}
          <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl p-5 space-y-5">
            {/* Sliders row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-4 border-b border-gray-800/40">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                  <span>Max age</span>
                  <span className="text-indigo-400">{maxAge}d</span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={365}
                  step={7}
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="w-full h-1 bg-[#18181b] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                  <span>Max stars</span>
                  <span className="text-indigo-400">{(maxStars / 1000).toFixed(0)}k</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={100000}
                  step={500}
                  value={maxStars}
                  onChange={(e) => setMaxStars(Number(e.target.value))}
                  className="w-full h-1 bg-[#18181b] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                  <span>Min acceleration</span>
                  <span className="text-indigo-400">{minAccel.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={minAccel}
                  onChange={(e) => setMinAccel(Number(e.target.value))}
                  className="w-full h-1 bg-[#18181b] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Checkboxes, Selects, and Exports row */}
            <div className="flex flex-wrap items-end gap-6">
              {/* Checkboxes block */}
              <div className="flex flex-col gap-2.5 radar-filter-checkboxes">
                <label className="radar-checkbox-inline flex items-center gap-2 text-xs font-bold font-mono text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={preViralOnly}
                    onChange={(e) => setPreViralOnly(e.target.checked)}
                  />
                  Pre-viral only (14d to 5k)
                </label>
                <label className="radar-checkbox-inline flex items-center gap-2 text-xs font-bold font-mono text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={requireConsistentGrowth}
                    onChange={(e) => setRequireConsistentGrowth(e.target.checked)}
                  />
                  Consistent growth (5+ of 7d)
                </label>
                <label className="radar-checkbox-inline flex items-center gap-2 text-xs font-bold font-mono text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={requireForkMomentum}
                    onChange={(e) => setRequireForkMomentum(e.target.checked)}
                  />
                  Fork momentum
                </label>
                <label className="radar-checkbox-inline flex items-center gap-2 text-xs font-bold font-mono text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={requireSustainedVelocity}
                    onChange={(e) => setRequireSustainedVelocity(e.target.checked)}
                  />
                  Sustained 30d velocity
                </label>
              </div>

              {/* Selects block */}
              <div className="flex gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Stage</span>
                  <select
                    value={earlyStage}
                    onChange={(e) => setEarlyStage(e.target.value as EarlyStage)}
                    className="bg-[#18181b] border border-[#2d2d34] rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gray-500 font-semibold cursor-pointer"
                  >
                    <option value="all">ALL STAGES</option>
                    <option value="dormant">DORMANT</option>
                    <option value="emerging">EMERGING</option>
                    <option value="accelerating">ACCELERATING</option>
                    <option value="pre_viral">PRE-VIRAL</option>
                    <option value="breakout">BREAKOUT</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Sort by</span>
                  <select
                    value={earlySort}
                    onChange={(e) => setEarlySort(e.target.value as EarlySortKey)}
                    className="bg-[#18181b] border border-[#2d2d34] rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gray-500 font-semibold cursor-pointer"
                  >
                    <option value="breakout_score">BREAKOUT SCORE</option>
                    <option value="acceleration">ACCELERATION</option>
                    <option value="star_velocity_7d">7D VELOCITY</option>
                    <option value="velocity_ratio">VELOCITY RATIO</option>
                    <option value="novelty_score">NOVELTY</option>
                    <option value="trend_score">TREND SCORE</option>
                  </select>
                </div>
              </div>

              {/* Exports block */}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => exportCSV(exportRows, `radar-early-${category}.csv`)}
                  className="px-3 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </button>
                <button
                  onClick={() => exportJSON(exportRows, `radar-early-${category}.json`)}
                  className="px-3 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  JSON
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl overflow-hidden shadow-sm">
            {earlyLoading ? (
              <div className="py-12 text-center text-gray-500 font-mono text-xs animate-pulse">// SCANNING FOR EARLY BREAKOUTS</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#2d2d34] text-gray-500 font-bold uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Repo</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4 text-right">Breakout</th>
                      <th className="py-3 px-4 text-right">Trend</th>
                      <th className="py-3 px-4 text-right">Accel.</th>
                      <th className="py-3 px-4 text-center">ETA</th>
                      <th className="py-3 px-4">Signals</th>
                      <th className="py-3 px-4 text-center">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2d34]/60">
                    {visibleEarly.map((repo, idx) => {
                      const stage = repo.momentum_stage || "emerging";
                      const accel = repo.acceleration || 0;
                      const signals = repo.active_signals || [];

                      // Stage Badge Color
                      let stageBadgeColor = "text-gray-400 border-gray-800 bg-[#1f1f23]";
                      if (stage === "breakout") {
                        stageBadgeColor = "text-[#f85149] border-[#f85149]/30 bg-[#f85149]/10";
                      } else if (stage === "pre_viral") {
                        stageBadgeColor = "text-[#d29922] border-[#d29922]/30 bg-[#d29922]/10";
                      } else if (stage === "accelerating" || stage === "emerging") {
                        stageBadgeColor = "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
                      }

                      // Health Dot
                      let healthDot = "• Healthy";
                      let healthColor = "text-[#3fb950]";
                      if (repo.sustainability_label === "RED") {
                        healthDot = "• Critical";
                        healthColor = "text-[#f85149]";
                      } else if (repo.sustainability_label === "YELLOW") {
                        healthDot = "• Caution";
                        healthColor = "text-[#d29922]";
                      }

                      return (
                        <tr
                          key={repo.repo_id}
                          onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                          className="hover:bg-[#232328] transition-colors cursor-pointer text-gray-300 font-medium"
                        >
                          <td className="py-3.5 px-4 text-center text-gray-500 font-semibold font-mono">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-sans text-sm">
                            <span className="text-gray-400 font-normal">{repo.owner}/</span>
                            <span className="text-white font-bold">{repo.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stageBadgeColor} uppercase tracking-wider`}>
                              {stage.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-indigo-400 font-bold">
                            {(repo.breakout_score ?? repo.trend_score).toFixed(3)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[#d29922]">{repo.trend_score.toFixed(4)}</td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${accel > 0 ? "text-[#3fb950]" : "text-gray-500"}`}>
                            {accel > 0 ? `+${accel.toFixed(2)}` : "—"}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            {repo.estimated_viral_eta_days !== undefined && repo.estimated_viral_eta_days !== null
                              ? `~${repo.estimated_viral_eta_days}d`
                              : "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {signals.slice(0, 2).map((s) => (
                                <span key={s} className="bg-[#2a2a2f] text-gray-400 px-2 py-0.5 rounded text-[9px] font-bold">
                                  {s.replace("_", " ")}
                                </span>
                              ))}
                              {signals.length > 2 && (
                                <span className="text-[10px] text-gray-500 font-mono font-bold">+{signals.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className={`py-3.5 px-4 text-center font-mono font-bold ${healthColor}`}>{healthDot}</td>
                        </tr>
                      );
                    })}
                    {earlyRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-500 font-mono text-xs">
                          // NO EARLY SIGNALS MATCH THE CURRENT FILTERS
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer row inside card */}
            <div className="p-4 border-t border-[#2d2d34] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1b1b1f]">
              <div className="flex items-center gap-3 text-xs text-gray-500 font-medium font-sans">
                <span>Showing {visibleEarly.length} of {earlyRows.length}</span>
                {earlyRows.length > 20 && (
                  <button
                    onClick={() => setLimitRadar(limitRadar === 20 ? 50 : 20)}
                    className="px-2.5 py-1 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-[10px] font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    {limitRadar === 20 ? "See all" : "Show less"}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/radar"
                  className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  Top breakouts <span className="text-xs">↗</span>
                </Link>
                <Link
                  href="/overview"
                  className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  Signal picks <span className="text-xs">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl p-4 shadow-sm">
      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">
        {label}
      </div>
      <div className="text-xl font-bold mt-1 font-mono" style={{ color: highlight || "white" }}>
        {value}
      </div>
    </div>
  );
}
