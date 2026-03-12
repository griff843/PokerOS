"use client";

import { useMemo } from "react";
import { buildDiagnosticCapture, getPrimaryDiagnosticPrompt, type AdaptiveCoachingProfile } from "@poker-coach/core/browser";
import { buildDrillCoachingSnapshotFromAttempt } from "@/lib/drill-coach-view";
import { buildTransparencySnapshot } from "@/lib/learning-transparency";
import type { DrillAttempt } from "@/lib/session-types";
import { formatActionLine, formatDecisionConfidence, getPoolContextBadge } from "@/lib/study-session-ui";
import { CoachDiagnosisCard, RangeSupportCard, StrategyFrequencyCard, TransparencyVerdictCard } from "@/components/review/LearningTransparency";
import { DrillCoachingSummary } from "@/components/review/DrillCoachingSummary";

interface CoachingPanelProps {
  attempt: DrillAttempt;
  onAdvance: () => void;
  onCaptureDiagnostic: (diagnostic: DrillAttempt["diagnostic"]) => void;
  isLast: boolean;
  adaptiveSignal?: string;
  adaptiveProfile?: AdaptiveCoachingProfile;
}

export function CoachingPanel({ attempt, onAdvance, onCaptureDiagnostic, isLast, adaptiveSignal, adaptiveProfile }: CoachingPanelProps) {
  const snapshot = useMemo(() => buildDrillCoachingSnapshotFromAttempt(attempt, adaptiveProfile), [attempt, adaptiveProfile]);
  const transparency = useMemo(() => buildTransparencySnapshot(attempt), [attempt]);
  const poolBadge = getPoolContextBadge(attempt);
  const diagnosticPrompt = useMemo(() => getPrimaryDiagnosticPrompt(attempt.drill), [attempt.drill]);

  const breakdown = [
    { label: "Action", value: `${Math.round(attempt.actionScore * 100)}%` },
    { label: "Tags", value: `${Math.round(attempt.tagScore * 100)}%` },
    ...(attempt.resolvedAnswer.correct_size ? [{ label: "Sizing", value: `${Math.round(attempt.sizingScore * 100)}%` }] : []),
    { label: "Confidence", value: formatDecisionConfidence(attempt.confidence) },
  ];

  return (
    <section className="rounded-[30px] border border-white/8 bg-gray-900/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
            Decision Review
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                attempt.correct
                  ? "bg-emerald-500/16 text-emerald-50 ring-1 ring-emerald-400/35"
                  : "bg-red-500/16 text-red-50 ring-1 ring-red-400/35"
              }`}
            >
              {attempt.correct ? "Correct line" : "Incorrect line"}
            </span>
            <span className="rounded-full border border-white/8 bg-black/25 px-3.5 py-1.5 text-sm font-semibold text-white">
              Total score {Math.round(attempt.score * 100)}%
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/85">
            {poolBadge.label}
          </p>
          <p className="mt-1 max-w-[210px] text-xs leading-5 text-amber-50/75">{poolBadge.detail}</p>
        </div>
      </div>

      <TransparencyVerdictCard verdict={transparency.verdict} />

      <DrillCoachingSummary snapshot={snapshot} activePool={attempt.activePool} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">Line read</p>
          <div className="mt-3 space-y-2 text-sm text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <span>Your line</span>
              <span className="font-semibold text-white">{formatActionLine(attempt.userAction, attempt.userSizeBucket)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Resolved line</span>
              <span className="font-semibold text-white">
                {formatActionLine(attempt.resolvedAnswer.correct, attempt.resolvedAnswer.correct_size?.size_bucket ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Decision time</span>
              <span className="font-semibold text-white">{(attempt.elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">Score split</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {breakdown.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-gray-950/80 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <StrategyFrequencyCard frequencyView={transparency.frequencies} title="Solver honesty" />

      {adaptiveSignal ? (
        <div className="rounded-[24px] border border-sky-500/18 bg-sky-500/8 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/85">Coaching Emphasis</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{adaptiveSignal}</p>
        </div>
      ) : null}

      <RangeSupportCard rangeView={transparency.rangeView} title="Range logic" />

      <CoachDiagnosisCard diagnosis={transparency.diagnosis} />

      {diagnosticPrompt && !attempt.diagnostic ? (
        <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">Quick Reasoning Check</p>
            <p className="mt-2 text-sm leading-6 text-gray-300">{diagnosticPrompt.prompt}</p>
          </div>
          <div className="grid gap-2">
            {(diagnosticPrompt.options ?? []).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  const result = buildDiagnosticCapture({
                    drill: attempt.drill,
                    correct: attempt.correct,
                    confidence: attempt.confidence,
                    promptId: diagnosticPrompt.id,
                    optionId: option.id,
                  });
                  if (!result) {
                    return;
                  }
                  onCaptureDiagnostic({
                    promptId: result.promptId,
                    prompt: result.prompt,
                    promptType: result.promptType,
                    concept: result.concept,
                    expectedReasoning: result.expectedReasoning,
                    optionId: result.optionId,
                    optionLabel: result.optionLabel,
                    result,
                  });
                }}
                className="rounded-2xl border border-white/8 bg-gray-950/80 px-4 py-3 text-left text-sm leading-6 text-gray-100 transition hover:border-amber-400/40 hover:bg-amber-500/8"
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-gray-500">Optional. This helps the coach separate a line miss from a reasoning miss.</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onAdvance}
        className="w-full rounded-[24px] bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white shadow-[0_16px_44px_rgba(5,150,105,0.3)] transition hover:bg-emerald-500"
      >
        {isLast ? "View Summary" : "Next Drill"}
      </button>
      <p className="text-center text-xs uppercase tracking-[0.16em] text-gray-500">
        Space or Right Arrow to advance
      </p>
    </section>
  );
}
