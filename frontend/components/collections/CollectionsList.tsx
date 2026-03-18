"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api, Collection } from "@/lib/api";
import { useState } from "react";

export function TrendingCollections() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["collections", "trending"],
    queryFn: () => api.getTrendingCollections(),
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 1 | -1 }) =>
      api.voteCollection(userId!, id, direction),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections", "trending"] }),
  });

  if (isLoading)
    return <div className="p-8 text-center text-gray-400 font-mono text-sm animate-pulse">Loading collections…</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2 tracking-tight">
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Community Collections
          </h2>
          <p className="text-sm text-gray-500 mt-1">Curated lists of repositories created by the community</p>
        </div>
        {userId && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            {showCreate ? "Cancel" : "Create Collection"}
          </button>
        )}
      </div>

      {showCreate && userId && (
        <CreateCollectionForm userId={userId} onSuccess={() => setShowCreate(false)} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {collections?.map((col) => (
          <div
            key={col.id}
            className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-900 line-clamp-1 truncate pr-3">{col.title}</h3>
              {userId && (
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md overflow-hidden shrink-0">
                  <button
                    onClick={() => voteMutation.mutate({ id: col.id, direction: 1 })}
                    disabled={voteMutation.isPending}
                    className="px-2 py-1 hover:bg-gray-100 text-gray-400 hover:text-emerald-500 transition-colors text-xs"
                  >▲</button>
                  <span className="text-xs font-mono font-semibold min-w-[24px] text-center text-gray-700">
                    {col.votes}
                  </span>
                  <button
                    onClick={() => voteMutation.mutate({ id: col.id, direction: -1 })}
                    disabled={voteMutation.isPending}
                    className="px-2 py-1 hover:bg-gray-100 text-gray-400 hover:text-rose-500 transition-colors text-xs"
                  >▼</button>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-grow leading-relaxed">
              {col.description || "No description provided."}
            </p>

            <div className="flex items-center justify-between text-xs text-gray-500 font-medium mt-auto pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5 font-mono">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                {col.repo_count} repos
              </div>
              <span className="uppercase text-gray-400">{col.created_by.substring(0, 10)}…</span>
            </div>
          </div>
        ))}
        {(!collections || collections.length === 0) && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-mono text-sm bg-gray-50">
            No collections yet. Be the first to create one!
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCollectionForm({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string; is_public: boolean; repo_ids: string[] }) =>
      api.createCollection(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", "trending"] });
      onSuccess();
    },
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">Create New Collection</h4>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Collection Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-gray-400 transition-colors"
            placeholder="e.g. Best UI Component Libraries"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Brief Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-20 resize-none placeholder:text-gray-400 transition-colors"
            placeholder="What is this collection about?"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={() =>
              createMutation.mutate({ title, description: desc, is_public: true, repo_ids: [] })
            }
            disabled={!title || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 shadow-sm"
          >
            {createMutation.isPending ? "Creating…" : "Save Collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
