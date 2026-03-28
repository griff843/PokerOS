"use client";

import type { TableSimDrill } from "@/lib/drill-schema";
import type { DrillAttempt } from "@/lib/session-types";
import { buildMomentumSignal, extractConceptLabel, extractDecisionLabel } from "@/lib/study-session-ui";

interface SessionRailProps {
  drill: TableSimDrill;
  attempts: DrillAttempt[];
  assignmentBucket?: "exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive";
  assignmentRationale?: string;
  onExit: () => void;
}

export function SessionRail({ drill, attempts, assignmentBucket, assignmentRationale, onExit }: SessionRailProps) {
  const momentum = buildMomentumSignal(attempts);
  const assignmentLabel = assignmentBucket ? formatAssignmentBucket(assignmentBucket) : null;

  return (
    <div className="sticky top-0 z-20 rounded-[26px] border border-white/8 bg-gray-950/80 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
            Current Node
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-200">
            <span className="rounded-full border border-white/8 bg-black/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-300">
              {drill.node_id}
            </span>
            <span className="truncate font-semibold text-white">{extractConceptLabel(drill)}</span>
            <span className="hidden text-sm text-gray-500 lg:inline">{extractDecisionLabel(drill)}</span>
          </div>
          {assignmentLabel ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-500/18 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                {assignmentLabel}
              </span>
              {assignmentRationale ? (
                <span className="max-w-[48rem] text-xs leading-5 text-gray-400">{assignmentRationale}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="rounded-2xl border border-emerald-500/18 bg-emerald-500/10 px-3.5 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/85">
              {momentum.label}
            </p>
            <p className="text-xs text-emerald-50/75">{momentum.detail}</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-2xl border border-white/8 bg-black/25 px-3.5 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/15 hover:bg-white/5"
          >
            Exit Session
          </button>
        </div>
      </div>
    </div>
  );
}

function formatAssignmentBucket(bucket: NonNullable<SessionRailProps["assignmentBucket"]>) {
  switch (bucket) {
    case "exact_match":
      return "Exact Match";
    case "turn_line_transfer":
      return "Turn-Line Transfer";
    case "sizing_stability":
      return "Sizing Stability";
    case "bridge_reconstruction":
      return "Bridge Reconstruction";
    case "memory_decisive":
      return "Memory Decisive";
  }
}
