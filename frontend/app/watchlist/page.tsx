"use client";

export const dynamic = "force-dynamic";

import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { api, WatchlistItemOut } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

export default function WatchlistPage() {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThreshold, setEditThreshold] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editWebhook, setEditWebhook] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["watchlist", userId],
    queryFn: () => api.getWatchlist(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.removeFromWatchlist(userId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist", userId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, threshold, email, webhook }: { id: string; threshold: string; email: string; webhook: string }) =>
      api.updateWatchlistItem(userId!, id, {
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
      <div className="page-root">
        <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Loading account...</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="page-root">
        <div className="panel" style={{ padding: "24px" }}>
          <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Sign in to access your watchlist</div>
          <p style={{ margin: "0 0 14px", color: "var(--text-secondary)", fontSize: "14px" }}>
            Your saved repositories and alert preferences are tied to your account.
          </p>
          <Link href="/sign-in" className="btn-cyber btn-cyber-cyan" style={{ display: "inline-block", textDecoration: "none", padding: "8px 14px" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">WATCHLIST<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // {items.length} repo{items.length !== 1 ? "s" : ""} tracked
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING WATCHLIST<span className="terminal-cursor" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="panel" style={{ border: "1px solid var(--pink)" }}>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", margin: 0, fontSize: "12px" }}>
            ✕ FAILED TO LOAD WATCHLIST
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "28px", marginBottom: "12px",
            color: "var(--text-muted)" }}>◈</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)",
            letterSpacing: "0.08em", textTransform: "uppercase" }}>NOTHING HERE YET</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)",
            marginTop: "8px" }}>
            // Navigate to a repo page and click Watch
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && items.length > 0 && (
        <div className="panel table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th className="th-mono">REPO</th>
                <th className="th-mono">CATEGORY</th>
                <th className="th-mono" style={{ textAlign: "right" }}>STARS</th>
                <th className="th-mono" style={{ textAlign: "right" }}>TREND SCORE</th>
                <th className="th-mono" style={{ textAlign: "right" }}>ACCEL.</th>
                <th className="th-mono">HEALTH</th>
                <th className="th-mono">ALERT</th>
                <th className="th-mono">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: editingId === item.id ? "rgba(0,229,255,0.03)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div>
                        <a href={`/repo/${item.owner}/${item.name}`}
                          style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cyan)",
                            textDecoration: "none", fontWeight: 600 }}>
                          {item.owner}/{item.name}
                        </a>
                        {item.primary_language && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                            color: "var(--text-muted)", marginLeft: "6px" }}>
                            {item.primary_language}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {item.age_days}d old · since {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "11px",
                      color: "var(--text-secondary)" }}>
                      {item.category.replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {item.stars?.toLocaleString() ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)",
                      color: "var(--amber)" }}>
                      {item.trend_score != null ? item.trend_score.toFixed(4) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)",
                      color: (item.acceleration ?? 0) > 1 ? "var(--green)" : "var(--text-primary)" }}>
                      {item.acceleration != null ? item.acceleration.toFixed(2) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {item.sustainability_label ? <SustainBadge label={item.sustainability_label} /> : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "10px",
                      color: "var(--text-muted)" }}>
                      {item.alert_threshold != null ? `≥ ${item.alert_threshold}` : "—"}
                      {item.notify_email && (
                        <div style={{ fontSize: "10px", color: "var(--cyan)" }}>◈ {item.notify_email}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => editingId === item.id ? setEditingId(null) : startEdit(item)}
                          style={{ padding: "4px 8px", background: "transparent",
                            border: "1px solid var(--border)", cursor: "pointer",
                            fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--cyan)",
                            letterSpacing: "0.06em" }}>
                          {editingId === item.id ? "CANCEL" : "EDIT"}
                        </button>
                        <button onClick={() => removeMutation.mutate(item.id)} disabled={removeMutation.isPending}
                          style={{ padding: "4px 8px", background: "transparent",
                            border: "1px solid var(--pink)", cursor: "pointer",
                            fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--pink)",
                            letterSpacing: "0.06em" }}>
                          REMOVE
                        </button>
                      </div>
                    </td>
                  </tr>

                  {editingId === item.id && (
                    <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={8} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>ALERT THRESHOLD</label>
                            <input type="number" step="0.001" placeholder="e.g. 0.05" value={editThreshold}
                              onChange={(e) => setEditThreshold(e.target.value)} className="cyber-input" style={{ width: "140px" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>NOTIFY EMAIL</label>
                            <input type="email" placeholder="you@example.com" value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)} className="cyber-input" style={{ width: "200px" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>WEBHOOK URL</label>
                            <input type="url" placeholder="https://…" value={editWebhook}
                              onChange={(e) => setEditWebhook(e.target.value)} className="cyber-input" style={{ width: "240px" }} />
                          </div>
                          <button onClick={() => updateMutation.mutate({ id: item.id, threshold: editThreshold, email: editEmail, webhook: editWebhook })}
                            disabled={updateMutation.isPending}
                            className="btn-cyber btn-cyber-cyan" style={{ padding: "7px 16px" }}>
                            SAVE
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
