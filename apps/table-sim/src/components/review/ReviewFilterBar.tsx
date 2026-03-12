"use client";

import { FILTERABLE_TAGS, type ReviewFilter } from "@/lib/review-types";

interface ReviewFilterBarProps {
  filter: ReviewFilter;
  tagFilter: string | null;
  onFilterChange: (f: ReviewFilter) => void;
  onTagFilterChange: (tag: string | null) => void;
}

export function ReviewFilterBar({
  filter,
  tagFilter,
  onFilterChange,
  onTagFilterChange,
}: ReviewFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1.5">
        <button
          onClick={() => onFilterChange("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          All
        </button>
        <button
          onClick={() => onFilterChange("incorrect")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "incorrect"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          Incorrect Only
        </button>
      </div>

      <select
        value={tagFilter ?? ""}
        onChange={(e) => onTagFilterChange(e.target.value || null)}
        className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-gray-700"
      >
        <option value="">All tags</option>
        {FILTERABLE_TAGS.map((tag) => (
          <option key={tag} value={tag}>
            {tag.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
