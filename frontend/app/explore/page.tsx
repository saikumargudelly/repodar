"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, RepoFilterDTO, RepoSummary, PaginatedResponse } from "@/lib/api";

const CATEGORIES = [
  { id: "all", name: "All" },
  { id: "ai_ml", name: "AI / ML" },
  { id: "web", name: "Web" },
  { id: "devtools", name: "DevTools" },
  { id: "security", name: "Security" },
  { id: "agents", name: "Agents" }
];

const LANGUAGES = [
  { id: "all", name: "All languages" },
  { id: "python", name: "Python" },
  { id: "typescript", name: "TypeScript" },
  { id: "go", name: "Go" },
  { id: "rust", name: "Rust" },
  { id: "elixir", name: "Elixir" },
  { id: "javascript", name: "JavaScript" }
];

const CATEGORY_MAP: Record<string, string[]> = {
  all: [],
  ai_ml: [
    "LLM Models",
    "Agent Frameworks",
    "Inference Engines",
    "Vector Databases",
    "Model Serving / Runtimes",
    "Distributed Compute / Infra",
    "Evaluation Frameworks",
    "Fine-tuning Toolkits"
  ],
  web: ["Web Frameworks"],
  devtools: ["DevTools"],
  security: ["Security"],
  agents: ["Agent Frameworks"]
};

