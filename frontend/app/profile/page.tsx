"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignOutButton, useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, DigestFrequency, ProfilePreferencesPatchBody } from "@/lib/api";

const VERTICALS: Array<{ key: string; label: string }> = [
  { key: "ai_ml",      label: "AI / ML" },
  { key: "devtools",   label: "DevTools" },
  { key: "web_mobile", label: "Web & Mobile" },
  { key: "data_infra", label: "Data & Infrastructure" },
  { key: "security",   label: "Security" },
  { key: "blockchain", label: "Blockchain" },
  { key: "oss_tools",  label: "OSS Tools" },
  { key: "science",    label: "Science & Research" },
  { key: "creative",   label: "Creative & Gaming" },
];

const DIGEST_OPTIONS: Array<{ value: DigestFrequency; label: string; helper: string }> = [
  { value: "off", label: "Off", helper: "Do not send digest emails." },
  { value: "daily", label: "Daily", helper: "Receive a daily summary of alerts and breakouts." },
  { value: "weekly", label: "Weekly", helper: "Receive one digest each Monday." },
  { value: "monthly", label: "Monthly", helper: "Receive one digest at the start of each month." },
  { value: "realtime", label: "Realtime (legacy)", helper: "Maintains your previous setting from onboarding." },
];

type FormState = {
  email: string;
  digest_frequency: DigestFrequency;
  verticals: string[];
};

function normalizeForm(state: FormState): FormState {
  return {
    email: state.email.trim(),
    digest_frequency: state.digest_frequency,
    verticals: [...state.verticals].sort(),
  };
}

