"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, RadarRepo, EarlyRadarRepo } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

const BREAKOUT_CATEGORIES = [
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

const EARLY_CATEGORIES = [
  "All",
  "model_training",
  "inference_serving",
  "data_pipeline",
  "vector_database",
  "evaluation",
  "agents_orchestration",
  "fine_tuning",
  "multimodal",
  "rlhf_alignment",
  "deployment_infra",
];

type Stage = "early" | "established";

export default function InsightsPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("early");
  const [category, setCategory] = useState("All");
  const [maxStars, setMaxStars] = useState(stage === "early" ? 1000 : 10000);

  // Fetch both datasets
  const { data: radarData } = useQuery({
    queryKey: ["radar", false],
    queryFn: () => api.getRadar(false),
  });

  const { data: earlyData } = useQuery({
    queryKey: ["early-radar-insights", maxStars],
    queryFn: () =>
      api.getEarlyRadar({
        max_age_days: 90,
        max_stars: maxStars,
        min_acceleration: 0,
        category: category !== "All" ? category : undefined,
        limit: 100,
      }),
  });

  const data =
    stage === "early"
      ? earlyData?.filter((r) => category === "All" || r.category === category)
      : radarData?.filter((r) => category === "All" || r.category === category);

  const categories = stage === "early" ? EARLY_CATEGORIES : BREAKOUT_CATEGORIES;

  return (
    <div className="page-root">
      {/* Header */}
      <div>
        <div className="section-title-cyber">
          {stage === "early" ? "EARLY STAGE" : "ESTABLISHED BREAKOUTS"}<span className="terminal-cursor" />
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
          {stage === "early"
            ? "// Emerging repos with high momentum · less than 90 days old"
            : "// Mature projects with strong upward trajectory"}
        </div>
      </div>

      {/* Stage toggle */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {(["early", "established"] as const).map((s) => (
          <button key={s}
            onClick={() => { setStage(s); setCategory("All"); setMaxStars(s === "early" ? 1000 : 10000); }}
            className={`filter-btn-cyber${stage === s ? " active" : ""}`}>
            {s === "early" ? "◈ Early (< 90d)" : "▲ Established"}
          </button>
        ))}
        <span style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px", alignSelf: "center" }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="cyber-select">
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        {stage === "established" && (
          <select value={maxStars} onChange={(e) => setMaxStars(Number(e.target.value))} className="cyber-select">
            <option value={10000}>All stars</option>
            <option value={5000}>Under 5k</option>
            <option value={1000}>Under 1k</option>
          </select>
        )}
      </div>

      {/* Table */}
      {!data || data.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "40px 0",
          textAlign: "center", fontSize: "12px", letterSpacing: "0.06em" }}>
          // NO REPOS FOUND<span className="terminal-cursor" />
        </div>
      ) : (
        <div className="panel table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th className="th-mono">REPO</th>
                <th className="th-mono" style={{ textAlign: "right" }}>STARS</th>
                <th className="th-mono" style={{ textAlign: "right" }}>TREND SCORE</th>
                <th className="th-mono" style={{ textAlign: "right" }}>ACCEL.</th>
                <th className="th-mono" style={{ textAlign: "center" }}>HEALTH</th>
              </tr>
            </thead>
            <tbody>
              {data.map((repo: any) => (
                <tr key={repo.repo_id} className="tr-cyber"
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cyan)",
                      fontWeight: 600 }}>
                      {repo.owner}/{repo.name}
                    </span>
                    {repo.primary_language && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                        color: "var(--text-muted)", marginLeft: "8px" }}>
                        {repo.primary_language}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right",
                    fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>
                    {(repo.stars ?? repo.current_stars ?? 0).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right",
                    fontFamily: "var(--font-mono)", color: "var(--amber)" }}>
                    {repo.trend_score?.toFixed(4) ?? "—"}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)",
                    color: (repo.acceleration ?? 0) > 1 ? "var(--green)" : "var(--text-primary)" }}>
                    {repo.acceleration?.toFixed(2) ?? "—"}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                    {repo.sustainability_label
                      ? <SustainBadge label={repo.sustainability_label} />
                      : <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
