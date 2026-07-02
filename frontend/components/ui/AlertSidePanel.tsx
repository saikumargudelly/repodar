"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, AlertResponse } from "@/lib/api";

const ALERT_ICONS: Record<string, React.ReactNode> = {
  star_spike_24h: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-yellow)" }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  star_spike_48h: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-yellow)" }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  momentum_surge: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-green)" }}>
      <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5" />
      <path d="M12 2c1.5 2 2.5 4 2.5 6 0 1-.5 1.5-1.5 1.5s-4-1-6-2.5c-2-1.5-3-2.5-3-3.5 0-1 .5-1.5 1.5-1.5 2 0 4 1 6 2.5Z" />
      <path d="M12 2s4 1.5 6 3.5c1.5 1.5 2.5 3 2.5 4.5 0 1-.5 1.5-1.5 1.5s-3-1-4.5-2.5c-1.5-1.5-2.5-3-2.5-7Z" />
    </svg>
  ),
  pr_surge: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-blue)" }}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 15V9a4 4 0 0 0-4-4H9" />
      <line x1="6" y1="9" x2="6" y2="15" />
    </svg>
  ),
  new_breakout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-red)" }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

interface AlertSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AlertSidePanel({ isOpen, onClose }: AlertSidePanelProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { data: alertsData } = useQuery({
    queryKey: ["global-side-alerts"],
    queryFn: () => api.getAlerts(false, 30),
    refetchInterval: 30000,
    enabled: isOpen,
  });

  useEffect(() => {
    if (alertsData) setAlerts(alertsData);
  }, [alertsData]);

  // ESC key closes the panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = isOpen ? "hidden" : "";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen, isMobile]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const handleMarkRead = async (alertId: string) => {
    try {
      await api.markAlertRead(alertId);
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, is_read: true } : a));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissAll = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    try {
      await api.markAllAlertsRead();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Responsive layout ────────────────────────────────────────
  // Desktop: slide-in from the right, 380px wide
  // Mobile/Tablet: slide-up bottom sheet, ~70vh, rounded top corners
  const isBottomSheet = isMobile;

  const panelStyle: React.CSSProperties = isBottomSheet
    ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "72vh",
        maxHeight: "72vh",
        width: "100%",
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
        zIndex: 999,
        transform: isOpen ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "380px",
        maxWidth: "calc(100vw - 64px)",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "-4px 0 32px rgba(0,0,0,0.35)",
        zIndex: 999,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        flexDirection: "column",
      };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          zIndex: 998,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Panel */}
      <div style={panelStyle}>

        {/* Bottom-sheet drag handle (mobile only) */}
        {isBottomSheet && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 4px",
            flexShrink: 0,
          }}>
            <div style={{
              width: "36px",
              height: "4px",
              borderRadius: "2px",
              background: "var(--border)",
            }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          padding: isBottomSheet ? "8px 16px 12px" : "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{
            fontWeight: 600,
            fontSize: "14px",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Trend Alerts
            {unreadCount > 0 && (
              <span style={{
                background: "var(--accent-red)",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: "10px",
                lineHeight: 1.5,
              }}>
                {unreadCount}
              </span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {unreadCount > 0 && (
              <button
                onClick={handleDismissAll}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "var(--font-sans)",
                  padding: "4px 6px",
                  borderRadius: "4px",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
              >
                Dismiss all
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "16px",
                padding: "4px 8px",
                borderRadius: "4px",
                lineHeight: 1,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
              aria-label="Close alerts"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {alerts.length === 0 ? (
            <div style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              textAlign: "center",
              padding: "48px 24px",
              fontFamily: "var(--font-sans)",
            }}>
              No active alerts
            </div>
          ) : (
            alerts.map((alert) => {
              const prefix = `${alert.owner}/${alert.name} `;
              const detailText = alert.headline.startsWith(prefix)
                ? alert.headline.slice(prefix.length)
                : alert.headline;

              return (
                <div
                  key={alert.id}
                  onClick={() => {
                    if (!alert.is_read) handleMarkRead(alert.id);
                    router.push(`/repo/${alert.owner}/${alert.name}`);
                    onClose();
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: alert.is_read ? "transparent" : "rgba(255,255,255,0.015)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = alert.is_read ? "transparent" : "rgba(255,255,255,0.015)")}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, marginTop: "2px" }}>
                    {ALERT_ICONS[alert.alert_type] ?? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "var(--accent-blue)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: "2px",
                    }}>
                      {alert.owner}/{alert.name}
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {detailText}
                    </div>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}>
                      <span style={{
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        fontSize: "9px",
                        fontWeight: 600,
                      }}>
                        {alert.category}
                      </span>
                      {new Date(alert.triggered_at).toLocaleDateString()}
                    </div>
                  </div>
                  {!alert.is_read && (
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent-red)",
                      flexShrink: 0,
                      marginTop: "6px",
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
