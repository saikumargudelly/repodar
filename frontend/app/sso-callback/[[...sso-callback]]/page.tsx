"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// This page handles the OAuth callback from GitHub/Google/Discord.
// Clerk's AuthenticateWithRedirectCallback exchanges the OAuth code for a session
// and then redirects to the URL specified in redirectUrlComplete (/post-auth).
export default function SSOCallbackPage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "14px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: "12px", fontSize: "32px" }}>🎯</div>
        <p>Completing sign in…</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
