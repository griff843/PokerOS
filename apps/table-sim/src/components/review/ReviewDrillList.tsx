"use client";

import type { DrillAttempt } from "@/lib/session-types";

interface ReviewDrillListProps {
  attempts: DrillAttempt[];
  filteredIndices: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function ReviewDrillList({
  attempts,
  filteredIndices,
  selectedIndex,
  onSelect,
}: ReviewDrillListProps) {
  if (filteredIndices.length === 0) return null;

  return (
    <div className="space-y-1.5 overflow-y-auto max-h-[40vh]">
      {filteredIndices.map((idx) => {
        const attempt = attempts[idx];
        const isActive = idx === selectedIndex;
        return (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-emerald-600/30 border border-emerald-600/50"
                : "bg-gray-800/50 hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-200 truncate mr-2">
                #{idx + 1} {attempt.drill.title}
              </span>
              <span
                className={`text-xs flex-shrink-0 ${
                  attempt.correct ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {attempt.correct ? "Correct" : "Wrong"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 uppercase tracking-wide">
              <span>{attempt.selection.kind}</span>
              <span>{attempt.selection.reason.replace(/_/g, " ")}</span>
            </div>
            {attempt.missedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {attempt.missedTags.map((tag) => (
                  <span key={tag} className="text-xs text-red-400/70">
                    {tag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
