"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export default function RootPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    // Authenticated users go to overview, unauthenticated to landing
    if (userId) {
      router.replace("/overview");
    } else {
      router.replace("/landing");
    }
  }, [isLoaded, userId, router]);

  // Show loading state while auth is being determined
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
      Loading...
    </div>
  );
}
