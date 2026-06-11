"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, EarlyRadarRepo } from "@/lib/api";

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

type EarlySortKey = "breakout_score" | "acceleration" | "star_velocity_7d" | "velocity_ratio" | "novelty_score" | "trend_score";
type EarlyStage = "all" | "dormant" | "emerging" | "accelerating" | "pre_viral" | "breakout";

export default function EarlyRadarPage() {
  const router = useRouter();
  const [maxAge, setMaxAge] = useState(180);
  const [maxStars, setMaxStars] = useState(50000);
  const [minAccel, setMinAccel] = useState(0);
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<EarlySortKey>("breakout_score");
  const [momentumStage, setMomentumStage] = useState<EarlyStage>("all");
  const [preViralOnly, setPreViralOnly] = useState(false);
  const [requireConsistentGrowth, setRequireConsistentGrowth] = useState(false);
  const [requireForkMomentum, setRequireForkMomentum] = useState(false);
  const [requireSustainedVelocity, setRequireSustainedVelocity] = useState(false);

  // Limit items count
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ["early-radar", maxAge, maxStars, minAccel, category, sortBy, momentumStage, preViralOnly, requireConsistentGrowth, requireForkMomentum, requireSustainedVelocity],
    queryFn: () =>
      api.getEarlyRadar({
        max_age_days: maxAge,
        max_stars: maxStars,
        min_acceleration: minAccel,
        category: category !== "All" ? category : undefined,
        sort_by: sortBy,
        momentum_stage: momentumStage !== "all" ? momentumStage : undefined,
        require_pre_viral: preViralOnly,
        require_consistent_growth: requireConsistentGrowth,
        require_fork_momentum: requireForkMomentum,
        require_sustained_velocity: requireSustainedVelocity,
        limit: 100,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const repos: EarlyRadarRepo[] = useMemo(() => {
    return data ?? [];
  }, [data]);

  // Header Metrics Calculations
  const activeTrendAverage = useMemo(() => {
    if (repos.length === 0) return 0;
    return repos.reduce((sum, row) => sum + row.trend_score, 0) / repos.length;
  }, [repos]);

  const activeAccelerationAverage = useMemo(() => {
    if (repos.length === 0) return 0;
    return repos.reduce((sum, row) => sum + row.acceleration, 0) / repos.length;
  }, [repos]);

  const highMomentumCount = useMemo(() => {
    return repos.filter((row) => {
      const stage = row.momentum_stage;
      return stage === "pre_viral" || stage === "breakout" || (row.breakout_score ?? 0) > 1;
    }).length;
  }, [repos]);

  const exportRows = useMemo(() => {
    return repos.map((row) => ({
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
  }, [repos]);

  // Sliced to respect the limit
  const visibleRows = repos.slice(0, limit);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Early insight radar</h1>
          <p className="text-xs text-gray-500 font-medium font-sans mt-1">
            Emerging repos ranked by breakout probability
          </p>
        </div>

        {/* Categories selector */}
        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setLimit(20);
            }}
            className="bg-[#18181b] border border-[#2d2d34] rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gray-500 font-semibold cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All categories" : c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Matched repos" value={String(repos.length)} />
        <MetricCard label="Avg trend score" value={activeTrendAverage.toFixed(4)} highlight="#d29922" />
        <MetricCard label="Avg acceleration" value={activeAccelerationAverage.toFixed(2)} />
        <MetricCard label="Pre-viral / breakout" value={String(highMomentumCount)} highlight="#3fb950" />
      </div>

      {/* ── Sliders and Filters Panel ── */}
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
                value={momentumStage}
                onChange={(e) => setMomentumStage(e.target.value as EarlyStage)}
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
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as EarlySortKey)}
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

      {/* ── Table Container ── */}
      <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
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
                {visibleRows.map((repo, idx) => {
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
                {repos.length === 0 && (
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

        {/* Footer controls inside card */}
        <div className="p-4 border-t border-[#2d2d34] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1b1b1f]">
          <div className="flex items-center gap-3 text-xs text-gray-500 font-medium font-sans">
            <span>Showing {visibleRows.length} of {repos.length}</span>
            {repos.length > 20 && (
              <button
                onClick={() => setLimit(limit === 20 ? 50 : 20)}
                className="px-2.5 py-1 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-[10px] font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
              >
                {limit === 20 ? "See all" : "Show less"}
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
