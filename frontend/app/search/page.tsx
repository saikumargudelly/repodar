"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, NLSearchResult, NLSearchRepo, ParsedFilters } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

const EXAMPLE_QUERIES = [
  "Show me fast inference engines with high momentum this week",
  "New agent frameworks under 6 months old with Python",
  "Vector databases with high sustainability score",
  "LLM fine-tuning repos gaining stars fast in last 30 days",
  "Go security tools created in the last 3 months",
  "TypeScript web frameworks trending this week",
];

function SourceBadge({ source }: { source: "internal" | "github" }) {
  if (source === "github") {
    return (
      <span style={{
        background: "rgba(34,197,94,0.1)",
        border: "1px solid #22c55e",
        borderRadius: "3px",
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        color: "#22c55e",
        padding: "2px 6px",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}>
        LIVE
      </span>
    );
  }
  return (
    <span style={{
      background: "rgba(6,182,212,0.1)",
      border: "1px solid var(--cyan)",
      borderRadius: "3px",
      fontFamily: "var(--font-mono)",
      fontSize: "9px",
      color: "var(--cyan)",
      padding: "2px 6px",
      letterSpacing: "0.05em",
      whiteSpace: "nowrap",
    }}>
      TRACKED
    </span>
  );
}

function FilterChips({ filters }: { filters: ParsedFilters }) {
  const chips: { label: string; value: string }[] = [];
  if (filters.vertical)         chips.push({ label: "vertical",   value: filters.vertical });
  if (filters.language)         chips.push({ label: "language",   value: filters.language });
  if (filters.min_trend_score)  chips.push({ label: "min score",  value: String(filters.min_trend_score) });
  if (filters.min_stars)        chips.push({ label: "min stars",  value: filters.min_stars.toLocaleString() });
  if (filters.max_age_days)     chips.push({ label: "age ≤",      value: `${filters.max_age_days}d` });
  if (filters.sort_by)          chips.push({ label: "sort by",    value: filters.sort_by });
  if (filters.time_window)      chips.push({ label: "window",     value: filters.time_window });

  const keywords = filters.keywords ?? [];

  if (!chips.length && !keywords.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
      {chips.map((c) => (
        <span key={c.label} style={{
          background: "var(--surface2)",
          border: "1px solid var(--cyan)",
          borderRadius: "4px",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--cyan)",
          padding: "3px 10px",
          letterSpacing: "0.04em",
        }}>
          {c.label}: <span style={{ color: "var(--text-primary)" }}>{c.value}</span>
        </span>
      ))}
      {keywords.map((kw) => (
        <span key={kw} style={{
          background: "var(--surface2)",
          border: "1px solid var(--amber, #f59e0b)",
          borderRadius: "4px",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--amber, #f59e0b)",
          padding: "3px 10px",
          letterSpacing: "0.04em",
        }}>
          #{kw}
        </span>
      ))}
      {filters.query_understood && (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--text-muted)",
          alignSelf: "center",
          marginLeft: "4px",
        }}>
          // {filters.query_understood}
        </span>
      )}
    </div>
  );
}

function RepoRow({ repo, rank }: { repo: NLSearchRepo; rank: number }) {
  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
        {String(rank).padStart(2, "0")}
      </td>
      <td style={{ padding: "10px 16px", minWidth: 0 }}>
        <Link href={`/repo/${repo.owner}/${repo.name}`}
          style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cyan)",
            textDecoration: "none", fontWeight: 600 }}>
          {repo.owner}/{repo.name}
        </Link>
        {repo.description && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
            marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: "300px" }}>
            {repo.description}
          </div>
        )}
      </td>
      <td style={{ padding: "10px 16px" }}>
        <SourceBadge source={repo.source} />
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
        {repo.category}
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--amber)" }}>
        {repo.trend_score != null ? repo.trend_score.toFixed(3) : "—"}
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)" }}>
        {repo.stars != null ? repo.stars.toLocaleString() : "—"}
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
        {repo.primary_language ?? "—"}
      </td>
      <td style={{ padding: "10px 16px" }}>
        {repo.sustainability_label
          ? <SustainBadge label={repo.sustainability_label} />
          : <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>—</span>}
      </td>
    </tr>
  );
}

export default function SearchPage() {
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: result, isFetching, error } = useQuery<NLSearchResult>({
    queryKey: ["nl-search", submittedQuery],
    queryFn: () => api.nlSearch(submittedQuery, 30),
    enabled: submittedQuery.trim().length > 0,
    staleTime: 60_000,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inputValue.trim()) setSubmittedQuery(inputValue.trim());
  }

  function useExample(q: string) {
    setInputValue(q);
    setSubmittedQuery(q);
    inputRef.current?.focus();
  }

  const internalCount = result?.repos.filter((r) => r.source === "internal").length ?? 0;
  const githubCount   = result?.repos.filter((r) => r.source === "github").length ?? 0;

  return (
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">NL SEARCH<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Describe what you&apos;re looking for — AI parses filters, searches tracked repos + live GitHub
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit}>
        <div style={{
          display: "flex",
          gap: "8px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "4px 4px 4px 16px",
          boxShadow: isFetching ? "0 0 0 2px var(--cyan)" : undefined,
          transition: "box-shadow 0.2s",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--cyan)", alignSelf: "center" }}>
            &gt;_
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g. fast inference engines with high momentum"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              padding: "10px 0",
            }}
          />
          <button
            type="submit"
            disabled={isFetching || !inputValue.trim()}
            style={{
              background: "var(--cyan)",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              padding: "8px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: isFetching ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
              opacity: isFetching ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {isFetching ? "SEARCHING..." : "SEARCH"}
          </button>
        </div>
      </form>

      {/* Example queries */}
      {!submittedQuery && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginBottom: "8px", letterSpacing: "0.06em" }}>
            // TRY THESE QUERIES
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => useExample(q)}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  padding: "6px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Parsed filters */}
      {result?.filters && <FilterChips filters={result.filters} />}

      {/* Error */}
      {error && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--red, #ef4444)", padding: "12px 0" }}>
          // ERROR: {String(error)}
        </div>
      )}

      {/* Loading */}
      {isFetching && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center", padding: "40px 0",
          fontSize: "12px", letterSpacing: "0.06em" }}>
          // INTERPRETING QUERY + SEARCHING GITHUB<span className="terminal-cursor" />
        </div>
      )}

      {/* Results */}
      {result && !isFetching && (
        <>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
              // {result.total} repo{result.total !== 1 ? "s" : ""} matched
            </div>
            {internalCount > 0 && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--cyan)" }}>
                {internalCount} tracked
              </div>
            )}
            {githubCount > 0 && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#22c55e" }}>
                {githubCount} live from GitHub
              </div>
            )}
          </div>

          {result.repos.length === 0 ? (
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
              textAlign: "center", fontSize: "12px" }}>
              // NO RESULTS — try a different query
            </div>
          ) : (
            <div className="panel table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr>
                    {["#", "REPO", "SOURCE", "CATEGORY", "TREND SCORE", "STARS", "LANGUAGE", "HEALTH"].map((h) => (
                      <th key={h} className="th-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.repos.map((repo, i) => (
                    <RepoRow key={`${repo.source}-${repo.repo_id}`} repo={repo} rank={i + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
