import type { DrillCoachingSnapshot } from "@poker-coach/core/browser";

interface DrillCoachingSummaryProps {
  snapshot: DrillCoachingSnapshot;
  activePool: string;
  focus?: {
    label: string;
    headline: string;
    detail: string;
    applicable: boolean;
    emptyHeadline?: string;
    emptyMessage?: string;
  };
}

export function DrillCoachingSummary({ snapshot, activePool, focus }: DrillCoachingSummaryProps) {
  const verdictTone = snapshot.verdict.tone === "good"
    ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-50"
    : "border-rose-500/30 bg-rose-500/12 text-rose-50";

  return (
    <div className="space-y-4">
      <div className={`rounded-[26px] border p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)] ${verdictTone}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-current/75">{snapshot.verdict.label}</p>
        <p className="mt-2 text-lg font-semibold leading-7">{snapshot.verdict.headline}</p>
        <p className="mt-2 text-sm leading-6 text-current/80">{snapshot.verdict.detail}</p>
      </div>

      {snapshot.adaptiveContext ? (
        <div className="rounded-[22px] border border-sky-500/22 bg-sky-500/8 p-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/85">{snapshot.adaptiveContext.title}</p>
          <p className="text-base font-semibold leading-7 text-white">{snapshot.adaptiveContext.headline}</p>
          <p className="text-sm leading-6 text-gray-300">{snapshot.adaptiveContext.detail}</p>
        </div>
      ) : null}

      {snapshot.exploitContrast.applies ? (
        <div className="rounded-[26px] border border-amber-400/30 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(9,12,20,0.9))] p-4 shadow-[0_20px_70px_rgba(251,191,36,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/85">Exploit Shift</p>
              <h3 className="mt-2 text-base font-semibold leading-7 text-amber-50">{snapshot.exploitContrast.headline}</h3>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
              Pool {activePool}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-amber-50/85">{snapshot.exploitContrast.detail}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ActionTile label="Baseline" value={snapshot.exploitContrast.baselineAction ?? "-"} tone="neutral" />
            <ActionTile label={`Pool ${activePool}`} value={snapshot.exploitContrast.selectedPoolAction ?? "-"} tone="warning" />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <CoachingTile moment={snapshot.whyCorrect} tone="emerald" />
        {snapshot.whyMistake ? <CoachingTile moment={snapshot.whyMistake} tone="rose" /> : null}
        <CoachingTile moment={snapshot.keyConcept} tone="sky" />
        <CoachingTile moment={snapshot.nextAdjustment} tone="amber" />
      </div>

      {snapshot.difficultyReason ? (
        <div className="rounded-[22px] border border-slate-500/20 bg-slate-500/8 p-4 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/80">Why This Spot Is Hard</p>
          <p className="text-sm leading-6 text-gray-300">{snapshot.difficultyReason}</p>
        </div>
      ) : null}

      {(snapshot.concepts.missedTags.length > 0 || snapshot.concepts.matchedTags.length > 0) ? (
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Concept Signal</p>
          <div className="flex flex-wrap gap-2">
            {snapshot.concepts.requiredTags.map((tag) => {
              const matched = snapshot.concepts.matchedTags.includes(tag);
              return (
                <span
                  key={tag}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${matched
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-500/25 bg-rose-500/10 text-rose-100"}`}
                >
                  {matched ? "Seen" : "Missed"} {formatTag(tag)}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {focus ? (
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">{focus.label}</p>
          <p className="text-base font-semibold leading-7 text-white">{focus.applicable ? focus.headline : (focus.emptyHeadline ?? focus.headline)}</p>
          <p className="text-sm leading-6 text-gray-300">{focus.applicable ? focus.detail : (focus.emptyMessage ?? focus.detail)}</p>
        </div>
      ) : null}
    </div>
  );
}

function CoachingTile({
  moment,
  tone,
}: {
  moment: DrillCoachingSnapshot["whyCorrect"];
  tone: "emerald" | "rose" | "sky" | "amber";
}) {
  const toneClass = tone === "emerald"
    ? "border-emerald-500/20 bg-emerald-500/8"
    : tone === "rose"
      ? "border-rose-500/20 bg-rose-500/8"
      : tone === "sky"
        ? "border-sky-500/20 bg-sky-500/8"
        : "border-amber-500/20 bg-amber-500/8";
  const labelClass = tone === "emerald"
    ? "text-emerald-200/85"
    : tone === "rose"
      ? "text-rose-200/85"
      : tone === "sky"
        ? "text-sky-200/85"
        : "text-amber-200/85";

  return (
    <div className={`rounded-[22px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${toneClass}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${labelClass}`}>{moment.title}</p>
      <p className="mt-2 text-base font-semibold leading-7 text-white">{moment.headline}</p>
      <p className="mt-2 text-sm leading-6 text-gray-300">{moment.detail}</p>
    </div>
  );
}

function ActionTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "warning";
}) {
  const toneClass = tone === "warning"
    ? "border-amber-400/30 bg-amber-400/10 text-amber-50"
    : "border-white/10 bg-black/25 text-white";

  return (
    <div className={`rounded-[18px] border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/70">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatTag(value: string): string {
  return value.replace(/[_:]+/g, " ");
}
