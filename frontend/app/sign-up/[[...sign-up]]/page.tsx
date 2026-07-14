"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import type { OAuthStrategy } from "@clerk/shared/types";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";
import Logo from "@/components/Logo";


const PROVIDERS = [
  {
    key: "google",
    label: "Sign up with Google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.355-2.845-6.355-6.355s2.845-6.355 6.355-6.355c1.62 0 3.065.6 4.18 1.58l3.1-3.1C18.6 1.83 15.615.9 12.24.9 6.015.9 1 5.915 1 12.14s5.015 11.24 11.24 11.24c5.895 0 10.8-4.215 10.8-11.24 0-.645-.06-1.275-.165-1.855H12.24z"/>
      </svg>
    ),
    strategy: "oauth_google" as OAuthStrategy
  },
  {
    key: "discord",
    label: "Sign up with Discord",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
      </svg>
    ),
    strategy: "oauth_discord" as OAuthStrategy
  },
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
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, #262524 0%, #1e1d1c 100%)",
        color: "var(--text-primary, #e6edf3)",
        fontFamily: "var(--font-sans, system-ui)",
      }}>
        <ProfessionalLoader size={50} text="Already signed in. Redirecting..." />

      </div>
    );
  }

  const isReady = signUpLoaded && !!signUp;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at center, #262524 0%, #1e1d1c 100%)",
      padding: "24px",
      fontFamily: "var(--font-sans, system-ui)",
      color: "var(--text-primary, #e6edf3)",
    }}>
      <style>{`
        .auth-provider-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: var(--text-primary, #e6edf3);
          font-family: var(--font-sans, system-ui);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .auth-provider-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(210, 153, 34, 0.4);
          box-shadow: 0 0 12px rgba(210, 153, 34, 0.15);
          transform: translateY(-1px);
        }
        .auth-provider-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .auth-provider-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .auth-brand-logo {
          display: inline-flex;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .auth-brand-logo:hover {
          transform: scale(1.04);
        }
        .auth-link {
          color: var(--accent-yellow, #d29922);
          text-decoration: none;
          font-weight: 600;
          transition: color 0.15s ease;
        }
        .auth-link:hover {
          color: #f5b041;
          text-decoration: underline;
        }
      `}</style>

      <div className="auth-card" style={{
        width: "100%",
        maxWidth: "440px",
        background: "rgba(38, 37, 36, 0.6)",
        backdropFilter: "blur(16px)",
        border: "1px solid #31302f",
        borderRadius: "16px",
        padding: "36px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>
        {/* Logo Section */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "28px" }}>
          <div className="auth-brand-logo">
            <Logo size={28} showText={true} />
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}>Create your account</h1>
        <p style={{ margin: "0 0 28px", color: "var(--color-text-secondary, #8b949e)", fontSize: "14px", lineHeight: "1.5" }}>
          Start tracking breakout repositories. Personalized radar, momentum scores, and pre-trend alerts.
        </p>

        {/* OAuth Buttons Container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {PROVIDERS.map((provider) => {
            const loading = loadingProvider === provider.key;
            return (
              <button
                key={provider.key}
                onClick={() => void startOAuth(provider.key)}
                disabled={!isReady || !!loadingProvider}
                className="auth-provider-btn"
              >
                {loading ? (
                  <ProfessionalLoader size={18} />
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", color: "var(--color-text-secondary)" }}>
                    {provider.icon}
                  </span>
                )}
                <span>
                  {loading ? `Redirecting to ${provider.key === "google" ? "Google" : "Discord"}…` : provider.label}
                </span>
              </button>
            );
          })}
        </div>

        {!isReady && (
          <p style={{ marginTop: "16px", color: "var(--color-text-tertiary, #6e7681)", fontSize: "12px", textAlign: "center", fontFamily: "var(--font-mono)" }}>
            // LOADING Clerk Auth module...
          </p>
        )}

        {error && (
          <div style={{
            marginTop: "16px",
            padding: "10px 14px",
            background: "rgba(248,81,73,0.08)",
            border: "1px solid rgba(248,81,73,0.25)",
            borderRadius: "8px"
          }}>
            <p style={{ margin: 0, color: "#f85149", fontSize: "13px", lineHeight: "1.4" }}>✕ {error}</p>
          </div>
        )}

        {/* Footers */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ margin: "0 0 10px", color: "var(--color-text-tertiary, #6e7681)", fontSize: "13px" }}>
            Already have an account?{" "}
            <Link href="/sign-in" className="auth-link">Sign in</Link>
          </p>
          <p style={{ margin: 0, color: "var(--color-text-tertiary, #6e7681)", fontSize: "13px" }}>
            <Link href="/landing" className="auth-link" style={{ color: "var(--color-text-tertiary, #6e7681)" }}>← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
