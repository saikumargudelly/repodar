"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/lib/useAuthSession";
import { api } from "@/lib/api";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";


type SetupStage = "auth" | "keys" | "onboarding" | "complete";

export default function PostAuthPage() {
  const router = useRouter();
  const { isLoaded, userId, isSignedIn, token, isReady } = useAuthSession();
  const started = useRef(false);
  const [stage, setStage] = useState<SetupStage>("auth");

  useEffect(() => {
    if (!isLoaded || started.current) return;
    if (!isSignedIn || !userId) {
      router.replace("/sign-in");
      return;
    }
    if (!isReady || !token) return; // Wait until token is fully ready
    started.current = true;

    (async () => {
      try {
        // Stage 1: Auth is complete. Move to Keys
        setStage("keys");
        
        // Ensure the user has an API key provisioned
        try {
          await api.ensureApiKey(token);
        } catch (error) {
          console.warn("Unable to ensure default API key:", error);
        }

        // Stage 2: Keys is complete. Move to Onboarding
        setStage("onboarding");

        // Determine if onboarding is complete
        try {
          const status = await api.getOnboardingStatus(token);
          setStage("complete");
          if (status.onboarding_completed) {
            router.replace("/overview");
          } else {
            router.replace("/onboarding");
          }
        } catch (error) {
          console.warn("Unable to fetch onboarding status:", error);
          setStage("complete");
          // Fallback: send to onboarding if we can't determine status
          router.replace("/onboarding");
        }
      } catch (error) {
        console.error("Post-auth error:", error);
        setStage("complete");
        router.replace("/overview");
      }
    })();
  }, [isLoaded, isSignedIn, isReady, token, router, userId]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at center, #111520 0%, #07090e 100%)",
      color: "var(--color-text-primary, #e6edf3)",
      fontFamily: "var(--font-sans, system-ui)",
      padding: "24px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "rgba(22, 27, 34, 0.45)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "32px",
        textAlign: "center",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>
        <div style={{ marginBottom: "24px" }}>
          <ProfessionalLoader size={60} />
        </div>


        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
          Finalizing Workspace
        </h2>

        {/* Terminal status box */}
        <div style={{
          background: "rgba(0, 0, 0, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "8px",
          padding: "12px 16px",
          textAlign: "left",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "11px",
          color: "#8b949e",
          lineHeight: "1.7",
        }}>
          {/* Stage 1: Auth */}
          <div style={{ color: stage !== "auth" ? "#3fb950" : "var(--color-text-primary)" }}>
            {stage !== "auth" ? "✔" : "⚡"} Session credentials verified
          </div>

          {/* Stage 2: Keys */}
          {stage !== "auth" && (
            <div style={{ color: (stage === "onboarding" || stage === "complete") ? "#3fb950" : "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{(stage === "onboarding" || stage === "complete") ? "✔" : "⚡"} Default API key ensured</span>
              {stage === "keys" && <span className="terminal-cursor" />}
            </div>
          )}

          {/* Stage 3: Onboarding */}
          {(stage === "onboarding" || stage === "complete") && (
            <div style={{ color: stage === "complete" ? "#3fb950" : "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{stage === "complete" ? "✔" : "⚡"} Onboarding profile retrieved</span>
              {stage === "onboarding" && <span className="terminal-cursor" />}
            </div>
          )}

          {/* Stage 4: Redirecting */}
          {stage === "complete" && (
            <div style={{ color: "#3fb950", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>⚡ Redirecting to workspace</span>
              <span className="terminal-cursor" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
