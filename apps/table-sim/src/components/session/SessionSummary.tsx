"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { RecommendedTrainingBlockCard } from "@/components/training/RecommendedTrainingBlockCard";
import type { SessionState } from "@/lib/session-types";
import type { SessionAction } from "@/lib/session-reducer";
import { buildSessionReviewSnapshot, type SessionReviewAction } from "@/lib/session-review";

interface SessionSummaryProps {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  onNewSession: () => void;
}

export function SessionSummary({ state, dispatch, onNewSession }: SessionSummaryProps) {
  const router = useRouter();
  const snapshot = useMemo(() => buildSessionReviewSnapshot(state), [state]);

  function handleAction(action: SessionReviewAction) {
    if (action.action === "command_center") {
      onNewSession();
      return;
    }

    if (action.action === "open_intervention") {
      if (snapshot.recommendedTrainingBlock) {
        router.push(snapshot.recommendedTrainingBlock.href);
      }
      return;
    }

    dispatch({
      type: "START_REVIEW",
      filter: action.action === "review_incorrect" ? "incorrect" : "all",
      tagFilter: action.tagFilter,
    });
    router.push("/app/review");
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      <ReviewHeader
        focusLabel={snapshot.header.focusLabel}
        completionLabel={snapshot.header.completionLabel}
        headline={snapshot.header.headline}
        outcome={snapshot.header.outcome}
        poolLabel={snapshot.header.poolLabel}
        mixLabel={snapshot.header.mixLabel}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <PerformanceOverview items={snapshot.performance.items} />
        <CoachDebriefCard debrief={snapshot.coachDebrief} />
      </div>

      {snapshot.planningContext ? (
        <PlanningContextCard context={snapshot.planningContext} />
      ) : null}

      {snapshot.followUpContext ? (
        <PlanningContextCard context={snapshot.followUpContext} />
      ) : null}

      {snapshot.assignmentAudit ? (
        <AssignmentAuditCard audit={snapshot.assignmentAudit} />
      ) : null}

      <WhatMovedToday items={snapshot.movedToday.items} />

      <ImportantDrillsSection
        drills={snapshot.importantDrills}
        emptyMessage={snapshot.importantDrillsEmptyMessage}
        onReview={(tagFilter) => {
          dispatch({ type: "START_REVIEW", filter: "incorrect", tagFilter });
          router.push("/app/review");
        }}
      />

      {snapshot.recommendedTrainingBlock ? (
        <RecommendedTrainingBlockCard
          plan={snapshot.recommendedTrainingBlock.plan}
          onOpen={() => router.push(snapshot.recommendedTrainingBlock!.href)}
          ctaLabel="Open Coach Plan"
        />
      ) : null}

      <NextActionSection
        primary={snapshot.nextAction.primary}
        secondary={snapshot.nextAction.secondary}
        onAction={handleAction}
      />
    </div>
  );
}

function ReviewHeader({
  focusLabel,
  completionLabel,
  headline,
  outcome,
  poolLabel,
  mixLabel,
}: {
  focusLabel: string;
  completionLabel: string;
  headline: string;
  outcome: string;
  poolLabel: string;
  mixLabel: string;
}) {
  return (
    <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
      <div className="space-y-4">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/85">Session Review</p>
          <div className="flex flex-wrap gap-2">
            <ReviewChip label={focusLabel} />
            <ReviewChip label={poolLabel} />
            <ReviewChip label={mixLabel} subtle />
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">{completionLabel}</p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">{headline}</h1>
          <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">{outcome}</p>
        </div>
      </div>
    </section>
  );
}

function PerformanceOverview({
  items,
}: {
  items: Array<{ label: string; value: string; detail: string; tone: "good" | "warning" | "neutral" }>;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Performance Overview</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">A compact read on how the session landed, without turning the page into a score report.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}

function WhatMovedToday({
  items,
}: {
  items: Array<{ label: string; title: string; detail: string; tone: "good" | "warning" | "neutral" }>;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">What Moved Today</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">The few session-level shifts that matter most for improvement, kept selective and coach-readable.</p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <MetricCard key={`${item.label}:${item.title}`} label={item.label} value={item.title} detail={item.detail} tone={item.tone} />
        ))}
      </div>
    </section>
  );
}

function CoachDebriefCard({
  debrief,
}: {
  debrief: { takeaway: string; leak: string; pattern: string; nextFocus: string };
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Coach Debrief</p>
      <div className="mt-4 space-y-4">
        <DebriefPanel title="Strongest takeaway" text={debrief.takeaway} tone="neutral" />
        <DebriefPanel title="Root leak diagnosis" text={debrief.leak} tone="warning" />
        <DebriefPanel title="Recurring pattern" text={debrief.pattern} tone="neutral" />
        <DebriefPanel title="Next recommended focus" text={debrief.nextFocus} tone="good" />
      </div>
    </section>
  );
}

function PlanningContextCard({
  context,
}: {
  context: { title: string; detail: string };
}) {
  return (
    <section className="rounded-[30px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(44,26,8,0.38),rgba(19,14,11,0.88))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">{context.title}</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-50/90">{context.detail}</p>
    </section>
  );
}

