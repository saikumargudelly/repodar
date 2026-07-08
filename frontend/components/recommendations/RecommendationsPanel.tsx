"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/useAuthSession";
import { api } from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface Props {
  /** Pass owner+name when on a repo detail page for "Similar Repos" */
  repoOwner?: string;
  repoName?: string;
}

export function RecommendationsPanel({ repoOwner, repoName }: Props) {
  const { token, isReady } = useAuthSession();
  const isSimilar = !!(repoOwner && repoName);

  const { data: recommendations, isLoading } = useQuery({
    queryKey: isSimilar
      ? ["similar-repos", repoOwner, repoName]
      : ["personalized-recs"],
    queryFn: () =>
      isSimilar
        ? api.getSimilarRepos(repoOwner!, repoName!, 6)
        : api.getRecommendations(token!, 10),
    enabled: isSimilar || isReady,
    staleTime: 5 * 60_000,
  });

  if (isLoading)
    return (
      <div className="animate-pulse h-24 rounded-lg bg-space-800/40" />
    );
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
      }}
    >
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          {isSimilar ? "Similar repositories" : "Recommended for You"}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {isSimilar ? "based on tech stack & category" : "personalized recommendations"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {recommendations.slice(0, 4).map((rec, index) => {
          const fullName = (rec as any).full_name || (rec.repo ? `${rec.repo.owner}/${rec.repo.name}` : "");
          const [owner, ...nameParts] = fullName.split("/");
          const name = nameParts.join("/");
          const stars: number = (rec as any).stars ?? rec.repo?.stars ?? 0;
          const description: string = (rec as any).description ?? rec.repo?.description ?? "";
          const language: string = (rec as any).primary_language ?? rec.repo?.primary_language ?? "";

          if (!fullName) return null;

          const langColors: Record<string, string> = {
            TypeScript: "#3178c6",
            JavaScript: "#f1e05a",
            Python: "#3572A5",
            Go: "#00ADD8",
            HTML: "#e34c26",
            CSS: "#563d7c",
            Rust: "#dea584",
          };
          const dotColor = langColors[language] || "var(--text-muted)";

          return (
            <div
              key={(rec as any).repo_id || fullName}
              style={{
                padding: "16px 0",
                borderBottom: index === Math.min(recommendations.length, 4) - 1 ? "none" : "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Link
                  href={`/repo/${owner}/${name}`}
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#58a6ff",
                    textDecoration: "none",
                    fontFamily: "var(--font-sans)",
                  }}
                  className="hover:underline"
                >
                  {fullName}
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--accent-yellow)", fontFamily: "var(--font-mono)" }}>
                  <span>★</span>
                  <span>{stars.toLocaleString()}</span>
                </div>
              </div>

              {description && (
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.4" }}>
                  {description}
                </p>
              )}

              {language && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: dotColor, display: "inline-block" }} />
                  <span>{language}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
