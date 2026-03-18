import { Metadata } from "next";
import { AlertRulesManager } from "@/components/alerts/AlertRulesManager";

export const metadata: Metadata = {
  title: "Settings | Repodar",
  description: "Configure your Repodar preferences and alerts",
};

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account preferences, webhooks, and notifications.</p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Automation & Alerts</h2>
          <AlertRulesManager />
        </section>
        
        {/* Further settings like Theme, API keys, etc can go here later */}
      </div>
    </div>
  );
}
