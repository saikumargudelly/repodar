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
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 8px" }}>
          {stage === "early" ? "🌱 Early Stage" : "🚀 Established Breakouts"}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
          {stage === "early"
            ? "Discover emerging repos with high momentum (< 90 days old)"
            : "Track mature projects with strong upward trajectory"}
        </p>
      </div>

      {/* Stage toggle */}
      <div style={{ display: "flex", gap: "8px" }}>
        {(["early", "established"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStage(s);
              setCategory("All");
              setMaxStars(s === "early" ? 1000 : 10000);
            }}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: stage === s ? "var(--accent-blue)" : "var(--bg-elevated)",
              color: stage === s ? "#fff" : "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {s === "early" ? "🌱 Early (< 90d, < 1k stars)" : "🚀 Established"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: "6px 10px",
            fontSize: "12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            color: "var(--text-primary)",
          }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {stage === "established" && (
          <select
            value={maxStars}
            onChange={(e) => setMaxStars(Number(e.target.value))}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-primary)",
            }}
          >
            <option value={10000}>All stars</option>
            <option value={5000}>< 5k stars</option>
            <option value={1000}>< 1k stars</option>
          </select>
        )}
      </div>

      {/* Table */}
      {!data || data.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          No repos found matching filters.
        </div>
      ) : (
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)" }}>
                  Repo
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                  ⭐ Stars
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                  Trend Score
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                  Accel.
                </th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: "var(--text-muted)" }}>
                  Health
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((repo: any) => (
                <tr
                  key={repo.repo_id}
                  onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                  style={{
                    borderTop: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-elevated)")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <a
                      href={repo.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: "var(--accent-blue)",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      {repo.owner}/{repo.name}
                    </a>
                    {repo.primary_language && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {repo.primary_language}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                    {repo.stars?.toLocaleString() || repo.current_stars?.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {repo.trend_score?.toFixed(4)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      color:
                        (repo.acceleration ?? 0) > 1
                          ? "var(--accent-blue)"
                          : "var(--text-primary)",
                    }}
                  >
                    {repo.acceleration?.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {repo.sustainability_label ? (
                      <SustainBadge label={repo.sustainability_label} />
                    ) : (
                      "—"
                    )}
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
