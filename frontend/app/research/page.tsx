"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { api, ResearchSession } from "@/lib/api";

const VERTICAL_LABELS: Record<string, string> = {
  ai_ml: "AI / ML", devtools: "DevTools", web_mobile: "Web & Mobile",
  data_infra: "Data & Infra", security: "Security", blockchain: "Blockchain",
  oss_tools: "OSS Tools", science: "Science", creative: "Creative",
};

export default function ResearchListPage() {
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    api.research.listSessions(userId)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isLoaded, userId]);

  const handleCreate = async () => {
    if (!userId) return;
    setCreating(true);
    try {
      const s = await api.research.createSession(userId, "Untitled Research");
      router.push(`/research/${s.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    if (!confirm("Delete this research session?")) return;
    await api.research.deleteSession(id, userId);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="main-content" style={{ minHeight: "100vh" }}>
      <style>{`
        .research-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 18px 20px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .research-card:hover {
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 1px rgba(88,166,255,0.15), 0 4px 16px rgba(0,0,0,0.2);
        }
        .badge-pill {
          display: inline-flex; align-items: center;
          padding: 2px 8px; border-radius: 10px;
          font-size: 10px; font-weight: 600; font-family: var(--font-sans);
          border: 1px solid var(--border); color: var(--text-muted);
          background: var(--bg-elevated);
        }
        .badge-pill.has-report {
          border-color: rgba(63,185,80,0.4);
          color: var(--accent-green);
          background: rgba(63,185,80,0.08);
        }
        .quick-chips {
          display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px;
        }
        .quick-chip {
          padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500;
          font-family: var(--font-sans); cursor: pointer; transition: all 0.15s;
          border: 1px solid var(--border); color: var(--text-muted);
          background: var(--bg-elevated);
        }
        .quick-chip:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 className="section-title-cyber" style={{ fontSize: "28px", marginBottom: "6px" }}>
              🔬 Research <span>Mode</span>
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-muted)" }}>
              Conversational GitHub intelligence — real-time data, no hallucination
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "var(--accent-blue)", color: "#fff",
              border: "none", borderRadius: "8px", padding: "10px 20px",
              fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1,
              transition: "opacity 0.15s, transform 0.1s",
            }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            {creating ? "Creating…" : "+ New Research"}
          </button>
        </div>

        {/* Quick-start chips */}
        <div className="quick-chips">
          {[
            { label: "🤖 AI/ML trends this week", q: "what's trending in AI and ML this week?" },
            { label: "🔒 Security tools gaining traction", q: "security tools gaining stars this month" },
            { label: "🦀 Rust ecosystem rising stars", q: "rust repos with high momentum" },
            { label: "📊 Data infra landscape", q: "map the data infrastructure ecosystem" },
          ].map(({ label, q }) => (
            <button key={label} className="quick-chip" onClick={async () => {
              if (!userId) return;
              setCreating(true);
              try {
                const s = await api.research.createSession(userId, label);
                router.push(`/research/${s.id}?q=${encodeURIComponent(q)}`);
              } catch { setCreating(false); }
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Session list */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px 0", fontFamily: "var(--font-sans)", fontSize: "14px" }}>
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "80px 20px",
          border: "1px dashed var(--border)", borderRadius: "12px",
          background: "var(--bg-surface)",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔬</div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--text-primary)", fontSize: "16px", marginBottom: "8px" }}>
            No research sessions yet
          </div>
          <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
            Start a conversation to research GitHub repos in real-time
          </div>
          <button onClick={handleCreate} style={{
            background: "var(--accent-blue)", color: "#fff", border: "none",
            borderRadius: "8px", padding: "10px 24px",
            fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>
            Start Research
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {sessions.map((s) => (
            <div key={s.id} className="research-card" onClick={() => router.push(`/research/${s.id}`)}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.3 }}>
                  {s.title}
                </div>
                <button
                  onClick={(e) => handleDelete(s.id, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", flexShrink: 0, padding: "0 4px", lineHeight: 1 }}
                  title="Delete session"
                >×</button>
              </div>

              {s.description && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>{s.description}</div>
              )}

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                {s.verticals.map((v) => (
                  <span key={v} className="badge-pill">{VERTICAL_LABELS[v] ?? v}</span>
                ))}
                {s.pin_count > 0 && (
                  <span className="badge-pill">📌 {s.pin_count} pinned</span>
                )}
                {s.has_report && (
                  <span className="badge-pill has-report">📄 Report ready</span>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
                  {s.message_count} messages
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
                  {new Date(s.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
