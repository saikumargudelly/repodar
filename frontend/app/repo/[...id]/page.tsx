"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ComposedChart, Bar, ReferenceLine,
} from "recharts";
import {
  api, DailyMetricPoint, ComputedMetricPoint, ReleaseItem, SocialMentionItem, CommitActivityPoint, DeepSummary,
} from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-header"><span className="panel-title">{title}</span></div>
      <div style={{ padding: "0 20px 20px" }}>{children}</div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" },
  labelStyle: { color: "var(--text-muted)" },
};

function StarHistoryChart({ data, releases, mentions }: {
  data: DailyMetricPoint[];
  releases: number[];
  mentions?: SocialMentionItem[];
}) {
  // Mark dates where releases increased
  const enriched = data.map((d, i) => ({
    ...d,
    release_bump: i > 0 && data[i].releases > data[i - 1].releases ? d.stars : null,
  }));

  // Build a set of dates with social mentions for ReferenceLine markers
  const mentionDates = new Set(
    (mentions || []).map((m) => m.posted_at.slice(0, 10))
  );

  return (
    <ChartCard title="Star History">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={enriched}>
          <defs>
            <linearGradient id="starGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={42} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [v != null ? v.toLocaleString() : "—", "Stars"]} />
          <Area type="monotone" dataKey="stars" stroke="var(--cyan)" fill="url(#starGrad)" strokeWidth={2} dot={false} />
          {/* Social mention markers */}
          {data.map((d) =>
            mentionDates.has(d.date) ? (
              <ReferenceLine
                key={d.date}
                x={d.date}
                stroke="var(--amber)"
                strokeDasharray="4 2"
                label={{ value: "💬", position: "top", fontSize: 10 }}
              />
            ) : null
          )}
        </AreaChart>
      </ResponsiveContainer>
      {mentions && mentions.length > 0 && (
        <div style={{ padding: "6px 0 0", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          <span style={{ color: "var(--amber)" }}>▌</span> Dashed lines = HN / Reddit posts
        </div>
      )}
    </ChartCard>
  );
}

function VelocityChart({ data }: { data: ComputedMetricPoint[] }) {
  return (
    <ChartCard title="Velocity vs Acceleration">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis yAxisId="vel" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} />
          <YAxis yAxisId="accel" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} />
          <Tooltip {...tooltipStyle} />
          <Area yAxisId="vel" type="monotone" dataKey="star_velocity_7d" name="Velocity 7d" stroke="var(--cyan)" fill="rgba(0,229,255,0.1)" strokeWidth={2} dot={false} />
          <Bar yAxisId="accel" dataKey="acceleration" name="Acceleration" fill="rgba(57,255,20,0.35)" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ContributorChart({ data }: { data: DailyMetricPoint[] }) {
  return (
    <ChartCard title="Contributor Growth">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey="contributors" name="Contributors" stroke="var(--amber)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function DailyDeltaChart({ data }: { data: DailyMetricPoint[] }) {
  return (
    <ChartCard title="Daily Star Delta">
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="daily_star_delta" name="Stars Added" fill="rgba(0,229,255,0.5)" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ScoreTimeline({ data }: { data: ComputedMetricPoint[] }) {
  return (
    <ChartCard title="Trend Score Timeline">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={52} />
          <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [v != null ? v.toFixed(6) : "—", "Trend Score"]} />
          <Area type="monotone" dataKey="trend_score" stroke="var(--amber)" fill="url(#trendGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function SignalExplainer({ scores, dailyMetrics }: { scores: ComputedMetricPoint[]; dailyMetrics: DailyMetricPoint[] }) {
  if (scores.length < 1) return null;
  const latest = scores[scores.length - 1];
  const prior = scores.length >= 2 ? scores[scores.length - 2] : null;
  const latestDaily = dailyMetrics[dailyMetrics.length - 1] ?? null;
  const priorDaily = dailyMetrics.length >= 8 ? dailyMetrics[dailyMetrics.length - 8] : null;

  const signals: { icon: string; label: string; value: string; detail?: string; positive?: boolean }[] = [];

  // Star velocity + pct change vs prior week
  if (latest.star_velocity_7d != null) {
    const vel = latest.star_velocity_7d;
    let pctStr = "";
    if (prior?.star_velocity_7d && prior.star_velocity_7d > 0) {
      const pct = ((vel - prior.star_velocity_7d) / prior.star_velocity_7d) * 100;
      pctStr = ` (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs prior week)`;
    }
    signals.push({
      icon: "⭐",
      label: "7-day star velocity",
      value: `+${vel.toFixed(1)}/day`,
      detail: pctStr,
      positive: vel > 0,
    });
  }

  // Acceleration
  if (latest.acceleration != null) {
    const acc = latest.acceleration;
    signals.push({
      icon: acc > 0 ? "🚀" : "📉",
      label: "Momentum",
      value: acc > 0 ? "Accelerating" : acc < 0 ? "Decelerating" : "Flat",
      detail: ` (accel: ${acc > 0 ? "+" : ""}${acc.toFixed(4)})`,
      positive: acc > 0,
    });
  }

  // Contributor growth (daily metric comparison)
  if (latestDaily && priorDaily && priorDaily.contributors > 0) {
    const delta = latestDaily.contributors - priorDaily.contributors;
    const pct = (delta / priorDaily.contributors) * 100;
    if (delta !== 0) {
      signals.push({
        icon: "👥",
        label: "Contributor growth (7d)",
        value: `${delta > 0 ? "+" : ""}${delta} new devs`,
        detail: ` (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% change)`,
        positive: delta > 0,
      });
    }
  }

  // Release boost
  if (latestDaily && priorDaily && latestDaily.releases > priorDaily.releases) {
    const newReleases = latestDaily.releases - priorDaily.releases;
    signals.push({
      icon: "🏷️",
      label: "Release boost",
      value: `${newReleases} release${newReleases > 1 ? "s" : ""} in last 7 days`,
      positive: true,
    });
  }

  // Trend score change
  if (prior?.trend_score && latest.trend_score! > 0) {
    const delta = ((latest.trend_score! - prior.trend_score) / prior.trend_score) * 100;
    signals.push({
      icon: "📊",
      label: "Trend score",
      value: latest.trend_score!.toFixed(6),
      detail: ` (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prior snapshot)`,
      positive: delta > 0,
    });
  }

  if (signals.length === 0) return null;

  return (
    <div className="panel" style={{ padding: "20px 24px" }}>
      <div className="panel-header" style={{ marginBottom: "12px" }}>
        <span className="panel-title">◈ SIGNAL EXPLAINER — WHY THIS SCORE?</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {signals.map((s) => (
          <div key={s.label} className="signal-row">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px",
              color: "var(--text-muted)", flexShrink: 0 }}>{s.icon}</span>
            <span className="signal-label">{s.label}:</span>
            <span style={{ fontWeight: 700,
              color: s.positive ? "var(--green)" : s.positive === false ? "var(--pink)" : "var(--text-primary)",
              fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              {s.value}
            </span>
            {s.detail && <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)",
              fontSize: "10px" }}>{s.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature 8: Commit Frequency Heatmap ─────────────────────────────────────

function CommitHeatmap({ data }: { data: CommitActivityPoint[] }) {
  if (!data || data.length === 0) return null;

  // Build a map of date→count
  const countMap: Record<string, number> = {};
  let maxCount = 1;
  for (const p of data) {
    countMap[p.date] = p.count;
    if (p.count > maxCount) maxCount = p.count;
  }

  // Build 52 weeks × 7 days grid starting from the earliest entry
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const weeks: CommitActivityPoint[][] = [];
  let week: CommitActivityPoint[] = [];
  for (const p of sorted) {
    week.push(p);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);

  const intensity = (count: number) => {
    if (count === 0) return "var(--bg-elevated)";
    const pct = count / maxCount;
    if (pct < 0.25) return "rgba(0,229,255,0.2)";
    if (pct < 0.5) return "rgba(0,229,255,0.45)";
    if (pct < 0.75) return "rgba(0,229,255,0.7)";
    return "var(--cyan)";
  };

  return (
    <div className="panel" style={{ padding: "20px 24px", overflowX: "auto" }}>
      <div className="panel-header" style={{ marginBottom: "12px" }}>
        <span className="panel-title">◈ COMMIT ACTIVITY — LAST 52 WEEKS</span>
      </div>
      <div style={{ display: "flex", gap: "3px" }}>
        {weeks.map((w, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {w.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} commit${day.count !== 1 ? "s" : ""}`}
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "2px",
                  background: intensity(day.count),
                  border: "1px solid rgba(255,255,255,0.05)",
                  cursor: "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Less
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <div key={i} style={{ width: "10px", height: "10px", borderRadius: "2px", background: intensity(Math.round(pct * maxCount)) }} />
        ))}
        More
      </div>
    </div>
  );
}

// ─── Feature 7: Release Changelog ─────────────────────────────────────────────

function ReleaseChangelog({ releases, owner, name }: { releases: ReleaseItem[]; owner: string; name: string }) {
  if (!releases || releases.length === 0) return null;

  return (
    <div className="panel" style={{ padding: "20px 24px" }}>
      <div className="panel-header" style={{ marginBottom: "12px" }}>
        <span className="panel-title">◈ RECENT RELEASES</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {releases.map((r) => (
          <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <a
                href={r.html_url || `https://github.com/${owner}/${name}/releases/tag/${r.tag_name}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: "var(--cyan)", textDecoration: "none" }}
              >
                {r.tag_name}
              </a>
              {r.is_prerelease && (
                <span style={{ fontSize: "10px", background: "rgba(255,193,7,0.15)", color: "var(--amber)", padding: "2px 7px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                  PRE-RELEASE
                </span>
              )}
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {r.published_at.slice(0, 10)}
              </span>
              {r.name && r.name !== r.tag_name && (
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{r.name}</span>
              )}
            </div>
            {r.body_truncated && (
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                {r.body_truncated}
                {r.body_truncated.length >= 500 ? "…" : ""}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature 6: Social Mentions Feed ─────────────────────────────────────────

function SocialMentionsFeed({ mentions }: { mentions: SocialMentionItem[] }) {
  if (!mentions || mentions.length === 0) return null;

  const platformIcon = (p: string) => p === "hn" ? "🔶" : "🟠";
  const platformLabel = (p: string, sub?: string | null) =>
    p === "hn" ? "Hacker News" : sub ? `r/${sub}` : "Reddit";

  return (
    <div className="panel" style={{ padding: "20px 24px" }}>
      <div className="panel-header" style={{ marginBottom: "12px" }}>
        <span className="panel-title">◈ COMMUNITY MENTIONS — HN &amp; REDDIT</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {mentions.slice(0, 10).map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>{platformIcon(m.platform)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <a
                href={m.post_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "12px", color: "var(--cyan)", textDecoration: "none", display: "block", marginBottom: "2px" }}
              >
                {m.post_title || "(no title)"}
              </a>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {platformLabel(m.platform, m.subreddit)} · {m.upvotes} pts · {m.posted_at.slice(0, 10)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricPill({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontFamily: mono ? "var(--font-mono)" : undefined }}>{value}</div>
    </div>
  );
}

export default function RepoDeepDive() {
  const params = useParams<{ id: string[] }>();
  const repoId = Array.isArray(params.id) ? params.id.join("/") : params.id;

  const { data: repo, isLoading: repoLoading } = useQuery({
    queryKey: ["repo", repoId],
    queryFn: () => api.getRepo(repoId),
    enabled: !!repoId,
  });

  const { data: dailyMetrics } = useQuery({
    queryKey: ["daily-metrics", repoId, 60],
    queryFn: () => api.getDailyMetrics(repoId, 60),
    enabled: !!repoId,
  });

  const { data: scores } = useQuery({
    queryKey: ["computed-scores", repoId, 60],
    queryFn: () => api.getComputedScores(repoId, 60),
    enabled: !!repoId,
  });

  // Feature 7: Releases
  const { data: releases } = useQuery({
    queryKey: ["releases", repoId],
    queryFn: () => api.getReleases(repoId, 10),
    enabled: !!repoId,
  });

  // Deep Summary: what/why/how/tech-stack/contributors/languages
  const owner = repoId.split("/")[0] ?? "";
  const repoName = repoId.split("/").slice(1).join("/") ?? "";
  const { data: deepSummary, isLoading: deepLoading } = useQuery<DeepSummary>({
    queryKey: ["deep-summary", repoId],
    queryFn: () => api.getDeepSummary(owner, repoName),
    enabled: !!repoId && !!owner && !!repoName,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  // Feature 6: Social Mentions
  const { data: mentions } = useQuery({
    queryKey: ["mentions", repoId],
    queryFn: () => api.getSocialMentions(repoId, 20),
    enabled: !!repoId,
  });

  // Feature 8: Commit Activity
  const { data: commitActivity } = useQuery({
    queryKey: ["commit-activity", repoId],
    queryFn: () => api.getCommitActivity(repoId),
    enabled: !!repoId,
  });

  if (repoLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px",
          letterSpacing: "0.06em" }}>
          // LOADING REPO DATA<span className="terminal-cursor" />
        </p>
      </div>
    );
  }

  if (!repo) {
    return <p style={{ fontFamily: "var(--font-mono)", color: "var(--pink)",
      paddingTop: "40px", fontSize: "12px" }}>✕ REPOSITORY NOT FOUND</p>;
  }

  const latest = dailyMetrics?.[dailyMetrics.length - 1];

  return (
    <div className="page-root">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px",
            flexWrap: "wrap" }}>
            <div className="section-title-cyber" style={{ fontSize: "16px", letterSpacing: "0.06em" }}>
              {repo.owner}/<span style={{ color: "var(--cyan)" }}>{repo.name}</span>
              <span className="terminal-cursor" />
            </div>
            {repo.sustainability_label && <SustainBadge label={repo.sustainability_label} />}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
            marginBottom: repo.description ? "4px" : 0 }}>
            // {repo.category} · {repo.age_days}d old{repo.primary_language ? ` · ${repo.primary_language}` : ""}
          </div>
          {repo.description && (
            <div style={{ color: "var(--text-secondary)", fontSize: "12px", maxWidth: "600px" }}>
              {repo.description}
            </div>
          )}
        </div>
        <div className="repo-header-actions">
          <Link href={`/widget/repo/${repo.owner}/${repo.name}`}
            style={{ padding: "7px 14px", border: "1px solid var(--border)", fontSize: "11px",
              fontFamily: "var(--font-mono)", color: "var(--text-muted)", textDecoration: "none",
              letterSpacing: "0.06em" }}>
            WIDGET ⧉
          </Link>
          <a href={repo.github_url} target="_blank" rel="noopener noreferrer"
            style={{ padding: "7px 14px", border: "1px solid var(--cyan)", fontSize: "11px",
              fontFamily: "var(--font-mono)", color: "var(--cyan)", textDecoration: "none",
              letterSpacing: "0.06em" }}>
            GITHUB ↗
          </a>
        </div>
      </div>

      {/* Score pills */}
      <div className="metric-pills-grid">
        <MetricPill label="Trend Score" value={repo.trend_score?.toFixed(4) ?? "—"} mono />
        <MetricPill label="Stars/Day (7d)" value={repo.star_velocity_7d?.toFixed(1) ?? "—"} mono />
        <MetricPill label="Acceleration" value={repo.acceleration?.toFixed(3) ?? "—"} mono />
        <MetricPill label="Sustainability" value={repo.sustainability_score != null ? `${(repo.sustainability_score * 100).toFixed(0)}%` : "—"} mono />
        <MetricPill label="Fork/Star Ratio" value={repo.fork_to_star_ratio?.toFixed(3) ?? "—"} mono />
        <MetricPill label="Total Stars" value={latest?.stars?.toLocaleString() ?? "—"} />
      </div>

      {/* ── Deep Repo Analysis ─────────────────────────────────────────── */}
      {deepLoading && (
        <div className="panel" style={{ padding: "20px 24px", borderLeft: "3px solid var(--cyan)" }}>
          <div className="panel-header" style={{ marginBottom: "10px" }}>
            <span className="panel-title">◈ AI DEEP ANALYSIS</span>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
            letterSpacing: "0.06em" }}>// GENERATING ANALYSIS…<span className="terminal-cursor" /></p>
        </div>
      )}

      {deepSummary && (
        <>
          {/* What / Why / How */}
          <div className="panel" style={{ padding: "20px 24px", borderLeft: "3px solid var(--cyan)" }}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <span className="panel-title">◈ AI DEEP ANALYSIS</span>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "12px" }}>
                generated {deepSummary.generated_at.slice(0, 10)}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { key: "WHAT", label: "What it is", value: deepSummary.what, color: "var(--cyan)" },
                { key: "WHY", label: "Why it exists", value: deepSummary.why, color: "var(--amber)" },
                { key: "HOW", label: "How it works", value: deepSummary.how, color: "var(--green)" },
              ].map(({ key, label, value, color }) => value && (
                <div key={key} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
                    color, minWidth: "36px", paddingTop: "2px", letterSpacing: "0.08em" }}>{key}</span>
                  <div>
                    <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)",
                      marginBottom: "3px", letterSpacing: "0.06em" }}>{label}</div>
                    <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "13px", margin: 0 }}>
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack + Use Cases side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {deepSummary.tech_stack.length > 0 && (
              <div className="panel" style={{ padding: "20px 24px" }}>
                <div className="panel-header" style={{ marginBottom: "12px" }}>
                  <span className="panel-title">◈ TECH STACK</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {deepSummary.tech_stack.map((tech) => (
                    <span key={tech} style={{ fontFamily: "var(--font-mono)", fontSize: "11px",
                      padding: "4px 10px", borderRadius: "4px",
                      background: "rgba(0,229,255,0.1)", color: "var(--cyan)",
                      border: "1px solid rgba(0,229,255,0.25)" }}>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {deepSummary.use_cases.length > 0 && (
              <div className="panel" style={{ padding: "20px 24px" }}>
                <div className="panel-header" style={{ marginBottom: "12px" }}>
                  <span className="panel-title">◈ USE CASES</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {deepSummary.use_cases.map((uc) => (
                    <li key={uc} style={{ color: "var(--text-secondary)", fontSize: "12px", lineHeight: "1.5" }}>
                      {uc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Languages breakdown */}
          {Object.keys(deepSummary.languages).length > 0 && (
            <div className="panel" style={{ padding: "20px 24px" }}>
              <div className="panel-header" style={{ marginBottom: "14px" }}>
                <span className="panel-title">◈ LANGUAGE BREAKDOWN</span>
              </div>
              {(() => {
                const total = Object.values(deepSummary.languages).reduce((a, b) => a + b, 0);
                const sorted = Object.entries(deepSummary.languages).sort(([, a], [, b]) => b - a);
                const COLORS = ["var(--cyan)", "var(--amber)", "var(--green)", "var(--pink)",
                  "#9d7fff", "#ff9944", "#44aaff", "#ff44aa"];
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", height: "10px", borderRadius: "5px", overflow: "hidden", width: "100%" }}>
                      {sorted.map(([lang, bytes], i) => (
                        <div key={lang} title={`${lang}: ${((bytes / total) * 100).toFixed(1)}%`}
                          style={{ width: `${(bytes / total) * 100}%`, background: COLORS[i % COLORS.length],
                            minWidth: "2px", transition: "width 0.3s" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
                      {sorted.slice(0, 8).map(([lang, bytes], i) => (
                        <div key={lang} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%",
                            background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px",
                            color: "var(--text-secondary)" }}>
                            {lang}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px",
                            color: "var(--text-muted)" }}>
                            {((bytes / total) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Top Contributors */}
          {deepSummary.contributors.length > 0 && (
            <div className="panel" style={{ padding: "20px 24px" }}>
              <div className="panel-header" style={{ marginBottom: "14px" }}>
                <span className="panel-title">◈ TOP CONTRIBUTORS</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {deepSummary.contributors.map((c) => (
                  <a key={c.login} href={c.profile_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                      textDecoration: "none", width: "72px" }}>
                    <img src={c.avatar_url} alt={c.login}
                      style={{ width: "44px", height: "44px", borderRadius: "50%",
                        border: "2px solid var(--border)" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)",
                      textAlign: "center", overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", width: "100%" }}>{c.login}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
                      {c.contributions.toLocaleString()} commits
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Fallback: show old 3-sentence summary only if deep analysis not available/loaded */}
      {!deepSummary && !deepLoading && repo.repo_summary && (
        <div className="panel" style={{ padding: "20px 24px", borderLeft: "3px solid var(--cyan)" }}>
          <div className="panel-header" style={{ marginBottom: "10px" }}>
            <span className="panel-title">◈ AI SUMMARY</span>
            {repo.repo_summary_generated_at && (
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "12px" }}>
                generated {repo.repo_summary_generated_at.slice(0, 10)}
              </span>
            )}
          </div>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.75", fontSize: "13px", margin: 0 }}>
            {repo.repo_summary}
          </p>
        </div>
      )}

      {/* LLM Explanation */}
      {repo.explanation && (
        <div className="panel" style={{ padding: "20px 24px" }}>
          <div className="panel-header" style={{ marginBottom: "10px" }}>
            <span className="panel-title">▲ ANALYST INSIGHT</span>
          </div>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "13px", margin: 0 }}>
            {repo.explanation}
          </p>
        </div>
      )}

      {/* Charts grid */}
      {dailyMetrics && dailyMetrics.length > 0 ? (
        <>
          {scores && scores.length > 0 && (
            <SignalExplainer scores={scores} dailyMetrics={dailyMetrics} />
          )}
          <StarHistoryChart data={dailyMetrics} releases={[]} mentions={mentions} />
          <div className="chart-row-2">
            <DailyDeltaChart data={dailyMetrics} />
            <ContributorChart data={dailyMetrics} />
          </div>
          {scores && scores.length > 0 && (
            <div className="chart-row-2">
              <VelocityChart data={scores} />
              <ScoreTimeline data={scores} />
            </div>
          )}
        </>
      ) : (
        <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px",
            letterSpacing: "0.06em" }}>
            // NO METRIC HISTORY YET — run <span style={{ color: "var(--cyan)" }}>POST /admin/run-all</span>
          </p>
        </div>
      )}

      {/* Feature 8: Commit Frequency Heatmap */}
      {commitActivity && commitActivity.length > 0 && (
        <CommitHeatmap data={commitActivity} />
      )}

      {/* Feature 6: Social Mentions Feed */}
      <SocialMentionsFeed mentions={mentions || []} />

      {/* Feature 7: Release Changelog */}
      {repo && (
        <ReleaseChangelog releases={releases || []} owner={repo.owner} name={repo.name} />
      )}

      {/* Raw metrics table */}
      {dailyMetrics && dailyMetrics.length > 0 && (
        <div className="panel table-scroll">
          <div className="panel-header"><span className="panel-title">▣ RAW METRICS — LAST 7 SNAPSHOTS</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr>
                {["DATE", "STARS", "+STARS", "FORKS", "CONTRIBUTORS", "OPEN ISSUES", "RELEASES"].map((h) => (
                  <th key={h} className="th-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailyMetrics.slice(-7).reverse().map((m) => (
                <tr key={m.date} className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)",
                    fontSize: "11px", color: "var(--text-muted)" }}>{m.date}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)" }}>
                    {m.stars.toLocaleString()}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)",
                    color: m.daily_star_delta > 0 ? "var(--green)" : "var(--text-muted)" }}>
                    {m.daily_star_delta > 0 ? `+${m.daily_star_delta}` : m.daily_star_delta}
                  </td>
                  <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)" }}>
                    {m.forks.toLocaleString()}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)" }}>{m.contributors}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)" }}>{m.open_issues}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)" }}>{m.releases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
