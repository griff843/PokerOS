"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { loadSessionPlan, type TableSimActivePool } from "@/lib/session-plan";
import type { CommandCenterSnapshot } from "@/lib/command-center";
import { SESSION_COUNT_OPTIONS, SESSION_POOL_OPTIONS } from "@/lib/session-controls";
import { RecommendedTrainingBlockCard } from "@/components/training/RecommendedTrainingBlockCard";
import { buildMomentumSignal, formatDecisionConfidence, formatSessionLabel } from "@/lib/study-session-ui";

export function CommandCenter() {
  const { state, dispatch, startSession } = useSession();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(true);
  const [activePool, setActivePool] = useState<TableSimActivePool>("baseline");

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setSnapshotLoading(true);
      try {
        const response = await fetch("/api/command-center", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load command center");
        }
        const data = (await response.json()) as CommandCenterSnapshot;
        if (!cancelled) {
          setSnapshot(data);
          setCount(data.recommendedConfig.count);
          setTimed(data.recommendedConfig.timed);
          setActivePool(data.recommendedConfig.activePool);
        }
      } catch (error) {
        console.error("Failed to load command center:", error);
        if (!cancelled) {
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setSnapshotLoading(false);
        }
      }
    }

    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasActiveSession = state.drills.length > 0 && state.phase !== "configuring" && state.phase !== "summary";
  const hasCompletedSession = state.phase === "summary" && state.attempts.length > 0;
  const hasCurrentReview = state.attempts.length > 0;
  const incorrectAttempts = state.attempts.filter((attempt) => !attempt.correct).length;
  const currentDrill = hasActiveSession ? state.drills[state.currentIndex]?.drill : null;
  const liveMomentum = state.attempts.length > 0 ? buildMomentumSignal(state.attempts) : null;

  const recentLiveWork = useMemo(
    () => state.attempts.slice(-4).reverse().map((attempt) => ({
      title: attempt.drill.title,
      detail: `${attempt.drill.node_id} · ${formatDecisionConfidence(attempt.confidence)}`,
      outcome: attempt.correct
        ? `Locked in at ${Math.round(attempt.score * 100)}% with ${formatDecisionConfidence(attempt.confidence).toLowerCase()} confidence.`
        : `Missed at ${Math.round(attempt.score * 100)}%; review the trigger before you move on.`,
      tsLabel: "Current block",
    })),
    [state.attempts]
  );

  const displayedRecentWork = recentLiveWork.length > 0
    ? recentLiveWork
    : snapshot?.recentWork ?? [];

  const primaryAction = useMemo(() => {
    if (hasActiveSession) {
      return {
        eyebrow: "Session in progress",
        title: "Return to the live decision loop",
        rationale: "The highest-value next action is to continue the block already in motion while the current focus is still fresh.",
        cta: "Continue Session",
        onClick: () => router.push("/app/play"),
      };
    }

    if (hasCompletedSession && incorrectAttempts > 0) {
      return {
        eyebrow: "Post-session review",
        title: "Review the key mistakes from your last block",
        rationale: `You have ${incorrectAttempts} recent misses ready for review, so the cleanest next step is to close the loop before starting a fresh block.`,
        cta: "Review Key Mistakes",
        onClick: () => {
          dispatch({ type: "START_REVIEW", filter: "incorrect", tagFilter: null });
          router.push("/app/review");
        },
      };
    }

    if (hasCompletedSession) {
      return {
        eyebrow: "Session checkpoint",
        title: "Use the latest summary as your re-entry point",
        rationale: "Your last block is complete. Reopen the summary to anchor what changed before you branch into the next session.",
        cta: "Open Latest Summary",
        onClick: () => router.push("/app/summary"),
      };
    }

    return {
      eyebrow: "Daily focus",
      title: snapshotLoading ? "Loading today’s best next action" : snapshot?.dailyFocus.title ?? "Start today’s session",
      rationale: snapshot?.dailyFocus.rationale ?? "Use today’s block to reinforce the clearest live signal before expanding.",
      cta: starting ? "Loading Session" : "Start Today’s Session",
      onClick: handleStart,
    };
  }, [dispatch, hasActiveSession, hasCompletedSession, incorrectAttempts, router, snapshot, snapshotLoading, starting]);

  const momentumSignals = useMemo(() => {
    const signals: Array<{ label: string; detail: string; tone: "good" | "warning" | "neutral" }> = [];

    if (liveMomentum) {
      signals.push({
        label: liveMomentum.label,
        detail: liveMomentum.detail,
        tone: "neutral",
      });
    }

    if (snapshot?.momentum.improving) {
      signals.push({
        label: `Improving: ${snapshot.momentum.improving.label}`,
        detail: snapshot.momentum.improving.detail,
        tone: "good",
      });
    }

    if (snapshot?.momentum.slipping) {
      signals.push({
        label: `Slipping: ${snapshot.momentum.slipping.label}`,
        detail: snapshot.momentum.slipping.detail,
        tone: "warning",
      });
    }

    if (snapshot?.momentum.readiness) {
      signals.push({
        label: snapshot.momentum.readiness.label,
        detail: snapshot.momentum.readiness.detail,
        tone: snapshot.momentum.readiness.label === "Needs a reset" ? "warning" : "good",
      });
    }

    signals.push({
      label: snapshot?.momentum.cadence.label ?? (snapshotLoading ? "Reading recent form" : "Fresh slate"),
      detail: snapshot?.momentum.cadence.detail ?? "No stored reps yet, so today starts from a balanced baseline.",
      tone: "neutral",
    });

    return signals.slice(0, 4);
  }, [liveMomentum, snapshot, snapshotLoading]);

  async function handleStart() {
    setStarting(true);
    try {
      const plan = await loadSessionPlan(count, activePool);
      startSession({ config: { drillCount: count, timed, activePool }, plan });
      router.push("/app/play");
    } catch (error) {
      console.error("Failed to start session:", error);
      setStarting(false);
    }
  }

  const secondaryActions = [
    hasActiveSession
      ? { label: "Continue active session", detail: "Return to the current decision loop without resetting the focus.", onClick: () => router.push("/app/play") }
      : null,
    hasCurrentReview && incorrectAttempts > 0
      ? {
          label: "Review key mistakes",
          detail: `${incorrectAttempts} recent misses are ready for guided review.`,
          onClick: () => {
            dispatch({ type: "START_REVIEW", filter: "incorrect", tagFilter: null });
            router.push("/app/review");
          },
        }
      : null,
    hasCompletedSession
      ? { label: "Open latest summary", detail: "Use the latest session summary as your checkpoint before the next block.", onClick: () => router.push("/app/summary") }
      : null,
    !hasActiveSession && snapshot?.recommendedTrainingBlock
      ? { label: "Open coach plan", detail: "Review the prescribed training block before you launch it.", onClick: () => router.push(snapshot.recommendedTrainingBlock.href) }
      : !hasActiveSession
        ? { label: "Start recommended block", detail: "Begin the current recommended session with the configured pool and block size.", onClick: handleStart }
        : null,
    snapshot
      ? { label: "Explore weaknesses", detail: "Open the long-horizon leak map and see which concepts are recurring or worsening.", onClick: () => router.push("/app/weaknesses") }
      : null,
    snapshot
      ? { label: "Open growth profile", detail: "See whether the larger profile is strengthening, flat, or slipping over time.", onClick: () => router.push("/app/growth") }
      : null,
    { label: "Review imported hands", detail: "Bring real-play hands into the coaching loop or review the ones already mapped.", onClick: () => router.push("/app/hands") },
  ].filter((action): action is { label: string; detail: string; onClick: () => void } => Boolean(action));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.18),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[32px] border border-white/8 bg-[linear-gradient(135deg,rgba(17,24,39,0.88),rgba(10,15,28,0.82))] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300/85">Poker OS</p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.6rem]">Command Center</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  A calm orientation layer for what to work on now, what is changing, and how to re-enter training with confidence.
                </p>
              </div>
            </div>
            {snapshot?.generatedAt ? (
              <div className="rounded-full border border-white/8 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(snapshot.generatedAt))}
              </div>
            ) : null}
          </div>
        </header>

        <DailyFocusCard
          primaryAction={primaryAction}
          snapshot={snapshot}
          loading={snapshotLoading}
          hasActiveSession={hasActiveSession}
          currentDrillTitle={currentDrill?.title ?? null}
          currentDrillNode={currentDrill?.node_id ?? null}
          count={count}
          timed={timed}
          activePool={activePool}
          starting={starting}
          onCountChange={setCount}
          onTimedChange={setTimed}
          onPoolChange={setActivePool}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <MomentumCard signals={momentumSignals} />
          <CoachBriefingCard loading={snapshotLoading} snapshot={snapshot} />
        </div>

        {snapshot?.recommendedTrainingBlock ? (
          <RecommendedTrainingBlockCard
            plan={snapshot.recommendedTrainingBlock.plan}
            onOpen={() => router.push(snapshot.recommendedTrainingBlock.href)}
            ctaLabel="Open Coach Plan"
          />
        ) : null}

        <PriorityLeaksCard
          loading={snapshotLoading}
          snapshot={snapshot}
          hasReviewableMistakes={incorrectAttempts > 0}
          onReviewMistakes={() => {
            dispatch({ type: "START_REVIEW", filter: "incorrect", tagFilter: null });
            router.push("/app/review");
          }}
          onExploreWeaknesses={() => router.push("/app/weaknesses")}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
          <RecentWorkCard work={displayedRecentWork} />
          <SecondaryActionsCard actions={secondaryActions} />
        </div>
      </div>
    </div>
  );
}

