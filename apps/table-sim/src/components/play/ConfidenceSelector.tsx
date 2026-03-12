"use client";

import type { DecisionConfidence } from "@/lib/session-types";
import { DECISION_CONFIDENCE_OPTIONS } from "@/lib/study-session-ui";

interface ConfidenceSelectorProps {
  value: DecisionConfidence;
  onChange: (value: DecisionConfidence) => void;
}

export function ConfidenceSelector({ value, onChange }: ConfidenceSelectorProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
          Confidence
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-600">Calibration</p>
      </div>
      <div className="inline-flex w-full rounded-[20px] border border-white/8 bg-black/20 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        {DECISION_CONFIDENCE_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex-1 rounded-2xl px-3 py-2.5 text-xs font-semibold transition ${
                selected
                  ? "bg-emerald-500/16 text-emerald-100 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.38)]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
