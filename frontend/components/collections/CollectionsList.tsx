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
    return <div className="p-8 text-center text-space-400 font-mono text-sm animate-pulse">Loading collections…</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-space-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Community Collections
          </h2>
          <p className="text-sm text-space-400 mt-1">Curated lists of repositories created by the community</p>
        </div>
        {userId && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-accent-500 text-white rounded text-sm font-medium hover:bg-accent-600 transition-colors"
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
            className="bg-space-900 border border-space-800 rounded-lg p-5 flex flex-col hover:border-space-600 transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-medium text-space-100 line-clamp-1">{col.title}</h3>
              {userId && (
                <div className="flex items-center bg-space-950 border border-space-800 rounded-md overflow-hidden">
                  <button
                    onClick={() => voteMutation.mutate({ id: col.id, direction: 1 })}
                    disabled={voteMutation.isPending}
                    className="px-2 py-1 hover:bg-space-800 text-space-400 hover:text-emerald-400 transition-colors text-xs"
                  >▲</button>
                  <span className="text-xs font-mono font-medium min-w-[24px] text-center text-space-300">
                    {col.votes}
                  </span>
                  <button
                    onClick={() => voteMutation.mutate({ id: col.id, direction: -1 })}
                    disabled={voteMutation.isPending}
                    className="px-2 py-1 hover:bg-space-800 text-space-400 hover:text-rose-400 transition-colors text-xs"
                  >▼</button>
                </div>
              )}
            </div>

            <p className="text-sm text-space-400 line-clamp-2 mb-4 flex-grow">
              {col.description || "No description provided."}
            </p>

            <div className="flex items-center justify-between text-xs text-space-500 font-mono mt-auto pt-4 border-t border-space-800">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                {col.repo_count} repos
              </div>
              <span className="uppercase text-space-600">{col.created_by.substring(0, 10)}…</span>
            </div>
          </div>
        ))}
        {(!collections || collections.length === 0) && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-space-800 rounded-lg text-space-500 font-mono text-sm">
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
    <div className="bg-space-950 border border-space-800 rounded-lg p-5">
      <h4 className="text-sm font-semibold text-space-200 mb-4">Create New Collection</h4>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-space-400 mb-1.5">Collection Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-space-900 border border-space-700 rounded-md px-3 py-2 text-sm text-space-100 focus:outline-none focus:border-accent-500"
            placeholder="e.g. Best UI Component Libraries"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-space-400 mb-1.5">Brief Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full bg-space-900 border border-space-700 rounded-md px-3 py-2 text-sm text-space-100 focus:outline-none focus:border-accent-500 h-20 resize-none"
            placeholder="What is this collection about?"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={() =>
              createMutation.mutate({ title, description: desc, is_public: true, repo_ids: [] })
            }
            disabled={!title || createMutation.isPending}
            className="px-4 py-2 bg-accent-500 text-white rounded text-sm font-medium hover:bg-accent-600 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Save Collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
