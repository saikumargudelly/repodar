"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, A2AService } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10",
  unreachable: "text-amber-400 bg-amber-400/10",
  invalid: "text-red-400 bg-red-400/10",
};

export default function ServicesPage() {
  const [services, setServices] = useState<A2AService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState("");
  const [provider, setProvider] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchCap, setSearchCap] = useState("");

  // Register form
  const [regUrl, setRegUrl] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regMsg, setRegMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: A2AService[];
      if (searchCap.trim()) {
        data = await api.searchServices(searchCap.trim());
      } else {
        data = await api.getServices({
          category: category || undefined,
          provider: provider || undefined,
          status: statusFilter || undefined,
          limit: 100,
        });
      }
      setServices(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [category, provider, statusFilter, searchCap]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regUrl.trim()) return;
    setRegLoading(true);
    setRegMsg(null);
    try {
      const res = await api.registerService(regUrl.trim());
      setRegMsg({ type: "success", text: res.message });
      setRegUrl("");
      load();
    } catch (e: unknown) {
      setRegMsg({ type: "error", text: e instanceof Error ? e.message : "Registration failed" });
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">A2A Service Catalog</h1>
        <p className="text-white/50 text-sm">
          Discover and register AI services exposing A2A capability cards.
        </p>
      </div>

      {/* Register form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
          Register a Service
        </h2>
        <form onSubmit={handleRegister} className="flex gap-3 flex-wrap">
          <input
            type="url"
            placeholder="https://your-service.example.com"
            value={regUrl}
            onChange={(e) => setRegUrl(e.target.value)}
            className="flex-1 min-w-[260px] bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm
                       placeholder-white/30 focus:outline-none focus:border-violet-500 transition"
          />
          <button
            type="submit"
            disabled={regLoading}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg
                       text-sm font-medium transition"
          >
            {regLoading ? "Registering…" : "Register"}
          </button>
        </form>
        {regMsg && (
          <p className={`mt-2 text-xs ${regMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {regMsg.text}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by capability…"
          value={searchCap}
          onChange={(e) => { setSearchCap(e.target.value); setCategory(""); setProvider(""); setStatusFilter(""); }}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm placeholder-white/30
                     focus:outline-none focus:border-violet-500 transition w-52"
        />
        <input
          type="text"
          placeholder="Filter by category…"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setSearchCap(""); }}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm placeholder-white/30
                     focus:outline-none focus:border-violet-500 transition w-44"
        />
        <input
          type="text"
          placeholder="Filter by provider…"
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setSearchCap(""); }}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm placeholder-white/30
                     focus:outline-none focus:border-violet-500 transition w-44"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setSearchCap(""); }}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/70
                     focus:outline-none focus:border-violet-500 transition"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="unreachable">Unreachable</option>
          <option value="invalid">Invalid</option>
        </select>
        <button
          onClick={load}
          className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-white/40 text-sm py-16 text-center">Loading services…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-8 text-center">{error}</div>
      ) : services.length === 0 ? (
        <div className="text-white/40 text-sm py-16 text-center">
          No services found.
          {!searchCap && !category && !provider && !statusFilter && (
            <span> Register the first one above!</span>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service: s }: { service: A2AService }) {
  const statusClass = STATUS_COLOR[s.status] ?? "text-white/40 bg-white/5";

  return (
    <Link
      href={`/services/${s.id}`}
      className="block bg-white/5 hover:bg-white/8 border border-white/10 hover:border-violet-500/40
                 rounded-xl p-5 transition group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold group-hover:text-violet-300 transition line-clamp-1">
          {s.name}
        </h3>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusClass}`}>
          {s.status}
        </span>
      </div>

      {s.provider && (
        <p className="text-xs text-white/40 mb-2">{s.provider}</p>
      )}

      {s.description && (
        <p className="text-xs text-white/60 line-clamp-2 mb-3">{s.description}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-3">
        {(s.categories ?? []).slice(0, 3).map((cat) => (
          <span key={cat} className="text-[10px] px-2 py-0.5 bg-violet-500/10 text-violet-300 rounded-full">
            {cat}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/40">
        <span>{s.capability_count} capability{s.capability_count !== 1 ? "ies" : "y"}</span>
        {s.response_latency_ms !== null && (
          <span>{s.response_latency_ms} ms</span>
        )}
      </div>
    </Link>
  );
}
