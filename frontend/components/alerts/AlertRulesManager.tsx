"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api, AlertRule } from "@/lib/api";

export function AlertRulesManager() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  const { data: rules, isLoading } = useQuery<AlertRule[]>({
    queryKey: ["alert-rules", userId],
    queryFn: () => api.getAlertRules(userId!),
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAlertRule(userId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules", userId] }),
  });

  if (!userId) return <div className="text-sm text-space-400 p-4">Sign in to manage alerts.</div>;
  if (isLoading) return <div className="text-sm text-space-400 p-4 animate-pulse">Loading alert rules…</div>;

  return (
    <div className="bg-space-900 border border-space-800 rounded-lg p-5">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-space-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Active Alert Webhooks
          </h3>
          <p className="text-sm text-space-400 mt-1">Configure automated notifications for your watched repos</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 text-sm font-medium rounded transition-colors"
        >
          {showCreate ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      {showCreate && <CreateAlertForm userId={userId} onSuccess={() => setShowCreate(false)} />}

      <div className="space-y-3">
        {rules?.map((rule) => (
          <div key={rule.id} className="flex justify-between items-center bg-space-950 border border-space-800 rounded p-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${rule.is_active ? "bg-emerald-500" : "bg-space-600"}`} />
                <span className="font-medium text-space-100 text-sm">{rule.name}</span>
              </div>
              <div className="text-xs font-mono text-space-400">
                Trigger: <span className="text-accent-300">{rule.condition}</span>
                {" · "}Channels: <span className="text-space-300">{rule.channels.join(", ")}</span>
              </div>
            </div>
            <button
              onClick={() => deleteMutation.mutate(rule.id)}
              disabled={deleteMutation.isPending}
              className="text-space-500 hover:text-red-400 p-2 transition-colors"
              title="Delete Rule"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
        {(!rules || rules.length === 0) && (
          <div className="text-center py-8 text-space-500 text-sm font-mono border border-dashed border-space-800 rounded">
            No active webhooks configured.
          </div>
        )}
      </div>
    </div>
  );
}

function CreateAlertForm({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("STAR_VELOCITY_500_3D");
  const [url, setUrl] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Omit<AlertRule, "id" | "is_active">) => api.createAlertRule(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", userId] });
      onSuccess();
    },
  });

  return (
    <div className="bg-space-950 border border-space-800 rounded-lg p-5 mb-6">
      <h4 className="text-sm font-semibold text-space-200 mb-4">New Webhook Rule</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-space-400 mb-1">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 focus:outline-none focus:border-accent-500"
            placeholder="e.g. Breakout Radar"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-space-400 mb-1">Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 focus:outline-none focus:border-accent-500"
          >
            <option value="STAR_VELOCITY_500_3D">Gained 500+ stars in 3 days</option>
            <option value="NEW_BREAKOUT_COHORT">Enters Breakout Cohort (Trend &gt; 0.35)</option>
            <option value="MOMENTUM_ACCELERATING">Momentum changed to Accelerating</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-space-400 mb-1">Webhook URL (Optional)</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 focus:outline-none focus:border-accent-500 font-mono"
            placeholder="https://hooks.slack.com/services/…"
          />
        </div>
      </div>
      <div className="flex justify-end">
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
          className="px-4 py-2 bg-accent-500 text-white rounded text-sm font-medium hover:bg-accent-600 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? "Saving…" : "Save Rule"}
        </button>
      </div>
    </div>
  );
}
