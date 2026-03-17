"use client";

import { useState } from "react";
import { RepoFilterDTO } from "@/lib/api";

interface FilterPanelProps {
  initialFilter?: RepoFilterDTO;
  onFilterChange: (filter: RepoFilterDTO) => void;
  onClose?: () => void;
}

export function FilterPanel({ initialFilter, onFilterChange, onClose }: FilterPanelProps) {
  const [filter, setFilter] = useState<RepoFilterDTO>(initialFilter || {});

  const handleChange = (field: keyof RepoFilterDTO, value: any) => {
    setFilter((prev) => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    // Clean up empty fields before applying
    const cleaned = { ...filter };
    if (cleaned.languages && cleaned.languages.length === 0) delete cleaned.languages;
    if (cleaned.categories && cleaned.categories.length === 0) delete cleaned.categories;
    if (cleaned.min_stars === undefined || isNaN(cleaned.min_stars)) delete cleaned.min_stars;
    if (cleaned.max_stars === undefined || isNaN(cleaned.max_stars)) delete cleaned.max_stars;
    if (cleaned.min_age_days === undefined || isNaN(cleaned.min_age_days)) delete cleaned.min_age_days;
    if (cleaned.max_age_days === undefined || isNaN(cleaned.max_age_days)) delete cleaned.max_age_days;
    if (cleaned.min_trend_score === undefined || isNaN(cleaned.min_trend_score)) delete cleaned.min_trend_score;
    if (cleaned.sustainability_label === "") delete cleaned.sustainability_label;

    onFilterChange(cleaned);
    if (onClose) onClose();
  };

  const handleClear = () => {
    setFilter({});
    onFilterChange({});
    if (onClose) onClose();
  };

  return (
    <div className="bg-space-900 border border-space-800 rounded-lg p-5 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-space-100 uppercase tracking-wider">Advanced Filters</h3>
        {onClose && (
          <button onClick={onClose} className="text-space-400 hover:text-space-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stars Range */}
        <div className="space-y-2">
          <label className="text-xs text-space-400 font-medium">Stars Range</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full bg-space-950 border border-space-800 rounded px-3 py-1.5 text-sm text-space-200 focus:outline-none focus:border-accent-500"
              value={filter.min_stars || ""}
              onChange={(e) => handleChange("min_stars", e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <span className="text-space-500">-</span>
            <input
              type="number"
              placeholder="Max"
              className="w-full bg-space-950 border border-space-800 rounded px-3 py-1.5 text-sm text-space-200 focus:outline-none focus:border-accent-500"
              value={filter.max_stars || ""}
              onChange={(e) => handleChange("max_stars", e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Age Range */}
        <div className="space-y-2">
          <label className="text-xs text-space-400 font-medium">Age (Days)</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full bg-space-950 border border-space-800 rounded px-3 py-1.5 text-sm text-space-200 focus:outline-none focus:border-accent-500"
              value={filter.min_age_days || ""}
              onChange={(e) => handleChange("min_age_days", e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <span className="text-space-500">-</span>
            <input
              type="number"
              placeholder="Max"
              className="w-full bg-space-950 border border-space-800 rounded px-3 py-1.5 text-sm text-space-200 focus:outline-none focus:border-accent-500"
              value={filter.max_age_days || ""}
              onChange={(e) => handleChange("max_age_days", e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Sustainability & Trend */}
        <div className="space-y-2">
          <label className="text-xs text-space-400 font-medium">Sustainability</label>
          <select
            className="w-full bg-space-950 border border-space-800 rounded px-3 py-1.5 text-sm text-space-200 focus:outline-none focus:border-accent-500"
            value={filter.sustainability_label || ""}
            onChange={(e) => handleChange("sustainability_label", e.target.value || undefined)}
          >
            <option value="">Any</option>
            <option value="HIGH">High (Scale-ready)</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low (Risk)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-space-400 font-medium">Min Trend Score</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            placeholder="0.0 - 1.0"
            className="w-full bg-space-950 border border-space-800 rounded px-3 py-1.5 text-sm text-space-200 focus:outline-none focus:border-accent-500"
            value={filter.min_trend_score || ""}
            onChange={(e) => handleChange("min_trend_score", e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-space-800 flex justify-end space-x-3">
        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm text-space-400 hover:text-space-200 transition-colors"
        >
          Clear Filters
        </button>
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 text-sm font-medium rounded transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
