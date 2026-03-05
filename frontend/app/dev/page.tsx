export const dynamic = "force-dynamic";

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser, SignInButton } from "@clerk/nextjs";
import { api, ApiKeyOut } from "@/lib/api";

export default function DevPage() {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const userId = user?.id ?? "";

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys", userId],
    queryFn: () => api.listApiKeys(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createApiKey(userId, { name: newKeyName.trim() || "My Key" }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", userId] });
      setNewKeyName("");
      if (created.raw_key) setRawKey(created.raw_key);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: number) => api.revokeApiKey(userId, keyId),
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
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔑</div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Developer API Access</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "28px" }}>
          Sign in to generate API keys and integrate Repodar data into your own tools.
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
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "var(--font-sans, sans-serif)",
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "22px" }}>🔑</span>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Developer API</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          Manage your API keys. Free tier: 100 calls/day. Pass your key as <code style={{ background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: "3px", fontSize: "12px" }}>X-Api-Key</code> header.
        </p>
      </div>

      {/* Rate limits info */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "12px",
          marginBottom: "32px",
        }}
      >
        {[
          { tier: "free", limit: "100 / day", color: "var(--text-secondary)" },
          { tier: "pro", limit: "5,000 / day", color: "var(--accent-blue)" },
          { tier: "enterprise", limit: "Unlimited", color: "var(--accent-green)" },
        ].map(({ tier, limit, color }) => (
          <div
            key={tier}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px" }}>
              {tier}
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color }}>{limit}</div>
          </div>
        ))}
      </div>

      {/* Create key */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "20px",
          marginBottom: "28px",
        }}
      >
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "14px" }}>Create New Key</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Key name (e.g. My Dashboard)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createMutation.mutate()}
            style={{
              padding: "8px 12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontSize: "13px",
              minWidth: "240px",
              flex: 1,
            }}
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            style={{
              padding: "8px 20px",
              background: "var(--accent-blue)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              opacity: createMutation.isPending ? 0.7 : 1,
            }}
          >
            {createMutation.isPending ? "Creating…" : "Generate Key"}
          </button>
        </div>
        {createMutation.isError && (
          <p style={{ color: "var(--accent-red)", fontSize: "12px", marginTop: "8px" }}>
            Failed to create key.
          </p>
        )}
      </div>

      {/* Existing keys */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Loading keys…
        </div>
      )}

      {!isLoading && allKeys.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            color: "var(--text-muted)",
            fontSize: "13px",
          }}
        >
          No API keys yet. Generate one above to get started.
        </div>
      )}

      {!isLoading && allKeys.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {allKeys.map((key) => {
            const pct = key.day_limit > 0 ? Math.min(100, (key.calls_today / key.day_limit) * 100) : 0;
            const isNearLimit = pct > 80;
            return (
              <div
                key={key.id}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${key.is_active ? "var(--border)" : "var(--accent-red)44"}`,
                  borderRadius: "10px",
                  padding: "16px 20px",
                  opacity: key.is_active ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 600 }}>{key.name}</span>
                      <TierBadge tier={key.tier} />
                      {!key.is_active && (
                        <span style={{ fontSize: "10px", color: "var(--accent-red)", background: "var(--accent-red)22", border: "1px solid var(--accent-red)", borderRadius: "4px", padding: "1px 6px", fontWeight: 700 }}>
                          REVOKED
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </span>
                  </div>

                  {key.is_active && (
                    <button
                      onClick={() => revokeMutation.mutate(key.id)}
                      disabled={revokeMutation.isPending}
                      style={{
                        padding: "6px 14px",
                        background: "transparent",
                        border: "1px solid var(--accent-red)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                        color: "var(--accent-red)",
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>

                {/* Usage stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "12px" }}>
                  <UsageStat label="Today" value={key.calls_today.toLocaleString()} of={key.day_limit > 0 ? key.day_limit.toLocaleString() : "∞"} warn={isNearLimit} />
                  <UsageStat label="This month" value={key.calls_this_month.toLocaleString()} />
                  <UsageStat label="Total" value={key.calls_total.toLocaleString()} />
                </div>

                {/* Day usage bar */}
                {key.day_limit > 0 && (
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Daily usage: {pct.toFixed(1)}%
                    </div>
                    <div style={{ height: "6px", background: "var(--bg-elevated)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: isNearLimit ? "var(--accent-red)" : "var(--accent-blue)",
                          borderRadius: "3px",
                          transition: "width 0.3s",
                        }}
                      />
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "540px",
              padding: "28px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>🎉 Key Created</h2>
              <button
                onClick={() => setRawKey(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                background: "var(--accent-yellow)22",
                border: "1px solid var(--accent-yellow)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "var(--accent-yellow)",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              ⚠️ Copy this key now — it will never be shown again.
            </div>
            <div
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "12px 14px",
                fontFamily: "monospace",
                fontSize: "13px",
                wordBreak: "break-all",
                marginBottom: "16px",
                color: "var(--text-primary)",
              }}
            >
              {rawKey}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={copyRaw}
                style={{
                  flex: 1,
                  padding: "9px",
                  background: "var(--accent-blue)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copiedRaw ? "✓ Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={() => setRawKey(null)}
                style={{
                  flex: 1,
                  padding: "9px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Reference */}
      <div
        style={{
          marginTop: "40px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "20px",
        }}
      >
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "14px" }}>Quick Reference</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { method: "GET", path: "/dashboard/early-radar", desc: "Young repos with high momentum" },
            { method: "GET", path: "/dashboard/radar", desc: "Top breakout repos" },
            { method: "GET", path: "/dashboard/leaderboard", desc: "Star-gain leaderboard (7d/30d/90d)" },
            { method: "GET", path: "/topics/momentum", desc: "Topic momentum scores" },
            { method: "GET", path: "/contributors/network", desc: "Cross-repo contributor network" },
            { method: "GET", path: "/forks/leaderboard", desc: "Notable forks with own traction" },
            { method: "GET", path: "/reports/history", desc: "Historical ecosystem reports" },
          ].map(({ method, path, desc }) => (
            <div key={path} style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px" }}>
              <span
                style={{
                  padding: "2px 6px",
                  background: "var(--accent-blue)22",
                  color: "var(--accent-blue)",
                  borderRadius: "4px",
                  fontWeight: 700,
                  fontSize: "11px",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              >
                {method}
              </span>
              <code style={{ fontFamily: "monospace", color: "var(--text-primary)", minWidth: "260px" }}>{path}</code>
              <span style={{ color: "var(--text-muted)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const color =
    tier === "enterprise" ? "var(--accent-green)" :
    tier === "pro" ? "var(--accent-blue)" :
    "var(--text-muted)";
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        color,
        border: `1px solid ${color}`,
        borderRadius: "4px",
        padding: "1px 6px",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
      }}
    >
      {tier}
    </span>
  );
}

function UsageStat({ label, value, of: ofValue, warn = false }: { label: string; value: string; of?: string; warn?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: warn ? "var(--accent-red)" : "var(--text-primary)" }}>
        {value}
        {ofValue && <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-muted)" }}> / {ofValue}</span>}
      </div>
    </div>
  );
}
