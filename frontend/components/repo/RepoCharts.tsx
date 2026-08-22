"use client";

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ComposedChart, Bar, ReferenceLine,
} from "recharts";
import { DailyMetricPoint, ComputedMetricPoint, SocialMentionItem } from "@/lib/api";
import { formatCompactNumber } from "@/lib/utils";
import { ChartContainer } from "./ChartContainer";

const tooltipStyle = {
  contentStyle: {
    background: "rgba(38, 37, 36, 0.8)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.45)",
    color: "var(--text-primary)"
  },
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

// 1. Star History Chart
export function StarHistoryChart({ data, mentions }: {
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
    <div 
      className="panel card-pad" 
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>
          Star history
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          total cumulative stars
        </span>
      </div>
      <ChartContainer minHeight={200}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
          <AreaChart data={enriched} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="starGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={42} tickFormatter={(v) => formatCompactNumber(v)} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v: any) => [v != null ? v.toLocaleString() : "—", "Stars"]} />
            <Area type="monotone" dataKey="stars" stroke="#818cf8" fill="url(#starGrad)" strokeWidth={2} dot={false} />
            {data.map((d) =>
              mentionDates.has(d.date) ? (
                <ReferenceLine
                  key={d.date}
                  x={d.date}
                  stroke="#ff9f43"
                  strokeDasharray="4 2"
                  label={{ value: "💬", position: "top", fontSize: 10 }}
                />
              ) : null
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

// 2. Daily Star Delta Chart
export function DailyDeltaChart({ data }: { data: DailyMetricPoint[] }) {
  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><rect x="18" y="3" width="4" height="18"></rect><rect x="10" y="8" width="4" height="13"></rect><rect x="2" y="13" width="4" height="8"></rect></svg>
          Daily star delta
        </span>
      </div>
      <ChartContainer minHeight={180}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="daily_star_delta" name="Stars Added" fill="var(--accent-green)" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

// 3. Contributor Growth Chart
export function ContributorChart({ data }: { data: DailyMetricPoint[] }) {
  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Contributor growth
        </span>
      </div>
      <ChartContainer minHeight={180}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="contributors" name="Total Contributors" stroke="var(--accent-green)" fill="url(#contribGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

// 4. Velocity vs Acceleration Chart
export function VelocityChart({ data }: { data: ComputedMetricPoint[] }) {
  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          Velocity &amp; Acceleration
        </span>
      </div>
      <ChartContainer minHeight={180}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="star_velocity_7d" name="7d Velocity" stroke="#38bdf8" fill="rgba(56, 189, 248, 0.05)" strokeWidth={1.5} dot={false} />
            <Bar dataKey="acceleration" name="Acceleration" fill="var(--accent-yellow)" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

// 5. Score Timeline Chart
export function ScoreTimeline({ data }: { data: ComputedMetricPoint[] }) {
  return (
    <div 
      className="panel card-pad"
      style={{
        background: "rgba(38, 37, 36, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          Trend score timeline
        </span>
      </div>
      <ChartContainer minHeight={180}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-yellow)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--accent-yellow)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={formatDateShort} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={36} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="trend_score" name="Trend Score" stroke="var(--accent-yellow)" fill="url(#scoreGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