export default function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeLanguage, setActiveLanguage] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("trend_score");
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Build the RepoFilterDTO payload dynamically
  const filter: RepoFilterDTO = {
    q: debouncedSearchTerm || undefined,
    categories: activeCategory !== "all" ? CATEGORY_MAP[activeCategory] : undefined,
    languages: activeLanguage !== "all" ? [activeLanguage] : undefined,
    sort_by: sortBy,
    sort_dir: "desc"
  };

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse<RepoSummary>>({
    queryKey: ["explore", filter, page],
    queryFn: () => api.filterRepos(filter, page, PER_PAGE),
    staleTime: 30_000,
    keepPreviousData: true,
  } as any);

  const handleCategorySelect = (catId: string) => {
    setActiveCategory(catId);
    setPage(1);
  };

  const handleLanguageSelect = (langId: string) => {
    setActiveLanguage(langId);
    setPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Title & Matched Count */}
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Explore repositories</h1>
        <span className="text-xs text-gray-500 font-medium font-sans">
          {data?.total !== undefined ? `${data.total} matched` : "12 matched"}
        </span>
      </div>

      {/* Filter Toolbar (Search, Categories, Sort) */}
      <div className="explore-filter-toolbar">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-[280px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search repos, t..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#18181b] border border-[#2d2d34] rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all"
          />
        </div>

        {/* Category Pills */}
        <div className="explore-categories-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap border ${
                activeCategory === cat.id
                  ? "bg-[#27272a] text-white border-gray-600"
                  : "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1f1f23] border-transparent"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500 font-semibold font-sans">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-[#18181b] border border-[#2d2d34] rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gray-500 transition-all font-semibold cursor-pointer"
          >
            <option value="trend_score">Trend score</option>
            <option value="stars">Stars</option>
            <option value="sustainability_score">Sustainability</option>
            <option value="star_velocity_7d">Star velocity 7d</option>
            <option value="age_days">Age</option>
          </select>
        </div>
      </div>

      {/* Languages Filters Row */}
      <div className="explore-languages-row border-t border-b border-gray-800/40">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => handleLanguageSelect(lang.id)}
            className={`px-3.5 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
              activeLanguage === lang.id
                ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200"
                : "bg-[#18181b] border-[#2d2d34] text-gray-400 hover:text-gray-200 hover:border-gray-600"
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>

      {/* Card Grid Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#1f1f23] border border-[#2d2d34] rounded-xl p-5 h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-200 ${isFetching ? "opacity-60" : "opacity-100"}`}>
            {data?.items.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
            {data?.items.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-400 font-mono text-sm border border-dashed border-gray-800 rounded-xl">
                No repositories match your filters. Try relaxing the constraints.
              </div>
            )}
          </div>

          {/* Footer Navigation & Pagination */}
          <div className="mt-8 pt-6 border-t border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500 font-medium font-sans">
              Showing {data?.items.length ?? 0} of {data?.total ?? 0}
            </div>

            {/* Pagination Controls */}
            {data && data.total_pages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-[#18181b] border border-[#2d2d34] rounded-md text-xs font-semibold text-gray-400 hover:text-white disabled:opacity-40 disabled:hover:text-gray-400 transition-all cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="text-xs text-gray-400 font-mono px-1">
                  Page {page} of {data.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page === data.total_pages}
                  className="px-3 py-1 bg-[#18181b] border border-[#2d2d34] rounded-md text-xs font-semibold text-gray-400 hover:text-white disabled:opacity-40 disabled:hover:text-gray-400 transition-all cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}

            {/* Bottom Links */}
            <div className="flex items-center gap-3">
              <Link
                href="/radar"
                className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                Agent picks <span className="text-xs">↗</span>
              </Link>
              <Link
                href="/early-radar"
                className="px-4 py-1.5 bg-[#18181b] border border-[#2d2d34] hover:border-gray-600 rounded-md text-xs font-semibold text-gray-300 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                Rising fast <span className="text-xs">↗</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RepoCard({ repo }: { repo: RepoSummary }) {
  // Format stars helper (e.g. 25326 -> "25.3k")
  const formatStars = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return num.toString();
  };

  // Language color mapper
  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      python: "bg-emerald-500",
      go: "bg-teal-500",
      typescript: "bg-blue-500",
      javascript: "bg-yellow-500",
      rust: "bg-orange-500",
      elixir: "bg-violet-500",
    };
    return colors[lang.toLowerCase()] || "bg-gray-400";
  };

  // Trend Badge Style
  const getTrendBadgeStyle = (score: number) => {
    const val = Math.round(score * 100);
    if (val >= 100) {
      return "bg-[#e6f4ea] text-[#137333]"; // High Trend
    } else if (val >= 30) {
      return "bg-[#fff3cd] text-[#856404]"; // Medium Trend
    } else {
      return "bg-[#2a2a2d] text-[#8e8e93]"; // Low Trend
    }
  };

  // Generate polish fallbacks if topics is empty
  let displayTopics = repo.topics || [];
  if (displayTopics.length === 0) {
    if (repo.category) {
      displayTopics.push(
        repo.category
          .toLowerCase()
          .replace(" frameworks", "")
          .replace(" models", "")
          .replace(" runtimes", "")
          .replace(" databases", "")
      );
    }
    if (repo.primary_language) displayTopics.push(repo.primary_language.toLowerCase());
    displayTopics.push("github");
  }
  displayTopics = displayTopics.slice(0, 3);

  const trendVal = repo.trend_score !== null ? Math.round(repo.trend_score * 100) : null;

  return (
    <Link
      href={`/repo/${repo.owner}/${repo.name}`}
      className="group flex flex-col bg-[#1f1f23] border border-[#2d2d34] rounded-xl p-5 hover:border-gray-600 hover:bg-[#232328] transition-all duration-200 shadow-sm"
    >
      {/* Top Header: Owner/Name & Stars */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="text-[15px] font-semibold text-white truncate pr-3">
          <span className="text-gray-400 font-normal">{repo.owner}/</span>
          {repo.name}
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold text-gray-200 shrink-0">
          <span className="text-amber-500 text-sm">★</span>
          {formatStars(repo.stars)}
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed flex-grow">
          {repo.description}
        </p>
      )}

      {/* Language & Trend Badge Row */}
      <div className="mt-auto flex items-center justify-between">
        {/* Language */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${getLanguageColor(repo.primary_language || "")}`} />
          <span className="text-gray-400 text-xs font-semibold">{repo.primary_language || "Markdown"}</span>
        </div>

        {/* Trend score pill */}
        {trendVal !== null && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${getTrendBadgeStyle(repo.trend_score || 0)}`}>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {trendVal}
          </span>
        )}
      </div>

      {/* Topics row */}
      <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-gray-800/20">
        {displayTopics.map((topic) => (
          <span
            key={topic}
            className="bg-[#2a2a2f] hover:bg-[#323238] text-gray-300 px-2.5 py-0.5 text-[10px] font-bold tracking-wide rounded-full transition-colors"
          >
            {topic}
          </span>
        ))}
      </div>
    </Link>
  );
}
