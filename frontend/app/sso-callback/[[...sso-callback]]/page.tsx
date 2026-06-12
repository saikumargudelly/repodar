"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// This page handles the OAuth callback from GitHub/Google/Discord.
// Clerk's AuthenticateWithRedirectCallback exchanges the OAuth code for a session
// and then redirects to the URL specified in redirectUrlComplete (/post-auth).
export default function SSOCallbackPage() {
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
        {/* Rasengan Loader */}
        <div style={{ position: "relative", width: "70px", height: "70px", margin: "0 auto 24px", display: "block" }}>
          {/* Outer Ring */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#38bdf8",
            borderBottomColor: "#38bdf8",
            animation: "rotate-cw 1.2s linear infinite",
          }} />
          {/* Inner Ring */}
          <div style={{
            position: "absolute",
            inset: "8px",
            borderRadius: "50%",
            border: "2.5px solid transparent",
            borderLeftColor: "#00e5ff",
            borderRightColor: "#00e5ff",
            animation: "rotate-ccw 0.8s linear infinite",
          }} />
          {/* Core */}
          <div style={{
            position: "absolute",
            inset: "20px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #ffffff 20%, #38bdf8 80%)",
            boxShadow: "0 0 16px #38bdf8, 0 0 32px rgba(56, 189, 248, 0.5)",
            animation: "pulse-center 0.6s infinite alternate",
          }} />
        </div>

        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
          SSO Authentication
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
          lineHeight: "1.6",
        }}>
          <div style={{ color: "#3fb950" }}>✔ OAuth connection verified</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>⚡ Completing sign in</span>
            <span className="terminal-cursor" />
          </div>
        </div>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
