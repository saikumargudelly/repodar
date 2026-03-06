"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, A2AService, A2ACapability } from "@/lib/api";

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active:        { color: "var(--green)",  bg: "var(--green)18" },
  unreachable:   { color: "var(--amber)",  bg: "var(--amber)18" },
  invalid:       { color: "var(--pink)",   bg: "var(--pink)18" },
  no_card:       { color: "var(--amber)",  bg: "var(--amber)18" },
  auth_required: { color: "var(--amber)",  bg: "var(--amber)18" },
  rate_limited:  { color: "var(--cyan)",   bg: "var(--cyan)18" },
  sleeping:      { color: "var(--cyan)",   bg: "var(--cyan)18" },
};

const METHOD_STYLE: Record<string, { color: string; bg: string }> = {
  GET:    { color: "var(--cyan)",  bg: "var(--cyan)18" },
  POST:   { color: "var(--green)", bg: "var(--green)18" },
  PUT:    { color: "var(--amber)", bg: "var(--amber)18" },
  PATCH:  { color: "var(--cyan)",  bg: "var(--cyan)18" },
  DELETE: { color: "var(--pink)",  bg: "var(--pink)18" },
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: "60vh", fontFamily: "var(--font-mono)", fontSize: "12px",
        color: "var(--text-muted)", letterSpacing: "0.06em" }}>
        // LOADING SERVICE DATA<span className="terminal-cursor" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "60vh", gap: "16px" }}>
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", fontSize: "13px" }}>
          ✕ {error ?? "SERVICE NOT FOUND"}
        </div>
        <Link href="/services" style={{ fontFamily: "var(--font-mono)", fontSize: "11px",
          color: "var(--cyan)", textDecoration: "none" }}>
          ← BACK TO SERVICE CATALOG
        </Link>
      </div>
    );
  }

  const ss = STATUS_STYLE[service.status] ?? { color: "var(--text-muted)", bg: "var(--bg-elevated)" };

  return (
    <div className="page-root">
      {/* Back */}
      <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: "6px",
        fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)",
        textDecoration: "none", letterSpacing: "0.04em" }}>
        ← A2A SERVICE CATALOG
      </Link>

      {/* Hero */}
      <div className="panel">
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start",
            justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
            <div>
              <div className="section-title-cyber" style={{ fontSize: "18px", marginBottom: "4px" }}>
                {service.name}
              </div>
              {service.provider && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px",
                  color: "var(--text-muted)" }}>by {service.provider}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {service.supports_streaming && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
                  color: "var(--green)", border: "1px solid var(--green)",
                  padding: "2px 8px", letterSpacing: "0.06em" }}>
                  ⚡ STREAMING
                </span>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
                color: ss.color, background: ss.bg, border: `1px solid ${ss.color}`,
                padding: "2px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {service.status}
              </span>
            </div>
          </div>

          {service.description && (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)",
              lineHeight: 1.6, marginBottom: "12px" }}>{service.description}</div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
            {(service.categories ?? []).map((cat) => (
              <span key={cat} className="cyber-tag">{cat}</span>
            ))}
          </div>

          {(service.auth_schemes ?? []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
              gap: "6px", marginBottom: "8px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px",
                color: "var(--text-muted)", letterSpacing: "0.08em" }}>AUTH</span>
              {(service.auth_schemes ?? []).map((s) => (
                <span key={s} style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                  color: "var(--amber)", background: "var(--amber)18",
                  border: "1px solid var(--amber)", padding: "1px 7px" }}>{s}</span>
              ))}
            </div>
          )}

          {((service.input_modes ?? []).length > 0 || (service.output_modes ?? []).length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
              {(service.input_modes ?? []).length > 0 && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px",
                    color: "var(--text-muted)", letterSpacing: "0.08em" }}>IN</span>
                  {(service.input_modes ?? []).map((m) => (
                    <span key={m} style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                      color: "var(--cyan)", background: "var(--cyan)18",
                      border: "1px solid var(--cyan)", padding: "1px 7px" }}>{m}</span>
                  ))}
                </div>
              )}
              {(service.output_modes ?? []).length > 0 && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px",
                    color: "var(--text-muted)", letterSpacing: "0.08em" }}>OUT</span>
                  {(service.output_modes ?? []).map((m) => (
                    <span key={m} style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                      color: "var(--green)", background: "var(--green)18",
                      border: "1px solid var(--green)", padding: "1px 7px" }}>{m}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px", marginTop: "16px", paddingTop: "16px",
            borderTop: "1px solid var(--border)", paddingBottom: "16px" }}>
            <Stat label="BASE URL" value={
              <a href={service.base_url} target="_blank" rel="noreferrer"
                style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)",
                  fontSize: "10px", wordBreak: "break-all", textDecoration: "none" }}>
                {service.base_url}
              </a>
            } />
            <Stat label="VERSION" value={service.version ?? "—"} />
            <Stat label="LATENCY" value={
              service.response_latency_ms !== null ? `${service.response_latency_ms} ms` : "—"
            } />
            <Stat label="CAPABILITIES" value={String(service.capability_count)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px", paddingBottom: "20px",
            borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <Stat label="REGISTERED" value={
              service.created_at ? new Date(service.created_at).toLocaleString() : "—"
            } />
            <Stat label="LAST CHECKED" value={
              service.last_checked_at ? new Date(service.last_checked_at).toLocaleString() : "—"
            } />
            {service.documentation_url && (
              <Stat label="DOCUMENTATION" value={
                <a href={service.documentation_url} target="_blank" rel="noreferrer"
                  style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)",
                    fontSize: "10px", wordBreak: "break-all", textDecoration: "none" }}>
                  {service.documentation_url}
                </a>
              } />
            )}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">◈ CAPABILITIES ({service.capabilities.length})</span>
        </div>
        {service.capabilities.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)",
            textAlign: "center", padding: "40px 20px", fontSize: "11px",
            letterSpacing: "0.06em" }}>
            // NO CAPABILITIES INDEXED YET
          </div>
        ) : (
          <div className="table-scroll" style={{ padding: "0 0 4px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr className="th-mono">
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>METHOD</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>PATH</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>NAME</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>DESCRIPTION</th>
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
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px",
        color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px",
        color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function CapabilityRow({ cap }: { cap: A2ACapability }) {
  const ms = METHOD_STYLE[cap.method.toUpperCase()] ?? { color: "var(--text-muted)", bg: "var(--bg-elevated)" };
  return (
    <tr className="tr-cyber">
      <td style={{ padding: "10px 12px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700,
          color: ms.color, background: ms.bg, border: `1px solid ${ms.color}`,
          padding: "2px 6px", letterSpacing: "0.06em" }}>
          {cap.method.toUpperCase()}
        </span>
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)",
        fontSize: "11px", color: "var(--text-secondary)" }}>{cap.path}</td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)",
        fontSize: "11px", color: "var(--text-primary)" }}>{cap.name}</td>
      <td style={{ padding: "10px 12px", fontSize: "11px",
        color: "var(--text-muted)" }}>{cap.description ?? "—"}</td>
    </tr>
  );
}
