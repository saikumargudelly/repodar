"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, RadarRepo, LanguageStat } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

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
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Breakout Radar</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
            All repos ranked by signal strength. {filtered.length} showing.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={newOnly}
              onChange={(e) => setNewOnly(e.target.checked)}
              style={{ accentColor: "var(--accent-blue)" }}
            />
            New only (&lt;180d)
          </label>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              padding: "6px 10px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sort bar */}
      <div className="scroll-selector" style={{ display: "flex" }}>
        <div style={{ display: "flex", gap: "6px" }}>
        {(["trend_score", "acceleration", "star_velocity_7d", "sustainability_score", "age_days"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              border: "1px solid var(--border)",
              background: sortKey === key ? "var(--accent-blue)" : "var(--bg-surface)",
              color: sortKey === key ? "white" : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: sortKey === key ? 600 : 400,
            }}
          >
            {key.replace(/_/g, " ")}
          </button>
        ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-scroll" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "60px 0" }}>Loading radar data...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                {["#", "Repo", "Category", "Trend Score", "Stars/d", "Accel.", "Sustain. Score", "Label", "Age"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 500, fontSize: "11px", letterSpacing: "0.5px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((repo, i) => (
                <RadarRow key={repo.repo_id} repo={repo} rank={i + 1} onClick={() => router.push(`/repo/${repo.repo_id}`)} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    No repos with scores yet. Run the pipeline first via <code>POST /admin/run-all</code>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Language & Tech Stack Radar ─────────────────────────────────── */}
      <div className="table-scroll" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 4px" }}>
            Language &amp; Tech Stack Radar
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            Which programming languages are growing fastest across tracked AI/ML repos — ranked by combined 7-day star velocity.
          </p>
        </div>
        {!langData || langData.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0", fontSize: "13px" }}>
            No language data yet — run the scoring pipeline first.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                {["#", "Language", "Repos", "Weekly Star Velocity", "Avg Trend Score", "Avg Sustainability", "Top Repo", "Categories"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 500, fontSize: "11px", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {langData.map((lang) => (
                <LangRow key={lang.language} lang={lang} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LangRow({ lang }: { lang: LanguageStat }) {
  const vel = lang.weekly_star_velocity;
  const velColor = vel > 100 ? "var(--accent-green)" : vel > 20 ? "var(--accent-blue)" : "var(--text-secondary)";
  return (
    <tr
      style={{ borderBottom: "1px solid var(--border)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}>{lang.growth_rank}</td>
      <td style={{ padding: "10px 16px", fontWeight: 700, fontSize: "14px" }}>{lang.language}</td>
      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>{lang.repo_count}</td>
      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, color: velColor }}>
        +{vel.toFixed(0)} ⭐/wk
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>{lang.avg_trend_score.toFixed(4)}</td>
      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>{(lang.avg_sustainability_score * 100).toFixed(0)}%</td>
      <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)" }}>
        {lang.top_repo ?? "—"}
      </td>
      <td style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {lang.categories.slice(0, 3).map((c) => (
            <span key={c} style={{ fontSize: "10px", background: "var(--bg-elevated)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: "4px" }}>
              {c}
            </span>
          ))}
          {lang.categories.length > 3 && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>+{lang.categories.length - 3}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function RadarRow({ repo, rank, onClick }: { repo: RadarRepo; rank: number; onClick: () => void }) {
  return (
    <tr
      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td style={{ padding: "11px 16px", color: "var(--text-muted)", fontSize: "12px" }}>{rank}</td>
      <td style={{ padding: "11px 16px" }}>
        <span style={{ fontWeight: 600 }}>{repo.owner}/</span>{repo.name}
      </td>
      <td style={{ padding: "11px 16px", color: "var(--text-muted)", fontSize: "12px" }}>{repo.category}</td>
      <td style={{ padding: "11px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--accent-blue)" }}>
        {repo.trend_score.toFixed(4)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "monospace" }}>{repo.star_velocity_7d.toFixed(1)}</td>
      <td style={{ padding: "11px 16px", fontFamily: "monospace", color: repo.acceleration > 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
        {repo.acceleration > 0 ? "▲" : "▼"} {Math.abs(repo.acceleration).toFixed(3)}
      </td>
      <td style={{ padding: "11px 16px", fontFamily: "monospace" }}>
        {(repo.sustainability_score * 100).toFixed(0)}%
      </td>
      <td style={{ padding: "11px 16px" }}>
        <SustainBadge label={repo.sustainability_label} />
      </td>
      <td style={{ padding: "11px 16px", color: "var(--text-muted)", fontSize: "12px" }}>{repo.age_days}d</td>
    </tr>
  );
}
