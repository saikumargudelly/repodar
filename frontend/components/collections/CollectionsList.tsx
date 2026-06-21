"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api, Collection } from "@/lib/api";
import { useState } from "react";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";


export function TrendingCollections() {
  const queryClient = useQueryClient();
  const { getToken, userId } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["collections", "trending"],
    queryFn: () => api.getTrendingCollections(),
    staleTime: 5 * 60 * 1000,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 1 | -1 }) =>
      api.voteCollection(await getToken() ?? "", id, direction),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections", "trending"] }),
  });

  if (isLoading) {
    return (
      <div style={{ padding: "60px 0" }}>
        <ProfessionalLoader size={45} text="Loading collections..." />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Community Collections
          </div>
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--text-muted)",
            marginTop: "6px",
          }}>
            Curated lists of repositories created by the community
          </div>
        </div>
        {userId && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-cyber btn-cyber-cyan"
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            {showCreate ? "Cancel" : "+ Create Collection"}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && userId && (
        <CreateCollectionForm getToken={getToken} onSuccess={() => setShowCreate(false)} />
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "16px",
      }}>
        {collections?.map((col) => (
          <div
            key={col.id}
            className="panel"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-blue)";
              (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
            }}
          >
            {/* Title row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
              <h3 style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: "15px",
                color: "var(--text-primary)",
                flex: 1,
                paddingRight: "12px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                margin: 0,
              }}>{col.title}</h3>
              {userId && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "var(--bg-elevated)",
                }}>
                  <button
                    onClick={() => voteMutation.mutate({ id: col.id, direction: 1 })}
                    disabled={voteMutation.isPending}
                    style={{
                      padding: "4px 8px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: "11px",
                      transition: "color 0.13s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-green)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >▲</button>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    fontWeight: 600,
                    minWidth: "24px",
                    textAlign: "center",
                    color: "var(--text-primary)",
                  }}>
                    {col.votes}
                  </span>
                  <button
                    onClick={() => voteMutation.mutate({ id: col.id, direction: -1 })}
                    disabled={voteMutation.isPending}
                    style={{
                      padding: "4px 8px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: "11px",
                      transition: "color 0.13s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >▼</button>
                </div>
              )}
            </div>

            {/* Description */}
            <p style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              flex: 1,
              marginBottom: "16px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              margin: "0 0 16px 0",
            }}>
              {col.description || "No description provided."}
            </p>

            {/* Footer */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "12px",
              borderTop: "1px solid var(--border)",
              marginTop: "auto",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                {col.repo_count} repos
              </div>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>
                {col.created_by.substring(0, 10)}…
              </span>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {(!collections || collections.length === 0) && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "56px 32px",
              textAlign: "center",
              border: "1px dashed var(--border)",
              borderRadius: "12px",
              background: "rgba(22, 27, 34, 0.2)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div className="narutorun-container" style={{ padding: "0 0 8px 0" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="narutorun-svg">
                <circle cx="29" cy="12" r="3" />
                <path d="M 27 9 L 24 7 L 26 10 L 23 10 L 26 12" />
                <path d="M 29 9 L 32 6 L 31 10 L 34 8 L 32 11" />
                <path d="M 25 13 C 23 13, 21 11, 19 12 C 17 13, 16 15, 14 14" />
                <path d="M 29 15 L 18 28" />
                <path d="M 27 17 L 10 21" />
                <path d="M 27 17 L 8 23" />
                <path d="M 18 28 L 26 34 L 20 44" />
                <path d="M 18 28 L 10 35 L 4 33" />
              </svg>
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>
              No collections yet
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
              // Be the first to create a collection!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCollectionForm({ getToken, onSuccess }: { getToken: () => Promise<string | null>; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; is_public: boolean; repo_ids: string[] }) =>
      api.createCollection(await getToken() ?? "", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", "trending"] });
      onSuccess();
    },
  });

  return (
    <div className="panel" style={{ padding: "20px" }}>
      <h4 style={{
        fontFamily: "var(--font-sans)",
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--text-primary)",
        marginBottom: "16px",
        margin: "0 0 16px 0",
      }}>Create New Collection</h4>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{
            display: "block",
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "6px",
          }}>Collection Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="cyber-input"
            style={{ width: "100%" }}
            placeholder="e.g. Best UI Component Libraries"
          />
        </div>

        <div>
          <label style={{
            display: "block",
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "6px",
          }}>Brief Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="cyber-input"
            style={{ width: "100%", height: "80px", resize: "none" }}
            placeholder="What is this collection about?"
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "4px" }}>
          <button
            onClick={() => createMutation.mutate({ title, description: desc, is_public: true, repo_ids: [] })}
            disabled={!title || createMutation.isPending}
            className="btn-cyber btn-cyber-cyan"
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              opacity: !title || createMutation.isPending ? 0.5 : 1,
              cursor: !title || createMutation.isPending ? "not-allowed" : "pointer",
            }}
          >
            {createMutation.isPending ? "Creating…" : "Save Collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
