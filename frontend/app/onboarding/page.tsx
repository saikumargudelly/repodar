"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { api, DigestFrequency } from "@/lib/api";
import { ProfessionalLoader } from "@/components/ProfessionalLoader";


type Step = "interests" | "watchlist" | "alerts" | "tour";

const STEP_ORDER: Step[] = ["interests", "watchlist", "alerts", "tour"];

const VERTICALS = [
  { key: "ai_ml",      label: "AI / ML" },
  { key: "devtools",   label: "DevTools" },
  { key: "web_mobile", label: "Web & Mobile" },
  { key: "security",   label: "Security" },
  { key: "data_infra", label: "Data & Infrastructure" },
  { key: "blockchain", label: "Blockchain" },
  { key: "oss_tools",  label: "OSS Tools" },
  { key: "science",    label: "Science & Research" },
  { key: "creative",   label: "Creative & Gaming" },
];

const VERTICAL_METADATA: Record<string, { element: string; color: string; shadow: string; bg: string }> = {
  ai_ml: { element: "Fire", color: "#f85149", shadow: "rgba(248, 81, 73, 0.2)", bg: "rgba(248, 81, 73, 0.05)" },
  devtools: { element: "Wind", color: "#d29922", shadow: "rgba(210, 153, 34, 0.2)", bg: "rgba(210, 153, 34, 0.05)" },
  web_mobile: { element: "Water", color: "#38bdf8", shadow: "rgba(56, 189, 248, 0.2)", bg: "rgba(56, 189, 248, 0.05)" },
  security: { element: "Earth", color: "#3fb950", shadow: "rgba(63, 185, 80, 0.2)", bg: "rgba(63, 185, 80, 0.05)" },
  data_infra: { element: "Lightning", color: "#a78bfa", shadow: "rgba(167, 139, 250, 0.2)", bg: "rgba(167, 139, 250, 0.05)" },
  blockchain: { element: "Void", color: "#fb923c", shadow: "rgba(251, 146, 60, 0.2)", bg: "rgba(251, 146, 60, 0.05)" },
  oss_tools: { element: "Metal", color: "#e6edf3", shadow: "rgba(230, 237, 243, 0.15)", bg: "rgba(230, 237, 243, 0.03)" },
  science: { element: "Wood", color: "#84cc16", shadow: "rgba(132, 204, 22, 0.2)", bg: "rgba(132, 204, 22, 0.05)" },
  creative: { element: "Yin-Yang", color: "#ec4899", shadow: "rgba(236, 72, 153, 0.2)", bg: "rgba(236, 72, 153, 0.05)" },
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, userId, getToken } = useAuth();
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
        const token = await getToken();
        if (!token) {
          if (!cancelled) setError("Authentication token missing. Please sign in again.");
          return;
        }

        const resetRequested = searchParams.get("reset") === "true";
        if (resetRequested) {
          try {
            await api.resetOnboarding(token);
          } catch (resetErr) {
            console.warn("Failed to reset onboarding in backend:", resetErr);
          }
        }

        const [status, overview] = await Promise.all([
          api.getOnboardingStatus(token),
          api.getOverview(),
        ]);
        if (cancelled) return;

        if (!resetRequested && (status.onboarding_completed || status.current_step === "complete")) {
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
  }, [isLoaded, router, user?.primaryEmailAddress?.emailAddress, userId, searchParams, getToken]);

  const progressIndex = STEP_ORDER.indexOf(step);

  const headbandWidthPercent = useMemo(() => {
    return (progressIndex / (STEP_ORDER.length - 1)) * 100;
  }, [progressIndex]);

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
    const token = await getToken();
    if (!token) {
      setError("Authentication token missing. Please sign in again.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      if (step === "interests") {
        await api.saveOnboardingInterests(token, selectedVerticals);
        setStep("watchlist");
      } else if (step === "watchlist") {
        await api.saveOnboardingWatchlist(token, selectedRepos);
        setStep("alerts");
      } else if (step === "alerts") {
        await api.saveOnboardingAlerts(token, { email, frequency });
        setStep("tour");
      } else {
        await api.completeOnboarding(token);
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
    const token = await getToken();
    if (!token) {
      setError("Authentication token missing. Please sign in again.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.skipOnboarding(token);
      router.replace("/overview");
    } catch (err) {
      console.error(err);
      setError("Unable to skip onboarding right now.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, #111520 0%, #07090e 100%)",
        color: "var(--color-text-primary, #e6edf3)",
        fontFamily: "var(--font-sans, system-ui)",
      }}>
        <ProfessionalLoader size={50} text="Preparing onboarding setup..." />
      </div>
    );
  }


  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at center, #141a29 0%, #07090e 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font-sans, system-ui)",
      color: "var(--color-text-primary, #e6edf3)",
    }}>
      <style>{`
        .onboarding-card {
          width: 100%;
          max-width: 680px;
          background: rgba(22, 27, 34, 0.45);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 36px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        }
        .onboarding-title {
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--color-text-primary, #e6edf3);
          margin: 0;
        }
        .onboarding-btn {
          font-family: var(--font-sans, system-ui);
          font-size: 13px;
          font-weight: 600;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: var(--color-text-primary, #e6edf3);
        }
        .onboarding-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .onboarding-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .onboarding-btn-primary {
          background: var(--accent-blue, #38bdf8);
          border-color: var(--accent-blue, #38bdf8);
          color: #ffffff;
        }
        .onboarding-btn-primary:hover:not(:disabled) {
          background: #00e5ff;
          border-color: #00e5ff;
          box-shadow: 0 0 16px rgba(0, 229, 255, 0.3);
        }
        .element-card {
          border: 1.2px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.015);
          border-radius: 10px;
          padding: 14px 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .element-card:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.04);
        }
        .element-card.selected {
          background: var(--selected-bg);
          border-color: var(--selected-color);
          box-shadow: 0 0 16px var(--selected-shadow);
        }
        .element-badge {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--selected-shadow);
          color: var(--selected-color);
          margin-bottom: 6px;
          display: inline-block;
        }
        .repo-card {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.015);
          border-radius: 10px;
          padding: 12px 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .repo-card:hover {
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(255, 255, 255, 0.12);
        }
        .repo-card.selected {
          border-color: #3fb950;
          background: rgba(63, 185, 80, 0.06);
          box-shadow: 0 0 12px rgba(63, 185, 80, 0.1);
        }
        .onboarding-input, .onboarding-select {
          width: 100%;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: var(--color-text-primary, #e6edf3);
          font-family: var(--font-sans, system-ui);
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
        }
        .onboarding-input:focus, .onboarding-select:focus {
          border-color: var(--accent-blue, #38bdf8);
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.15);
          background: rgba(0, 0, 0, 0.35);
        }
        .tour-step-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
        }
        .headband-container {
          display: flex;
          align-items: center;
          position: relative;
          margin-bottom: 32px;
        }
        .headband-line {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.06);
          transform: translateY(-50%);
          z-index: 1;
        }
        .headband-line-active {
          position: absolute;
          top: 50%;
          left: 0;
          height: 3px;
          background: var(--accent-blue, #38bdf8);
          transform: translateY(-50%);
          z-index: 2;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .headband-node {
          position: relative;
          z-index: 3;
          flex: 1;
          display: flex;
          justify-content: center;
        }
        .headband-metal-plate {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #0d1117;
          border: 3px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 0 3px #0d1117;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .headband-node.active .headband-metal-plate {
          border-color: var(--accent-blue, #38bdf8);
          background: #38bdf8;
          box-shadow: 0 0 16px var(--accent-blue, #38bdf8), 0 0 0 3px #0d1117;
        }
        .headband-node.completed .headband-metal-plate {
          border-color: #3fb950;
          background: #3fb950;
          box-shadow: 0 0 16px rgba(63, 185, 80, 0.3), 0 0 0 3px #0d1117;
        }
        .headband-label {
          position: absolute;
          top: 28px;
          font-size: 10px;
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          transition: color 0.3s;
        }
        .headband-node.active .headband-label {
          color: var(--accent-blue, #38bdf8);
        }
        .headband-node.completed .headband-label {
          color: #3fb950;
        }
      `}</style>

      <div className="onboarding-card">
        {/* Header Block */}
        <div style={{ marginBottom: "28px" }}>
          <h1 className="onboarding-title" style={{ fontSize: "28px" }}>Set up your radar</h1>
          <p style={{ margin: "6px 0 0", color: "var(--color-text-secondary, #8b949e)", fontSize: "14px", lineHeight: "1.5" }}>
            This takes under a minute and personalizes your feed.
          </p>
        </div>

        {/* Headband Progress bar */}
        <div className="headband-container">
          <div className="headband-line" />
          <div className="headband-line-active" style={{ width: `${headbandWidthPercent}%` }} />
          {STEP_ORDER.map((item, idx) => {
            const isActive = step === item;
            const isCompleted = progressIndex > idx;
            return (
              <div key={item} className={`headband-node ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`} onClick={() => !saving && progressIndex >= idx && setStep(item)}>
                <div className="headband-metal-plate" />
                <span className="headband-label">{item}</span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div style={{ minHeight: "240px", marginTop: "16px" }}>
          {step === "interests" && (
            <section>
              <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700 }}>Choose your focus areas</h2>
              <p style={{ margin: "0 0 20px", color: "var(--color-text-secondary, #8b949e)", fontSize: "14px" }}>
                Pick the verticals you want to monitor first.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                {VERTICALS.map((vertical) => {
                  const selected = selectedVerticals.includes(vertical.key);
                  const meta = VERTICAL_METADATA[vertical.key] || { element: "Chakra", color: "#ffffff", shadow: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.02)" };
                  return (
                    <button
                      key={vertical.key}
                      onClick={() => toggleVertical(vertical.key)}
                      className={`element-card ${selected ? "selected" : ""}`}
                      style={{
                        "--selected-bg": meta.bg,
                        "--selected-color": meta.color,
                        "--selected-shadow": meta.shadow,
                      } as React.CSSProperties}
                    >
                      <span className="element-badge" style={{
                        "--selected-color": meta.color,
                        "--selected-shadow": meta.shadow,
                      } as React.CSSProperties}>
                        {meta.element}
                      </span>
                      <div style={{ fontSize: "13px", fontWeight: 700 }}>
                        {vertical.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === "watchlist" && (
            <section>
              <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700 }}>Add your first watchlist repos</h2>
              <p style={{ margin: "0 0 20px", color: "var(--color-text-secondary, #8b949e)", fontSize: "14px" }}>
                Select repositories to receive momentum and spike alerts.
              </p>

              {suggestedRepos.length === 0 ? (
                <p style={{ color: "var(--color-text-tertiary, #6e7681)", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
                  // No suggestions yet. You can add repos later from any repo page.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" }}>
                  {suggestedRepos.map((slug) => {
                    const selected = selectedRepos.includes(slug);
                    return (
                      <div
                        key={slug}
                        onClick={() => toggleRepo(slug)}
                        className={`repo-card ${selected ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {}} // toggled by parent click
                          style={{ accentColor: "#3fb950", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{slug}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {step === "alerts" && (
            <section>
              <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700 }}>Configure alert delivery</h2>
              <p style={{ margin: "0 0 20px", color: "var(--color-text-secondary, #8b949e)", fontSize: "14px" }}>
                Choose where and how often we notify you.
              </p>

              <div style={{ display: "grid", gap: "18px", maxWidth: "480px" }}>
                <label style={{ display: "grid", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-tertiary, #6e7681)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    [EMAIL ADDRESS]
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="onboarding-input"
                  />
                </label>

                <label style={{ display: "grid", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-tertiary, #6e7681)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    [DIGEST FREQUENCY]
                  </span>
                  <select
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value as DigestFrequency)}
                    className="onboarding-select"
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
              <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700 }}>Workspace configured</h2>
              <p style={{ margin: "0 0 20px", color: "var(--color-text-secondary, #8b949e)", fontSize: "14px" }}>
                Your settings are saved. Here is what you can do next:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {[
                  { icon: "📈", text: "Track ecosystem momentum in Overview and Radar" },
                  { icon: "★", text: "Follow specific repositories in Watchlist" },
                  { icon: "🔔", text: "Review statistical alerts on the Alerts page" }
                ].map((item, idx) => (
                  <div key={idx} className="tour-step-row">
                    <span style={{ fontSize: "16px", lineHeight: 1 }}>{item.icon}</span>
                    <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Pulsing Konoha Seal animation for Step 4 */}
              <div style={{ display: "flex", justifyContent: "center", margin: "24px 0" }}>
                <svg viewBox="0 0 100 100" width="70" height="70" fill="none" stroke="var(--accent-blue, #38bdf8)" strokeWidth="3" style={{ animation: "pulse-center 1.5s infinite" }}>
                  <path d="M 50 15 C 30 15 20 30 20 50 C 20 70 35 85 50 85 C 65 85 80 70 80 50 C 80 35 70 20 50 20 C 40 20 35 25 35 35 C 35 45 45 50 50 50 C 55 50 60 45 60 40 C 60 38 58 35 55 35" strokeLinecap="round" />
                  <circle cx="55" cy="35" r="2.5" fill="var(--accent-blue, #38bdf8)" />
                  <path d="M 20 50 Q 10 50 15 45" strokeLinecap="round" />
                </svg>
              </div>
            </section>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: "16px",
            padding: "10px 14px",
            background: "rgba(248,81,73,0.08)",
            border: "1px solid rgba(248,81,73,0.25)",
            borderRadius: "8px"
          }}>
            <p style={{ margin: 0, color: "#f85149", fontSize: "13px" }}>✕ {error}</p>
          </div>
        )}

        {/* Buttons Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "32px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
          <div>
            {step !== "interests" && (
              <button
                onClick={goBack}
                disabled={saving}
                className="onboarding-btn"
              >
                Back
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => void skipOnboarding()}
              disabled={saving}
              className="onboarding-btn"
            >
              Skip
            </button>
            <button
              onClick={() => void saveCurrentStep()}
              disabled={!canContinue}
              className="onboarding-btn onboarding-btn-primary"
            >
              {saving ? "Saving..." : step === "tour" ? "Open Dashboard" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
