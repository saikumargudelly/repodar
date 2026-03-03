"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ComposedChart, Bar,
} from "recharts";
import { api, DailyMetricPoint, ComputedMetricPoint } from "@/lib/api";
import { SustainBadge } from "@/components/Nav";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
      <h3 style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", margin: "0 0 20px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" },
  labelStyle: { color: "var(--text-muted)" },
};

function StarHistoryChart({ data, releases }: { data: DailyMetricPoint[]; releases: number[] }) {
  // Mark dates where releases increased
  const enriched = data.map((d, i) => ({
    ...d,
    release_bump: i > 0 && data[i].releases > data[i - 1].releases ? d.stars : null,
  }));

  return (
    <ChartCard title="Star History">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={enriched}>
          <defs>
            <linearGradient id="starGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={60} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [v != null ? v.toLocaleString() : "—", "Stars"]} />
          <Area type="monotone" dataKey="stars" stroke="#3b82f6" fill="url(#starGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
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
          <YAxis yAxisId="vel" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={50} />
          <YAxis yAxisId="accel" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={50} />
          <Tooltip {...tooltipStyle} />
          <Area yAxisId="vel" type="monotone" dataKey="star_velocity_7d" name="Velocity 7d" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" strokeWidth={2} dot={false} />
          <Bar yAxisId="accel" dataKey="acceleration" name="Acceleration" fill="rgba(34,197,94,0.4)" />
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
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={40} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey="contributors" name="Contributors" stroke="#8b5cf6" strokeWidth={2} dot={false} />
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
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={40} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="daily_star_delta" name="Stars Added" fill="rgba(59,130,246,0.6)" />
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
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={60} />
          <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [v != null ? v.toFixed(6) : "—", "Trend Score"]} />
          <Area type="monotone" dataKey="trend_score" stroke="#f59e0b" fill="url(#trendGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function MetricPill({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: "8px", padding: "12px 16px" }}>
      <p style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", margin: "0 0 4px" }}>
        {label}
      </p>
      <p style={{ fontSize: "18px", fontWeight: 700, margin: 0, fontFamily: mono ? "monospace" : undefined }}>
        {value}
      </p>
    </div>
  );
}

export default function RepoDeepDive() {
  const params = useParams<{ id: string }>();
  const repoId = params.id;

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

  if (repoLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading repo data...</p>
      </div>
    );
  }

  if (!repo) {
    return <p style={{ color: "var(--accent-red)", paddingTop: "40px" }}>Repository not found.</p>;
  }

  const latest = dailyMetrics?.[dailyMetrics.length - 1];

  return (
    <div style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
              {repo.owner}/<span style={{ color: "var(--accent-blue)" }}>{repo.name}</span>
            </h1>
            {repo.sustainability_label && <SustainBadge label={repo.sustainability_label} />}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "0 0 4px" }}>
            {repo.category} · {repo.age_days} days old
            {repo.primary_language && ` · ${repo.primary_language}`}
          </p>
          {repo.description && (
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0, maxWidth: "600px" }}>
              {repo.description}
            </p>
          )}
        </div>
        <a
          href={repo.github_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "8px 16px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          View on GitHub ↗
        </a>
      </div>

      {/* Score pills */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px" }}>
        <MetricPill label="Trend Score" value={repo.trend_score?.toFixed(4) ?? "—"} mono />
        <MetricPill label="Stars/Day (7d)" value={repo.star_velocity_7d?.toFixed(1) ?? "—"} mono />
        <MetricPill label="Acceleration" value={repo.acceleration?.toFixed(3) ?? "—"} mono />
        <MetricPill label="Sustainability" value={repo.sustainability_score != null ? `${(repo.sustainability_score * 100).toFixed(0)}%` : "—"} mono />
        <MetricPill label="Fork/Star Ratio" value={repo.fork_to_star_ratio?.toFixed(3) ?? "—"} mono />
        <MetricPill label="Total Stars" value={latest?.stars?.toLocaleString() ?? "—"} />
      </div>

      {/* LLM Explanation */}
      {repo.explanation && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px 24px" }}>
          <h3 style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", margin: "0 0 12px" }}>
            Analyst Insight
          </h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "14px", margin: 0 }}>
            {repo.explanation}
          </p>
        </div>
      )}

      {/* Charts grid */}
      {dailyMetrics && dailyMetrics.length > 0 ? (
        <>
          <StarHistoryChart data={dailyMetrics} releases={[]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <DailyDeltaChart data={dailyMetrics} />
            <ContributorChart data={dailyMetrics} />
          </div>
          {scores && scores.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <VelocityChart data={scores} />
              <ScoreTimeline data={scores} />
            </div>
          )}
        </>
      ) : (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "40px", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>
            No metric history yet. Run the ingestion pipeline via <code>POST /admin/run-all</code>.
          </p>
        </div>
      )}

      {/* Raw metrics table — last 7 days */}
      {dailyMetrics && dailyMetrics.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 0" }}>
            <h3 style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", margin: "0 0 0" }}>
              Raw Metrics — Last 7 Snapshots
            </h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginTop: "12px" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                {["Date", "Stars", "+Stars", "Forks", "Contributors", "Open Issues", "Releases"].map((h) => (
                  <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontWeight: 500, fontSize: "11px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailyMetrics.slice(-7).reverse().map((m) => (
                <tr key={m.date} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 16px", color: "var(--text-muted)" }}>{m.date}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "monospace" }}>{m.stars.toLocaleString()}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "monospace", color: m.daily_star_delta > 0 ? "var(--accent-green)" : "var(--text-muted)" }}>
                    {m.daily_star_delta > 0 ? `+${m.daily_star_delta}` : m.daily_star_delta}
                  </td>
                  <td style={{ padding: "9px 16px", fontFamily: "monospace" }}>{m.forks.toLocaleString()}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "monospace" }}>{m.contributors}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "monospace" }}>{m.open_issues}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "monospace" }}>{m.releases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
