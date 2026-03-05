"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, A2AService, A2ACapability } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  active:        "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  unreachable:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
  invalid:       "text-red-400 bg-red-400/10 border-red-400/20",
  no_card:       "text-orange-400 bg-orange-400/10 border-orange-400/20",
  auth_required: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  rate_limited:  "text-purple-400 bg-purple-400/10 border-purple-400/20",
  sleeping:      "text-sky-400 bg-sky-400/10 border-sky-400/20",
};

const METHOD_COLOR: Record<string, string> = {
  GET: "text-sky-400 bg-sky-400/10",
  POST: "text-emerald-400 bg-emerald-400/10",
  PUT: "text-amber-400 bg-amber-400/10",
  PATCH: "text-violet-400 bg-violet-400/10",
  DELETE: "text-red-400 bg-red-400/10",
};

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [service, setService] = useState<A2AService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    api.getService(params.id)
      .then(setService)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error ?? "Service not found"}</p>
        <Link href="/services" className="text-xs text-violet-400 hover:text-violet-300 underline">
          ← Back to Service Catalog
        </Link>
      </div>
    );
  }

  const statusClass = STATUS_COLOR[service.status] ?? "text-white/40 bg-white/5 border-white/10";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/services"
        className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70
                   mb-6 transition"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        A2A Service Catalog
      </Link>

      {/* Hero */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">{service.name}</h1>
            {service.provider && (
              <p className="text-sm text-white/50">by {service.provider}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {service.supports_streaming && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full border text-emerald-300 bg-emerald-400/10 border-emerald-400/20">
                ⚡ Streaming
              </span>
            )}
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusClass}`}>
              {service.status}
            </span>
          </div>
        </div>

        {service.description && (
          <p className="text-sm text-white/70 leading-relaxed mb-4">{service.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {(service.categories ?? []).map((cat) => (
            <span key={cat} className="text-xs px-2.5 py-0.5 bg-violet-500/10 text-violet-300 rounded-full border border-violet-400/20">
              {cat}
            </span>
          ))}
        </div>

        {/* Auth schemes */}
        {(service.auth_schemes ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-[10px] text-white/40 uppercase tracking-wider mr-1">Auth</span>
            {(service.auth_schemes ?? []).map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 bg-amber-400/10 text-amber-300 rounded-full border border-amber-400/20">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Input / Output modes */}
        {((service.input_modes ?? []).length > 0 || (service.output_modes ?? []).length > 0) && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {(service.input_modes ?? []).length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">In</span>
                {(service.input_modes ?? []).map((m) => (
                  <span key={m} className="text-xs px-2 py-0.5 bg-sky-400/10 text-sky-300 rounded-full border border-sky-400/20">
                    {m}
                  </span>
                ))}
              </div>
            )}
            {(service.output_modes ?? []).length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Out</span>
                {(service.output_modes ?? []).map((m) => (
                  <span key={m} className="text-xs px-2 py-0.5 bg-teal-400/10 text-teal-300 rounded-full border border-teal-400/20">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/10">
          <Stat label="Base URL" value={
            <a href={service.base_url} target="_blank" rel="noreferrer"
               className="text-violet-400 hover:text-violet-300 text-xs break-all">
              {service.base_url}
            </a>
          } />
          <Stat label="Version" value={service.version ?? "—"} />
          <Stat label="Latency" value={service.response_latency_ms !== null ? `${service.response_latency_ms} ms` : "—"} />
          <Stat label="Capabilities" value={String(service.capability_count)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
          <Stat label="Registered" value={service.created_at ? new Date(service.created_at).toLocaleString() : "—"} />
          <Stat label="Last Checked" value={service.last_checked_at ? new Date(service.last_checked_at).toLocaleString() : "—"} />
          {service.documentation_url && (
            <Stat label="Documentation" value={
              <a href={service.documentation_url} target="_blank" rel="noreferrer"
                 className="text-sky-400 hover:text-sky-300 text-xs break-all">
                {service.documentation_url}
              </a>
            } />
          )}
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Capabilities ({service.capabilities.length})
        </h2>

        {service.capabilities.length === 0 ? (
          <div className="text-white/30 text-sm py-8 text-center bg-white/5 rounded-xl border border-white/10">
            No capabilities indexed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40">
                  <th className="pb-2 pr-4 font-medium">Method</th>
                  <th className="pb-2 pr-4 font-medium">Path</th>
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {service.capabilities.map((cap) => (
                  <CapabilityRow key={cap.id} cap={cap} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-white/90">{value}</div>
    </div>
  );
}

function CapabilityRow({ cap }: { cap: A2ACapability }) {
  const methodClass = METHOD_COLOR[cap.method.toUpperCase()] ?? "text-white/60 bg-white/5";
  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition">
      <td className="py-2.5 pr-4">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodClass}`}>
          {cap.method.toUpperCase()}
        </span>
      </td>
      <td className="py-2.5 pr-4 font-mono text-xs text-white/70">{cap.path}</td>
      <td className="py-2.5 pr-4 text-xs text-white/80">{cap.name}</td>
      <td className="py-2.5 text-xs text-white/50">{cap.description ?? "—"}</td>
    </tr>
  );
}
