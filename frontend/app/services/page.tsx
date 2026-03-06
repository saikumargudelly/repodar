"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, A2AService } from "@/lib/api";

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  active:      { color: "var(--green)",  bg: "var(--green)18" },
  unreachable: { color: "var(--amber)",  bg: "var(--amber)18" },
  invalid:     { color: "var(--pink)",   bg: "var(--pink)18" },
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
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">A2A SERVICE CATALOG<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Discover and register AI services exposing A2A capability cards
        </div>
      </div>

      {/* Register form */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">◈ REGISTER A SERVICE</span></div>
        <form onSubmit={handleRegister}
          style={{ padding: "0 20px 20px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input type="url" placeholder="https://your-service.example.com"
            value={regUrl} onChange={(e) => setRegUrl(e.target.value)}
            className="cyber-input" style={{ flex: 1, minWidth: "260px" }} />
          <button type="submit" disabled={regLoading}
            className="btn-cyber btn-cyber-cyan"
            style={{ padding: "8px 20px", opacity: regLoading ? 0.6 : 1 }}>
            {regLoading ? "REGISTERING…" : "REGISTER"}
          </button>
        </form>
        {regMsg && (
          <div style={{ padding: "0 20px 14px", fontFamily: "var(--font-mono)", fontSize: "11px",
            color: regMsg.type === "success" ? "var(--green)" : "var(--pink)" }}>
            {regMsg.text}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
        <input type="text" placeholder="SEARCH BY CAPABILITY"
          value={searchCap}
          onChange={(e) => { setSearchCap(e.target.value); setCategory(""); setProvider(""); setStatusFilter(""); }}
          className="cyber-input" style={{ width: "200px" }} />
        <input type="text" placeholder="CATEGORY"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setSearchCap(""); }}
          className="cyber-input" style={{ width: "160px" }} />
        <input type="text" placeholder="PROVIDER"
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setSearchCap(""); }}
          className="cyber-input" style={{ width: "160px" }} />
        <select value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setSearchCap(""); }}
          className="cyber-select">
          <option value="">ALL STATUSES</option>
          <option value="active">ACTIVE</option>
          <option value="unreachable">UNREACHABLE</option>
          <option value="invalid">INVALID</option>
        </select>
        <button onClick={load} className="btn-cyber" style={{ padding: "7px 14px" }}>REFRESH</button>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center",
          padding: "60px 0", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING SERVICES<span className="terminal-cursor" />
        </div>
      ) : error ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", textAlign: "center",
          padding: "40px 0", fontSize: "12px" }}>✕ {error}</div>
      ) : services.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
            letterSpacing: "0.08em" }}>
            // NO SERVICES FOUND
            {!searchCap && !category && !provider && !statusFilter && " — REGISTER THE FIRST ONE ABOVE"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service: s }: { service: A2AService }) {
  const statusStyle = STATUS_COLOR[s.status] ?? { color: "var(--text-muted)", bg: "var(--bg-elevated)" };

  return (
    <Link href={`/services/${s.id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
        padding: "18px 20px", cursor: "pointer", transition: "border-color 0.15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--cyan)44")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: "8px", marginBottom: "6px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600,
            color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap" }}>
            {s.name}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700,
            color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.color}`,
            padding: "1px 6px", letterSpacing: "0.06em", flexShrink: 0,
            textTransform: "uppercase" }}>
            {s.status}
          </span>
        </div>

        {s.provider && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--text-muted)", marginBottom: "6px" }}>{s.provider}</div>
        )}

        {s.description && (
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden" }}>{s.description}</div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
          {(s.categories ?? []).slice(0, 3).map((cat) => (
            <span key={cat} className="cyber-tag">{cat}</span>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between",
          fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
          <span>{s.capability_count} CAPABILIT{s.capability_count !== 1 ? "IES" : "Y"}</span>
          {s.response_latency_ms !== null && <span>{s.response_latency_ms} ms</span>}
        </div>
      </div>
    </Link>
  );
}
