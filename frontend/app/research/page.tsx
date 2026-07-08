"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, ResearchSession } from "@/lib/api";

// B&W Theme Palette
const C = {
  bg: "var(--bg-primary)",
  bgCard: "var(--bg-surface)",
  bgHover: "var(--bg-elevated)",
  border: "var(--border)",
  text: "var(--text-primary)",
  textSub: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  green: "var(--accent-green)",
  amber: "var(--accent-yellow)",
  red: "var(--accent-red)",
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

import { useAuthSession } from "@/lib/useAuthSession";

export default function ResearchListPage() {
  const router = useRouter();
  const { isLoaded, token, isReady } = useAuthSession();
  
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Responsive breakpoints
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isReady || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.research.listSessions(token)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isLoaded, isReady, token]);

  const handleCreate = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const s = await api.research.createSession(token, "Untitled Research");
      router.push(`/research/${s.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleChipClick = async (label: string, q: string) => {
    if (!token) return;
    setCreating(true);
    try {
      const s = await api.research.createSession(token, label);
      router.push(`/research/${s.id}?q=${encodeURIComponent(q)}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this research session?")) return;
    if (!token) return;
    try {
      await api.research.deleteSession(id, token);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Determine standard page height based on the device's navigation margin-top behavior in AppShell
  const pageHeight = isMobile ? "calc(100vh - 56px - 26px)" : "calc(100vh - 26px)";

  return (
    <div className="page-fade-in" style={{ height: pageHeight, display: "flex", flexDirection: "column", background: C.bg, color: C.text, overflow: "hidden" }}>


      {/* Global Header */}
      <div className="research-header" style={{
        height: "56px",
        background: C.bgCard,
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 16px" : "0 24px",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", color: "var(--accent-blue)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18h8M3 22h18M14 22a7 7 0 1 0-14 0M9 14h2M9 12a3 3 0 0 1 6 0V6" />
              <path d="M12 2v4M11 4h2" />
            </svg>
          </span>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: isMobile ? "14px" : "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Research mode
          </h1>
          <span style={{
            background: C.bgHover,
            color: C.textSub,
            borderRadius: "10px",
            padding: isMobile ? "2px 6px" : "2px 8px",
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
            padding: isMobile ? "6px 12px" : "8px 16px",
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
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "16px" : "24px 24px 0 24px", overflowY: "auto" }}>
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
                    borderRadius: "6px",
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
              <div className="narutorun-container" style={{ padding: "0 0 8px 0" }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="narutorun-svg">
                  <circle cx="29" cy="12" r="3" />
                  <path d="M 27 9 L 24 7 L 26 10 L 23 10 L 26 12" />
                  <path d="M 29 9 L 32 6 L 31 10 L 34 8 L 32 11" />
                  <path d="M 25 13 C 23 13, 21 11, 19 12 C 17 13, 16 15, 14 14" />
                  <path d="M 29 15 L 18 28" />
                  <path d="M 27 17 L 10 21" />
                  <path d="M 27 17 L 8 23" />
                  <path d="M 18 28 L 26 34 L 20 44" />
                  <path d="M 18 28 L 10 35 L 4 33" />
                </svg>
              </div>
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
            <div style={{
              flex: isMobile ? "0 0 100%" : isTablet ? "0 0 35%" : "0 0 42%",
              borderRight: isMobile ? "none" : `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: isMobile ? "12px 16px 0 16px" : "16px 20px 0 20px"
            }}>
              
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
                      borderRadius: "6px",
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
                      borderLeft: `3px solid ${C.border}`,
                      borderRadius: "10px",
                      padding: "16px 16px 16px 14px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = C.textSub;
                      e.currentTarget.style.borderLeftColor = C.textSub;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.borderLeftColor = C.border;
                    }}
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

            {/* Right Column (Placeholder matching Image 4 - hidden on mobile) */}
            {!isMobile && (
              <div style={{ flex: isTablet ? "0 0 65%" : "0 0 58%", background: C.bg }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
