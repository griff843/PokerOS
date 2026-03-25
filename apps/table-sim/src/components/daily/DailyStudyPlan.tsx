"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  DailyPlanBlock,
  DailyPlanBlockKind,
  DailySessionLength,
  DailyStudyPlan,
  DailyStudyPlanBundle,
} from "@/lib/daily-study-plan";
import type { CalibrationSurfaceAdapter } from "@/lib/calibration-surface";
import { fetchCalibrationSurface } from "@/lib/calibration-surface";

export function DailyStudyPlan() {
  const [bundle, setBundle] = useState<DailyStudyPlanBundle | null>(null);
  const [calibration, setCalibration] = useState<CalibrationSurfaceAdapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLength, setSelectedLength] = useState<DailySessionLength>(45);
  // v4: lightweight in-session completion tracking (not persisted)
  const [completedIndices, setCompletedIndices] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [planResult, calibrationResult] = await Promise.allSettled([
          fetch("/api/daily-study-plan", { cache: "no-store" }),
          fetchCalibrationSurface({ limit: 12, topLimit: 1 }),
        ]);

        if (planResult.status !== "fulfilled") {
          throw new Error("Failed to load daily study plan");
        }
        if (!planResult.value.ok) {
          throw new Error("Failed to load daily study plan");
        }

        const data = (await planResult.value.json()) as DailyStudyPlanBundle;
        if (!cancelled) {
          setBundle(data);
          setSelectedLength(data.defaultSessionLength);
          if (calibrationResult.status === "fulfilled") {
            setCalibration(calibrationResult.value);
          } else {
            console.error("Failed to load calibration surface:", calibrationResult.reason);
            setCalibration(null);
          }
        }
      } catch (error) {
        console.error("Failed to load daily study plan:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset completion state when session length changes
  useEffect(() => {
    setCompletedIndices([]);
  }, [selectedLength]);

  const plan = bundle
    ? selectedLength === 20
      ? bundle.plan20
      : selectedLength === 45
        ? bundle.plan45
        : bundle.plan90
    : null;

  const allBlocksDone =
    plan !== null && plan.blocks.length > 0 && completedIndices.length === plan.blocks.length;

  function toggleBlock(index: number) {
    setCompletedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader loading={loading} bundle={bundle} />

        {!loading && bundle?.state === "no_history" ? (
          <NoHistoryState plan={bundle.plan20} />
        ) : (
          <>
            <SessionLengthSelector
              loading={loading}
              selected={selectedLength}
              bundle={bundle}
              onSelect={setSelectedLength}
            />
            <MainFocusCard loading={loading} plan={plan} />
            <PlanSummarySection loading={loading} plan={plan} bundle={bundle} />
            <CalibrationSummaryPanel loading={loading} calibration={calibration} />
            <BlockList
              loading={loading}
              plan={plan}
              completedIndices={completedIndices}
              onToggleComplete={toggleBlock}
            />
            {allBlocksDone && plan && <SessionCompletePanel plan={plan} />}
            <WhyThisPlan loading={loading} plan={plan} />
          </>
        )}
      </div>
    </div>
  );
}

export function CalibrationSummaryPanel({
  loading,
  calibration,
}: {
  loading: boolean;
  calibration: CalibrationSurfaceAdapter | null;
}) {
  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  if (!calibration || calibration.state === "no_calibration") {
    return null;
  }

  const summary = calibration.highlightedConcept;
  const toneClass = calibration.state === "strong_evidence"
    ? "border-emerald-500/20 bg-emerald-950/20"
    : calibration.state === "partial_evidence"
      ? "border-amber-500/20 bg-amber-950/20"
      : "border-white/10 bg-white/[0.03]";

  return (
    <div className={`rounded-xl border px-5 py-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Calibration Summary
      </p>
      <p className="mt-2 text-sm font-medium text-white">{calibration.headline}</p>
      <p className="mt-1 text-sm text-white/60">{summary?.whyThisStillMatters ?? calibration.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">
          {calibration.state.replace(/_/g, " ")}
        </span>
        {summary && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">
            {summary.label}
          </span>
        )}
        {summary && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">
            {summary.interventionState.replace(/_/g, " ")}
          </span>
        )}
      </div>
      {summary && (
        <p className="mt-3 text-xs text-white/40">
          Next move: {summary.suggestedAction?.detail ?? summary.retentionSummary}
        </p>
      )}
    </div>
  );
}

function PageHeader({
  loading,
  bundle,
}: {
  loading: boolean;
  bundle: DailyStudyPlanBundle | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-white">Today&apos;s Study Plan</h1>
        {!loading && bundle && (
          <p className="mt-0.5 text-sm text-emerald-400/70">
            {bundle.state === "ready"
              ? "Personalized from your coaching profile"
              : bundle.state === "sparse_history"
                ? "Building your coaching baseline"
                : "No history yet"}
          </p>
        )}
      </div>
      <Link
        href="/app/session"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Start Session
      </Link>
    </div>
  );
}

// v4: improved no-history state — more coaching voice, less placeholder feel
function NoHistoryState({ plan }: { plan: DailyStudyPlan }) {
  const block = plan.blocks[0];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-6 py-8 text-center">
        <p className="text-base font-semibold text-white">Your coaching engine is ready.</p>
        <p className="mt-2 text-sm text-white/50">
          Work through 10 drills to establish your baseline — after that, this page becomes your
          personalized daily guide.
        </p>
        {block?.destination && (
          <Link
            href={block.destination}
            className="mt-5 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {plan.firstAction.label}
          </Link>
        )}
      </div>
      {block && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            First Step
          </p>
          <p className="mt-2 text-sm text-white/80">{block.actionInstruction}</p>
          <p className="mt-1.5 text-xs text-white/40">
            Done when: {block.completionCondition}
          </p>
        </div>
      )}
    </div>
  );
}

function SessionLengthSelector({
  loading,
  selected,
  bundle,
  onSelect,
}: {
  loading: boolean;
  selected: DailySessionLength;
  bundle: DailyStudyPlanBundle | null;
  onSelect: (length: DailySessionLength) => void;
}) {
  if (loading) {
    return <div className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  const lengths = bundle?.availableSessionLengths ?? [20, 45, 90];

  return (
    <div className="flex gap-2">
      {(lengths as DailySessionLength[]).map((length) => (
        <button
          key={length}
          onClick={() => onSelect(length)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            selected === length
              ? "bg-emerald-600 text-white"
              : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          {length} min
        </button>
      ))}
      <span className="ml-auto self-center text-xs text-white/30">Choose session length</span>
    </div>
  );
}

function MainFocusCard({
  loading,
  plan,
}: {
  loading: boolean;
  plan: DailyStudyPlan | null;
}) {
  if (loading) {
    return <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }
  if (!plan) return null;

  const firstAction = plan.firstAction;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/60">
            Today&apos;s Focus
          </p>
          <p className="mt-1 text-base font-semibold text-white">{plan.mainFocus}</p>
          {/* v4: session goal — action-oriented one-liner */}
          <p className="mt-0.5 text-sm text-white/50">{plan.sessionGoal}</p>
          {/* v4: finishing condition — explicit session completion signal */}
          <p className="mt-2 text-xs text-white/30">
            Done when: {plan.finishingCondition}
          </p>
        </div>
        {firstAction.destination ? (
          <Link
            href={firstAction.destination}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {firstAction.label}
          </Link>
        ) : (
          <span className="shrink-0 rounded-lg bg-emerald-600/40 px-4 py-2 text-sm font-medium text-white/60">
            {firstAction.label}
          </span>
        )}
      </div>
    </div>
  );
}

function PlanSummarySection({
  loading,
  plan,
  bundle,
}: {
  loading: boolean;
  plan: DailyStudyPlan | null;
  bundle: DailyStudyPlanBundle | null;
}) {
  if (loading) {
    return <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }
  if (!plan) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Plan Summary
      </p>
      <p className="mt-2 text-sm text-white/70">{plan.planSummary}</p>
      {plan.urgencySignals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {plan.urgencySignals.map((signal) => (
            <UrgencyBadge key={signal} signal={signal} />
          ))}
        </div>
      )}
      {bundle?.primaryConceptLabel && (
        <p className="mt-2 text-sm text-white/50">
          Primary focus:{" "}
          <span className="text-white/70">{bundle.primaryConceptLabel}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-white/30">
        Estimated: {plan.totalEstimatedMinutes} min · {plan.blocks.length} block
        {plan.blocks.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function BlockList({
  loading,
  plan,
  completedIndices,
  onToggleComplete,
}: {
  loading: boolean;
  plan: DailyStudyPlan | null;
  completedIndices: number[];
  onToggleComplete: (index: number) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }
  if (!plan || plan.blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Session Blocks
      </p>
      {plan.blocks.map((block, index) => (
        <BlockCard
          key={`${block.kind}-${index}`}
          block={block}
          index={index}
          isCompleted={completedIndices.includes(index)}
          onToggleComplete={() => onToggleComplete(index)}
        />
      ))}
    </div>
  );
}

// v4: expanded block card with action framing and completion toggle
function BlockCard({
  block,
  index,
  isCompleted,
  onToggleComplete,
}: {
  block: DailyPlanBlock;
  index: number;
  isCompleted: boolean;
  onToggleComplete: () => void;
}) {
  const borderColor = isCompleted
    ? "border-white/5"
    : index === 0
      ? "border-emerald-500/30"
      : "border-white/10";
  const bgColor = isCompleted ? "bg-white/[0.02]" : index === 0 ? "bg-white/5" : "bg-white/[0.03]";
  const textOpacity = isCompleted ? "opacity-40" : "opacity-100";

  const cardContent = (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-5 py-4 transition-all`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className={`min-w-0 flex-1 ${textOpacity}`}>
          <div className="flex items-center gap-2">
            <BlockKindIcon kind={block.kind} />
            <p className={`text-sm font-medium ${isCompleted ? "text-white/40 line-through" : "text-white"}`}>
              {block.title}
            </p>
          </div>
          <p className="mt-1.5 text-sm text-white/50">{block.reason}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`text-xs ${isCompleted ? "text-white/20" : "text-white/40"}`}>
            {block.estimatedMinutes} min
          </span>
          {/* v4: completion toggle button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleComplete();
            }}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              isCompleted
                ? "bg-emerald-900/40 text-emerald-400/60 hover:bg-emerald-900/20"
                : "border border-white/10 text-white/40 hover:border-emerald-500/30 hover:text-emerald-400"
            }`}
          >
            {isCompleted ? "✓ Done" : "Mark done"}
          </button>
        </div>
      </div>

      {/* v4: action framing — always visible */}
      {!isCompleted && (
        <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
          <p className="text-xs text-white/60">
            <span className="text-white/30">What to do: </span>
            {block.actionInstruction}
          </p>
          <p className="text-xs text-white/40">
            <span className="text-white/20">Done when: </span>
            {block.completionCondition}
          </p>
        </div>
      )}

      {/* v4: next step hint — shown after completing the block */}
      {isCompleted && block.nextStepHint && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-xs text-emerald-400/60">→ {block.nextStepHint}</p>
        </div>
      )}

      {/* Open link indicator (non-completed blocks) */}
      {!isCompleted && block.destination && (
        <div className="mt-2 text-right">
          <span className="text-xs font-medium text-emerald-400/60">→ Open</span>
        </div>
      )}
    </div>
  );

  // Only make it a link if not completed (to avoid accidental navigation)
  if (block.destination && !isCompleted) {
    return (
      <Link href={block.destination} className="block transition-opacity hover:opacity-90">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

function BlockKindIcon({ kind }: { kind: DailyPlanBlockKind }) {
  const icons: Record<DailyPlanBlockKind, string> = {
    focus_concept: "◎",
    secondary_concept: "○",
    execute_intervention: "▶",
    review_real_hands: "♠",
    retention_check: "✓",
    inspect_replay_drift: "⟳",
  };
  const colors: Record<DailyPlanBlockKind, string> = {
    focus_concept: "text-emerald-400",
    secondary_concept: "text-emerald-300/60",
    execute_intervention: "text-amber-400",
    review_real_hands: "text-blue-400/80",
    retention_check: "text-purple-400/80",
    inspect_replay_drift: "text-white/40",
  };
  return (
    <span className={`shrink-0 text-sm ${colors[kind]}`} aria-hidden="true">
      {icons[kind]}
    </span>
  );
}

// v4: session complete panel — shown when all blocks are marked done
function SessionCompletePanel({ plan }: { plan: DailyStudyPlan }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-5 py-5 text-center">
      <p className="text-sm font-semibold text-emerald-400">Session complete</p>
      <p className="mt-1 text-xs text-white/50">
        You finished all {plan.blocks.length} block{plan.blocks.length !== 1 ? "s" : ""} for this
        session.
      </p>
      <p className="mt-2 text-xs text-white/30">{plan.expectedOutcome}</p>
      <Link
        href="/app/session"
        className="mt-4 inline-block rounded-lg border border-emerald-500/30 px-4 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-950/40"
      >
        Start another session
      </Link>
    </div>
  );
}

function WhyThisPlan({
  loading,
  plan,
}: {
  loading: boolean;
  plan: DailyStudyPlan | null;
}) {
  if (loading || !plan) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Why This Plan
      </p>
      <p className="mt-2 text-sm text-white/60">{plan.whyThisPlan}</p>
      <p className="mt-2 text-xs text-white/30">
        Expected outcome: {plan.expectedOutcome}
      </p>
    </div>
  );
}

function UrgencyBadge({ signal }: { signal: string }) {
  const isOverdue = signal.includes("overdue");
  const isIntervention = signal.includes("intervention");
  const cls = isOverdue
    ? "bg-red-900/30 text-red-300/80"
    : isIntervention
      ? "bg-amber-900/30 text-amber-300/80"
      : "bg-white/10 text-white/50";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{signal}</span>
  );
}
