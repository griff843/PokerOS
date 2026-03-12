"use client";

import type { ReplayStreet } from "@/lib/learning-transparency";

interface ReplayControlsProps {
  streets: ReplayStreet[];
  currentStreet: ReplayStreet;
  onSelectStreet: (street: ReplayStreet) => void;
  onStepForward: () => void;
  onStepBack: () => void;
}

export function ReplayControls({
  streets,
  currentStreet,
  onSelectStreet,
  onStepForward,
  onStepBack,
}: ReplayControlsProps) {
  const currentIndex = streets.indexOf(currentStreet);

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onStepBack}
          disabled={currentIndex <= 0}
          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Back
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Street Replay</p>
        <button
          type="button"
          onClick={onStepForward}
          disabled={currentIndex >= streets.length - 1}
          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {streets.map((street) => {
          const active = street === currentStreet;
          return (
            <button
              key={street}
              type="button"
              onClick={() => onSelectStreet(street)}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-100 shadow-[0_12px_28px_rgba(16,185,129,0.12)]"
                  : "border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-gray-800"
              }`}
            >
              {street}
            </button>
          );
        })}
      </div>
    </div>
  );
}
