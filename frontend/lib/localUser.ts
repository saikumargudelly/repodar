/**
 * Anonymous local user — generates a stable UUID stored in localStorage.
 * Used as a drop-in replacement for Clerk's useUser() so the app works
 * without any auth service configured.
 */
import { useState, useEffect } from "react";

function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "local";
  let id = localStorage.getItem("repodar_user_id");
  if (!id) {
    id = "local-" + Math.random().toString(36).slice(2, 11);
    localStorage.setItem("repodar_user_id", id);
  }
  return id;
}

export function useLocalUser() {
  const [userId, setUserId] = useState<string>("local");

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  return { userId };
}
