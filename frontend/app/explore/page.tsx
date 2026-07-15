"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, RepoFilterDTO, RepoSummary, PaginatedResponse } from "@/lib/api";
import { formatCompactNumber } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", name: "All" },
  { id: "ai_ml", name: "AI / ML" },
  { id: "web", name: "Web" },
  { id: "devtools", name: "DevTools" },
  { id: "security", name: "Security" },
  { id: "agents", name: "Agents" },
  { id: "blockchain", name: "Blockchain" },
  { id: "data_eng", name: "Data Engineering" },
  { id: "mcp", name: "Model Context Protocol" },
  { id: "a2a", name: "Agent-to-Agent" },
  { id: "data_infra", name: "Data & Infra" }
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
  agents: ["Agent Frameworks"],
  blockchain: ["Blockchain"],
  data_eng: ["Data Engineering"],
  mcp: ["Model Context Protocol"],
  a2a: ["Agent-to-Agent"],
  data_infra: ["Data & Infra"]
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
    <div className="page-root" style={{ maxWidth: "80rem", margin: "0 auto" }}>
      {/* Title & Matched Count */}
      <div style={{ marginBottom: "24px" }}>
        <div className="page-eyebrow">
          {data?.total !== undefined ? `${data.total} repositories matched` : "—"}
        </div>
        <h1 className="page-title">Explore</h1>
      </div>

      {/* Filter Toolbar (Search, Categories, Sort) */}
      <div className="explore-filter-toolbar">
        {/* Search Input */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px", maxWidth: "280px" }}>
          <span style={{ position: "absolute", inset: "0 auto 0 0", display: "flex", alignItems: "center", paddingLeft: "12px", pointerEvents: "none", color: "var(--text-muted)" }}>
            <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search repos, topics..."
            style={{
              width: "100%",
              paddingLeft: "36px",
              paddingRight: "12px",
              paddingTop: "6px",
              paddingBottom: "6px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "13px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--text-muted)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Category Pills */}
        <div className="explore-categories-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              style={{
                padding: "5px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "20px",
                border: `1px solid ${activeCategory === cat.id ? "var(--text-muted)" : "var(--border)"}`,
                background: activeCategory === cat.id ? "rgba(255,255,255,0.06)" : "transparent",
                color: activeCategory === cat.id ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-sans)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== cat.id) {
                  e.currentTarget.style.borderColor = "var(--text-muted)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== cat.id) {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, fontFamily: "var(--font-sans)" }}>Sort</span>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "5px 12px",
              fontSize: "12px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--text-muted)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
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
      <div className="explore-languages-row" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => handleLanguageSelect(lang.id)}
            style={{
              padding: "4px 14px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "20px",
              border: "1px solid",
              borderColor: activeLanguage === lang.id ? "var(--text-muted)" : "transparent",
              background: activeLanguage === lang.id ? "var(--bg-elevated)" : "transparent",
              color: activeLanguage === lang.id ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (activeLanguage !== lang.id) {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.borderColor = "var(--border)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeLanguage !== lang.id) {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "transparent";
              }
            }}
          >
            {lang.name}
          </button>
        ))}
      </div>

      {/* Card Grid Results */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "20px",
                height: "176px",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
              transition: "opacity 0.2s",
              opacity: isFetching ? 0.6 : 1,
            }}
          >
            {data?.items.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
            {data?.items.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "64px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  border: "1px dashed var(--border)",
                  borderRadius: "12px",
                }}
              >
                No repositories match your filters. Try relaxing the constraints.
              </div>
            )}
          </div>

          {/* Footer Navigation & Pagination */}
          <div
            style={{
              marginTop: "32px",
              paddingTop: "24px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, fontFamily: "var(--font-sans)" }}>
              Showing {data?.items.length ?? 0} of {data?.total ?? 0}
            </div>

            {/* Pagination Controls */}
            {data && data.total_pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: "4px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    opacity: page === 1 ? 0.4 : 1,
                    fontFamily: "var(--font-sans)",
                    transition: "all 0.15s",
                  }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "0 4px" }}>
                  Page {page} of {data.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page === data.total_pages}
                  style={{
                    padding: "4px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    cursor: page === data.total_pages ? "not-allowed" : "pointer",
                    opacity: page === data.total_pages ? 0.4 : 1,
                    fontFamily: "var(--font-sans)",
                    transition: "all 0.15s",
                  }}
                >
                  Next →
                </button>
              </div>
            )}

            {/* Bottom Links */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Link
                href="/radar"
                style={{
                  padding: "5px 14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s",
                }}
              >
                Agent picks <span style={{ fontSize: "11px" }}>↗</span>
              </Link>
              <Link
                href="/early-radar"
                style={{
                  padding: "5px 14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s",
                }}
              >
                Rising fast <span style={{ fontSize: "11px" }}>↗</span>
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
    return formatCompactNumber(num);
  };

  // Language color — CSS variable based dots
  const getLanguageColor = (lang: string): string => {
    const colors: Record<string, string> = {
      python: "#3fb950",   // green — matches var(--accent-green)
      go: "#22d3ee",       // cyan
      typescript: "#58a6ff", // blue — matches var(--accent-blue)
      javascript: "#d29922", // amber — matches var(--accent-yellow)
      rust: "#f97316",     // orange
      elixir: "#a78bfa",   // violet
    };
    return colors[lang.toLowerCase()] || "var(--text-muted)";
  };

  // Trend Badge — dark-mode color system (matches the rest of the app)
  const getTrendBadge = (score: number): { bg: string; color: string; border: string } => {
    const val = Math.round(score * 100);
    if (val >= 100) {
      return {
        bg: "rgba(63,185,80,0.12)",
        color: "var(--accent-green)",
        border: "1px solid rgba(63,185,80,0.25)",
      };
    } else if (val >= 30) {
      return {
        bg: "rgba(210,153,34,0.12)",
        color: "var(--accent-yellow)",
        border: "1px solid rgba(210,153,34,0.25)",
      };
    } else {
      return {
        bg: "var(--bg-elevated)",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
      };
    }
  };

  // Generate fallback topics if empty
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
  const badge = getTrendBadge(repo.trend_score || 0);

  return (
    <Link
      href={`/repo/${repo.owner}/${repo.name}`}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "20px",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)";
        (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
      }}
    >
      {/* Top Header: Owner/Name & Stars */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "12px" }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{repo.owner}/</span>
          {repo.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0 }}>
          <span style={{ color: "var(--accent-yellow)" }}>★</span>
          {formatStars(repo.stars)}
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          marginBottom: "16px",
          lineHeight: "1.5",
          flexGrow: 1,
          margin: "0 0 16px 0",
        }}>
          {repo.description}
        </p>
      )}

      {/* Language & Trend Badge Row */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Language */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: getLanguageColor(repo.primary_language || ""), flexShrink: 0 }} />
          <span style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans)" }}>
            {repo.primary_language || "Markdown"}
          </span>
        </div>

        {/* Trend score pill */}
        {trendVal !== null && (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 10px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            background: badge.bg,
            color: badge.color,
            border: badge.border,
            transition: "all 0.15s",
          }}>
            <svg style={{ width: "10px", height: "10px", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {trendVal}
          </span>
        )}
      </div>

      {/* Topics row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
        {displayTopics.map((topic) => (
          <span
            key={topic}
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              padding: "2px 10px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              borderRadius: "20px",
              fontFamily: "var(--font-sans)",
              border: "1px solid var(--border)",
              transition: "all 0.15s",
            }}
          >
            {topic}
          </span>
        ))}
      </div>
    </Link>
  );
}