function ImportantDrillsSection({
  drills,
  emptyMessage,
  onReview,
}: {
  drills: Array<{
    drillId: string;
    title: string;
    nodeId: string;
    outcome: string;
    detail: string;
    confidence: string;
    reviewTag: string | null;
    assignmentRationale?: string;
    assignmentBucket?: string | null;
  }>;
  emptyMessage?: string;
  onReview: (tagFilter: string | null) => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Important Drills To Review</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">A short queue of the highest-value spots to revisit, so deeper review stays intentional instead of sprawling.</p>
      </div>
      <div className="mt-4 space-y-3">
        {drills.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">{emptyMessage}</p>
        ) : (
          drills.map((drill) => (
            <div key={`${drill.drillId}:${drill.reviewTag ?? "all"}`} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-white">{drill.title}</p>
                    <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {drill.nodeId}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-amber-200">{drill.outcome}</p>
                  <p className="text-sm leading-6 text-slate-300">{drill.detail}</p>
                  {drill.assignmentBucket || drill.assignmentRationale ? (
                    <div className="rounded-[18px] border border-sky-500/14 bg-sky-500/8 px-3 py-2">
                      {drill.assignmentBucket ? (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/85">
                          {formatAssignmentBucket(drill.assignmentBucket)}
                        </p>
                      ) : null}
                      {drill.assignmentRationale ? (
                        <p className="mt-1 text-xs leading-5 text-slate-300">{drill.assignmentRationale}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex min-w-[180px] flex-col gap-2">
                  <div className="rounded-[18px] border border-white/8 bg-white/5 px-3 py-2 text-sm text-slate-300">
                    Confidence: <span className="font-semibold text-white">{drill.confidence}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onReview(drill.reviewTag)}
                    className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Open In Review
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AssignmentAuditCard({
  audit,
}: {
  audit: {
    title: string;
    detail: string;
    bucketMix: Array<{ label: string; count: number }>;
    selectedDrillIds: string[];
    warnings: string[];
    correctiveFocus?: string;
  };
}) {
  return (
    <section className="rounded-[30px] border border-sky-500/14 bg-[linear-gradient(180deg,rgba(9,25,39,0.92),rgba(8,16,28,0.88))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/85">{audit.title}</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">{audit.detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {audit.bucketMix.map((entry) => (
          <span
            key={entry.label}
            className="rounded-full border border-sky-500/18 bg-sky-500/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100"
          >
            {entry.count} {entry.label}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">
        Drill IDs: {audit.selectedDrillIds.join(", ")}
      </p>
      {audit.correctiveFocus ? (
        <div className="mt-4 rounded-[18px] border border-emerald-400/18 bg-emerald-500/8 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/85">Corrective Focus</p>
          <p className="mt-2 text-xs leading-5 text-emerald-50/90">{audit.correctiveFocus}</p>
        </div>
      ) : null}
      {audit.warnings.length ? (
        <div className="mt-4 rounded-[18px] border border-amber-400/18 bg-amber-500/8 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/85">Audit Warnings</p>
          <div className="mt-2 space-y-2">
            {audit.warnings.map((warning) => (
              <p key={warning} className="text-xs leading-5 text-amber-50/90">{warning}</p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatAssignmentBucket(bucket: string) {
  switch (bucket) {
    case "memory_decisive":
      return "Assignment: memory decisive";
    case "bridge_reconstruction":
      return "Assignment: bridge reconstruction";
    case "sizing_stability":
      return "Assignment: sizing stability";
    case "turn_line_transfer":
      return "Assignment: turn-line transfer";
    case "exact_match":
      return "Assignment: exact match";
    default:
      return `Assignment: ${bucket.replace(/_/g, " ")}`;
  }
}

function NextActionSection({
  primary,
  secondary,
  onAction,
}: {
  primary: SessionReviewAction;
  secondary: SessionReviewAction[];
  onAction: (action: SessionReviewAction) => void;
}) {
  return (
    <section className="rounded-[30px] border border-emerald-500/14 bg-[linear-gradient(180deg,rgba(7,18,24,0.94),rgba(8,16,28,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)] xl:items-start">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/85">Next Action</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Close the debrief with one clear move, then keep the rest of the flow close at hand.</p>
          </div>
          <div className="rounded-[26px] border border-emerald-500/14 bg-emerald-500/8 p-5">
            <p className="text-2xl font-semibold tracking-tight text-white">{primary.label}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90">{primary.detail}</p>
            <button
              type="button"
              onClick={() => onAction(primary)}
              className="mt-5 inline-flex min-w-[240px] items-center justify-center rounded-[22px] bg-emerald-500 px-5 py-4 text-base font-semibold text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.32)] transition hover:bg-emerald-400"
            >
              {primary.label}
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {secondary.map((action) => (
            <button
              key={`${action.action}:${action.label}`}
              type="button"
              onClick={() => onAction(action)}
              className="w-full rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/5"
            >
              <p className="text-base font-semibold text-white">{action.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{action.detail}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warning" | "neutral";
}) {
  const toneClass = tone === "good"
    ? "border-emerald-500/18 bg-emerald-500/8"
    : tone === "warning"
      ? "border-amber-500/18 bg-amber-500/8"
      : "border-white/8 bg-black/20";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function DebriefPanel({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "good" | "warning" | "neutral";
}) {
  const toneClass = tone === "good"
    ? "border-emerald-500/18 bg-emerald-500/8"
    : tone === "warning"
      ? "border-amber-500/18 bg-amber-500/8"
      : "border-white/8 bg-black/20";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
    </div>
  );
}

function ReviewChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${subtle ? "border-white/8 bg-white/5 text-slate-300" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"}`}>
      {label}
    </span>
  );
}

