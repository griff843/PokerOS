"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { loadSessionPlan, type TableSimActivePool } from "@/lib/session-plan";
import type { WeaknessExplorerSnapshot } from "@/lib/weakness-explorer";

const DEFAULT_BLOCK_SIZE = 10;

export function WeaknessExplorer() {
  const { state, startSession } = useSession();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WeaknessExplorerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingKey, setStartingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setLoading(true);
      try {
        const response = await fetch("/api/weakness-explorer", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load weakness explorer");
        }
        const data = (await response.json()) as WeaknessExplorerSnapshot;
        if (!cancelled) {
          setSnapshot(data);
        }
      } catch (error) {
        console.error("Failed to load weakness explorer:", error);
        if (!cancelled) {
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasActiveSession = state.drills.length > 0 && state.phase !== "configuring" && state.phase !== "summary";

  async function startWeaknessBlock(recommendedPool: TableSimActivePool, key: string) {
    if (hasActiveSession) {
      router.push("/app/play");
      return;
    }

    setStartingKey(key);
    try {
      const plan = await loadSessionPlan(DEFAULT_BLOCK_SIZE, recommendedPool);
      startSession({ config: { drillCount: DEFAULT_BLOCK_SIZE, timed: true, activePool: recommendedPool }, plan });
      router.push("/app/play");
    } catch (error) {
      console.error("Failed to start weakness block:", error);
      setStartingKey(null);
    }
  }

  const topActionLabel = hasActiveSession ? "Continue Active Session" : "Start Weakness Block";
  const topPriority = snapshot?.priorityWeaknesses[0] ?? null;
  const deepReviewGroups = useMemo(() => snapshot?.deepReviewGroups ?? [], [snapshot]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ExplorerHeader loading={loading} snapshot={snapshot} />

        <PriorityWeaknessesSection
          weaknesses={snapshot?.priorityWeaknesses ?? []}
          loading={loading}
          topActionLabel={topActionLabel}
          activeSession={hasActiveSession}
          startingKey={startingKey}
          onStart={startWeaknessBlock}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
          <MovementSignalsSection loading={loading} signals={snapshot?.movementSignals ?? []} />
          <TrainingRecommendationsSection
            loading={loading}
            actions={snapshot?.trainingActions ?? []}
            actionLabel={topActionLabel}
            activeSession={hasActiveSession}
            startingKey={startingKey}
            onStart={startWeaknessBlock}
            onCommandCenter={() => router.push("/app/session")}
          />
        </div>

        <DeepReviewSection
          loading={loading}
          groups={deepReviewGroups}
          actionLabel={topActionLabel}
          activeSession={hasActiveSession}
          startingKey={startingKey}
          onStart={startWeaknessBlock}
        />

        <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Next Move</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Take the top weakness back into training, or return to Command Center if you want the wider improvement picture first.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/app/growth")}
                className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
              >
                Open Growth Profile
              </button>
              <button
                type="button"
                onClick={() => router.push("/app/session")}
                className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
              >
                Return To Command Center
              </button>
              {topPriority ? (
                <button
                  type="button"
                  onClick={() => startWeaknessBlock(topPriority.recommendedPool as TableSimActivePool, topPriority.key)}
                  disabled={startingKey === topPriority.key}
                  className="rounded-[20px] bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-700/70 disabled:text-white"
                >
                  {startingKey === topPriority.key ? "Loading Block" : topActionLabel}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ExplorerHeader({ loading, snapshot }: { loading: boolean; snapshot: WeaknessExplorerSnapshot | null }) {
  return (
    <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
      <div className="space-y-4">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/85">Weakness Explorer</p>
          <div className="flex flex-wrap gap-2">
            <HeaderChip label={snapshot?.header.activePoolLabel ?? "Baseline"} />
            <HeaderChip label="Long-horizon leak map" subtle />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">
            {snapshot?.header.headline ?? (loading ? "Reading the current leak structure" : "Current weakness picture is still forming.")}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">
            {snapshot?.header.summary ?? "Not enough history yet to rank strong long-horizon weaknesses cleanly."}
          </p>
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            {snapshot?.header.orientation ?? "Use this screen to understand which leaks are recurring, which are worsening, and which should lead the next block."}
          </p>
        </div>
      </div>
    </section>
  );
}

function PriorityWeaknessesSection({
  weaknesses,
  loading,
  topActionLabel,
  activeSession,
  startingKey,
  onStart,
}: {
  weaknesses: WeaknessExplorerSnapshot["priorityWeaknesses"];
  loading: boolean;
  topActionLabel: string;
  activeSession: boolean;
  startingKey: string | null;
  onStart: (pool: TableSimActivePool, key: string) => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Priority Weaknesses</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">The few leaks doing the most damage right now, ranked with explanation instead of raw system labels.</p>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {loading ? (
          <p className="text-sm text-slate-500">Loading the current weakness map.</p>
        ) : weaknesses.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">There is not enough stored history yet to surface a trustworthy weakness ranking.</p>
        ) : (
          weaknesses.map((weakness, index) => (
            <div key={weakness.key} className="rounded-[26px] border border-white/8 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                      #{index + 1}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {weakness.typeLabel}
                    </span>
                    <span className="rounded-full border border-amber-500/18 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                      {weakness.urgency}
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">{weakness.label}</h2>
                  <p className="text-sm text-slate-400">{weakness.recurrence}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onStart(weakness.recommendedPool as TableSimActivePool, weakness.key)}
                  disabled={startingKey === weakness.key}
                  className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-wait disabled:bg-slate-700 disabled:text-white"
                >
                  {startingKey === weakness.key ? "Loading" : topActionLabel}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-slate-300">{weakness.whyItMatters}</p>
                  {weakness.interventionDecision ? <p className="text-sm leading-6 text-amber-50/90">{weakness.interventionDecision.summary}</p> : null}
                  {weakness.caseSummary ? (
                    <div className="rounded-[18px] border border-emerald-500/16 bg-emerald-500/8 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Concept case</p>
                      <p className="mt-2 text-sm font-semibold text-white">{weakness.caseSummary.statusLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-50/90">{weakness.caseSummary.priorityExplanation}</p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {weakness.interventionDecision ? (
                      <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                        {weakness.interventionDecision.action.replace(/_/g, " ")} ? {weakness.interventionDecision.recommendedStrategy.replace(/_/g, " ")}
                      </span>
                    ) : null}
                    {weakness.coachingPattern ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        {weakness.coachingPattern}
                      </span>
                    ) : null}
                    {weakness.dimensions.map((dimension) => (
                      <span key={dimension} className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs text-slate-300">
                        {dimension}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Recommended action</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{weakness.recommendedAction}</p>
                  <Link
                    href={`/app/concepts/${encodeURIComponent(weakness.conceptKey)}`}
                    className="mt-4 inline-flex rounded-[16px] border border-white/10 bg-black/20 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/18 hover:bg-white/10"
                  >
                    Open concept case
                  </Link>
                  {weakness.trend ? (
                    <div className="mt-4 rounded-[18px] border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Trend</p>
                      <p className="mt-2 text-sm font-semibold text-white">{weakness.trend.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{weakness.trend.detail}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {weakness.relatedDrills.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {weakness.relatedDrills.map((drill) => (
                    <span key={drill.drillId} className="rounded-full border border-white/8 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
                      {drill.title}
                    </span>
                  ))}
                </div>
              ) : activeSession ? (
                <p className="mt-4 text-sm text-slate-500">A session is already in progress, so the cleanest move is to finish that block before starting another weakness-focused one.</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MovementSignalsSection({
  loading,
  signals,
}: {
  loading: boolean;
  signals: WeaknessExplorerSnapshot["movementSignals"];
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Trend / Movement Signals</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">A compact read on which leaks are decaying, which are repairing, and where the trend picture is still thin.</p>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Reading movement across recent weakness windows.</p>
        ) : (
          signals.map((signal) => (
            <SignalCard key={`${signal.label}:${signal.detail}`} {...signal} />
          ))
        )}
      </div>
    </section>
  );
}

function TrainingRecommendationsSection({
  loading,
  actions,
  actionLabel,
  activeSession,
  startingKey,
  onStart,
  onCommandCenter,
}: {
  loading: boolean;
  actions: WeaknessExplorerSnapshot["trainingActions"];
  actionLabel: string;
  activeSession: boolean;
  startingKey: string | null;
  onStart: (pool: TableSimActivePool, key: string) => void;
  onCommandCenter: () => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Training Recommendations</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Turn the diagnosis into the next block instead of leaving the screen with a vague idea of what matters.</p>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Shaping recommended next moves from the current leak map.</p>
        ) : actions.length === 0 ? (
          <button
            type="button"
            onClick={onCommandCenter}
            className="w-full rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/5"
          >
            <p className="text-base font-semibold text-white">Return To Command Center</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">Use the broader home screen to choose the next move while the weakness map is still sparse.</p>
          </button>
        ) : (
          actions.map((action) => (
            <div key={action.weaknessKey} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <p className="text-base font-semibold text-white">{action.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{action.detail}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onStart(action.recommendedPool as TableSimActivePool, action.weaknessKey)}
                  disabled={startingKey === action.weaknessKey}
                  className="rounded-[18px] bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-700/70 disabled:text-white"
                >
                  {startingKey === action.weaknessKey ? "Loading Block" : actionLabel}
                </button>
                {!activeSession ? (
                  <button
                    type="button"
                    onClick={onCommandCenter}
                    className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
                  >
                    Return To Command Center
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DeepReviewSection({
  loading,
  groups,
  actionLabel,
  activeSession,
  startingKey,
  onStart,
}: {
  loading: boolean;
  groups: WeaknessExplorerSnapshot["deepReviewGroups"];
  actionLabel: string;
  activeSession: boolean;
  startingKey: string | null;
  onStart: (pool: TableSimActivePool, key: string) => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Deep Review Entry</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Related drill families stay tucked behind the diagnosis so the screen stays calm, but the next deeper inspection is still close by.</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading related drills and deeper review paths.</p>
        ) : groups.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">No deeper drill groups are ready yet because the weakness map is still too thin.</p>
        ) : (
          groups.map((group) => (
            <div key={group.title} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <p className="text-base font-semibold text-white">{group.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{group.detail}</p>
              <div className="mt-4 space-y-2">
                {group.drills.length > 0 ? group.drills.map((drill) => (
                  <div key={drill.drillId} className="rounded-[18px] border border-white/8 bg-white/5 px-3 py-3">
                    <p className="text-sm font-semibold text-white">{drill.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{drill.nodeId}</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No direct drill matches are ready yet for this weakness.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onStart(group.recommendedPool as TableSimActivePool, group.title)}
                disabled={startingKey === group.title}
                className="mt-4 w-full rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10 disabled:cursor-wait disabled:bg-slate-700 disabled:text-white"
              >
                {activeSession ? "Continue Active Session" : startingKey === group.title ? "Loading Block" : actionLabel}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SignalCard({ label, detail, tone }: { label: string; detail: string; tone: "good" | "warning" | "neutral" }) {
  const toneClass = tone === "good"
    ? "border-emerald-500/18 bg-emerald-500/8"
    : tone === "warning"
      ? "border-amber-500/18 bg-amber-500/8"
      : "border-white/8 bg-black/20";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClass}`}>
      <p className="text-base font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function HeaderChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${subtle ? "border-white/8 bg-white/5 text-slate-300" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"}`}>
      {label}
    </span>
  );
}




