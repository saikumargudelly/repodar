// Sidebar implementation - collapsible left navigation
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", icon: "📊", label: "Overview" },
  { href: "/insights", icon: "🔍", label: "Insights" },
  { href: "/leaderboard", icon: "🏆", label: "Leaderboard" },
  { href: "/topics", icon: "🏷️", label: "Topics" },
  { href: "/network", icon: "🕸️", label: "Network" },
  { href: "/orgs", icon: "🏢", label: "Org Health" },
  { href: "/compare", icon: "⚖️", label: "Compare" },
  { href: "/watchlist", icon: "⭐", label: "Watchlist" },
  { href: "/dev", icon: "🔑", label: "Dev API" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        width: collapsed ? "60px" : "240px",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease",
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: 40,
      }}
    >
      {/* Logo / Collapse toggle */}
      <div
        style={{
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          gap: "8px",
        }}
      >
        {!collapsed && (
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <span style={{ fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>
              Repodar
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: "14px",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: collapsed ? 0 : "12px",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                color: isActive
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                background: isActive ? "var(--bg-elevated)" : "transparent",
                textDecoration: "none",
                transition: "all 0.15s",
                justifyContent: collapsed ? "center" : "flex-start",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: "16px" }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
