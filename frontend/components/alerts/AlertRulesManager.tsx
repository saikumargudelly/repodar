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

  if (!userId) return <div className="text-sm text-gray-500 p-4">Sign in to manage alerts.</div>;
  if (isLoading) return <div className="text-sm text-gray-400 p-4 animate-pulse">Loading alert rules…</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 tracking-tight">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Active Alert Webhooks
          </h3>
          <p className="text-sm text-gray-500 mt-1">Configure automated notifications for your watched repos</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-medium rounded-md transition-colors"
        >
          {showCreate ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      {showCreate && <CreateAlertForm userId={userId} onSuccess={() => setShowCreate(false)} />}

      <div className="space-y-3">
        {rules?.map((rule) => (
          <div key={rule.id} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${rule.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-gray-300"}`} />
                <span className="font-semibold text-gray-900 text-sm">{rule.name}</span>
              </div>
              <div className="text-xs font-mono text-gray-500 font-medium">
                Trigger: <span className="text-gray-700 bg-gray-200/60 px-1 py-0.5 rounded">{rule.condition}</span>
                <span className="mx-2 text-gray-300">|</span>Channels: <span className="text-gray-700">{rule.channels.join(", ")}</span>
              </div>
            </div>
            <button
              onClick={() => deleteMutation.mutate(rule.id)}
              disabled={deleteMutation.isPending}
              className="text-gray-400 hover:text-red-500 p-2 transition-colors hover:bg-red-50 rounded-md"
              title="Delete Rule"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
        {(!rules || rules.length === 0) && (
          <div className="text-center py-8 text-gray-500 text-sm font-mono border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
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
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm ring-1 ring-gray-900/5">
      <h4 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">New Webhook Rule</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-gray-400 transition-colors"
            placeholder="e.g. Breakout Radar"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          >
            <option value="STAR_VELOCITY_500_3D">Gained 500+ stars in 3 days</option>
            <option value="NEW_BREAKOUT_COHORT">Enters Breakout Cohort (Trend &gt; 0.35)</option>
            <option value="MOMENTUM_ACCELERATING">Momentum changed to Accelerating</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Webhook URL (Optional)</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono placeholder:text-gray-400 placeholder:font-sans transition-colors"
            placeholder="https://hooks.slack.com/services/…"
          />
        </div>
      </div>
      <div className="flex justify-end pt-2 border-t border-gray-100">
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
          className="px-4 py-2 mt-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 shadow-sm"
        >
          {createMutation.isPending ? "Saving…" : "Save Rule"}
        </button>
      </div>
    </div>
  );
}
