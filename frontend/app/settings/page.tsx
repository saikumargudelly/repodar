import { Metadata } from "next";
import { AlertRulesManager } from "@/components/alerts/AlertRulesManager";

export const metadata: Metadata = {
  title: "Settings | Repodar",
  description: "Configure your Repodar preferences and alerts",
};

export default function SettingsPage() {
  return (
    <div className="page-root" style={{ maxWidth: "980px", margin: "0 auto", width: "100%" }}>
      <div>
        <div className="page-eyebrow">Manage your account preferences, webhooks, and notifications</div>
        <h1 className="page-title">Settings</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <section>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px", fontFamily: "var(--font-sans)" }}>
            Automation & Alerts
          </h2>
          <AlertRulesManager />
        </section>
        
        {/* Further settings like Theme, API keys, etc can go here later */}
      </div>
    </div>
  );
}
