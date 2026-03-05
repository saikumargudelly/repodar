"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser, SignInButton } from "@clerk/nextjs";
import { api, WatchlistItemOut } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

export default function WatchlistPage() {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editThreshold, setEditThreshold] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editWebhook, setEditWebhook] = useState<string>("");

  const userId = user?.id ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["watchlist", userId],
    queryFn: () => api.getWatchlist(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.removeFromWatchlist(userId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist", userId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, threshold, email, webhook }: { id: number; threshold: string; email: string; webhook: string }) =>
      api.updateWatchlistItem(userId, id, {
        alert_threshold: threshold ? Number(threshold) : null,
        notify_email: email || null,
        notify_webhook: webhook || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
      setEditingId(null);
    },
  });

  const items: WatchlistItemOut[] = data ?? [];

  const startEdit = (item: WatchlistItemOut) => {
    setEditingId(item.id);
    setEditThreshold(item.alert_threshold != null ? String(item.alert_threshold) : "");
    setEditEmail(item.notify_email ?? "");
    setEditWebhook(item.notify_webhook ?? "");
  };

  if (!isLoaded) {
    return (
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "80px 20px",
          textAlign: "center",
          color: "var(--text-primary)",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Sign In to Access Your Watchlist</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "28px" }}>
          Track repos, set alert thresholds, and never miss a breakout.
        </p>
        <SignInButton mode="modal">
          <button
            style={{
              padding: "10px 24px",
              background: "var(--accent-blue)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
        </SignInButton>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "var(--font-sans, sans-serif)",
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "22px" }}>⭐</span>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Your Watchlist</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          {items.length} repo{items.length !== 1 ? "s" : ""} tracked · Signed in as{" "}
          <strong>{user.emailAddresses[0]?.emailAddress ?? user.id}</strong>
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Loading your watchlist…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "16px", background: "var(--accent-red)22", border: "1px solid var(--accent-red)", borderRadius: "8px", color: "var(--accent-red)", fontSize: "13px", marginBottom: "20px" }}>
          Failed to load watchlist.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔭</div>
          <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "8px" }}>Nothing here yet</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Navigate to a repo page and click "Watch" to start tracking it.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && items.length > 0 && (
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 12px" }}>Repo</th>
                <th style={{ padding: "8px 12px" }}>Category</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Stars</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Trend Score</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Accel.</th>
                <th style={{ padding: "8px 12px" }}>Health</th>
                <th style={{ padding: "8px 12px" }}>Alert</th>
                <th style={{ padding: "8px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <>
                  <tr
                    key={item.id}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: editingId === item.id ? "var(--bg-elevated)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px" }}>
                      <div>
                        <a
                          href={item.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}
                        >
                          {item.owner}/{item.name}
                        </a>
                        {item.primary_language && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "6px" }}>
                            {item.primary_language}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {item.age_days}d old · tracked since {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: "12px", color: "var(--text-secondary)" }}>
                      {item.category.replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>
                      {item.stars?.toLocaleString() ?? "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {item.trend_score != null ? item.trend_score.toFixed(4) : "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: (item.acceleration ?? 0) > 1 ? "var(--accent-blue)" : "var(--text-primary)" }}>
                      {item.acceleration != null ? item.acceleration.toFixed(2) : "—"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {item.sustainability_label ? <SustainBadge label={item.sustainability_label} /> : "—"}
                    </td>
                    <td style={{ padding: "12px", color: "var(--text-muted)", fontSize: "12px" }}>
                      {item.alert_threshold != null ? `≥ ${item.alert_threshold}` : "—"}
                      {item.notify_email && (
                        <div style={{ fontSize: "11px" }}>📧 {item.notify_email}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => editingId === item.id ? setEditingId(null) : startEdit(item)}
                          style={{
                            padding: "4px 10px",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                            color: "var(--text-primary)",
                          }}
                        >
                          {editingId === item.id ? "Cancel" : "Edit"}
                        </button>
                        <button
                          onClick={() => removeMutation.mutate(item.id)}
                          disabled={removeMutation.isPending}
                          style={{
                            padding: "4px 10px",
                            background: "transparent",
                            border: "1px solid var(--accent-red)",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                            color: "var(--accent-red)",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Edit row */}
                  {editingId === item.id && (
                    <tr key={`${item.id}-edit`} style={{ background: "var(--bg-elevated)", borderTop: "none" }}>
                      <td colSpan={8} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Alert Threshold (trend score)</label>
                            <input
                              type="number"
                              step="0.001"
                              placeholder="e.g. 0.05"
                              value={editThreshold}
                              onChange={(e) => setEditThreshold(e.target.value)}
                              style={inputStyle}
                            />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Notify Email</label>
                            <input
                              type="email"
                              placeholder="you@example.com"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              style={{ ...inputStyle, width: "200px" }}
                            />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Webhook URL</label>
                            <input
                              type="url"
                              placeholder="https://…"
                              value={editWebhook}
                              onChange={(e) => setEditWebhook(e.target.value)}
                              style={{ ...inputStyle, width: "240px" }}
                            />
                          </div>
                          <button
                            onClick={() => updateMutation.mutate({ id: item.id, threshold: editThreshold, email: editEmail, webhook: editWebhook })}
                            disabled={updateMutation.isPending}
                            style={{
                              padding: "7px 16px",
                              background: "var(--accent-blue)",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  color: "var(--text-primary)",
  fontSize: "13px",
  width: "140px",
};
