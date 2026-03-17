"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Nav } from "@/components/Nav";
import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";

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

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (!isLoaded) return;

    // Redirect unauthenticated users to sign-in on protected pages
    if (!userId && !publicPath) {
      router.push("/sign-in");
    }
  }, [isLoaded, userId, publicPath, router]);

  // Show loading state while auth is loading
  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        Loading...
      </div>
    );
  }

  // If unauthenticated and on protected page, don't render content yet (will redirect)
  if (!userId && !publicPath) {
    return null;
  }

  if (publicPath) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <Nav />
      <main
        className="main-content"
        style={{
          marginLeft: "var(--sidebar-width, 220px)",
          maxWidth: "100%",
          marginTop: "48px",
          overflowX: "hidden",
          transition: "margin-left 0.3s ease",
        }}
      >
        {children}
      </main>
      <StatusBar />
    </>
  );
}
