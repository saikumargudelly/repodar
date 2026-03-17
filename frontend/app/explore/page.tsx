"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, RepoFilterDTO, RepoSummary, PaginatedResponse } from "@/lib/api";
import { FilterPanel } from "@/components/filters/FilterPanel";

export default function ExplorePage() {
  const [filter, setFilter] = useState<RepoFilterDTO>({});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 24;

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse<RepoSummary>>({
    queryKey: ["explore", filter, page],
    queryFn: () => api.filterRepos(filter, page, PER_PAGE),
    staleTime: 60_000,
    keepPreviousData: true,
  } as any);

  const handleFilterChange = useCallback((f: RepoFilterDTO) => {
    setFilter(f);
    setPage(1);
  }, []);

  const activeFilterCount = Object.values(filter).filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-space-100 tracking-tight">Explore Repositories</h1>
          <p className="text-sm text-space-400 mt-1">
            {data?.total ? `${data.total.toLocaleString()} repos matched` : "Search and filter the full repository database"}
          </p>
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-space-700 bg-space-900 text-space-200 hover:bg-space-800 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-accent-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-mono">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Inline Filter Panel */}
      {showFilters && (
        <div className="mb-8">
          <FilterPanel
            initialFilter={filter}
            onFilterChange={handleFilterChange}
            onClose={() => setShowFilters(false)}
          />
        </div>
      )}

      {/* Active filters summary */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="mb-4 flex flex-wrap gap-2 items-center text-xs">
          {filter.min_stars && <Chip label={`Stars ≥ ${filter.min_stars.toLocaleString()}`} onRemove={() => handleFilterChange({ ...filter, min_stars: undefined })} />}
          {filter.max_stars && <Chip label={`Stars ≤ ${filter.max_stars.toLocaleString()}`} onRemove={() => handleFilterChange({ ...filter, max_stars: undefined })} />}
          {filter.min_trend_score && <Chip label={`Trend ≥ ${filter.min_trend_score}`} onRemove={() => handleFilterChange({ ...filter, min_trend_score: undefined })} />}
          {filter.sustainability_label && <Chip label={`Sustainability: ${filter.sustainability_label}`} onRemove={() => handleFilterChange({ ...filter, sustainability_label: undefined })} />}
          <button onClick={() => handleFilterChange({})} className="text-space-400 hover:text-red-400 underline">Clear all</button>
        </div>
      )}

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-space-900 border border-space-800 rounded-lg p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
            {data?.items.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
            {data?.items.length === 0 && (
              <div className="col-span-full py-16 text-center text-space-500 font-mono text-sm border-2 border-dashed border-space-800 rounded-lg">
                No repositories match your filters. Try relaxing the constraints.
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.total_pages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-10">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded border border-space-700 text-space-300 hover:bg-space-800 disabled:opacity-40 text-sm transition-colors"
              >← Prev</button>
              <span className="text-sm text-space-400 font-mono">
                Page {page} of {data.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="px-3 py-1.5 rounded border border-space-700 text-space-300 hover:bg-space-800 disabled:opacity-40 text-sm transition-colors"
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RepoCard({ repo }: { repo: RepoSummary }) {
  const labelColors: Record<string, string> = {
    GREEN: "text-emerald-400 bg-emerald-400/10 border-emerald-800",
    YELLOW: "text-amber-400 bg-amber-400/10 border-amber-800",
    RED: "text-red-400 bg-red-400/10 border-red-800",
  };
  const sustainClass = repo.sustainability_label ? labelColors[repo.sustainability_label] ?? "" : "";

  return (
    <Link
      href={`/repo/${repo.owner}/${repo.name}`}
      className="group bg-space-900 border border-space-800 rounded-lg p-5 flex flex-col hover:border-space-600 hover:bg-space-800/60 transition-all"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="font-mono text-sm font-medium text-cyan-400 truncate pr-3">
          {repo.owner}/<span className="text-cyan-300">{repo.name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-400 shrink-0 font-mono">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {(repo.stars ?? 0).toLocaleString()}
        </div>
      </div>

      {repo.description && (
        <p className="text-xs text-space-400 line-clamp-2 mb-3 flex-grow leading-relaxed">
          {repo.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase">
        {repo.primary_language && (
          <span className="px-1.5 py-0.5 rounded bg-space-800 text-space-400">{repo.primary_language}</span>
        )}
        {repo.sustainability_label && (
          <span className={`px-1.5 py-0.5 rounded border ${sustainClass}`}>{repo.sustainability_label}</span>
        )}
        {repo.trend_score !== null && repo.trend_score !== undefined && (
          <span className="ml-auto text-space-500">
            Trend <span className="text-space-300">{(repo.trend_score * 100).toFixed(0)}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-500/10 border border-accent-800 text-accent-300">
      {label}
      <button onClick={onRemove} className="hover:text-red-400 ml-0.5">×</button>
    </span>
  );
}
