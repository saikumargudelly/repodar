"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Nav } from "@/components/Nav";
import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AlertSidePanel } from "@/components/ui/AlertSidePanel";
import { useUnreadAlerts } from "@/lib/useUnreadAlerts";

const PUBLIC_PREFIXES = [
  "/",
  "/landing",
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/post-auth",
  "/onboarding",
  "/repo",
  "/collections",
  "/settings",
];

const NO_SHELL_PREFIXES = [
  "/landing",
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/post-auth",
  "/onboarding",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isNoShellPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return NO_SHELL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const publicPath = isPublicPath(pathname);
  const noShellPath = isNoShellPath(pathname);

  const [isMobile, setIsMobile] = useState(false);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

  const { unreadCount } = useUnreadAlerts();

  // Any page component can dispatch this event to open the alerts panel
  useEffect(() => {
    const handler = () => setAlertsPanelOpen(true);
    window.addEventListener("repodar:open-alerts", handler);
    return () => window.removeEventListener("repodar:open-alerts", handler);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId && !publicPath) {
      router.push("/sign-in");
    }
  }, [isLoaded, userId, publicPath, router]);

  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        Loading...
      </div>
    );
  }

  if (!userId && !publicPath) {
    return null;
  }

  if (noShellPath) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <Nav onOpenAlerts={() => setAlertsPanelOpen(true)} />
      <main
        className="main-content"
        style={{
          marginLeft: "var(--sidebar-width, 220px)",
          maxWidth: "100%",
          marginTop: "0px",
          overflowX: "hidden",
          transition: "margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.25s ease",
        }}
      >
        {children}
      </main>
      <StatusBar />
      <AlertSidePanel isOpen={alertsPanelOpen} onClose={() => setAlertsPanelOpen(false)} />
    </>
  );
}
