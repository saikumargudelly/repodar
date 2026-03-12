"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { api, DigestFrequency } from "@/lib/api";

type Step = "interests" | "watchlist" | "alerts" | "tour";

const STEP_ORDER: Step[] = ["interests", "watchlist", "alerts", "tour"];

const VERTICALS: Array<{ key: string; label: string }> = [
  { key: "ai_ml", label: "AI / ML" },
  { key: "devtools", label: "DevTools" },
  { key: "web_frameworks", label: "Web Frameworks" },
  { key: "security", label: "Security" },
  { key: "data_engineering", label: "Data Engineering" },
  { key: "blockchain", label: "Blockchain" },
  { key: "oss_tools", label: "OSS Tools" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState<Step>("interests");

  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<DigestFrequency>("daily");

  const [suggestedRepos, setSuggestedRepos] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace("/sign-in");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [status, overview] = await Promise.all([
          api.getOnboardingStatus(userId),
          api.getOverview(),
        ]);
        if (cancelled) return;

        if (status.onboarding_completed || status.current_step === "complete") {
          router.replace("/overview");
          return;
        }

        const nextStep = STEP_ORDER.includes(status.current_step as Step)
          ? (status.current_step as Step)
          : "interests";

        setStep(nextStep);
        setSelectedVerticals(status.selected_verticals ?? []);

        const picks = Array.from(
          new Set(
            (overview.top_breakout ?? [])
              .map((repo) => `${repo.owner}/${repo.name}`)
              .filter(Boolean)
          )
        ).slice(0, 8);
        setSuggestedRepos(picks);

        const primaryEmail = user?.primaryEmailAddress?.emailAddress ?? "";
        setEmail(primaryEmail);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Unable to load onboarding. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, router, user?.primaryEmailAddress?.emailAddress, userId]);

  const progressIndex = STEP_ORDER.indexOf(step);

  const canContinue = useMemo(() => {
    if (saving) return false;
    if (step === "interests") return selectedVerticals.length > 0;
    if (step === "alerts") return !!email;
    return true;
  }, [email, saving, selectedVerticals.length, step]);

  const toggleVertical = (vertical: string) => {
    setSelectedVerticals((prev) =>
      prev.includes(vertical) ? prev.filter((value) => value !== vertical) : [...prev, vertical]
    );
  };

  const toggleRepo = (slug: string) => {
    setSelectedRepos((prev) =>
      prev.includes(slug) ? prev.filter((value) => value !== slug) : [...prev, slug]
    );
  };

  const goBack = () => {
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) {
      setStep(STEP_ORDER[index - 1]);
    }
  };

  const saveCurrentStep = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");

    try {
      if (step === "interests") {
        await api.saveOnboardingInterests(userId, selectedVerticals);
        setStep("watchlist");
      } else if (step === "watchlist") {
        await api.saveOnboardingWatchlist(userId, selectedRepos);
        setStep("alerts");
      } else if (step === "alerts") {
        await api.saveOnboardingAlerts(userId, { email, frequency });
        setStep("tour");
      } else {
        await api.completeOnboarding(userId);
        router.replace("/overview");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to save this step. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const skipOnboarding = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      await api.skipOnboarding(userId);
      router.replace("/overview");
    } catch (err) {
      console.error(err);
      setError("Unable to skip onboarding right now.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        Preparing onboarding...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "grid", placeItems: "center", padding: "20px" }}>
      <div className="onboarding-card" style={{ width: "100%", maxWidth: "680px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--bg-surface)", padding: "28px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ margin: 0, fontSize: "30px", letterSpacing: "-0.02em" }}>Set up your radar</h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: "14px" }}>
            This takes under a minute and personalizes your feed.
          </p>
        </div>

        <div style={{ display: "flex", gap: "6px", marginBottom: "24px" }}>
          {STEP_ORDER.map((item, index) => (
            <div
              key={item}
              style={{
                height: "6px",
                flex: 1,
                borderRadius: "999px",
                background: index <= progressIndex ? "var(--accent-blue)" : "var(--bg-elevated)",
              }}
            />
          ))}
        </div>

        {step === "interests" && (
          <section>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>Choose your focus areas</h2>
            <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: "14px" }}>
              Pick the verticals you want to monitor first.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              {VERTICALS.map((vertical) => {
                const selected = selectedVerticals.includes(vertical.key);
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
          </section>
        )}

        {step === "watchlist" && (
          <section>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>Add your first watchlist repos</h2>
            <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: "14px" }}>
              Select repositories to receive momentum and spike alerts.
            </p>

            {suggestedRepos.length === 0 && (
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                No suggestions yet. You can continue and add repos later from any repo page.
              </p>
            )}

            <div style={{ display: "grid", gap: "8px" }}>
              {suggestedRepos.map((slug) => {
                const selected = selectedRepos.includes(slug);
                return (
                  <label
                    key={slug}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      background: "var(--bg-elevated)",
                      padding: "10px 12px",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleRepo(slug)} />
                    <span style={{ fontSize: "14px" }}>{slug}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {step === "alerts" && (
          <section>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>Configure alert delivery</h2>
            <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: "14px" }}>
              Choose where and how often we notify you.
            </p>

            <div style={{ display: "grid", gap: "12px" }}>
              <label style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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

              <label style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Frequency</span>
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as DigestFrequency)}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    padding: "10px 12px",
                    fontSize: "14px",
                  }}
                >
                  <option value="realtime">Realtime (every few hours)</option>
                  <option value="daily">Daily digest</option>
                  <option value="weekly">Weekly digest</option>
                  <option value="monthly">Monthly digest</option>
                  <option value="off">Off</option>
                </select>
              </label>
            </div>
          </section>
        )}

        {step === "tour" && (
          <section>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>You are ready</h2>
            <p style={{ margin: "0 0 14px", color: "var(--text-secondary)", fontSize: "14px" }}>
              Your workspace is configured. Next, explore the dashboard and watchlist.
            </p>
            <div style={{ display: "grid", gap: "8px", color: "var(--text-secondary)", fontSize: "14px" }}>
              <div>1. Track ecosystem momentum in `Overview` and `Radar`.</div>
              <div>2. Follow specific repositories in `Watchlist`.</div>
              <div>3. Review statistical alerts in the `Alerts` page.</div>
            </div>
          </section>
        )}

        {error && <p style={{ marginTop: "16px", color: "#ef4444", fontSize: "13px" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "24px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {step !== "interests" && (
              <button
                onClick={goBack}
                disabled={saving}
                style={{
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => void skipOnboarding()}
              disabled={saving}
              style={{
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                borderRadius: "8px",
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Skip
            </button>
            <button
              onClick={() => void saveCurrentStep()}
              disabled={!canContinue}
              style={{
                border: "1px solid var(--accent-blue)",
                background: "var(--accent-blue)",
                color: "#fff",
                borderRadius: "8px",
                padding: "10px 16px",
                cursor: canContinue ? "pointer" : "not-allowed",
                opacity: canContinue ? 1 : 0.6,
                fontWeight: 600,
              }}
            >
              {saving ? "Saving..." : step === "tour" ? "Open dashboard" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
