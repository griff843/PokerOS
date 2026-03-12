import type { InterventionPlan } from "@poker-coach/core/browser";

export function RecommendedTrainingBlockCard({
  plan,
  href,
  ctaLabel = "Open Recommended Block",
  compact = false,
  onOpen,
}: {
  plan: InterventionPlan;
  href?: string;
  ctaLabel?: string;
  compact?: boolean;
  onOpen?: () => void;
}) {
  return (
    <section className="rounded-[30px] border border-amber-500/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">Recommended Training Block</p>
          <h3 className={`${compact ? "text-xl" : "text-2xl"} font-semibold tracking-tight text-white`}>{plan.recommendedSessionTitle}</h3>
          <p className="text-sm leading-6 text-amber-50/90">{plan.rationale}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoPill label="Root Leak Diagnosis" value={plan.rootLeakDiagnosis} />
          <InfoPill label="Next Session Focus" value={plan.nextSessionFocus} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {plan.trainingBlocks.map((block) => (
            <div key={`${block.role}:${block.conceptKey}`} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{block.role}</p>
              <p className="mt-2 text-base font-semibold text-white">{block.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{block.reason}</p>
              <p className="mt-3 text-sm font-semibold text-amber-200">{block.reps} reps</p>
            </div>
          ))}
        </div>

        {(onOpen || href) ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-black/20 px-4 py-4">
            <p className="text-sm leading-6 text-slate-300">
              {plan.totalTargetReps} total prescribed reps across {plan.trainingBlocks.length} focused blocks.
            </p>
            {onOpen ? (
              <button
                type="button"
                onClick={onOpen}
                className="rounded-[20px] bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                {ctaLabel}
              </button>
            ) : href ? (
              <a
                href={href}
                className="rounded-[20px] bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                {ctaLabel}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white">{value}</p>
    </div>
  );
}