export default function ProfilePage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    email: "",
    digest_frequency: "weekly",
    verticals: [],
  });
  const [initialForm, setInitialForm] = useState<FormState | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "No primary email available";
  const firstName = user?.firstName ?? "Not available";
  const lastName = user?.lastName ?? "Not available";
  const derivedFullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const fullName = user?.fullName ?? (derivedFullName || "Unnamed account");
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || fullName.slice(0, 2).toUpperCase();

  const preferencesQuery = useQuery({
    queryKey: ["profile-preferences", userId],
    queryFn: () => api.getProfilePreferences(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!preferencesQuery.data) {
      return;
    }
    const next: FormState = {
      email: preferencesQuery.data.email ?? user?.primaryEmailAddress?.emailAddress ?? "",
      digest_frequency: preferencesQuery.data.digest_frequency,
      verticals: preferencesQuery.data.verticals ?? [],
    };
    setForm(next);
    setInitialForm(next);
  }, [preferencesQuery.data, user?.primaryEmailAddress?.emailAddress]);

  const saveMutation = useMutation({
    mutationFn: (payload: ProfilePreferencesPatchBody) => api.updateProfilePreferences(userId!, payload),
    onSuccess: (updated) => {
      const next: FormState = {
        email: updated.email ?? "",
        digest_frequency: updated.digest_frequency,
        verticals: updated.verticals ?? [],
      };
      setForm(next);
      setInitialForm(next);
      setFeedback("Preferences updated successfully.");
      queryClient.setQueryData(["profile-preferences", userId], updated);
    },
    onError: (error: Error) => {
      setFeedback(error.message || "Failed to save preferences.");
    },
  });

  const isDirty = useMemo(() => {
    if (!initialForm) {
      return false;
    }
    const current = normalizeForm(form);
    const initial = normalizeForm(initialForm);
    return (
      current.email !== initial.email
      || current.digest_frequency !== initial.digest_frequency
      || JSON.stringify(current.verticals) !== JSON.stringify(initial.verticals)
    );
  }, [form, initialForm]);

  const canSave = form.email.trim().length > 0 && isDirty && !saveMutation.isPending;

  const toggleVertical = (vertical: string) => {
    setFeedback("");
    setForm((prev) => ({
      ...prev,
      verticals: prev.verticals.includes(vertical)
        ? prev.verticals.filter((value) => value !== vertical)
        : [...prev.verticals, vertical],
    }));
  };

  const handleSubmit = () => {
    if (!userId) {
      return;
    }

    const trimmedEmail = form.email.trim();
    if (!trimmedEmail) {
      setFeedback("Email is required for digest subscriptions.");
      return;
    }

    setFeedback("");
    saveMutation.mutate({
      email: trimmedEmail,
      digest_frequency: form.digest_frequency,
      verticals: form.verticals,
    });
  };

  if (!isLoaded) {
    return (
      <div className="page-root">
        <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Loading account...</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="page-root">
        <div className="panel" style={{ padding: "24px", maxWidth: "540px" }}>
          <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Sign in to manage your profile</div>
          <p style={{ margin: "0 0 14px", color: "var(--text-secondary)", fontSize: "14px" }}>
            Preferences and digest subscriptions are tied to your account.
          </p>
          <Link href="/sign-in" className="btn-cyber btn-cyber-cyan" style={{ display: "inline-block", textDecoration: "none", padding: "8px 14px" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (preferencesQuery.isLoading && !initialForm) {
    return (
      <div className="page-root">
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px" }}>
          // LOADING PROFILE PREFERENCES<span className="terminal-cursor" />
        </div>
      </div>
    );
  }

  if (preferencesQuery.isError && !initialForm) {
    return (
      <div className="page-root">
        <div className="panel" style={{ border: "1px solid var(--pink)", maxWidth: "620px" }}>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", margin: 0, fontSize: "12px" }}>
            ✕ FAILED TO LOAD PROFILE PREFERENCES
          </p>
          <button
            onClick={() => void preferencesQuery.refetch()}
            style={{
              marginTop: "12px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-primary)",
              borderRadius: "8px",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root" style={{ maxWidth: "980px", margin: "0 auto", width: "100%" }}>
      <div>
        <div className="section-title-cyber">PROFILE<span className="terminal-cursor" /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          // Manage your personalization and digest subscriptions
        </div>
      </div>

      <div className="panel" style={{ padding: "18px", display: "flex", justifyContent: "space-between", gap: "18px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "center", minWidth: 0 }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "999px",
              background: "var(--accent-blue)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
              {fullName}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Signed in as {accountEmail}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "6px", fontFamily: "var(--font-mono)" }}>
              Clerk user ID: {userId}
            </div>
          </div>
        </div>

        <SignOutButton redirectUrl="/landing">
          <button
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </SignOutButton>
      </div>

      <div className="panel" style={{ padding: "18px", display: "grid", gap: "12px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Account Details
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {[
            { label: "Full name", value: fullName },
            { label: "First name", value: firstName },
            { label: "Last name", value: lastName },
            { label: "Main login email", value: accountEmail },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--bg-elevated)",
                padding: "12px",
                display: "grid",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {item.label}
              </span>
              <span style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600, wordBreak: "break-word" }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ padding: "18px", display: "grid", gap: "14px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Digest Email
        </div>
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>Digest destination</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => {
              setFeedback("");
              setForm((prev) => ({ ...prev, email: event.target.value }));
            }}
            placeholder="you@example.com"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "8px",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              padding: "10px 12px",
              fontSize: "14px",
            }}
          />
        </label>
      </div>

      <div className="panel" style={{ padding: "18px", display: "grid", gap: "12px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Digest Frequency
        </div>
        <div style={{ display: "grid", gap: "8px" }}>
          {DIGEST_OPTIONS.map((option) => {
            const active = form.digest_frequency === option.value;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setFeedback("");
                  setForm((prev) => ({ ...prev, digest_frequency: option.value }));
                }}
                style={{
                  border: active ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                  background: active ? "var(--accent-blue)1f" : "var(--bg-elevated)",
                  color: active ? "var(--accent-blue)" : "var(--text-primary)",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "grid",
                  gap: "4px",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "13px" }}>{option.label}</span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{option.helper}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ padding: "18px", display: "grid", gap: "12px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Vertical Preferences
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          {VERTICALS.map((vertical) => {
            const selected = form.verticals.includes(vertical.key);
            return (
              <button
                key={vertical.key}
                onClick={() => toggleVertical(vertical.key)}
                style={{
                  border: selected ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                  background: selected ? "var(--accent-blue)1f" : "var(--bg-elevated)",
                  color: selected ? "var(--accent-blue)" : "var(--text-primary)",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                {vertical.label}
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div className="panel" style={{ border: feedback.includes("success") || feedback.includes("updated") ? "1px solid var(--green)" : "1px solid var(--pink)" }}>
          <p style={{ margin: 0, fontSize: "13px", color: feedback.includes("success") || feedback.includes("updated") ? "var(--green)" : "var(--pink)" }}>
            {feedback}
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSubmit}
          disabled={!canSave}
          className="btn-cyber btn-cyber-cyan"
          style={{
            padding: "10px 16px",
            opacity: canSave ? 1 : 0.6,
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {saveMutation.isPending ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
