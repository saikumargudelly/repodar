"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ComposedChart, Bar, ReferenceLine,
} from "recharts";
import {
  api, DailyMetricPoint, ComputedMetricPoint, ReleaseItem, SocialMentionItem, CommitActivityPoint, DeepSummary,
} from "@/lib/api";
import { ForecastChart } from "@/components/forecast/ForecastChart";
import { RecommendationsPanel } from "@/components/recommendations/RecommendationsPanel";
import ReactMarkdown from "react-markdown";

const tooltipStyle = {
  contentStyle: { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" },
  labelStyle: { color: "var(--text-muted)" },
};

function formatDateShort(dateStr: string) {
  try {
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${months[monthIndex]} ${day}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function formatDateFriendly(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `Generated ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch (e) {
    return `Generated ${dateStr}`;
  }
}

function HealthBadge({ label }: { label: string | null }) {
  if (!label) return null;
  const norm = label.toUpperCase().trim();
  let text = "Caution";
  let color = "var(--accent-yellow)";
  let bg = "rgba(210, 153, 34, 0.12)";
  
  if (norm === "GREEN" || norm === "HEALTHY") {
    text = "Healthy";
    color = "var(--accent-green)";
    bg = "rgba(63, 185, 80, 0.12)";
  } else if (norm === "RED" || norm === "CRITICAL" || norm === "LOW") {
    text = "Critical";
    color = "var(--accent-red)";
    bg = "rgba(248, 81, 73, 0.12)";
  }
  
  return (
    <span style={{
      fontFamily: "var(--font-sans)",
      fontSize: "10px",
      fontWeight: 700,
      color,
      backgroundColor: bg,
      border: `1px solid ${color}`,
      padding: "2px 8px",
      borderRadius: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}>
      {text}
    </span>
  );
}

function MetricCard({
  label,
  value,
  valueColor,
  subLabel,
  subColor,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
  subLabel?: string;
  subColor?: string;
}) {
  return (
    <div className="kpi-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", padding: "14px 16px" }}>
      <div>
        <div className="kpi-label" style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, marginBottom: "4px" }}>
          {label}
        </div>
        <div className="kpi-value" style={{ fontSize: "24px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: valueColor || "var(--text-primary)", marginBottom: "4px", letterSpacing: "-0.02em" }}>
          {value}
        </div>
      </div>
      {subLabel && (
        <div style={{ fontSize: "11px", color: subColor || "var(--text-muted)", fontFamily: "var(--font-sans)", fontWeight: 500 }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}

function StarHistoryChart({ data, mentions }: {
  data: DailyMetricPoint[];
  mentions?: SocialMentionItem[];
}) {
  const enriched = data.map((d, i) => ({
    ...d,
    release_bump: i > 0 && data[i].releases > data[i - 1].releases ? d.stars : null,
  }));

  const mentionDates = new Set(
    (mentions || []).map((m) => m.posted_at.slice(0, 10))
  );

  return (
    <div className="panel card-pad">
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="panel-title" style={{ fontSize: "15px", fontWeight: 700 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>
          Star history
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          total cumulative stars
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={enriched} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="starGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={42} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v: any) => [v != null ? v.toLocaleString() : "—", "Stars"]} />
          <Area type="monotone" dataKey="stars" stroke="var(--accent-blue)" fill="url(#starGrad)" strokeWidth={2} dot={false} />
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
    </div>
  );
}

function DailyDeltaChart({ data }: { data: DailyMetricPoint[] }) {
  return (
    <div className="panel card-pad">
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><rect x="18" y="3" width="4" height="18"></rect><rect x="10" y="8" width="4" height="13"></rect><rect x="2" y="13" width="4" height="8"></rect></svg>
          Daily star delta
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="daily_star_delta" name="Stars Added" fill="var(--accent-green)" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ContributorChart({ data }: { data: DailyMetricPoint[] }) {
  return (
    <div className="panel card-pad">
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Contributor growth
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-yellow)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--accent-yellow)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Area type="monotone" dataKey="contributors" name="Contributors" stroke="var(--accent-yellow)" fill="url(#contribGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function VelocityChart({ data }: { data: ComputedMetricPoint[] }) {
  return (
    <div className="panel card-pad">
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Velocity vs acceleration
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Area type="monotone" dataKey="star_velocity_7d" name="Velocity 7d" stroke="var(--accent-blue)" fill="url(#velGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScoreTimeline({ data }: { data: ComputedMetricPoint[] }) {
  return (
    <div className="panel card-pad">
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          Trend score timeline
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-yellow)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--accent-yellow)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={52} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v: any) => [typeof v === "number" && v != null ? v.toFixed(6) : "—", "Trend Score"]} />
          <Area type="monotone" dataKey="trend_score" stroke="var(--accent-yellow)" fill="url(#trendGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SignalExplainer({ scores }: { scores: ComputedMetricPoint[] }) {
  if (scores.length < 1) return null;
  const latest = scores[scores.length - 1];
  const prior = scores.length >= 2 ? scores[scores.length - 2] : null;

  let trendChangePct = 0;
  if (latest.trend_score && prior?.trend_score && prior.trend_score > 0) {
    trendChangePct = ((latest.trend_score - prior.trend_score) / prior.trend_score) * 100;
  }

  let velChangePct = 0;
  if (latest.star_velocity_7d && prior?.star_velocity_7d && prior.star_velocity_7d > 0) {
    velChangePct = ((latest.star_velocity_7d - prior.star_velocity_7d) / prior.star_velocity_7d) * 100;
  }

  const accel = latest.acceleration ?? 0;
  const accelStatus = accel > 0.001 ? "Accelerating" : accel < -0.001 ? "Decelerating" : "Flat";

  return (
    <div className="panel card-pad" style={{ height: "100%" }}>
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span className="panel-title" style={{ fontSize: "14px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          Signal explainer
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "var(--text-muted)", display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-primary)", minWidth: "120px" }}>7d star velocity</span>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--green)", minWidth: "90px", fontFamily: "var(--font-mono)" }}>
            +{latest.star_velocity_7d?.toFixed(1)}/day
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {velChangePct >= 0 ? "+" : ""}{velChangePct.toFixed(0)}% vs prior week
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "var(--text-muted)", display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path><path d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path></svg>
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-primary)", minWidth: "120px" }}>Momentum</span>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-primary)", minWidth: "90px" }}>
            {accelStatus}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            accel: {accel.toFixed(4)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "var(--text-muted)", display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-primary)", minWidth: "120px" }}>Trend score</span>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--amber)", minWidth: "90px", fontFamily: "var(--font-mono)" }}>
            {latest.trend_score?.toFixed(4)}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {trendChangePct >= 0 ? "+" : ""}{trendChangePct.toFixed(1)}% vs prior snapshot
          </span>
        </div>
      </div>
    </div>
  );
}

function CommitHeatmap({ data }: { data: CommitActivityPoint[] }) {
  if (!data || data.length === 0) return null;

  const countMap: Record<string, number> = {};
  let maxCount = 1;
  for (const p of data) {
    countMap[p.date] = p.count;
    if (p.count > maxCount) maxCount = p.count;
  }

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
    if (pct < 0.25) return "rgba(63,185,80,0.2)";
    if (pct < 0.5) return "rgba(63,185,80,0.45)";
    if (pct < 0.75) return "rgba(63,185,80,0.7)";
    return "var(--accent-green)";
  };

  return (
    <div className="panel card-pad" style={{ overflowX: "auto" }}>
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>
          Commit activity — last 52 weeks
        </span>
      </div>
      <div style={{ display: "flex", gap: "3px", marginTop: "8px" }}>
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
                  border: "1px solid rgba(255,255,255,0.02)",
                  cursor: "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Less
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <div key={i} style={{ width: "10px", height: "10px", borderRadius: "2px", background: intensity(Math.round(pct * maxCount)) }} />
        ))}
        More
      </div>
    </div>
  );
}

function ReleaseChangelog({ releases, owner, name }: { releases: ReleaseItem[]; owner: string; name: string }) {
  if (!releases || releases.length === 0) return null;

  return (
    <div className="panel card-pad">
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 12 }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          Recent releases
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {releases.map((r) => (
          <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <a
                href={r.html_url || `https://github.com/${owner}/${name}/releases/tag/${r.tag_name}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: "#58a6ff", textDecoration: "none" }}
              >
                {r.tag_name}
              </a>
              {r.is_prerelease && (
                <span style={{ fontSize: "10px", background: "rgba(255,193,7,0.1)", color: "var(--amber)", padding: "1px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
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
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
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

function SocialMentionsFeed({ mentions }: { mentions: SocialMentionItem[] }) {
  if (!mentions || mentions.length === 0) return null;

  const platformIcon = (p: string) => p === "hn" ? "🔶" : "🟠";
  const platformLabel = (p: string, sub?: string | null) =>
    p === "hn" ? "Hacker News" : sub ? `r/${sub}` : "Reddit";

  return (
    <div className="panel card-pad">
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 12 }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Community mentions — HN &amp; Reddit
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {mentions.slice(0, 5).map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>{platformIcon(m.platform)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <a
                href={m.post_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "13px", fontWeight: 500, color: "#58a6ff", textDecoration: "none", display: "block", marginBottom: "2px" }}
                className="hover:underline"
              >
                {m.post_title || "(no title)"}
              </a>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {platformLabel(m.platform, m.subreddit)} · {m.upvotes} pts · {m.posted_at.slice(0, 10)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EcosystemTabContent({ repoId, repo }: { repoId: string; repo: any }) {
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const { data: ecosystem, isLoading, error } = useQuery({
    queryKey: ["ecosystem-map", repoId],
    queryFn: () => api.getEcosystemMap(repoId),
    enabled: !!repoId,
  });

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await api.generateEcosystemReport(repoId);
      setReportMd(res.content_md);
    } catch (err) {
      console.error(err);
      alert("Failed to generate ecosystem report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh" }}>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px" }}>
          // ANALYSING ECOSYSTEM DATA<span className="terminal-cursor" />
        </p>
      </div>
    );
  }

  if (error || !ecosystem) {
    return (
      <div className="panel card-pad" style={{ borderLeft: "3px solid var(--accent-red)" }}>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--accent-red)", margin: 0 }}>
          ✕ Error loading ecosystem data. Please ensure repository is indexed.
        </p>
      </div>
    );
  }

  const primaryCategory = ecosystem.primary_category || "OSS Tools";
  const strength = ecosystem.strength;
  const relationships = ecosystem.relationships || [];

  const alternatives = relationships.filter((r: any) => r.relationship === "alternative");
  const companions = relationships.filter((r: any) => r.relationship === "companion");

  // SVG dimensions & node layout settings
  const width = 600;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;

  // Let's compute positions dynamically
  // 1. Center category node: (centerX, centerY)
  // 2. Pivot Repository: (centerX, centerY - 120)
  // 3. Alternatives (left side, distributed vertically/radially)
  const leftAlts = alternatives.slice(0, 4);
  const leftNodes = leftAlts.map((alt: any, index: number) => {
    const angle = 140 + (index * 80) / Math.max(1, leftAlts.length - 1); // radial distribution
    const rad = (angle * Math.PI) / 180;
    const distance = 140;
    return {
      x: centerX + distance * Math.cos(rad),
      y: centerY + distance * Math.sin(rad),
      label: alt.related_repo,
      type: "alternative",
      data: alt,
    };
  });

  // 4. Companions (right side, distributed vertically/radially)
  const rightComps = companions.slice(0, 4);
  const rightNodes = rightComps.map((comp: any, index: number) => {
    const angle = -40 + (index * 80) / Math.max(1, rightComps.length - 1);
    const rad = (angle * Math.PI) / 180;
    const distance = 140;
    return {
      x: centerX + distance * Math.cos(rad),
      y: centerY + distance * Math.sin(rad),
      label: comp.related_repo,
      type: "companion",
      data: comp,
    };
  });

  const allNodes = [
    { x: centerX, y: centerY - 120, label: `${repo.owner}/${repo.name}`, type: "pivot", data: repo },
    ...leftNodes,
    ...rightNodes,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Ecosystem Strength Dashboard */}
      <div className="panel card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Canonical Category</span>
          <span style={{ fontSize: "20px", fontWeight: "bold", color: "var(--accent-blue)", marginTop: "4px" }}>{primaryCategory}</span>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.4" }}>
            {strength.details}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", borderLeft: "1px solid var(--border)", paddingLeft: "20px" }}>
          {/* Circular progress display */}
          <div style={{ position: "relative", width: "70px", height: "70px", flexShrink: 0 }}>
            <svg width="70" height="70" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2.5"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="2.5"
                strokeDasharray={`${strength.score}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "16px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
              {strength.score}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Ecosystem Strength</span>
            <div style={{ fontSize: "15px", fontWeight: "bold", color: "var(--text-primary)", marginTop: "2px" }}>{strength.status}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "1px solid var(--border)", paddingLeft: "20px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Active Projects: <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{strength.metrics?.active_projects ?? 0}</strong></span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Total Stars: <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{(strength.metrics?.total_stars ?? 0).toLocaleString()}</strong></span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Avg Star Velocity: <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{strength.metrics?.average_velocity ?? 0}/day</strong></span>
        </div>
      </div>

      {/* Interactive Ecosystem Graph Map */}
      <div className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 4px 0", marginBottom: 0 }}>
          <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
            🌐 Ecosystem relationship map
          </span>
        </div>
        <div style={{ position: "relative", width: "100%", overflow: "hidden", display: "flex", justifyContent: "center" }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxHeight: "400px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            {/* Draw connectors to Center Node */}
            {allNodes.map((n, idx) => (
              <line
                key={`line-${idx}`}
                x1={centerX}
                y1={centerY}
                x2={n.x}
                y2={n.y}
                stroke={n.type === "companion" ? "var(--accent-yellow)" : "var(--accent-blue)"}
                strokeWidth={n.type === "pivot" ? 2.5 : 1.5}
                strokeDasharray={n.type === "companion" ? "4 4" : "0"}
                opacity="0.4"
              />
            ))}

            {/* Center Node (Category) */}
            <circle cx={centerX} cy={centerY} r="35" fill="var(--accent-blue)" fillOpacity={0.2} stroke="var(--accent-blue)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 6px rgba(88,166,255,0.4))" }} />
            <text x={centerX} y={centerY - 5} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="bold" fontFamily="var(--font-sans)">
              {primaryCategory.split(" ").slice(0, 1).join(" ")}
            </text>
            <text x={centerX} y={centerY + 8} textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="bold" fontFamily="var(--font-sans)">
              {primaryCategory.split(" ").slice(1).join(" ")}
            </text>

            {/* Render Surrounding Nodes */}
            {allNodes.map((n, idx) => {
              const r = n.type === "pivot" ? 22 : 16;
              const fill = n.type === "pivot" ? "var(--accent-green)" : n.type === "companion" ? "var(--accent-yellow)" : "var(--accent-blue)";
              const stroke = n.type === "pivot" ? "var(--accent-green)" : n.type === "companion" ? "var(--accent-yellow)" : "var(--accent-blue)";
              
              // Helper to split long owner/name strings
              const labelParts = n.label.split("/");
              const displayName = labelParts.length > 1 ? labelParts[1] : n.label;

              return (
                <g key={`node-${idx}`} style={{ cursor: "pointer" }} onClick={() => {
                  if (n.type !== "pivot") {
                    // Navigate or search
                    window.open(`https://github.com/${n.label}`, "_blank");
                  }
                }}>
                  <circle cx={n.x} cy={n.y} r={r} fill={fill} fillOpacity={n.type === "pivot" ? 0.2 : 0.15} stroke={stroke} strokeWidth="1.5" style={{ transition: "all 0.3s" }} />
                  <text x={n.x} y={n.y + r + 13} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontWeight={n.type === "pivot" ? "bold" : "normal"} fontFamily="var(--font-sans)">
                    {displayName}
                  </text>
                  <text x={n.x} y={n.y + 3} textAnchor="middle" fill="#fff" fontSize="8" fontFamily="var(--font-mono)" opacity="0.8">
                    {n.type === "pivot" ? "HQ" : n.type === "companion" ? "Stack" : "Alt"}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", fontSize: "11px", color: "var(--text-muted)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-green)" }} /> Selected Repository
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-blue)" }} /> Direct Alternatives
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-yellow)" }} /> Companion Stack Tools
          </div>
        </div>
      </div>

      {/* Alternatives Comparison Table */}
      <div className="panel table-scroll">
        <div className="panel-header" style={{ borderBottom: "none", padding: "16px 20px" }}>
          <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
            ⚔️ Direct Alternatives &amp; Competitors
          </span>
        </div>
        {alternatives.length === 0 ? (
          <p style={{ padding: "0 20px 20px 20px", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            No direct alternatives indexable in this category yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["ALTERNATIVE", "STARS", "LANGUAGE", "CONFIDENCE", "EXPLANATION"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alternatives.map((alt: any) => (
                <tr key={alt.related_repo} className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                    <a href={`https://github.com/${alt.related_repo}`} target="_blank" rel="noopener noreferrer" style={{ color: "#58a6ff", textDecoration: "none" }}>
                      {alt.related_repo}
                    </a>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>
                    {alt.stars ? alt.stars.toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                    {alt.primary_language || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      fontWeight: "bold",
                      fontFamily: "var(--font-mono)",
                      color: alt.confidence >= 0.75 ? "var(--green)" : alt.confidence >= 0.50 ? "var(--amber)" : "var(--pink)",
                      background: alt.confidence >= 0.75 ? "rgba(63, 185, 80, 0.1)" : alt.confidence >= 0.50 ? "rgba(210, 153, 34, 0.1)" : "rgba(248, 81, 73, 0.1)",
                      padding: "2px 6px",
                      borderRadius: "4px"
                    }}>
                      {Math.round(alt.confidence * 100)}%
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                    {alt.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Companions and Stack Combinations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        <div className="panel card-pad">
          <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
            <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
              🔌 Integrations &amp; Companion Stacks
            </span>
          </div>
          {companions.length === 0 ? (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 0 0" }}>
              No adjacent integrations detected.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              {companions.slice(0, 5).map((comp: any) => (
                <div key={comp.related_repo} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ color: "#ff9f43", fontWeight: "bold" }}>✦</span>
                  <div style={{ fontSize: "12px" }}>
                    <a href={`https://github.com/${comp.related_repo}`} target="_blank" rel="noopener noreferrer" style={{ color: "#58a6ff", textDecoration: "none", fontWeight: 600 }}>
                      {comp.related_repo}
                    </a>
                    <span style={{ color: "var(--text-secondary)", marginLeft: "6px" }}>
                      — {comp.explanation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel card-pad" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
              <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
                📋 Ecosystem Research Brief
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5", margin: "8px 0 0 0" }}>
              Generate a structured technology landscape analyst brief mapping the leaders, stacks, and trends of this category.
            </p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport}
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "10px 16px",
              borderRadius: "6px",
              background: "var(--cyan)",
              color: "#000",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              transition: "opacity 0.2s"
            }}
            className="hover:opacity-90"
          >
            {generatingReport ? "Generating Brief..." : "⚡ Generate Ecosystem Brief"}
          </button>
        </div>
      </div>

      {/* Render Markdown Ecosystem Report inline */}
      {reportMd && (
        <div className="panel card-pad" style={{ borderLeft: "3px solid var(--cyan)", marginTop: "8px" }}>
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>📄 Category Landscape Report</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(reportMd);
                alert("Report copied to clipboard!");
              }}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              Copy Markdown
            </button>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7", overflowY: "auto", maxHeight: "500px", paddingRight: "10px" }} className="markdown-body font-sans">
            <ReactMarkdown>{reportMd}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RepoDeepDive() {
  const params = useParams<{ id: string[] }>();
  const repoId = Array.isArray(params.id) ? params.id.join("/") : params.id;

  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const [pinned, setPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<"metrics" | "ecosystem">("metrics");

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

  const { data: releases } = useQuery({
    queryKey: ["releases", repoId],
    queryFn: () => api.getReleases(repoId, 10),
    enabled: !!repoId,
  });

  const owner = repoId.split("/")[0] ?? "";
  const repoName = repoId.split("/").slice(1).join("/") ?? "";
  
  const { data: deepSummary, isLoading: deepLoading } = useQuery<DeepSummary>({
    queryKey: ["deep-summary", repoId],
    queryFn: () => api.getDeepSummary(owner, repoName),
    enabled: !!repoId && !!owner && !!repoName,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const { data: mentions } = useQuery({
    queryKey: ["mentions", repoId],
    queryFn: () => api.getSocialMentions(repoId, 20),
    enabled: !!repoId,
  });

  const { data: commitActivity } = useQuery({
    queryKey: ["commit-activity", repoId],
    queryFn: () => api.getCommitActivity(repoId),
    enabled: !!repoId,
  });

  const { data: watchStatus, refetch: refetchWatchStatus } = useQuery({
    queryKey: ["watch-status", userId, repoId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      return api.checkWatchlist(token, repoId);
    },
    enabled: !!userId && !!repoId,
  });

  const toggleWatch = async () => {
    if (!userId) {
      alert("Please sign in to watch repositories.");
      return;
    }
    const token = await getToken();
    if (!token) {
      alert("Authentication token missing. Please sign in again.");
      return;
    }
    try {
      if (watchStatus?.watching && watchStatus.item) {
        await api.removeFromWatchlist(token, watchStatus.item.id);
      } else {
        await api.addToWatchlist(token, { repo_id: repoId });
      }
      refetchWatchStatus();
      queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
    } catch (err) {
      console.error("Failed to toggle watchlist:", err);
    }
  };

  const [deltaRunState, setDeltaRunState] = useState<"idle"|"running"|"done"|"error">("idle");

  useEffect(() => {
    if (!repo || repo.category !== "untracked" || deltaRunState !== "idle") return;
    const parts = repoId.split("/");
    if (parts.length < 2) return;
    const [runOwner, ...rest] = parts;
    const runName = rest.join("/");
    setDeltaRunState("running");
    api.deltaRun(runOwner, runName)
      .then(() => {
        setDeltaRunState("done");
        queryClient.invalidateQueries({ queryKey: ["repo", repoId] });
        queryClient.invalidateQueries({ queryKey: ["daily-metrics", repoId, 60] });
        queryClient.invalidateQueries({ queryKey: ["computed-scores", repoId, 60] });
        queryClient.invalidateQueries({ queryKey: ["deep-summary", repoId] });
      })
      .catch(() => setDeltaRunState("error"));
  }, [repo, repoId, deltaRunState, queryClient]);

  if (repoLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px", letterSpacing: "0.06em" }}>
          // LOADING REPO DATA<span className="terminal-cursor" />
        </p>
      </div>
    );
  }

  if (!repo) {
    return <p style={{ fontFamily: "var(--font-mono)", color: "var(--pink)", paddingTop: "40px", fontSize: "12px" }}>✕ REPOSITORY NOT FOUND</p>;
  }

  const latest = dailyMetrics?.[dailyMetrics.length - 1];

  const latestScore = scores?.[scores.length - 1];
  const priorScore = scores && scores.length >= 2 ? scores[scores.length - 2] : null;

  let trendChangePct = 0;
  if (latestScore?.trend_score && priorScore?.trend_score) {
    const lVal = latestScore.trend_score;
    const pVal = priorScore.trend_score;
    if (pVal > 0) {
      trendChangePct = ((lVal - pVal) / pVal) * 100;
    }
  }

  let velChangePct = 0;
  if (latestScore?.star_velocity_7d && priorScore?.star_velocity_7d) {
    const lVal = latestScore.star_velocity_7d;
    const pVal = priorScore.star_velocity_7d;
    if (pVal > 0) {
      velChangePct = ((lVal - pVal) / pVal) * 100;
    }
  }

  return (
    <div className="page-root" style={{ display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "40px" }}>
      {/* 1. Header */}
      <div className="repo-header-container">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
              {repo.owner}/<span style={{ color: "var(--text-secondary)" }}>{repo.name}</span>
            </span>
            {repo.sustainability_label && <HealthBadge label={repo.sustainability_label} />}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "12px", marginTop: "8px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              {repo.category}
            </span>
            <span>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              {repo.age_days.toLocaleString()}d old
            </span>
            <span>·</span>
            {repo.primary_language && (
              <>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  {repo.primary_language}
                </span>
                <span>·</span>
              </>
            )}
            <span style={{ color: "var(--text-secondary)" }}>{repo.description}</span>
          </div>
        </div>

        <div className="repo-header-actions" style={{ display: "inline-flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button
            onClick={toggleWatch}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: watchStatus?.watching ? "rgba(63, 185, 80, 0.15)" : "rgba(255, 255, 255, 0.02)",
              color: watchStatus?.watching ? "var(--green)" : "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            {watchStatus?.watching ? "Watching" : "Watch"}
          </button>

          <button
            onClick={() => setPinned(!pinned)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: pinned ? "rgba(210, 153, 34, 0.15)" : "rgba(255, 255, 255, 0.02)",
              color: pinned ? "var(--amber)" : "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="8" x2="22" y2="12"></line><line x1="12" y1="2" x2="22" y2="12"></line><path d="M12 2L2 12h10L12 2z"></path></svg>
            {pinned ? "Pinned" : "Pin"}
          </button>

          <a
            href={repo.github_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "rgba(255, 255, 255, 0.02)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>

          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "rgba(255, 255, 255, 0.02)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            •••
          </button>
        </div>
      </div>

      {/* 2. 6-Column Metric Grid */}
      <div className="metric-pills-grid">
        <MetricCard
          label="Trend score"
          value={repo.trend_score?.toFixed(4) ?? "—"}
          valueColor="var(--amber)"
          subLabel={`${trendChangePct >= 0 ? "+" : ""}${trendChangePct.toFixed(1)}% vs prior`}
          subColor={trendChangePct >= 0 ? "var(--green)" : "var(--pink)"}
        />
        <MetricCard
          label="Stars / day (7d)"
          value={Math.round(repo.star_velocity_7d ?? 0).toLocaleString()}
          subLabel={`${velChangePct >= 0 ? "+" : ""}${velChangePct.toFixed(0)}% vs prior week`}
          subColor={velChangePct >= 0 ? "var(--green)" : "var(--pink)"}
        />
        <MetricCard
          label="Acceleration"
          value={repo.acceleration?.toFixed(3) ?? "—"}
          subLabel={repo.acceleration && repo.acceleration > 0.001 ? "accelerating momentum" : repo.acceleration && repo.acceleration < -0.001 ? "decelerating momentum" : "flat momentum"}
          subColor="var(--text-muted)"
        />
        <MetricCard
          label="Sustainability"
          value={repo.sustainability_score != null ? `${(repo.sustainability_score * 100).toFixed(0)}%` : "—"}
          subLabel={repo.sustainability_score && repo.sustainability_score < 0.4 ? "low retention" : repo.sustainability_score && repo.sustainability_score < 0.7 ? "medium retention" : "high retention"}
          subColor="var(--text-muted)"
        />
        <MetricCard
          label="Fork / star ratio"
          value={repo.fork_to_star_ratio?.toFixed(3) ?? "—"}
          subLabel={`${(latest?.forks ?? repo.forks ?? 0).toLocaleString()} forks`}
          subColor="var(--text-muted)"
        />
        <MetricCard
          label="Total stars"
          value={(latest?.stars ?? repo.stars ?? 0).toLocaleString()}
          valueColor="var(--green)"
          subLabel={`+${(latest?.daily_star_delta ?? 0).toLocaleString()} today`}
          subColor="var(--green)"
        />
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: "flex",
        gap: "24px",
        borderBottom: "1px solid var(--border)",
        marginTop: "10px",
        marginBottom: "18px",
        position: "sticky",
        top: "0",
        background: "var(--bg-main)",
        zIndex: 10,
        paddingTop: "6px"
      }}>
        <button
          onClick={() => setActiveTab("metrics")}
          style={{
            padding: "10px 4px",
            fontSize: "14px",
            fontWeight: activeTab === "metrics" ? 600 : 400,
            color: activeTab === "metrics" ? "var(--text-primary)" : "var(--text-muted)",
            borderBottom: activeTab === "metrics" ? "2px solid var(--accent-blue)" : "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            transition: "all 0.2s"
          }}
        >
          Repository Metrics &amp; Analysis
        </button>
        <button
          onClick={() => setActiveTab("ecosystem")}
          style={{
            padding: "10px 4px",
            fontSize: "14px",
            fontWeight: activeTab === "ecosystem" ? 600 : 400,
            color: activeTab === "ecosystem" ? "var(--text-primary)" : "var(--text-muted)",
            borderBottom: activeTab === "ecosystem" ? "2px solid var(--accent-blue)" : "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            transition: "all 0.2s"
          }}
        >
          Ecosystem Intelligence
        </button>
      </div>

      {activeTab === "metrics" ? (
        <>
          {/* 3. AI Deep Analysis Panel */}
          {deepLoading && (
            <div className="panel card-pad" style={{ borderLeft: "3px solid var(--cyan)" }}>
              <div className="panel-header" style={{ marginBottom: "10px" }}>
                <span className="panel-title">◈ AI DEEP ANALYSIS</span>
              </div>
              <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px", letterSpacing: "0.06em" }}>// GENERATING ANALYSIS…<span className="terminal-cursor" /></p>
            </div>
          )}

          {deepSummary && (
            <>
              <div className="panel card-pad" style={{ borderLeft: "3px solid var(--cyan)" }}>
                <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
                    ✨ AI deep analysis
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {formatDateFriendly(deepSummary.generated_at)}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
                  {[
                    { key: "What", value: deepSummary.what, badgeBg: "rgba(88, 166, 255, 0.15)", badgeColor: "var(--accent-blue)" },
                    { key: "Why", value: deepSummary.why, badgeBg: "rgba(63, 185, 80, 0.15)", badgeColor: "var(--accent-green)" },
                    { key: "How", value: deepSummary.how, badgeBg: "rgba(210, 153, 34, 0.15)", badgeColor: "var(--accent-yellow)" },
                  ].map(({ key, value, badgeBg, badgeColor }) => value && (
                    <div key={key} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        fontFamily: "var(--font-sans)",
                        background: badgeBg,
                        color: badgeColor,
                        minWidth: "50px",
                        textAlign: "center",
                        flexShrink: 0
                      }}>{key}</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.5" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Tech Stack & Use Cases */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {deepSummary.tech_stack.length > 0 && (
                  <div className="panel card-pad">
                    <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
                      <span className="panel-title" style={{ fontSize: "14px" }}>
                        🛠️ Tech stack
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                      {deepSummary.tech_stack.map((tech) => {
                        const isTS = tech.toLowerCase() === "typescript";
                        const isJS = tech.toLowerCase() === "javascript";
                        const bg = isTS ? "rgba(88, 166, 255, 0.15)" : isJS ? "rgba(210, 153, 34, 0.15)" : "rgba(255,255,255,0.03)";
                        const color = isTS ? "var(--accent-blue)" : isJS ? "var(--accent-yellow)" : "var(--text-secondary)";
                        const border = isTS ? "1px solid rgba(88,166,255,0.25)" : isJS ? "1px solid rgba(210,153,34,0.25)" : "1px solid var(--border)";
                        return (
                          <span key={tech} style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            padding: "3px 10px",
                            borderRadius: "4px",
                            background: bg,
                            color: color,
                            border: border
                          }}>
                            {tech}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {deepSummary.use_cases.length > 0 && (
                  <div className="panel card-pad">
                    <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
                      <span className="panel-title" style={{ fontSize: "14px" }}>
                        📋 Use cases
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                      {deepSummary.use_cases.map((uc) => (
                        <div key={uc} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                          <span style={{ color: "var(--green)", fontWeight: "bold" }}>✓</span>
                          <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{uc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Language Breakdown & Signal Explainer */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {Object.keys(deepSummary.languages).length > 0 && (
                  <div className="panel card-pad">
                    <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 12px 0", marginBottom: 0 }}>
                      <span className="panel-title" style={{ fontSize: "14px" }}>
                        &lt;/ &gt; Language breakdown
                      </span>
                    </div>
                    {(() => {
                      const total = Object.values(deepSummary.languages).reduce((a, b) => a + b, 0);
                      const sorted = Object.entries(deepSummary.languages).sort(([, a], [, b]) => b - a);
                      const COLORS = ["#818cf8", "#ff9f43", "var(--green)", "var(--pink)", "#9d7fff", "#ff9944", "#44aaff", "#ff44aa"];
                      return (
                        <div style={{ display: "flex", flexDirection: "column", marginTop: "8px" }}>
                          <div style={{ display: "flex", height: "10px", borderRadius: "5px", overflow: "hidden", width: "100%" }}>
                            {sorted.map(([lang, bytes], i) => (
                              <div key={lang} title={`${lang}: ${((bytes / total) * 100).toFixed(1)}%`}
                                style={{ width: `${(bytes / total) * 100}%`, background: COLORS[i % COLORS.length], minWidth: "2px" }} />
                            ))}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: "12px" }}>
                            {sorted.slice(0, 6).map(([lang, bytes], i) => (
                              <div key={lang} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontFamily: "var(--font-sans)" }}>
                                <span style={{ color: COLORS[i % COLORS.length], fontSize: "14px" }}>●</span>
                                <span style={{ color: "var(--text-secondary)" }}>
                                  {lang} <span style={{ color: "var(--text-muted)", marginLeft: "4px" }}>{((bytes / total) * 100).toFixed(1)}%</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {scores && scores.length > 0 && (
                  <SignalExplainer scores={scores} />
                )}
              </div>

              {/* 6. Top Contributors */}
              {deepSummary.contributors.length > 0 && (
                <div className="panel card-pad">
                  <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="panel-title" style={{ fontSize: "14px" }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      Top contributors
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      by commit count
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
                    {deepSummary.contributors.slice(0, 10).map((c) => (
                      <a key={c.login} href={c.profile_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "20px", background: "rgba(255,255,255,0.01)", textDecoration: "none", transition: "all 0.2s" }}
                        className="hover:bg-space-800"
                      >
                        <img src={c.avatar_url} alt={c.login} style={{ width: "20px", height: "20px", borderRadius: "50%" }} />
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{c.login}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{c.contributions} commits</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Fallback AI Summary */}
          {!deepSummary && !deepLoading && repo.repo_summary && (
            <div className="panel card-pad" style={{ borderLeft: "3px solid var(--cyan)" }}>
              <div className="panel-header" style={{ marginBottom: "10px" }}>
                <span className="panel-title">◈ AI SUMMARY</span>
              </div>
              <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "13px", margin: 0 }}>
                {repo.repo_summary}
              </p>
            </div>
          )}

          {/* 7. Star History */}
          {dailyMetrics && dailyMetrics.length > 0 && (
            <StarHistoryChart data={dailyMetrics} mentions={mentions} />
          )}

          {/* 8. Daily Star Delta & Contributor Growth side by side */}
          {dailyMetrics && dailyMetrics.length > 0 && (
            <div className="chart-row-2">
              <DailyDeltaChart data={dailyMetrics} />
              <ContributorChart data={dailyMetrics} />
            </div>
          )}

          {/* 9. Star Forecast (90 days) */}
          <ForecastChart owner={repo.owner} name={repo.name} />

          {/* 10. Velocity vs Acceleration & Trend Score Timeline side by side */}
          {scores && scores.length > 0 && (
            <div className="chart-row-2">
              <VelocityChart data={scores} />
              <ScoreTimeline data={scores} />
            </div>
          )}

          {/* Commit activity */}
          {commitActivity && commitActivity.length > 0 && (
            <CommitHeatmap data={commitActivity} />
          )}

          {/* Social Mentions */}
          <SocialMentionsFeed mentions={mentions || []} />

          {/* Recent Releases */}
          <ReleaseChangelog releases={releases || []} owner={repo.owner} name={repo.name} />

          {/* 11. Similar Repositories */}
          <RecommendationsPanel repoOwner={repo.owner} repoName={repo.name} />

          {/* 12. Raw Metrics snapshots table */}
          {dailyMetrics && dailyMetrics.length > 0 && (
            <div className="panel table-scroll">
              <div className="panel-header" style={{ borderBottom: "none", padding: "16px 20px" }}>
                <span className="panel-title" style={{ fontSize: "14px" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  Raw metrics — last 7 snapshots
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["DATE", "STARS", "+STARS", "FORKS", "CONTRIBUTORS", "OPEN ISSUES", "RELEASES"].map((h) => {
                      let cls = "th-mono";
                      if (["FORKS", "CONTRIBUTORS", "OPEN ISSUES"].includes(h)) cls += " col-hide-mobile";
                      if (h === "RELEASES") cls += " col-hide-tablet";
                      return <th key={h} className={cls} style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dailyMetrics.slice(-7).reverse().map((m) => (
                    <tr key={m.date} className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>{m.date}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{m.stars.toLocaleString()}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: m.daily_star_delta > 0 ? "var(--green)" : "var(--text-muted)" }}>
                        {m.daily_star_delta > 0 ? `+${m.daily_star_delta}` : m.daily_star_delta}
                      </td>
                      <td className="col-hide-mobile" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.forks.toLocaleString()}</td>
                      <td className="col-hide-mobile" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.contributors}</td>
                      <td className="col-hide-mobile" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.open_issues}</td>
                      <td className="col-hide-tablet" style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>{m.releases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <EcosystemTabContent repoId={repoId} repo={repo} />
      )}
    </div>
  );
}
