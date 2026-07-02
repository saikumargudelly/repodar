"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { StatusDot } from "@/components/ui/StatusDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCompactNumber } from "@/lib/utils";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(","), ...data.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))];
  downloadBlob(rows.join("\n"), filename, "text/csv");
}

function exportJSON(data: Record<string, unknown>[], filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json");
}

const C = {
  text:       "var(--text-primary)",
  textSub:    "var(--text-secondary)",
  textMuted:  "var(--text-muted)",
  border:     "var(--border)",
  bgPrimary:  "var(--bg-primary)",
  bgCard:     "var(--bg-surface)",
  bgHover:    "var(--bg-elevated)",
  amber:      "var(--accent-yellow)",
  green:      "var(--accent-green)",
  red:        "var(--accent-red)",
};

const SORT_OPTIONS = [
  { key: "trend_score", label: "Trend Score" },
  { key: "breakout_score", label: "Breakout Score" },
  { key: "acceleration", label: "Acceleration" },
  { key: "stars", label: "Stars" },
  { key: "age_days", label: "Age" },
];

export default function RadarPage() {
  const router = useRouter();

  // Unified stage selection
  const [stageFilter, setStageFilter] = useState<"all" | "early" | "breakout" | "established">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("breakout_score");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Advanced query parameters for Early Radar
  const [maxAge, setMaxAge] = useState(180);
  const [maxStars, setMaxStars] = useState(50000);
  const [minAccel, setMinAccel] = useState(0);

  // Queries
  const { data: radarData, isLoading: radarLoading } = useQuery({
    queryKey: ["radar-established"],
    queryFn: () => api.getRadar(false, "All", undefined, "trend_score", "desc", 100),
    staleTime: 5 * 60 * 1000,
  });

  const { data: earlyData, isLoading: earlyLoading } = useQuery({
    queryKey: ["radar-early-unified", maxAge, maxStars, minAccel],
    queryFn: () => api.getEarlyRadar({
      max_age_days: maxAge,
      max_stars: maxStars,
      min_acceleration: minAccel,
      limit: 100,
    }),
    staleTime: 5 * 60 * 1000,
  });

  const establishedRows = radarData ?? [];
  const earlyRows = earlyData ?? [];

  // Combine and process rows
  const combinedRows = useMemo(() => {
    const list: { repo: any; stage: "Early" | "Breakout" | "Established" }[] = [];

    // Map established repos
    establishedRows.forEach((r) => {
      list.push({ repo: r, stage: "Established" });
    });

    // Map early repos
    earlyRows.forEach((r) => {
      const stageName = r.momentum_stage;
      const isBreakout = stageName === "breakout" || stageName === "pre_viral";
      list.push({
        repo: r,
        stage: isBreakout ? "Breakout" : "Early",
      });
    });

    // Filter by Stage
    let filtered = list;
    if (stageFilter === "early") {
      filtered = list.filter((item) => item.stage === "Early");
    } else if (stageFilter === "breakout") {
      filtered = list.filter((item) => item.stage === "Breakout");
    } else if (stageFilter === "established") {
      filtered = list.filter((item) => item.stage === "Established");
    }

    // Filter by Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.repo.name.toLowerCase().includes(q) ||
          item.repo.owner.toLowerCase().includes(q)
      );
    }

    // Sort combined list
    filtered.sort((a, b) => {
      const valA = a.repo[sortBy] ?? a.repo.trend_score ?? 0;
      const valB = b.repo[sortBy] ?? b.repo.trend_score ?? 0;
      return sortBy === "age_days" ? valA - valB : valB - valA;
    });

    return filtered;
  }, [establishedRows, earlyRows, stageFilter, searchQuery, sortBy]);

  // Export handling
  const exportData = useMemo(() => {
    return combinedRows.map(({ repo, stage }) => ({
      repo: `${repo.owner}/${repo.name}`,
      category: repo.category,
      stars: repo.stars,
      stage,
      trend_score: repo.trend_score,
      breakout_score: repo.breakout_score ?? repo.trend_score,
      acceleration: repo.acceleration,
      eta_to_5k_days: repo.estimated_viral_eta_days ?? null,
      sustainability_label: repo.sustainability_label,
      age_days: repo.age_days,
    }));
  }, [combinedRows]);

  const isLoading = radarLoading || earlyLoading;

  const TD_MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", padding: "10px 12px" };
  const TH_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "0.07em",
    color: C.textMuted,
    padding: "8px 12px",
    textAlign: "left",
    fontWeight: 600,
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "var(--bg-surface)"
  };

  return (
    <div className="page-root page-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div className="page-eyebrow">Ecosystem telemetry feeds</div>
          <h1 className="page-title">Radar</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => exportCSV(exportData, "radar-export.csv")}
            className="btn-cyber"
            style={{ padding: "6px 12px", fontSize: "11px" }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportJSON(exportData, "radar-export.json")}
            className="btn-cyber"
            style={{ padding: "6px 12px", fontSize: "11px" }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Main Toolbar */}
      <div className="panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: "200px" }}>
            <input
              type="text"
              placeholder="Search repository..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cyber-input"
              style={{ width: "100%" }}
            />
          </div>

          {/* Stage Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: C.textSub }}>Stage:</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as any)}
              className="cyber-select"
              style={{ minWidth: "140px" }}
            >
              <option value="all">All Stages</option>
              <option value="early">Early</option>
              <option value="breakout">Breakout</option>
              <option value="established">Established</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: C.textSub }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="cyber-select"
              style={{ minWidth: "140px" }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="link-btn-cyber"
            style={{ fontSize: "12px" }}
          >
            {showAdvancedFilters ? "Hide parameters" : "Adjust parameters"}
          </button>
        </div>

        {/* Collapsible Advanced Parameters */}
        {showAdvancedFilters && (
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", borderTop: `1px solid ${C.border}`, paddingTop: "14px", marginTop: "4px" }}>
            {/* Age Slider */}
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                <span style={{ color: C.textMuted }}>MAX AGE</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{maxAge}d</span>
              </div>
              <input
                type="range"
                min={7}
                max={365}
                step={7}
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                style={{ width: "100%", accentColor: C.text }}
              />
            </div>

            {/* Stars Slider */}
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                <span style={{ color: C.textMuted }}>MAX STARS</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{maxStars.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={100}
                max={100000}
                step={500}
                value={maxStars}
                onChange={(e) => setMaxStars(Number(e.target.value))}
                style={{ width: "100%", accentColor: C.text }}
              />
            </div>

            {/* Acceleration Slider */}
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                <span style={{ color: C.textMuted }}>MIN ACCEL</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{minAccel.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={minAccel}
                onChange={(e) => setMinAccel(Number(e.target.value))}
                style={{ width: "100%", accentColor: C.text }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Unified Table */}
      <div className="panel table-scroll">
        {isLoading ? (
          <div style={{ padding: "40px" }}>
            <Skeleton shape="table" />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "REPO", "STAGE", "BREAKOUT", "TREND", "ACCEL", "ETA TO 5K", "SUSTAIN", "AGE"].map((h) => {
                  const isRight = ["BREAKOUT", "TREND", "ACCEL", "ETA TO 5K"].includes(h);
                  return (
                    <th key={h} style={{ ...TH_STYLE, textAlign: isRight ? "right" : "left" }}>{h}</th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {combinedRows.map(({ repo, stage }, i) => {
                const accel = repo.acceleration ?? 0;
                const breakout = repo.breakout_score ?? repo.trend_score ?? 0;
                const trend = repo.trend_score ?? 0;
                const eta = repo.estimated_viral_eta_days;
                const stageColor = stage === "Established"
                  ? "var(--text-muted)"
                  : stage === "Breakout"
                    ? "var(--accent-yellow)"
                    : "var(--accent-green)";

                return (
                  <tr
                    key={repo.repo_id}
                    className="tr-cyber"
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                    onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                  >
                    <td style={{ ...TD_MONO, color: C.textMuted, fontSize: "11px" }}>{i + 1}</td>
                    <td style={{ ...TD_MONO, maxWidth: "220px" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 400, color: C.textMuted }}>{repo.owner}/</span>{repo.name}
                      </div>
                      <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "2px" }}>
                        {repo.category} · {formatCompactNumber(repo.stars)} stars
                      </div>
                    </td>
                    <td style={{ ...TD_MONO }}>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
                        color: stageColor, border: `1px solid ${stageColor}`, padding: "2px 6px",
                        letterSpacing: "0.05em", textTransform: "uppercase"
                      }}>
                        {stage}
                      </span>
                    </td>
                    <td style={{ ...TD_MONO, textAlign: "right", fontWeight: 700 }}>{breakout.toFixed(3)}</td>
                    <td style={{ ...TD_MONO, textAlign: "right" }}>{trend.toFixed(4)}</td>
                    <td style={{ ...TD_MONO, textAlign: "right", color: accel > 0 ? C.green : C.red }}>
                      {accel > 0 ? "▲" : "▼"} {Math.abs(accel).toFixed(2)}
                    </td>
                    <td style={{ ...TD_MONO, textAlign: "right" }}>
                      {eta != null ? `~${eta}d` : "—"}
                    </td>
                    <td style={{ ...TD_MONO, whiteSpace: "nowrap" }}>
                      <StatusDot label={repo.sustainability_label} size="sm" />
                    </td>
                    <td style={{ ...TD_MONO, color: C.textMuted, fontSize: "11px" }}>
                      {repo.age_days}d
                    </td>
                  </tr>
                );
              })}
              {combinedRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "64px", textAlign: "center", color: C.textMuted, fontSize: "12px" }}>
                    No repositories matched the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
