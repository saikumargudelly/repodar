"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, RadarRepo, LanguageStat } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportCSV(data: any[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(","), ...data.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))];
  downloadBlob(rows.join("\n"), filename, "text/csv");
}
function exportJSON(data: any[], filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json");
}

const CATEGORIES = [
  "All",
  "LLM Models",
  "Agent Frameworks",
  "Inference Engines",
  "Vector Databases",
  "Model Serving / Runtimes",
  "Distributed Compute / Infra",
  "Evaluation Frameworks",
  "Fine-tuning Toolkits",
];

type SortKey = "trend_score" | "acceleration" | "star_velocity_7d" | "age_days" | "sustainability_score";

export default function RadarPage() {
  const router = useRouter();
  const [newOnly, setNewOnly] = useState(false);
  const [category, setCategory] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("trend_score");

  const { data, isLoading } = useQuery({
    queryKey: ["radar", newOnly],
    queryFn: () => api.getRadar(newOnly),
  });

  const { data: langData } = useQuery({
    queryKey: ["language-radar"],
    queryFn: () => api.getLanguageRadar(2),
  });

  const filtered = data
    ? data
        .filter((r) => category === "All" || r.category === category)
        .sort((a, b) => {
          if (sortKey === "age_days") return a[sortKey] - b[sortKey];
          return (b[sortKey] as number) - (a[sortKey] as number);
        })
    : [];

  return (
    <div className="page-root">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div className="section-title-cyber">BREAKOUT RADAR<span className="terminal-cursor" /></div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
            // {filtered.length} repos ranked by signal strength
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)",
            fontSize: "11px", color: "var(--text-muted)", cursor: "pointer", letterSpacing: "0.06em" }}>
            <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)}
              style={{ accentColor: "var(--cyan)" }} />
            NEW ONLY (&lt;180D)
          </label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="cyber-select">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Sort bar + export */}
      <div className="scroll-selector" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["trend_score", "acceleration", "star_velocity_7d", "sustainability_score", "age_days"] as SortKey[]).map((key) => (
            <button key={key} onClick={() => setSortKey(key)}
              className={`filter-btn-cyber${sortKey === key ? " active" : ""}`}>
              {key.replace(/_/g, " ").toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button onClick={() => exportCSV(filtered, `radar-${category.replace(/ /g, "_")}-${sortKey}.csv`)}
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", background: "transparent",
              border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 10px", cursor: "pointer" }}>
            ↓ CSV
          </button>
          <button onClick={() => exportJSON(filtered, `radar-${category.replace(/ /g, "_")}-${sortKey}.json`)}
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", background: "transparent",
              border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 10px", cursor: "pointer" }}>
            ↓ JSON
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="panel table-scroll">
        {isLoading ? (
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center", padding: "60px 0",
            fontSize: "12px", letterSpacing: "0.06em" }}>
            // LOADING RADAR DATA<span className="terminal-cursor" />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {["#", "REPO", "CATEGORY", "TREND SCORE", "STARS/D", "ACCEL.", "SUSTAIN.", "LABEL", "AGE"].map((h) => (
                  <th key={h} className="th-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((repo, i) => (
                <RadarRow key={repo.repo_id} repo={repo} rank={i + 1} onClick={() => router.push(`/repo/${repo.repo_id}`)} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "40px", textAlign: "center",
                    fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
                    // NO DATA — run the pipeline via POST /admin/run-all
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Language & Tech Stack Radar */}
      <div className="panel table-scroll">
        <div className="panel-header">
          <div>
            <div className="panel-title">⬡ Language &amp; Tech Stack Radar</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
              // Languages ranked by combined 7-day star velocity across AI/ML repos
            </div>
          </div>
        </div>
        {!langData || langData.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "center",
            padding: "40px 0", fontSize: "11px", letterSpacing: "0.06em" }}>
            // NO LANGUAGE DATA
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {["#", "LANGUAGE", "REPOS", "WEEKLY STAR VEL.", "AVG TREND SCORE", "AVG SUSTAIN.", "TOP REPO", "CATEGORIES"].map((h) => (
                  <th key={h} className="th-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {langData.map((lang) => <LangRow key={lang.language} lang={lang} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LangRow({ lang }: { lang: LanguageStat }) {
  const vel = lang.weekly_star_velocity;
  const velColor = vel > 100 ? "var(--green)" : vel > 20 ? "var(--cyan)" : "var(--text-secondary)";
  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>{String(lang.growth_rank).padStart(2, "0")}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>{lang.language}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)" }}>{lang.repo_count}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: velColor }}>
        +{vel.toFixed(0)}/wk
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--amber)" }}>{lang.avg_trend_score.toFixed(4)}</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)" }}>{(lang.avg_sustainability_score * 100).toFixed(0)}%</td>
      <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
        {lang.top_repo ?? "—"}
      </td>
      <td style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {lang.categories.slice(0, 3).map((c) => (
            <span key={c} className="cyber-tag">{c}</span>
          ))}
          {lang.categories.length > 3 && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>+{lang.categories.length - 3}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function RadarRow({ repo, rank, onClick }: { repo: RadarRepo; rank: number; onClick: () => void }) {
  return (
    <tr className="tr-cyber" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={onClick}>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>{String(rank).padStart(2, "0")}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>
        <span style={{ color: "var(--text-muted)" }}>{repo.owner}/</span><span style={{ fontWeight: 600, color: "var(--cyan)" }}>{repo.name}</span>
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.04em" }}>{repo.category}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--amber)" }}>
        {repo.trend_score.toFixed(4)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>{repo.star_velocity_7d.toFixed(1)}</td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)",
        color: repo.acceleration > 0 ? "var(--green)" : "var(--pink)" }}>
        {repo.acceleration > 0 ? "▲" : "▼"} {Math.abs(repo.acceleration).toFixed(3)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)" }}>
        {(repo.sustainability_score * 100).toFixed(0)}%
      </td>
      <td style={{ padding: "11px 16px" }}>
        <SustainBadge label={repo.sustainability_label} />
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>{repo.age_days}d</td>
    </tr>
  );
}
