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
    <div className="bg-[var(--bg-surface)] rounded-xl p-5 space-y-6 border border-[var(--border)]">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-wider font-mono uppercase">Advanced Filters</h3>
        {onClose && (
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stars Range */}
        <div className="space-y-2">
          <label className="text-xs text-[var(--text-secondary)] font-medium font-mono uppercase tracking-wider">Stars Range</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)] font-mono transition-all"
              value={filter.min_stars || ""}
              onChange={(e) => handleChange("min_stars", e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <span className="text-[var(--text-muted)] font-mono">-</span>
            <input
              type="number"
              placeholder="Max"
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)] font-mono transition-all"
              value={filter.max_stars || ""}
              onChange={(e) => handleChange("max_stars", e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Age Range */}
        <div className="space-y-2">
          <label className="text-xs text-[var(--text-secondary)] font-medium font-mono uppercase tracking-wider">Age (Days)</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)] font-mono transition-all"
              value={filter.min_age_days || ""}
              onChange={(e) => handleChange("min_age_days", e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <span className="text-[var(--text-muted)] font-mono">-</span>
            <input
              type="number"
              placeholder="Max"
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)] font-mono transition-all"
              value={filter.max_age_days || ""}
              onChange={(e) => handleChange("max_age_days", e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Sustainability & Trend */}
        <div className="space-y-2">
          <label className="text-xs text-[var(--text-secondary)] font-medium font-mono uppercase tracking-wider">Sustainability</label>
          <select
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] transition-all font-mono [&>option]:bg-[var(--bg-surface)] [&>option]:text-[var(--text-primary)]"
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
          <label className="text-xs text-[var(--text-secondary)] font-medium font-mono uppercase tracking-wider">Min Trend Score</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            placeholder="0.0 - 1.0"
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)] font-mono transition-all"
            value={filter.min_trend_score || ""}
            onChange={(e) => handleChange("min_trend_score", e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border)] flex justify-end space-x-3">
        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors font-medium rounded-md cursor-pointer"
        >
          Clear Filters
        </button>
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-[var(--accent-blue)] text-[var(--bg-primary)] hover:bg-[var(--accent-blue)]/90 text-sm font-semibold rounded-md transition-colors shadow-sm cursor-pointer"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
