"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface Props {
  /** Pass owner+name when on a repo detail page for "Similar Repos" */
  repoOwner?: string;
  repoName?: string;
}

export function RecommendationsPanel({ repoOwner, repoName }: Props) {
  const { userId } = useAuth();
  const isSimilar = !!(repoOwner && repoName);

  const { data: recommendations, isLoading } = useQuery({
    queryKey: isSimilar
      ? ["similar-repos", repoOwner, repoName]
      : ["personalized-recs", userId],
    queryFn: () =>
      isSimilar
        ? api.getSimilarRepos(repoOwner!, repoName!, 6)
        : api.getRecommendations(userId!, 10),
    enabled: isSimilar || !!userId,
    staleTime: 5 * 60_000,
  });

  if (isLoading)
    return (
      <div className="animate-pulse h-24 rounded-lg bg-space-800/40" />
    );
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="bg-space-900 border border-space-800 rounded-lg p-5">
      <h3 className="text-space-100 font-semibold tracking-wide mb-4 text-sm uppercase">
        {isSimilar ? "🔀 Similar Repositories" : "✨ Recommended for You"}
      </h3>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          // Recommendations from /recommendations return RecommendedRepo shape
          // The backend returns full_name + core fields, not nested repo object
          const fullName = (rec as any).full_name || (rec.repo ? `${rec.repo.owner}/${rec.repo.name}` : "");
          const [owner, ...nameParts] = fullName.split("/");
          const name = nameParts.join("/");
          const stars: number = (rec as any).stars ?? rec.repo?.stars ?? 0;
          const description: string = (rec as any).description ?? rec.repo?.description ?? "";
          const language: string = (rec as any).primary_language ?? rec.repo?.primary_language ?? "";
          const pushedAt: string | null = rec.repo?.pushed_at ?? null;
          const reasons: string[] = rec.reasons ?? [];

          if (!fullName) return null;

          return (
            <div
              key={(rec as any).repo_id || fullName}
              className="group relative block p-3 rounded-md bg-space-950/50 hover:bg-space-800 border border-transparent hover:border-space-700 transition-colors"
            >
              <Link href={`/repo/${owner}/${name}`} className="absolute inset-0 z-10">
                <span className="sr-only">View {name}</span>
              </Link>

              <div className="flex justify-between items-start mb-1">
                <div className="font-mono text-sm font-medium text-cyan-400 truncate pr-4">
                  {fullName}
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-400 font-mono shrink-0">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {stars.toLocaleString()}
                </div>
              </div>

              {description && (
                <p className="text-xs text-space-400 line-clamp-2 mb-2">{description}</p>
              )}

              <div className="flex flex-wrap gap-1.5 items-center text-[10px] font-mono mt-2">
                {reasons.slice(0, 2).map((r, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-space-800/80 text-space-300 uppercase">
                    {r}
                  </span>
                ))}
                {language && <span className="text-space-500">• {language}</span>}
                {pushedAt && (
                  <span className="text-space-500 ml-auto lowercase">
                    {formatDistanceToNow(new Date(pushedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
