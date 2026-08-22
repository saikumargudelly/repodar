"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ForecastResult } from "@/lib/api";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { format, addDays } from "date-fns";

interface Props {
  owner: string;
  name: string;
}

export function ForecastChart({ owner, name }: Props) {
  const { data: forecast, isLoading, error } = useQuery<ForecastResult>({
    queryKey: ["forecast", owner, name],
    queryFn: () => api.getForecast(owner, name),
    staleTime: 30 * 60_000,
    retry: 1,
  });

  if (isLoading) return <div className="h-56 flex items-center justify-center text-space-400 text-sm animate-pulse">Computing forecast…</div>;
  if (error || !forecast) return null; // Silently hide if no historical data

  const today = new Date();
  const data = [
    { date: "Today", stars: forecast.current_stars },
    { date: "+15d",  stars: Math.round(forecast.current_stars + (forecast.forecast_30d - forecast.current_stars) * 0.5) },
    { date: "+30d",  stars: Math.round(forecast.forecast_30d) },
    { date: "+45d",  stars: Math.round(forecast.forecast_30d + (forecast.forecast_90d - forecast.forecast_30d) * 0.25) },
    { date: "+60d",  stars: Math.round(forecast.forecast_30d + (forecast.forecast_90d - forecast.forecast_30d) * 0.5) },
    { date: "+75d",  stars: Math.round(forecast.forecast_30d + (forecast.forecast_90d - forecast.forecast_30d) * 0.75) },
    { date: "+90d",  stars: Math.round(forecast.forecast_90d) },
  ];

  const growthLabelColors: Record<string, string> = {
    "Hyper-growth": "text-emerald-400 bg-emerald-400/10",
    "High growth":  "text-blue-400 bg-blue-400/10",
    Steady:         "text-slate-400 bg-slate-800",
    Stagnating:     "text-amber-400 bg-amber-400/10",
    Declining:      "text-red-400 bg-red-400/10",
  };
  const labelClass = growthLabelColors[forecast.growth_label] ?? "text-space-300 bg-space-800";

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
      }}
    >
      <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 16px 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="panel-title" style={{ fontSize: "14px", fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          Star forecast (90 days)
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Linear regression · {Math.round(forecast.breakout_probability * 100)}% breakout probability · {forecast.growth_label}
        </span>
      </div>

      {/* KPI Box */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", padding: "12px 16px", background: "rgba(255, 255, 255, 0.01)", border: "1px solid var(--border)", borderRadius: "6px", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Now</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{forecast.current_stars.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>+30d estimate</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--green)" }}>~{Math.round(forecast.forecast_30d).toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>+90d estimate</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--green)" }}>~{Math.round(forecast.forecast_90d).toLocaleString()}</div>
        </div>
      </div>

      <div className="h-48 min-w-0" style={{ minWidth: 0, minHeight: 192 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={192}>
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} width={45}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", borderRadius: 6, fontSize: 12 }}
              itemStyle={{ color: "var(--text-primary)" }}
              labelStyle={{ color: "var(--text-muted)" }}
              formatter={(value: any) => [value.toLocaleString(), "Stars"]}
            />
            <ReferenceLine x="Today" stroke="var(--border)" strokeDasharray="3 3" label={{ value: "Now", fill: "var(--text-muted)", fontSize: 10, position: "top" }} />
            <Area
              type="monotone" dataKey="stars" stroke="var(--green)" strokeWidth={2}
              fillOpacity={1} fill="url(#fcGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Metadata Row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", marginTop: "16px", fontFamily: "var(--font-sans)", fontSize: "12px" }}>
        <div>
          <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>Breakout prob.</span>
          <span style={{ fontWeight: 600, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>{Math.round(forecast.breakout_probability * 100)}%</span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>Trajectory</span>
          <span style={{ fontWeight: 600, color: "var(--green)" }}>{forecast.growth_label}</span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>Based on</span>
          <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>7d velocity avg</span>
        </div>
      </div>
    </div>
  );
}
