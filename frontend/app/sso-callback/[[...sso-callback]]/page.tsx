"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";


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
        <div style={{ marginBottom: "24px" }}>
          <ProfessionalLoader size={60} />
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
