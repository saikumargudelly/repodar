"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";

export default function PostAuthPage() {
  const router = useRouter();
  const { isLoaded, userId, isSignedIn } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    if (!isSignedIn || !userId) {
      router.replace("/sign-in");
      return;
    }
    started.current = true;

    (async () => {
      try {
        // Ensure the user has an API key provisioned
        try {
          await api.ensureApiKey(userId);
        } catch (error) {
          console.warn("Unable to ensure default API key:", error);
        }

        // Determine if onboarding is complete
        try {
          const status = await api.getOnboardingStatus(userId);
          if (status.onboarding_completed) {
            router.replace("/overview");
          } else {
            router.replace("/onboarding");
          }
        } catch (error) {
          console.warn("Unable to fetch onboarding status:", error);
          // Fallback: send to onboarding if we can't determine status
          router.replace("/onboarding");
        }
      } catch (error) {
        console.error("Post-auth error:", error);
        router.replace("/overview");
      }
    })();
  }, [isLoaded, isSignedIn, router, userId]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: "12px", fontSize: "32px" }}>🎯</div>
        <p style={{ fontSize: "14px" }}>Finalizing your workspace…</p>
      </div>
    </div>
  );
}
