"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  DailyPlanBlock,
  DailyPlanBlockKind,
  DailySessionLength,
  DailyStudyPlan,
  DailyStudyPlanBundle,
} from "@/lib/daily-study-plan";

export function DailyStudyPlan() {
  const [bundle, setBundle] = useState<DailyStudyPlanBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLength, setSelectedLength] = useState<DailySessionLength>(45);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/daily-study-plan", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load daily study plan");
        const data = (await response.json()) as DailyStudyPlanBundle;
        if (!cancelled) {
          setBundle(data);
          setSelectedLength(data.defaultSessionLength);
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

  const plan = bundle
    ? selectedLength === 20
      ? bundle.plan20
      : selectedLength === 45
        ? bundle.plan45
        : bundle.plan90
    : null;

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
            <PlanSummarySection loading={loading} plan={plan} bundle={bundle} />
            <BlockList loading={loading} plan={plan} />
            <WhyThisPlan loading={loading} plan={plan} />
          </>
        )}
      </div>
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

function NoHistoryState({ plan }: { plan: DailyStudyPlan }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-10 text-center">
      <p className="text-white/60">No drill history yet.</p>
      <p className="mt-1 text-sm text-white/40">
        Complete a session to unlock your personalized daily study plan.
      </p>
      {plan.blocks[0] && (
        <Link
          href={plan.blocks[0].destination ?? "/app/session"}
          className="mt-5 inline-block rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {plan.blocks[0].title}
        </Link>
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
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Plan Summary
      </p>
      <p className="mt-2 text-base font-medium text-white">{plan.planSummary}</p>
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
}: {
  loading: boolean;
  plan: DailyStudyPlan | null;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5"
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
        <BlockCard key={`${block.kind}-${index}`} block={block} index={index} />
      ))}
    </div>
  );
}

function BlockCard({ block, index }: { block: DailyPlanBlock; index: number }) {
  const borderColor = index === 0 ? "border-emerald-500/30" : "border-white/10";
  const bgColor = index === 0 ? "bg-white/5" : "bg-white/[0.03]";

  const content = (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-5 py-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BlockKindIcon kind={block.kind} />
            <p className="text-sm font-medium text-white">{block.title}</p>
          </div>
          <p className="mt-1.5 text-sm text-white/50">{block.reason}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-white/40">{block.estimatedMinutes} min</span>
          {block.destination && (
            <span className="text-xs font-medium text-emerald-400/80">→ Open</span>
          )}
        </div>
      </div>
    </div>
  );

  if (block.destination) {
    return (
      <Link href={block.destination} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
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
