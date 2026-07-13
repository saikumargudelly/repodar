"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, AlertResponse } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

const ALERT_TYPE_LABELS: Record<string, string> = {
  star_spike_24h:  "⚡ 24h Star Spike",
  star_spike_48h:  "⚡ 48h Star Spike",
  momentum_surge:  "▲ Momentum Surge",
  pr_surge:        "◈ PR Surge",
  new_breakout:    "◉ New Breakout",
};

const ALERT_TYPE_COLORS: Record<string, string> = {
  star_spike_24h:  "var(--amber)",
  star_spike_48h:  "var(--amber)",
  momentum_surge:  "var(--cyan)",
  pr_surge:        "#8b5cf6",
  new_breakout:    "var(--green)",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AlertCard({ alert, onMarkRead }: { alert: AlertResponse; onMarkRead: (id: string) => void }) {
  const color = ALERT_TYPE_COLORS[alert.alert_type] ?? "var(--text-secondary)";
  const label = ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type;
  const tweetText = encodeURIComponent(
    `🔥 ${alert.owner}/${alert.name} is breaking out on GitHub!\n${alert.headline}\nhttps://github.com/${alert.owner}/${alert.name}`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  return (
    <div
      className="panel"
      style={{
        padding: "18px 22px",
        borderLeft: `3px solid ${color}`,
        opacity: alert.is_read ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color, fontWeight: 700 }}>{label}</span>
            <span style={{
              background: "var(--surface2)",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "3px",
              letterSpacing: "0.04em",
            }}>
              {alert.category}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
              {timeAgo(alert.triggered_at)}
            </span>
            {!alert.is_read && (
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "var(--cyan)", display: "inline-block", flexShrink: 0,
              }} />
            )}
          </div>

          <Link
            href={`/repo/${alert.owner}/${alert.name}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "14px",
              color: "var(--cyan)",
              fontWeight: 700,
              textDecoration: "none",
              display: "block",
              marginBottom: "6px",
            }}
          >
            {alert.owner}/{alert.name}
          </Link>

          <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: 0, lineHeight: "1.6", fontFamily: "var(--font-mono)" }}>
            {alert.headline}
          </p>

          {alert.z_score != null && (
            <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--amber)",
                background: "var(--amber, #f0a800)18", border: "1px solid var(--amber, #f0a800)44",
                padding: "1px 7px", borderRadius: "3px", letterSpacing: "0.04em" }}>
                {alert.z_score.toFixed(1)}σ
              </span>
              {alert.percentile != null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  padding: "1px 7px", borderRadius: "3px" }}>
                  p{alert.percentile.toFixed(0)}
                </span>
              )}
              {alert.is_sustained && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--green)",
                  background: "var(--green, #3fb950)18", border: "1px solid var(--green, #3fb950)44",
                  padding: "1px 7px", borderRadius: "3px" }}>
                  sustained
                </span>
              )}
              {alert.momentum_direction && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  padding: "1px 7px", borderRadius: "3px" }}>
                  {alert.momentum_direction === "accelerating" ? "↑ accel" : alert.momentum_direction === "decelerating" ? "↓ decel" : alert.momentum_direction}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--text-muted)",
              textDecoration: "none",
              padding: "4px 10px",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              whiteSpace: "nowrap",
            }}
          >
            ↗ Share
          </a>
          {!alert.is_read && (
            <button
              onClick={() => onMarkRead(alert.id)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--text-muted)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                padding: "4px 10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✓ Read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.subscribe(email, ["ai_ml"]);
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className="panel" style={{ padding: "18px 22px", textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--green)" }}>
          ✓ Check your inbox to confirm your subscription
        </span>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: "18px 22px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px", letterSpacing: "0.06em" }}>
        // GET WEEKLY BREAKOUT DIGEST IN YOUR INBOX
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            flex: 1,
            minWidth: "200px",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "8px 12px",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            background: "var(--cyan)",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            padding: "8px 18px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          SUBSCRIBE
        </button>
      </form>
      {error && (
        <p style={{ color: "var(--red, #ef4444)", fontFamily: "var(--font-mono)", fontSize: "11px", marginTop: "8px" }}>{error}</p>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", unreadOnly],
    queryFn: () => api.getAlerts(unreadOnly, 100),
    staleTime: 120 * 60 * 1000, // 2 hours
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.markAlertRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-alerts"] });
    },
  });
  const markAllReadMut = useMutation({
    mutationFn: () => api.markAllAlertsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-alerts"] });
    },
  });

  const categories = Array.from(new Set((alerts ?? []).map((a) => a.category))).sort();

  const filtered = (alerts ?? []).filter((a) =>
    categoryFilter === "all" || a.category === categoryFilter
  );

  const unreadCount = (alerts ?? []).filter((a) => !a.is_read).length;

  return (
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="page-eyebrow">
          System-wide breakout telemetry and activity alerts
          {unreadCount > 0 && ` · ${unreadCount} new`}
        </div>
        <h1 className="page-title">Alerts</h1>
      </div>

      {/* Subscribe form */}
      <SubscribeForm />

      {/* RSS link */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
        RSS feed:{" "}
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? ""}/feed.xml`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--cyan)", textDecoration: "none" }}
        >
          /feed.xml
        </a>
      </div>

      {/* Controls */}
      <div className="alerts-controls-row">
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`filter-btn-cyber${unreadOnly ? " active" : ""}`}
        >
          ● Unread only
        </button>
        <span className="alerts-controls-divider" />
        <button
          onClick={() => setCategoryFilter("all")}
          className={`filter-btn-cyber${categoryFilter === "all" ? " active" : ""}`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`filter-btn-cyber${categoryFilter === cat ? " active" : ""}`}
          >
            {cat}
          </button>
        ))}
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMut.mutate()}
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-muted)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "5px 12px",
              cursor: "pointer",
            }}
          >
            Mark all read
          </button>
        )}
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["alerts"] });
            queryClient.invalidateQueries({ queryKey: ["sidebar-alerts"] });
          }}
          style={{
            marginLeft: unreadCount > 0 ? "10px" : "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--accent-blue)",
            background: "transparent",
            border: "1px solid var(--accent-blue)",
            borderRadius: "4px",
            padding: "5px 12px",
            cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <Skeleton shape="table" />
      ) : filtered.length === 0 ? (
        <div style={{ color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "13px", fontFamily: "var(--font-sans)" }}>
          No active breakout alerts yet. The pipeline will populate on the next run.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onMarkRead={(id) => markReadMut.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
