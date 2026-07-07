"use client";

import React from "react";
import { MetricCard } from "./MetricCard";

interface StickyMetricsBarProps {
  repo: any;
  latest: any;
  trendChangePct: number;
  velChangePct: number;
}

export function StickyMetricsBar({
  repo,
  latest,
  trendChangePct,
  velChangePct,
}: StickyMetricsBarProps) {
  const getTrendInterpretation = () => {
    if (trendChangePct > 5) return "Accelerating growth";
    if (trendChangePct < -5) return "Declining growth";
    return "Stable growth";
  };
  const getTrendColor = () => {
    if (trendChangePct > 5) return "var(--accent-green)";
    if (trendChangePct < -5) return "var(--accent-red)";
    return "var(--accent-yellow)";
  };

  const getVelocityInterpretation = (vel: number) => {
    if (vel >= 10) return "Growing";
    if (vel >= 1) return "Stable";
    return "Flat";
  };
  const getVelocityColor = (vel: number) => {
    if (vel >= 10) return "var(--accent-green)";
    if (vel >= 1) return "var(--text-primary)";
    return "var(--text-muted)";
  };

  const getAccelInterpretation = (acc: number) => {
    if (acc > 0.001) return "Accelerating";
    if (acc < -0.001) return "Decelerating";
    return "Flat Momentum";
  };
  const getAccelColor = (acc: number) => {
    if (acc > 0.001) return "var(--accent-green)";
    if (acc < -0.001) return "var(--accent-red)";
    return "var(--text-muted)";
  };

  const getSustainabilityInterpretation = (score: number) => {
    if (score >= 0.7) return "High Sustainability";
    if (score >= 0.4) return "Medium Sustainability";
    return "Single Maintainer Risk";
  };
  const getSustainabilityColor = (score: number) => {
    if (score >= 0.7) return "var(--accent-green)";
    if (score >= 0.4) return "var(--accent-yellow)";
    return "var(--accent-red)";
  };

  const getForkInterpretation = (ratio: number) => {
    if (ratio > 0.3) return "High Fork Activity";
    if (ratio < 0.05) return "Low Fork Activity";
    return "Balanced Fork Ratio";
  };

  const getPopularityInterpretation = (stars: number) => {
    if (stars >= 10000) return "Established OSS";
    if (stars >= 1000) return "Emerging OSS";
    return "New Project";
  };

  const starCount = latest?.stars ?? repo.stars ?? 0;
  const forkCount = latest?.forks ?? repo.forks ?? 0;
  const deltaToday = latest?.daily_star_delta ?? 0;

  return (
    <div 
      style={{
        position: "sticky",
        top: 0,
        zIndex: 90,
        background: "rgba(30, 29, 28, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        paddingTop: "12px",
        paddingBottom: "16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div 
        className="metric-pills-grid" 
        style={{ 
          marginBottom: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px"
        }}
      >
        <MetricCard
          label="Trend score"
          interpretation={getTrendInterpretation()}
          interpretationColor={getTrendColor()}
          evidence={`Score: ${repo.trend_score?.toFixed(4) ?? "—"} (${trendChangePct >= 0 ? "+" : ""}${trendChangePct.toFixed(1)}% vs snapshot)`}
          source="Based on: Cumulative Trend Formula"
        />
        <MetricCard
          label="Stars / day (7d)"
          interpretation={getVelocityInterpretation(repo.star_velocity_7d ?? 0)}
          interpretationColor={getVelocityColor(repo.star_velocity_7d ?? 0)}
          evidence={`+${Math.round(repo.star_velocity_7d ?? 0).toLocaleString()}/day (${velChangePct >= 0 ? "+" : ""}${velChangePct.toFixed(0)}% vs last week)`}
          source="Based on: 7-Day Star Velocity"
        />
        <MetricCard
          label="Acceleration"
          interpretation={getAccelInterpretation(repo.acceleration ?? 0)}
          interpretationColor={getAccelColor(repo.acceleration ?? 0)}
          evidence={`Rate: ${repo.acceleration?.toFixed(4) ?? "—"}`}
          source="Based on: Star Velocity Acceleration"
        />
        <MetricCard
          label="Sustainability"
          interpretation={getSustainabilityInterpretation(repo.sustainability_score ?? 0)}
          interpretationColor={getSustainabilityColor(repo.sustainability_score ?? 0)}
          evidence={`Distribution index: ${(repo.sustainability_score * 100).toFixed(0)}%`}
          source="Based on: Gini Index Commit Share"
        />
        <MetricCard
          label="Fork / star ratio"
          interpretation={getForkInterpretation(repo.fork_to_star_ratio ?? 0)}
          evidence={`Ratio: ${repo.fork_to_star_ratio?.toFixed(3) ?? "—"} (${forkCount.toLocaleString()} forks)`}
          source="Based on: Fork to Star Ratio"
        />
        <MetricCard
          label="Total stars"
          interpretation={getPopularityInterpretation(starCount)}
          interpretationColor="var(--accent-green)"
          evidence={`${starCount.toLocaleString()} stars (+${deltaToday.toLocaleString()} today)`}
          source="Based on: Cumulative Star Metrics"
        />
      </div>
    </div>
  );
}
