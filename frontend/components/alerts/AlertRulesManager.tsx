"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/useAuthSession";
import { api, AlertRule } from "@/lib/api";

export function AlertRulesManager() {
  const queryClient = useQueryClient();
  const { token, isReady } = useAuthSession();
  const [showCreate, setShowCreate] = useState(false);

  const { data: rules, isLoading } = useQuery<AlertRule[]>({
    queryKey: ["alert-rules"],
    queryFn: () => {
      if (!token) throw new Error("No token available");
      return api.getAlertRules(token);
    },
    enabled: isReady,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!token) throw new Error("No token available");
      return api.deleteAlertRule(token, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  if (isLoading) return <div className="text-sm p-4 animate-pulse" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Loading alert rules…</div>;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">
          <svg style={{ width: "16px", height: "16px", color: "var(--accent-blue)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Active Alert Webhooks
        </span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-cyber btn-cyber-cyan"
          style={{ height: "26px", fontSize: "11px", padding: "0 10px" }}
        >
          {showCreate ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 16px 0" }}>
          Configure automated notifications for your watched repos
        </p>

        {showCreate && <CreateAlertForm token={token} onSuccess={() => setShowCreate(false)} />}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {rules?.map((rule) => (
            <div key={rule.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "12px 16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: rule.is_active ? "var(--accent-green)" : "var(--text-muted)", boxShadow: rule.is_active ? "0 0 6px var(--accent-green)" : "none" }} />
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>{rule.name}</span>
                </div>
                <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  Trigger: <span style={{ color: "var(--text-primary)", background: "rgba(255,255,255,0.04)", padding: "2px 4px", borderRadius: "3px" }}>{rule.condition}</span>
                  <span style={{ margin: "0 8px" }}>|</span>Channels: <span style={{ color: "var(--text-secondary)" }}>{rule.channels.join(", ")}</span>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(rule.id)}
                disabled={deleteMutation.isPending}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.15s, background 0.15s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; e.currentTarget.style.background = "rgba(248, 81, 73, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                title="Delete Rule"
              >
                <svg style={{ width: "16px", height: "16px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {(!rules || rules.length === 0) && (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)", border: "1px dashed var(--border)", borderRadius: "6px" }}>
              No active webhooks configured.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateAlertForm({ token, onSuccess }: { token: string | null; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("STAR_VELOCITY_500_3D");
  const [url, setUrl] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Omit<AlertRule, "id" | "is_active">) => {
      if (!token) throw new Error("No token available");
      return api.createAlertRule(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      onSuccess();
    },
  });

  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "16px", marginBottom: "16px" }}>
      <h4 style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
        New Webhook Rule
      </h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cyber-input"
              style={{ width: "100%" }}
              placeholder="e.g. Breakout Radar"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="cyber-input"
              style={{ width: "100%", height: "var(--input-height)", background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "var(--input-radius)", outline: "none", padding: "0 8px" }}
            >
              <option value="STAR_VELOCITY_500_3D">Gained 500+ stars in 3 days</option>
              <option value="NEW_BREAKOUT_COHORT">Enters Breakout Cohort (Trend &gt; 0.35)</option>
              <option value="MOMENTUM_ACCELERATING">Momentum changed to Accelerating</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Webhook URL (Optional)</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="cyber-input"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }}
            placeholder="https://hooks.slack.com/services/…"
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() =>
            createMutation.mutate({
              name,
              condition,
              frequency: "daily",
              webhook_url: url || null,
              channels: url ? ["webhook"] : ["in_app"],
            })
          }
          disabled={!name || createMutation.isPending}
          className="btn-cyber btn-cyber-cyan"
          style={{ opacity: (!name || createMutation.isPending) ? 0.5 : 1 }}
        >
          {createMutation.isPending ? "Saving…" : "Save Rule"}
        </button>
      </div>
    </div>
  );
}
