"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RecommendedTrainingBlockCard } from "@/components/training/RecommendedTrainingBlockCard";
import type { GrowthProfileSnapshot } from "@/lib/growth-profile";

export function GrowthProfile() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<GrowthProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setLoading(true);
      try {
        const response = await fetch("/api/growth-profile", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load growth profile");
        }
        const data = (await response.json()) as GrowthProfileSnapshot;
        if (!cancelled) {
          setSnapshot(data);
        }
      } catch (error) {
        console.error("Failed to load growth profile:", error);
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ProfileHeader loading={loading} snapshot={snapshot} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
          <ProgressSnapshotSection loading={loading} items={snapshot?.progressSnapshot ?? []} />
          <CoachPerspectiveSection loading={loading} coach={snapshot?.coachPerspective ?? null} />
        </div>

        {snapshot?.interventionRecommendation ? (
          <RecommendedTrainingBlockCard
            plan={snapshot.interventionRecommendation.plan}
            onOpen={() => router.push(snapshot.interventionRecommendation?.href ?? "/app/session")}
            ctaLabel="Open Coach Plan"
          />
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          <StrengthsSection loading={loading} items={snapshot?.strengths ?? []} />
          <WeakSpotsSection loading={loading} items={snapshot?.weakSpots ?? []} onOpenWeaknesses={() => router.push("/app/weaknesses")} />
        </div>

        <MovementSection loading={loading} items={snapshot?.movement ?? []} />
        <PracticeIdentitySection loading={loading} items={snapshot?.practiceIdentity ?? []} />
        <NextActionsSection loading={loading} actions={snapshot?.nextActions ?? []} onNavigate={(href) => router.push(href)} />
      </div>
    </div>
  );
}

function ProfileHeader({ loading, snapshot }: { loading: boolean; snapshot: GrowthProfileSnapshot | null }) {
  return (
    <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
      <div className="space-y-4">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/85">Growth Profile</p>
          <div className="flex flex-wrap gap-2">
            <HeaderChip label={snapshot?.header.direction ?? "Profile forming"} />
            <HeaderChip label="Long-term development" subtle />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">
            {snapshot?.header.headline ?? (loading ? "Reading your long-term development" : "Your growth picture is still forming.")}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">
            {snapshot?.header.summary ?? "There is not enough long-horizon history yet to say much more than the profile is still early."}
          </p>
        </div>
      </div>
    </section>
  );
}

function ProgressSnapshotSection({ loading, items }: { loading: boolean; items: GrowthProfileSnapshot["progressSnapshot"] }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Progress Snapshot</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">A compact read on whether the recent profile is strengthening, flattening, or asking for reinforcement.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {loading ? (
          <p className="text-sm text-slate-500">Loading progress signals.</p>
        ) : (
          items.map((item) => <MetricCard key={item.label} {...item} />)
        )}
      </div>
    </section>
  );
}

function CoachPerspectiveSection({ loading, coach }: { loading: boolean; coach: GrowthProfileSnapshot["coachPerspective"] | null }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Coach Perspective</p>
      <div className="mt-4 space-y-4">
        <CoachPanel title="Encouraging truth" text={coach?.encouragingTruth ?? (loading ? "Reading what is actually holding up." : "Not enough history yet to call a durable strength.")} tone="good" />
        <CoachPanel title="Limiting factor" text={coach?.limitingFactor ?? "The current profile is limited more by sample depth than by one sharply defined weakness."} tone="warning" />
        <CoachPanel title="Next stage" text={coach?.recommendation ?? "Build another deliberate block, then return here for a cleaner read."} tone="neutral" />
      </div>
    </section>
  );
}

function StrengthsSection({ loading, items }: { loading: boolean; items: GrowthProfileSnapshot["strengths"] }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Strengths</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Where the current game is holding up best, based on real tracked concept performance.</p>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading current strengths.</p>
        ) : items.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">No concept family has enough stable history yet to count as a real strength.</p>
        ) : (
          items.map((item) => <SignalBlock key={item.label} {...item} />)
        )}
      </div>
    </section>
  );
}

function WeakSpotsSection({ loading, items, onOpenWeaknesses }: { loading: boolean; items: GrowthProfileSnapshot["weakSpots"]; onOpenWeaknesses: () => void }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Weak Spots</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">The current drag on the profile, kept selective and tied back to the leak map.</p>
        </div>
        <button
          type="button"
          onClick={onOpenWeaknesses}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          Open Weakness Explorer
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading weak spots.</p>
        ) : items.length === 0 ? (
          <p className="text-sm leading-6 text-slate-400">No weak concept cluster has enough evidence yet to lead long-term planning.</p>
        ) : (
          items.map((item) => <SignalBlock key={item.label} label={item.label} detail={item.detail} tone={item.tone} />)
        )}
      </div>
    </section>
  );
}

function MovementSection({ loading, items }: { loading: boolean; items: GrowthProfileSnapshot["movement"] }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Progress Over Time</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">How the profile has been moving lately, using calm movement summaries instead of a chart wall.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading movement signals.</p>
        ) : (
          items.map((item) => <SignalBlock key={item.label} {...item} compact />)
        )}
      </div>
    </section>
  );
}

function PracticeIdentitySection({ loading, items }: { loading: boolean; items: GrowthProfileSnapshot["practiceIdentity"] }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Consistency / Practice Identity</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Not just how you score, but what kind of training rhythm and follow-through the data says you are building.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading practice identity signals.</p>
        ) : (
          items.map((item) => <MetricCard key={item.label} {...item} />)
        )}
      </div>
    </section>
  );
}

function NextActionsSection({ loading, actions, onNavigate }: { loading: boolean; actions: GrowthProfileSnapshot["nextActions"]; onNavigate: (href: string) => void }) {
  return (
    <section className="rounded-[30px] border border-emerald-500/14 bg-[linear-gradient(180deg,rgba(7,18,24,0.94),rgba(8,16,28,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/85">Next Development Actions</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">Leave the profile with a clear move, not just a reflection on what the data says.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading next actions.</p>
        ) : (
          actions.map((action) => (
            <button
              key={action.href + action.label}
              type="button"
              onClick={() => onNavigate(action.href)}
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

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "good" | "warning" | "neutral" }) {
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

function SignalBlock({ label, detail, tone, compact = false }: { label: string; detail: string; tone: "good" | "warning" | "neutral"; compact?: boolean }) {
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

function CoachPanel({ title, text, tone }: { title: string; text: string; tone: "good" | "warning" | "neutral" }) {
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

function HeaderChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${subtle ? "border-white/8 bg-white/5 text-slate-300" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"}`}>
      {label}
    </span>
  );
}
