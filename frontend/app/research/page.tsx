"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { api, ResearchSession } from "@/lib/api";

// B&W Theme Palette
const C = {
  bg: "#0d1117",
  bgCard: "#161b22",
  bgHover: "#21262d",
  border: "#30363d",
  text: "#e6edf3",
  textSub: "#8b949e",
  textMuted: "#6e7681",
  green: "#3fb950",
  amber: "#d29922",
  red: "#f85149",
};

// High-fidelity SVG icons for Quick Start Chips
const QUICK_CHIPS = [
  {
    label: "AI/ML trends this week",
    q: "what's trending in AI and ML this week?",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
        <path d="M12 22a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v12a4 4 0 0 0 4 4z" />
        <path d="M22 12a4 4 0 0 0-4-4H6a4 4 0 1 0 0 8h12a4 4 0 0 0 4-4z" />
      </svg>
    )
  },
  {
    label: "Security tools",
    q: "security tools gaining stars this month",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <circle cx="12" cy="11" r="2" />
        <path d="M12 13v3" />
      </svg>
    )
  },
  {
    label: "Rust rising stars",
    q: "rust repos with high momentum",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
        <path d="M6 18V4h6a5 5 0 0 1 0 10H6" />
        <path d="M12 14l5 5" />
      </svg>
    )
  },
  {
    label: "Data infra",
    q: "map the data infrastructure ecosystem",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
        <rect x="3" y="4" width="18" height="6" rx="1" />
        <rect x="3" y="14" width="18" height="6" rx="1" />
        <path d="M6 10v4M18 10v4" />
      </svg>
    )
  }
];

export default function ResearchListPage() {
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  
  const effectiveUserId = useMemo(() => {
    return isLoaded && userId ? userId : "default-user";
  }, [isLoaded, userId]);

  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.research.listSessions(effectiveUserId)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [effectiveUserId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const s = await api.research.createSession(effectiveUserId, "Untitled Research");
      router.push(`/research/${s.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleChipClick = async (label: string, q: string) => {
    setCreating(true);
    try {
      const s = await api.research.createSession(effectiveUserId, label);
      router.push(`/research/${s.id}?q=${encodeURIComponent(q)}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this research session?")) return;
    await api.research.deleteSession(id, effectiveUserId);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, color: C.text, overflow: "hidden" }}>
      <style>{`
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #8b949e;
        }
      `}</style>

      {/* Global Header */}
      <div style={{
        height: "56px",
        background: C.bgCard,
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>🔬</span>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
            Research mode
          </h1>
          <span style={{
            background: C.bgHover,
            color: C.textSub,
            borderRadius: "10px",
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            marginLeft: "4px"
          }}>
            β
          </span>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "8px 16px",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            cursor: creating ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: creating ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (!creating) { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.background = C.bgHover; } }}
          onMouseLeave={(e) => { if (!creating) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; } }}
        >
          {creating ? "Creating…" : "+ New research"}
        </button>
      </div>

      {/* Main Container */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textSub, fontFamily: "var(--font-sans)", fontSize: "13px" }}>
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          /* Empty State View - Image 1 */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px 0 24px", overflowY: "auto" }}>
            {/* Quick Start Chips */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "32px", flexShrink: 0 }}>
              {QUICK_CHIPS.map(({ label, q, icon }) => (
                <button
                  key={label}
                  onClick={() => handleChipClick(label, q)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    border: `1px solid ${C.border}`,
                    color: C.textSub,
                    background: C.bgCard,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.color = C.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Centered Empty State */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", textAlign: "center", paddingBottom: "80px" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: "8px" }}>
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <circle cx="10" cy="13" r="3" />
                <line x1="12" y1="15" x2="16" y2="19" />
              </svg>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: C.text, fontSize: "16px" }}>
                No research sessions yet
              </div>
              <div style={{ fontFamily: "var(--font-sans)", color: C.textSub, fontSize: "13px", maxWidth: "320px", lineHeight: 1.5 }}>
                Click &quot;New research&quot; to start exploring GitHub intelligence
              </div>
            </div>
          </div>
        ) : (
          /* Sessions Exist View - Image 4 */
          <>
            {/* Left Column (Sessions list + controls) */}
            <div style={{ flex: "0 0 42%", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden", padding: "16px 20px 0 20px" }}>
              
              {/* Quick Start Chips */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px", flexShrink: 0 }}>
                {QUICK_CHIPS.map(({ label, q, icon }) => (
                  <button
                    key={label}
                    onClick={() => handleChipClick(label, q)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      fontFamily: "var(--font-sans)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      border: `1px solid ${C.border}`,
                      color: C.textSub,
                      background: C.bgCard,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.color = C.text; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {/* Sessions List */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "20px" }}>
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/research/${s.id}`)}
                    style={{
                      background: C.bgCard,
                      border: `1px solid ${C.border}`,
                      borderRadius: "10px",
                      padding: "16px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px", color: C.text, lineHeight: 1.3 }}>
                        {s.title}
                      </div>
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          border: `1px solid ${C.border}`,
                          background: "transparent",
                          color: C.textSub,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: "14px",
                          lineHeight: 1,
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.color = C.text; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                        title="Delete session"
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.green, display: "inline-block" }} />
                        {s.message_count} messages
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "2px" }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {new Date(s.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column (Placeholder matching Image 4) */}
            <div style={{ flex: "0 0 58%", background: C.bg }} />
          </>
        )}
      </div>

      {/* Footer (matches mockup footer) */}
      <div style={{
        height: "36px",
        borderTop: `1px solid ${C.border}`,
        background: C.bgCard,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "12px",
        color: C.textSub,
        fontFamily: "var(--font-sans)",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.green }} />
            Live
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M6 9a9 9 0 0 0 9 9" />
              <circle cx="18" cy="18" r="3" />
            </svg>
            1,349 repos
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
              <rect x="9" y="9" width="6" height="6" />
              <line x1="9" y1="1" x2="9" y2="4" />
              <line x1="15" y1="1" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="23" />
              <line x1="15" y1="20" x2="15" y2="23" />
              <line x1="20" y1="9" x2="23" y2="9" />
              <line x1="20" y1="15" x2="23" y2="15" />
              <line x1="1" y1="9" x2="4" y2="9" />
              <line x1="1" y1="15" x2="4" y2="15" />
            </svg>
            AI/ML ecosystem
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            20 alerts
          </span>
        </div>
        <div>Repodar v2.0</div>
      </div>
    </div>
  );
}
