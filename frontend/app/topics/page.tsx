"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api, TopicMomentum, TopicRepo } from "@/lib/api";

// ── Score bar component ─────────────────────────────────────
function ScoreBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
          style={{ width: `${pct}%` }} 
        />
      </div>
      <span className="font-mono text-[10px] text-gray-400 w-12 text-right">
        {value.toFixed(4)}
      </span>
    </div>
  );
}

export default function TopicsPage() {
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [minRepos, setMinRepos] = useState(2);
  const [search, setSearch] = useState("");
  const [chartLimit, setChartLimit] = useState<15 | 20>(15);
  const [sortBy, setSortBy] = useState<"velocity" | "score" | "repos" | "accel">("velocity");

  const { data: topics, isLoading } = useQuery({
    queryKey: ["topic-momentum", minRepos],
    queryFn: () => api.getTopicMomentum({ min_repos: minRepos, limit: 50 }),
    staleTime: 10 * 60 * 1000,
  });

  const { data: topicRepos, isLoading: reposLoading } = useQuery({
    queryKey: ["topic-repos", selectedTopic],
    queryFn: () => api.getReposByTopic(selectedTopic!, 30),
    enabled: !!selectedTopic,
    staleTime: 5 * 60 * 1000,
  });

  // Filter list of topics by search input
  const filtered: TopicMomentum[] = (topics ?? []).filter((t) =>
    t.topic.toLowerCase().includes(search.toLowerCase())
  );

  // Sort filtered topics based on the active Sort Toggle
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") {
      return b.avg_trend_score - a.avg_trend_score;
    }
    if (sortBy === "repos") {
      return b.repo_count - a.repo_count;
    }
    if (sortBy === "accel") {
      return b.avg_acceleration - a.avg_acceleration;
    }
    return b.total_star_velocity - a.total_star_velocity;
  });

  // Sliced data for the velocity bar chart (always sorted by velocity descending)
  const chartData = [...filtered]
    .sort((a, b) => b.total_star_velocity - a.total_star_velocity)
    .slice(0, chartLimit)
    .map((t) => ({
      name: `#${t.topic}`,
      velocity: Math.round(t.total_star_velocity),
      avg_score: t.avg_trend_score,
    }));

  const maxScore = Math.max(...filtered.map((t) => t.avg_trend_score), 1);

  // Formatter helpers
  const formatVelocityHeader = (num: number) => {
    const sign = num >= 0 ? "+" : "";
    if (Math.abs(num) >= 1_000_000) {
      return `${sign}${(num / 1_000_000).toFixed(2)}M/d`;
    }
    if (Math.abs(num) >= 1000) {
      return `${sign}${(num / 1000).toFixed(1)}k/d`;
    }
    return `${sign}${num.toFixed(0)}/d`;
  };

  const formatTableVelocity = (num: number) => {
    const sign = num >= 0 ? "+" : "";
    if (Math.abs(num) >= 1_000_000) {
      return `${sign}${(num / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${sign}${(num / 1000).toFixed(1)}k`;
    }
    return `${sign}${num.toFixed(0)}`;
  };

  const formatYAxisTicks = (value: number) => {
    if (value >= 1000) return `${value / 1000}k`;
    return value.toString();
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Topic intelligence</h1>
          <p className="text-xs text-gray-500 font-medium font-sans mt-1">
            GitHub topic tags ranked by combined star velocity &amp; trend score
          </p>
        </div>

        {/* Summary chips */}
        {topics && (
          <div className="topics-summary-chips">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Topics</span>
              <span className="text-sm font-bold text-white font-mono">{filtered.length}</span>
            </div>
            <div className="w-[1px] h-8 bg-gray-800" />
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Avg score</span>
              <span className="text-sm font-bold text-white font-mono">
                {filtered.length ? (filtered.reduce((s, t) => s + t.avg_trend_score, 0) / filtered.length).toFixed(3) : "0.000"}
              </span>
            </div>
            <div className="w-[1px] h-8 bg-gray-800" />
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Total velocity</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {formatVelocityHeader(filtered.reduce((s, t) => s + t.total_star_velocity, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Chart Section ── */}
      <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Star velocity by topic — top {chartLimit}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">stars / day</span>
            <div className="flex border border-[#2d2d34] rounded-md overflow-hidden bg-[#18181b]">
              <button
                onClick={() => setChartLimit(15)}
                className={`px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  chartLimit === 15
                    ? "bg-[#27272a] text-white border-r border-[#2d2d34]"
                    : "text-gray-400 hover:text-white border-r border-[#2d2d34]"
                }`}
              >
                Top 15
              </button>
              <button
                onClick={() => setChartLimit(20)}
                className={`px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  chartLimit === 20 ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Top 20
              </button>
            </div>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        {chartData.length > 0 ? (
          <div className="h-[240px] w-full pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, bottom: 35, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a2f" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#8e8e93", fontWeight: 500 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  stroke="#2a2a2f"
                />
                <YAxis
                  tickFormatter={formatYAxisTicks}
                  tick={{ fontSize: 10, fill: "#8e8e93", fontFamily: "monospace" }}
                  stroke="#2a2a2f"
                />
                <Tooltip
                  contentStyle={{
                    background: "#1f1f23",
                    border: "1px solid #2d2d34",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#e6edf3",
                  }}
                  formatter={(v: any) => [`+${v}/d`, "Velocity"]}
                />
                <Bar 
                  dataKey="velocity" 
                  fill="#6366f1" 
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    if (data && typeof data.name === "string") {
                      const cleanName = data.name.replace("#", "");
                      setSelectedTopic(selectedTopic === cleanName ? null : cleanName);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-gray-500 font-mono text-xs">No chart data available</div>
        )}
      </div>

      {/* ── Table Section Controls ── */}
      <div className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="topics-table-toolbar">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-[260px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search topics…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#18181b] border border-[#2d2d34] rounded-md text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-all font-semibold"
            />
          </div>

          {/* Min Repos input */}
          <div className="flex items-center gap-2 bg-[#18181b] border border-[#2d2d34] rounded-md px-3 py-1.5">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider font-mono whitespace-nowrap">Min repos</span>
            <input
              type="number"
              min={1}
              value={minRepos}
              onChange={(e) => setMinRepos(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-8 bg-transparent text-white font-bold font-mono text-xs focus:outline-none text-center"
            />
          </div>

          {/* Sort selection buttons */}
          <div className="flex items-center border border-[#2d2d34] rounded-md overflow-hidden bg-[#18181b] ml-auto">
            <button
              onClick={() => setSortBy("velocity")}
              className={`px-3 py-1.5 text-xs font-semibold border-r border-[#2d2d34] transition-all cursor-pointer ${
                sortBy === "velocity" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Velocity
            </button>
            <button
              onClick={() => setSortBy("score")}
              className={`px-3 py-1.5 text-xs font-semibold border-r border-[#2d2d34] transition-all cursor-pointer ${
                sortBy === "score" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Score
            </button>
            <button
              onClick={() => setSortBy("repos")}
              className={`px-3 py-1.5 text-xs font-semibold border-r border-[#2d2d34] transition-all cursor-pointer ${
                sortBy === "repos" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Repos
            </button>
            <button
              onClick={() => setSortBy("accel")}
              className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                sortBy === "accel" ? "bg-[#27272a] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Accel
            </button>
          </div>
        </div>

        {/* Topics Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#2d2d34]">
                <th className="py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono w-12">#</th>
                <th className="py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">Topic</th>
                <th className="col-hide-mobile py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono text-center w-20">Repos</th>
                <th className="col-hide-tablet py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono text-right w-24">Avg score</th>
                <th className="col-hide-mobile py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono w-44">Score bar</th>
                <th className="py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono text-right w-28">Vel / day</th>
                <th className="col-hide-tablet py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono text-center w-24">Accel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d2d34]/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="py-6 px-4"><div className="h-4 bg-[#2a2a2f] rounded w-full" /></td>
                  </tr>
                ))
              ) : sorted.map((t, idx) => (
                <tr
                  key={t.topic}
                  onClick={() => setSelectedTopic(selectedTopic === t.topic ? null : t.topic)}
                  className={`hover:bg-[#232328] transition-colors cursor-pointer ${
                    selectedTopic === t.topic ? "bg-indigo-500/5 hover:bg-indigo-500/10" : ""
                  }`}
                >
                  {/* Rank */}
                  <td className="py-3 px-4 font-mono text-xs text-gray-500 font-semibold">{idx + 1}</td>
                  {/* Topic name and repo count */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-white text-sm"># {t.topic}</div>
                    <div className="text-[10px] text-gray-500 font-medium font-sans mt-0.5">{t.repo_count} repos</div>
                  </td>
                  {/* Repos count */}
                  <td className="col-hide-mobile py-3 px-4 text-center font-mono text-xs text-gray-200 font-bold">{t.repo_count}</td>
                  {/* Avg Trend Score */}
                  <td className="col-hide-tablet py-3 px-4 text-right font-mono text-xs text-gray-400">{t.avg_trend_score.toFixed(4)}</td>
                  {/* Score bar */}
                  <td className="col-hide-mobile py-3 px-4 min-w-[150px]">
                    <ScoreBar value={t.avg_trend_score} max={maxScore} />
                  </td>
                  {/* Total star velocity per day */}
                  <td className="py-3 px-4 text-right font-mono text-xs text-emerald-400 font-bold">
                    {formatTableVelocity(t.total_star_velocity)}
                  </td>
                  {/* Acceleration pill */}
                  <td className="col-hide-tablet py-3 px-4 text-center">
                    {t.avg_acceleration > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        +{t.avg_acceleration.toFixed(2)}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#18181b] border border-gray-800 text-gray-500">
                        {t.avg_acceleration.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-mono text-xs">
                    No topics match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer controls inside table card */}
        <div className="p-4 border-t border-[#2d2d34] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1b1b1f]">
          <div className="text-xs text-gray-500 font-medium font-sans">
            Showing {sorted.length} of {topics?.length ?? 0}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/early-radar"
              className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
            >
              Acceleration leaders <span className="text-xs">↗</span>
            </Link>
            <Link
              href="/overview"
              className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
            >
              By category <span className="text-xs">↗</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Slide-over Drawer for Selected Topic Detail ── */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setSelectedTopic(null)}
          />
          
          <div className="topics-drawer-container">
            <div className="w-screen max-w-md bg-[#16161a] border-l border-[#2d2d34] shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-[#2d2d34] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">Topic Details</span>
                  <h2 className="text-xl font-bold text-white mt-0.5">#{selectedTopic}</h2>
                </div>
                <button 
                  onClick={() => setSelectedTopic(null)}
                  className="text-gray-400 hover:text-white border border-[#2d2d34] hover:border-gray-600 rounded-md p-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Topic Metrics */}
              {(() => {
                const td = topics?.find((t) => t.topic === selectedTopic);
                if (!td) return null;
                return (
                  <div className="grid grid-cols-2 gap-4 p-6 border-b border-[#2d2d34] bg-[#1f1f23]/40">
                    <div className="bg-[#1f1f23] border border-[#2d2d34]/80 rounded-lg p-3">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Repos</span>
                      <span className="text-lg font-bold text-white">{td.repo_count}</span>
                    </div>
                    <div className="bg-[#1f1f23] border border-[#2d2d34]/80 rounded-lg p-3">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Avg Trend Score</span>
                      <span className="text-lg font-bold text-white">{td.avg_trend_score.toFixed(4)}</span>
                    </div>
                    <div className="bg-[#1f1f23] border border-[#2d2d34]/80 rounded-lg p-3">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Velocity</span>
                      <span className="text-lg font-bold text-emerald-400">+{td.total_star_velocity.toFixed(1)}/d</span>
                    </div>
                    <div className="bg-[#1f1f23] border border-[#2d2d34]/80 rounded-lg p-3">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono block">Acceleration</span>
                      <span className={`text-lg font-bold ${td.avg_acceleration > 1 ? "text-emerald-400" : "text-gray-300"}`}>
                        {td.avg_acceleration.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Drawer Repositories List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono mb-2">Repositories</h3>
                
                {reposLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-gray-800 border-t-indigo-500 rounded-full animate-spin" />
                    <span className="text-xs text-gray-500 font-mono">Loading repositories...</span>
                  </div>
                ) : (topicRepos ?? []).length === 0 ? (
                  <div className="text-center py-12 text-xs text-gray-500 font-mono">No repositories found for #{selectedTopic}</div>
                ) : (
                  (topicRepos ?? []).map((repo: TopicRepo, idx) => (
                    <div 
                      key={repo.repo_id}
                      onClick={() => {
                        setSelectedTopic(null);
                        router.push(`/repo/${repo.owner}/${repo.name}`);
                      }}
                      className="bg-[#1f1f23] border border-[#2d2d34] hover:border-gray-600 rounded-xl p-4 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="text-[13px] font-semibold text-indigo-400 truncate hover:underline">
                          {repo.owner}/{repo.name}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          repo.sustainability_label === "GREEN" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : repo.sustainability_label === "YELLOW"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {repo.sustainability_label || "YELLOW"}
                        </span>
                      </div>
                      
                      {/* Trend Score */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-gray-500 font-semibold uppercase font-mono mb-1">
                          <span>Trend Score</span>
                          <span>{repo.trend_score.toFixed(4)}</span>
                        </div>
                        <ScoreBar value={repo.trend_score} max={1} />
                      </div>
                      
                      {/* Repository stats */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800/60 text-center">
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold uppercase font-mono block">Stars</span>
                          <span className="text-xs font-semibold text-gray-300">
                            {repo.stars != null ? (repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars) : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold uppercase font-mono block">Rank</span>
                          <span className="text-xs font-semibold text-gray-300">#{idx + 1}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold uppercase font-mono block">Accel</span>
                          <span className={`text-xs font-semibold ${repo.acceleration > 1 ? "text-emerald-400" : "text-gray-300"}`}>
                            {repo.acceleration > 1 ? "▲" : ""}{repo.acceleration.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
