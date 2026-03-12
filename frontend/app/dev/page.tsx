"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api, ApiKeyOut } from "@/lib/api";

export default function DevPage() {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys", userId],
    queryFn: () => api.listApiKeys(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createApiKey(userId!, { name: newKeyName.trim() || "My Key" }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", userId] });
      setNewKeyName("");
      if (created.raw_key) setRawKey(created.raw_key);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.revokeApiKey(userId!, keyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys", userId] }),
  });

  const copyRaw = () => {
    if (rawKey) {
      navigator.clipboard.writeText(rawKey);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const allKeys: ApiKeyOut[] = keys ?? [];

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
          <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Sign in to manage API keys</div>
          <p style={{ margin: "0 0 14px", color: "var(--text-secondary)", fontSize: "14px" }}>
            API keys are private to your account and require authentication.
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
        <div className="section-title-cyber">DEVELOPER API<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Manage your API keys · pass as <span style={{ color: "var(--cyan)" }}>X-Api-Key</span> header
        </div>
      </div>

      {/* Rate limits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {[
          { tier: "FREE", limit: "100 / day", color: "var(--text-secondary)" },
          { tier: "PRO", limit: "5,000 / day", color: "var(--cyan)" },
          { tier: "ENTERPRISE", limit: "Unlimited", color: "var(--green)" },
        ].map(({ tier, limit, color }) => (
          <div key={tier} className="kpi-card">
            <div className="kpi-label">{tier}</div>
            <div className="kpi-value" style={{ color }}>{limit}</div>
          </div>
        ))}
      </div>

      {/* Create key */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">◈ CREATE NEW KEY</span></div>
        <div style={{ padding: "0 20px 20px", display: "flex", gap: "10px", flexWrap: "wrap",
          alignItems: "center" }}>
          <input type="text" placeholder="KEY NAME (e.g. My Dashboard)"
            value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createMutation.mutate()}
            className="cyber-input" style={{ minWidth: "240px", flex: 1 }} />
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
            className="btn-cyber btn-cyber-cyan" style={{ padding: "8px 20px",
              opacity: createMutation.isPending ? 0.6 : 1 }}>
            {createMutation.isPending ? "GENERATING…" : "GENERATE KEY"}
          </button>
        </div>
        {createMutation.isError && (
          <div style={{ padding: "0 20px 16px", fontFamily: "var(--font-mono)",
            color: "var(--pink)", fontSize: "11px" }}>✕ FAILED TO CREATE KEY</div>
        )}
      </div>

      {/* Existing keys */}
      {isLoading && (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING KEYS<span className="terminal-cursor" />
        </div>
      )}

      {!isLoading && allKeys.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
            letterSpacing: "0.08em" }}>
            // NO API KEYS YET — GENERATE ONE ABOVE
          </div>
        </div>
      )}

      {!isLoading && allKeys.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {allKeys.map((key) => {
            const pct = key.day_limit > 0 ? Math.min(100, (key.calls_today / key.day_limit) * 100) : 0;
            const isNearLimit = pct > 80;
            return (
              <div key={key.id} className="panel"
                style={{ opacity: key.is_active ? 1 : 0.55,
                  borderColor: key.is_active ? "var(--border)" : "var(--pink)44" }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", flexWrap: "wrap", gap: "8px",
                  padding: "16px 20px 12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px",
                        fontWeight: 600, color: "var(--text-primary)" }}>{key.name}</span>
                      <TierBadge tier={key.tier} />
                      {!key.is_active && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px",
                          color: "var(--pink)", background: "var(--pink)18",
                          border: "1px solid var(--pink)", padding: "1px 6px",
                          letterSpacing: "0.08em", fontWeight: 700 }}>REVOKED</span>
                      )}
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                      color: "var(--text-muted)" }}>
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && ` · last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </span>
                  </div>
                  {key.is_active && (
                    <button onClick={() => revokeMutation.mutate(key.id)}
                      disabled={revokeMutation.isPending}
                      className="btn-cyber" style={{ padding: "5px 12px", fontSize: "10px",
                        borderColor: "var(--pink)", color: "var(--pink)" }}>
                      REVOKE
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px", padding: "0 20px 14px" }}>
                  <UsageStat label="TODAY" value={key.calls_today.toLocaleString()}
                    of={key.day_limit > 0 ? key.day_limit.toLocaleString() : "∞"} warn={isNearLimit} />
                  <UsageStat label="THIS MONTH" value={key.calls_this_month.toLocaleString()} />
                  <UsageStat label="TOTAL" value={key.calls_total.toLocaleString()} />
                </div>
                {key.day_limit > 0 && (
                  <div style={{ padding: "0 20px 16px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                      color: "var(--text-muted)", marginBottom: "4px", letterSpacing: "0.06em" }}>
                      DAILY USAGE: {pct.toFixed(1)}%
                    </div>
                    <div style={{ height: "4px", background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`,
                        background: isNearLimit ? "var(--pink)" : "var(--cyan)",
                        transition: "width 0.3s" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Raw key modal */}
      {rawKey && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--cyan)",
            width: "100%", maxWidth: "540px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "16px" }}>
              <div className="section-title-cyber" style={{ fontSize: "14px" }}>
                ◈ KEY CREATED
              </div>
              <button onClick={() => setRawKey(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)",
                  fontSize: "20px", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ background: "var(--amber)18", border: "1px solid var(--amber)",
              padding: "10px 14px", fontFamily: "var(--font-mono)", color: "var(--amber)",
              fontSize: "11px", marginBottom: "16px", letterSpacing: "0.04em" }}>
              ⚠ COPY THIS KEY NOW — IT WILL NEVER BE SHOWN AGAIN
            </div>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)",
              padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: "12px",
              wordBreak: "break-all", marginBottom: "16px", color: "var(--cyan)" }}>
              {rawKey}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={copyRaw} className="btn-cyber btn-cyber-cyan"
                style={{ flex: 1, padding: "9px" }}>
                {copiedRaw ? "✓ COPIED" : "COPY TO CLIPBOARD"}
              </button>
              <button onClick={() => setRawKey(null)} className="btn-cyber"
                style={{ flex: 1, padding: "9px" }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* API Reference */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">▣ QUICK REFERENCE</span></div>
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { method: "GET", path: "/dashboard/early-radar", desc: "Young repos with high momentum" },
            { method: "GET", path: "/dashboard/radar", desc: "Top breakout repos" },
            { method: "GET", path: "/dashboard/leaderboard", desc: "Star-gain leaderboard (7d/30d/90d)" },
            { method: "GET", path: "/topics/momentum", desc: "Topic momentum scores" },
            { method: "GET", path: "/contributors/network", desc: "Cross-repo contributor network" },
            { method: "GET", path: "/forks/leaderboard", desc: "Notable forks with own traction" },
            { method: "GET", path: "/reports/history", desc: "Historical ecosystem reports" },
          ].map(({ method, path, desc }) => (
            <div key={path} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ padding: "2px 6px", background: "var(--cyan)18",
                color: "var(--cyan)", fontFamily: "var(--font-mono)", fontWeight: 700,
                fontSize: "10px", flexShrink: 0, marginTop: "1px", letterSpacing: "0.04em" }}>
                {method}
              </span>
              <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)",
                fontSize: "11px", minWidth: "260px" }}>{path}</code>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)",
                fontSize: "11px" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const color =
    tier === "enterprise" ? "var(--green)" :
    tier === "pro" ? "var(--cyan)" :
    "var(--text-muted)";
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700,
      color, border: `1px solid ${color}`, padding: "1px 6px",
      letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {tier}
    </span>
  );
}

function UsageStat({ label, value, of: ofValue, warn = false }: { label: string; value: string; of?: string; warn?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)",
        marginBottom: "2px", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700,
        color: warn ? "var(--pink)" : "var(--text-primary)" }}>
        {value}
        {ofValue && <span style={{ fontSize: "11px", fontWeight: 400,
          color: "var(--text-muted)" }}> / {ofValue}</span>}
      </div>
    </div>
  );
}
