"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import type { OAuthStrategy } from "@clerk/shared/types";

const PROVIDERS: { key: string; label: string; icon: string; strategy: OAuthStrategy }[] = [
  { key: "google", label: "Sign up with Google", icon: "🔍", strategy: "oauth_google" },
  { key: "discord", label: "Sign up with Discord", icon: "💬", strategy: "oauth_discord" },
];

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const autoTriggered = useRef(false);

  const providerParam = (searchParams.get("provider") || "").toLowerCase();
  const validProvider = PROVIDERS.find((p) => p.key === providerParam);

  useEffect(() => {
    if (authLoaded && isSignedIn) router.replace("/post-auth");
  }, [authLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!signUpLoaded || !validProvider || autoTriggered.current || (authLoaded && isSignedIn)) return;
    autoTriggered.current = true;
    void startOAuth(validProvider.key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signUpLoaded, authLoaded, isSignedIn]);

  const startOAuth = async (providerKey: string) => {
    const provider = PROVIDERS.find((p) => p.key === providerKey);
    if (!provider || !signUp || !signUpLoaded) return;
    if (authLoaded && isSignedIn) { router.replace("/post-auth"); return; }

    setError("");
    setLoadingProvider(providerKey);
    try {
      await signUp.authenticateWithRedirect({
        strategy: provider.strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/post-auth",
      });
    } catch (err: unknown) {
      console.error("OAuth error:", err);
      const message = err instanceof Error ? err.message : String(err ?? "");
      if (message.toLowerCase().includes("already signed in")) {
        router.replace("/post-auth");
        return;
      }
      if (message.toLowerCase().includes("allowed values") || message.toLowerCase().includes("strategy")) {
        setError(`${provider.key.charAt(0).toUpperCase() + provider.key.slice(1)} OAuth is not enabled in the Clerk dashboard. Enable it at dashboard.clerk.com → User & Authentication → Social Connections.`);
      } else {
        setError("Unable to start sign-up. Please try again.");
      }
      setLoadingProvider(null);
    }
  };

  if (authLoaded && isSignedIn) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        Already signed in. Redirecting…
      </div>
    );
  }

  const isReady = signUpLoaded && !!signUp;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", padding: "24px" }}>
      <div className="auth-card" style={{ width: "100%", maxWidth: "440px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
          <span style={{ fontSize: "28px" }}>🎯</span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-blue)" }}>Repodar</span>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}>Create your account</h1>
        <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: "14px" }}>
          Start tracking breakout repositories. Personalized radar, momentum scores, and pre-trend alerts.
        </p>

        <div style={{ display: "grid", gap: "10px" }}>
          {PROVIDERS.map((provider) => {
            const loading = loadingProvider === provider.key;
            return (
              <button
                key={provider.key}
                onClick={() => void startOAuth(provider.key)}
                disabled={!isReady || !!loadingProvider}
                style={{
                  border: `1px solid ${loading ? "var(--accent-blue)" : "var(--border)"}`,
                  background: loading ? "rgba(88,166,255,0.08)" : "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  borderRadius: "8px",
                  padding: "13px 16px",
                  textAlign: "left",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isReady && !loadingProvider ? "pointer" : "not-allowed",
                  opacity: (loadingProvider && !loading) || !isReady ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: "18px" }}>{provider.icon}</span>
                {loading ? `Redirecting to ${provider.label.replace("Sign up with ", "")}…` : provider.label}
              </button>
            );
          })}
        </div>

        {!isReady && (
          <p style={{ marginTop: "12px", color: "var(--text-muted)", fontSize: "12px", textAlign: "center" }}>Loading…</p>
        )}

        {error && (
          <div style={{ marginTop: "14px", padding: "10px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px" }}>
            <p style={{ margin: 0, color: "#ef4444", fontSize: "13px" }}>{error}</p>
          </div>
        )}

        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <p style={{ margin: "0 0 8px", color: "var(--text-muted)", fontSize: "13px" }}>
            Already have an account?{" "}
            <Link href="/sign-in" style={{ color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
          </p>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>
            <Link href="/landing" style={{ color: "var(--text-muted)", textDecoration: "none" }}>← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