function DailyFocusCard({
  primaryAction,
  snapshot,
  loading,
  hasActiveSession,
  currentDrillTitle,
  currentDrillNode,
  count,
  timed,
  activePool,
  starting,
  onCountChange,
  onTimedChange,
  onPoolChange,
}: {
  primaryAction: { eyebrow: string; title: string; rationale: string; cta: string; onClick: () => void };
  snapshot: CommandCenterSnapshot | null;
  loading: boolean;
  hasActiveSession: boolean;
  currentDrillTitle: string | null;
  currentDrillNode: string | null;
  count: number;
  timed: boolean;
  activePool: TableSimActivePool;
  starting: boolean;
  onCountChange: (count: number) => void;
  onTimedChange: (timed: boolean) => void;
  onPoolChange: (pool: TableSimActivePool) => void;
}) {
  const reasons = hasActiveSession
    ? [
        `${currentDrillNode ?? "Current node"} is already live.`,
        `${currentDrillTitle ?? "Your current focus"} is ready to resume without a reset.`,
      ]
    : snapshot?.dailyFocus.reasons ?? [];

  return (
    <section className="rounded-[36px] border border-emerald-400/16 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] p-6 shadow-[0_34px_110px_rgba(0,0,0,0.42)] sm:p-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-200/85">{primaryAction.eyebrow}</p>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[2.8rem]">{primaryAction.title}</h2>
            <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">{primaryAction.rationale}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FocusMetric label="Focus" value={hasActiveSession ? currentDrillNode ?? "Live block" : snapshot?.dailyFocus.concept ?? "Balanced reinforcement"} />
            <FocusMetric label="Session size" value={hasActiveSession ? "Live session" : snapshot?.dailyFocus.effort ?? `${count} deliberate reps`} />
            <FocusMetric label="Mix" value={hasActiveSession ? currentDrillTitle ?? "Return to stage" : snapshot?.dailyFocus.mix ?? "Balanced block"} />
          </div>

          {reasons.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {reasons.map((reason) => (
                <div key={reason} className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-medium text-slate-200">
                  {reason}
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={loading || starting}
            className="inline-flex min-w-[260px] items-center justify-center rounded-[26px] bg-emerald-500 px-6 py-4 text-base font-semibold text-slate-950 shadow-[0_18px_44px_rgba(16,185,129,0.36)] transition hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-700/70 disabled:text-white"
          >
            {primaryAction.cta}
          </button>
        </div>

        <div className="space-y-4 rounded-[30px] border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Today at a glance</p>
            <p className="text-sm leading-6 text-slate-300">
              Keep the main recommendation strong. Adjust the block only if you want a different effort level or pool lens.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <BriefingTile label="Node" value={hasActiveSession ? currentDrillNode ?? "Live session" : snapshot?.dailyFocus.nodeId ?? "Baseline"} />
            <BriefingTile label="Pool" value={hasActiveSession ? "Current session" : snapshot?.dailyFocus.pool ?? (activePool === "baseline" ? "Baseline" : `Pool ${activePool}`)} />
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Block size</p>
            <div className="flex flex-wrap gap-2">
              {SESSION_COUNT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onCountChange(option)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    count === option
                      ? "bg-emerald-500/18 text-emerald-50 ring-1 ring-emerald-400/30"
                      : "bg-white/5 text-slate-400 ring-1 ring-white/8 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pool lens</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {SESSION_POOL_OPTIONS.map((pool) => (
                <button
                  key={pool.value}
                  type="button"
                  onClick={() => onPoolChange(pool.value)}
                  className={`rounded-[22px] border px-4 py-3 text-left transition ${
                    activePool === pool.value
                      ? "border-amber-400/50 bg-amber-500/10 text-amber-50"
                      : "border-white/8 bg-white/5 text-slate-300 hover:border-white/14"
                  }`}
                >
                  <div className="text-sm font-semibold">{pool.label}</div>
                  <div className="mt-1 text-xs text-current/70">{pool.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[22px] border border-white/8 bg-slate-950/70 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Timed decisions</p>
              <p className="text-xs text-slate-500">Keep urgency in the decision loop</p>
            </div>
            <button
              type="button"
              onClick={() => onTimedChange(!timed)}
              className={`relative h-6 w-12 rounded-full transition-colors ${timed ? "bg-emerald-600" : "bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${timed ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MomentumCard({
  signals,
}: {
  signals: Array<{ label: string; detail: string; tone: "good" | "warning" | "neutral" }>;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Momentum Snapshot</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">The recent shape of your game, kept selective and easy to scan.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {signals.map((signal) => (
          <TrendItem key={`${signal.label}:${signal.detail}`} label={signal.label} detail={signal.detail} tone={signal.tone} compact />
        ))}
      </div>
    </section>
  );
}

function CoachBriefingCard({ loading, snapshot }: { loading: boolean; snapshot: CommandCenterSnapshot | null }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Coach Briefing</p>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-white">
            {snapshot?.coachBriefing.headline ?? (loading ? "Preparing today’s orientation" : "Stay with the strongest live signal.")}
          </p>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Focus reminder</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {snapshot?.coachBriefing.reminder ?? "Use the next block to reinforce what is still unstable before you branch out."}
          </p>
        </div>
        <div className="rounded-[24px] border border-emerald-500/16 bg-emerald-500/8 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/90">Recommendation</p>
          <p className="mt-2 text-sm leading-6 text-emerald-50">
            {snapshot?.coachBriefing.recommendation ?? "Run another balanced block and let the next set of reps sharpen the live target."}
          </p>
        </div>
      </div>
    </section>
  );
}

function PriorityLeaksCard({
  loading,
  snapshot,
  hasReviewableMistakes,
  onReviewMistakes,
  onExploreWeaknesses,
}: {
  loading: boolean;
  snapshot: CommandCenterSnapshot | null;
  hasReviewableMistakes: boolean;
  onReviewMistakes: () => void;
  onExploreWeaknesses: () => void;
}) {
  const leaks = snapshot?.priorityLeaks ?? [];

  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Priority Leaks</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Only the weaknesses that most deserve attention right now.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExploreWeaknesses}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            Explore weaknesses
          </button>
          {hasReviewableMistakes ? (
            <button
              type="button"
              onClick={onReviewMistakes}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Review mistakes
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading the strongest current weakness signals.</p>
        ) : leaks.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">
            Not enough attempt history yet to rank strong leaks cleanly. Another deliberate block will sharpen this read.
          </p>
        ) : (
          leaks.map((leak) => (
            <div key={`${leak.label}:${leak.emphasis}`} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-white">{leak.label}</p>
                <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {leak.emphasis}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{leak.detail}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RecentWorkCard({ work }: { work: Array<{ title: string; detail: string; outcome: string; tsLabel: string }> }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Recent Work</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">Continuity from the last few sessions or the block you already have in motion.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {work.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">
            No recent work is stored yet. Once you finish a block, this area will keep the thread of what you were reinforcing.
          </p>
        ) : (
          work.map((item) => (
            <div key={`${item.tsLabel}:${item.title}`} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.tsLabel}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.outcome}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SecondaryActionsCard({
  actions,
}: {
  actions: Array<{ label: string; detail: string; onClick: () => void }>;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Next Actions</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Clear ways to continue without hunting through the app.</p>
      <div className="mt-4 grid gap-3">
        {actions.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">
            Your main next action is already at the top of the page. Start the recommended block and let new work sharpen the next read.
          </p>
        ) : (
          actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/5"
            >
              <p className="text-base font-semibold text-white">{action.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{action.detail}</p>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function FocusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{formatSessionLabel(value)}</p>
    </div>
  );
}

function BriefingTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TrendItem({
  label,
  detail,
  tone,
  compact = false,
}: {
  label: string;
  detail: string;
  tone: "good" | "warning" | "neutral";
  compact?: boolean;
}) {
  const toneClass = tone === "good"
    ? "border-emerald-500/18 bg-emerald-500/8"
    : tone === "warning"
      ? "border-amber-500/18 bg-amber-500/8"
      : "border-white/8 bg-black/20";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClass}`}>
      <p className={`font-semibold text-white ${compact ? "text-base" : "text-lg"}`}>{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}









