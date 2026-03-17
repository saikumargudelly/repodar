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
    { date: "Today",             stars: forecast.current_stars,  isForecast: false },
    { date: format(addDays(today, 15), "MMM d"), stars: Math.round(forecast.current_stars + (forecast.forecast_30d - forecast.current_stars) / 2), isForecast: true },
    { date: "+30d",              stars: forecast.forecast_30d,   isForecast: true },
    { date: format(addDays(today, 60), "MMM d"), stars: Math.round(forecast.forecast_30d + (forecast.forecast_90d - forecast.forecast_30d) / 2), isForecast: true },
    { date: "+90d",              stars: forecast.forecast_90d,   isForecast: true },
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
    <div className="bg-space-900 border border-space-800 rounded-lg p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-space-100 font-medium text-sm tracking-wide">⭐ Star Forecast (90 Days)</h3>
          <p className="text-xs text-space-400 mt-0.5">Linear regression projection based on recent star velocity</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-xs text-space-400 mb-1 uppercase tracking-wider">Breakout Prob.</div>
            <div className="text-lg font-semibold text-accent-400">
              {Math.round(forecast.breakout_probability * 100)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-space-400 mb-1 uppercase tracking-wider">Trajectory</div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${labelClass}`}>
              {forecast.growth_label}
            </span>
          </div>
        </div>
      </div>

      {/* Star milestone badges */}
      <div className="flex gap-4 mb-4 text-xs font-mono">
        <div className="flex flex-col">
          <span className="text-space-500">Now</span>
          <span className="text-space-200 font-semibold">{forecast.current_stars.toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-space-500">+30d</span>
          <span className="text-emerald-400 font-semibold">+{(forecast.forecast_30d - forecast.current_stars).toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-space-500">+90d</span>
          <span className="text-emerald-300 font-semibold">+{(forecast.forecast_90d - forecast.current_stars).toLocaleString()}</span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="date" stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} width={45}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: 6, fontSize: 12 }}
              itemStyle={{ color: "#E5E7EB" }}
              labelStyle={{ color: "#9CA3AF" }}
              formatter={(value: any) => [value.toLocaleString(), "Stars"]}
            />
            <ReferenceLine x="Today" stroke="#374151" strokeDasharray="3 3" label={{ value: "Now", fill: "#6B7280", fontSize: 10 }} />
            <Area
              type="monotone" dataKey="stars" stroke="#818cf8" strokeWidth={2}
              fillOpacity={1} fill="url(#fcGrad)" strokeDasharray="5 5"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
