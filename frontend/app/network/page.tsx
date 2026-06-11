"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NetworkRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/leaderboard?tab=network");
  }, [router]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#0d1117" }}>
      <div style={{ fontFamily: "var(--font-mono)", color: "#6e7681", fontSize: "12px" }}>
        Redirecting to Leaderboard & contributor network...
      </div>
    </div>
  );
}
