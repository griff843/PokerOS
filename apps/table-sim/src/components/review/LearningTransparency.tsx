import React from "react";
import type {
  TransparencyFrequencyView,
  TransparencyHistoryLine,
  TransparencyDiagnosisView,
  TransparencyRangeView,
  TransparencyVerdictView,
} from "@/lib/learning-transparency";

export function TransparencyVerdictCard({ verdict }: { verdict: TransparencyVerdictView }) {
  const toneClass = verdict.tone === "good"
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-50"
    : verdict.tone === "warning"
      ? "border-amber-500/25 bg-amber-500/10 text-amber-50"
      : "border-white/10 bg-white/5 text-white";

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)] ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-current/70">{verdict.badge}</p>
      <p className="mt-2 text-lg font-semibold text-current">{verdict.headline}</p>
      <p className="mt-2 text-sm leading-6 text-current/85">{verdict.detail}</p>
    </div>
  );
}

export function StreetHistoryCard({ history }: { history: TransparencyHistoryLine[] }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">Street History</p>
        <p className="mt-2 text-sm leading-6 text-gray-300">How the hand got here, using structured line history when published and honest fallbacks when it is not.</p>
      </div>
      <div className="space-y-2">
        {history.map((line) => (
          <div key={line.street} className="rounded-xl border border-white/8 bg-gray-950/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{line.label}</span>
                {line.isDecisionStreet ? (
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                    Decision Street
                  </span>
                ) : null}
                <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                  {line.availability}
                </span>
              </div>
              {line.board ? (
                <span className="text-xs font-medium tracking-[0.08em] text-gray-400">{line.board}</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-medium text-gray-100">{line.summary}</p>
            {line.detail ? (
              <p className="mt-2 text-sm leading-6 text-gray-400">{line.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StrategyFrequencyCard({
  frequencyView,
  title = "Solver Frequency",
}: {
  frequencyView: TransparencyFrequencyView;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">{title}</p>
        <p className="mt-2 text-sm leading-6 text-gray-300">{frequencyView.detail}</p>
      </div>

      {!frequencyView.available ? (
        <div className="rounded-xl border border-dashed border-white/12 bg-white/5 px-3 py-3 text-sm text-gray-400">
          {frequencyView.headline}
        </div>
      ) : (
        <div className="space-y-2">
          {frequencyView.items.map((item) => (
            <div key={`${item.action}:${item.label}`} className="rounded-xl border border-white/8 bg-gray-950/70 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{item.label}</span>
                  {item.preferred ? (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                      Preferred
                    </span>
                  ) : null}
                  {item.chosen ? (
                    <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                      Your line
                    </span>
                  ) : null}
                </div>
                <span className="font-semibold text-gray-100">{Math.round(item.frequency)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full ${item.preferred ? "bg-emerald-400" : item.chosen ? "bg-amber-400" : "bg-slate-400"}`}
                  style={{ width: `${Math.max(item.frequency, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RangeSupportCard({
  rangeView,
  title,
}: {
  rangeView: TransparencyRangeView;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(7,18,24,0.92))] p-4 space-y-4 shadow-[0_18px_50px_rgba(16,185,129,0.08)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/80">{title ?? rangeView.title}</p>
        <p className="mt-2 text-sm leading-6 text-gray-300">{rangeView.subtitle}</p>
      </div>

      {rangeView.handFocus ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 space-y-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">{rangeView.handFocus.label}</p>
          <p className="text-sm font-semibold text-emerald-50">{rangeView.handFocus.summary}</p>
          {rangeView.handFocus.note ? (
            <p className="text-sm leading-6 text-emerald-50/80">{rangeView.handFocus.note}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        {rangeView.points.map((point) => (
          <div key={point} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-sm leading-6 text-gray-100">
            {point}
          </div>
        ))}
      </div>

      {rangeView.streetShifts.length > 0 ? (
        <div className="rounded-xl border border-cyan-500/18 bg-cyan-500/10 p-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/85">Street Shift Logic</p>
            <p className="mt-1 text-sm leading-6 text-cyan-50/80">What each street removed, preserved, or reweighted in the published range story.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {rangeView.streetShifts.map((shift) => (
              <div key={`range-shift:${shift.street}`} className="rounded-xl border border-white/8 bg-slate-950/65 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{shift.label}</span>
                  {shift.isDecisionStreet ? (
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                      Decision
                    </span>
                  ) : null}
                </div>
                {shift.board ? (
                  <p className="text-xs font-medium tracking-[0.08em] text-cyan-100/70">{shift.board}</p>
                ) : null}
                <p className="text-sm leading-6 text-gray-100">{shift.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rangeView.sections.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {rangeView.sections.map((section) => (
            <div key={section.title} className="rounded-xl border border-white/8 bg-gray-950/70 p-3 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{section.title}</p>
              <div className="space-y-2.5">
                {section.buckets.map((bucket) => (
                  <div key={`${section.title}:${bucket.label}`} className="rounded-lg border border-white/8 bg-black/20 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{bucket.label}</span>
                      {bucket.frequencyHint ? (
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                          {bucket.frequencyHint}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm leading-6 text-gray-100">{bucket.combos.join(", ")}</p>
                    {bucket.note ? (
                      <p className="text-xs leading-5 text-gray-400">{bucket.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {(rangeView.blockerNotes.length > 0 || rangeView.thresholdNotes.length > 0) ? (
        <div className="grid gap-3 md:grid-cols-2">
          {rangeView.blockerNotes.length > 0 ? (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/85">Blocker Logic</p>
              {rangeView.blockerNotes.map((note) => (
                <p key={note} className="text-sm leading-6 text-blue-50/90">{note}</p>
              ))}
            </div>
          ) : null}
          {rangeView.thresholdNotes.length > 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/85">Threshold Logic</p>
              {rangeView.thresholdNotes.map((note) => (
                <p key={note} className="text-sm leading-6 text-amber-50/90">{note}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


export function CoachDiagnosisCard({ diagnosis }: { diagnosis: TransparencyDiagnosisView }) {
  if (!diagnosis.available) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92))] p-4 space-y-3 shadow-[0_18px_50px_rgba(245,158,11,0.08)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/80">Coach Diagnosis</p>
        <p className="mt-2 text-base font-semibold leading-7 text-amber-50">{diagnosis.headline}</p>
      </div>
      <p className="text-sm leading-6 text-gray-200">{diagnosis.detail}</p>
      {diagnosis.promptType ? (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-amber-50/85">
            {diagnosis.promptType}
          </span>
        </div>
      ) : null}
      {(diagnosis.prompt || diagnosis.selectedReasoning || diagnosis.expectedReasoning) ? (
        <div className="grid gap-3 md:grid-cols-3">
          {diagnosis.prompt ? (
            <div className="rounded-xl border border-white/8 bg-black/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Reasoning Check</p>
              <p className="mt-2 text-sm leading-6 text-gray-100">{diagnosis.prompt}</p>
            </div>
          ) : null}
          {diagnosis.selectedReasoning ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">Your Reasoning</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/90">{diagnosis.selectedReasoning}</p>
            </div>
          ) : null}
          {diagnosis.expectedReasoning ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/85">Expected Reasoning</p>
              <p className="mt-2 text-sm leading-6 text-emerald-50/90">{diagnosis.expectedReasoning}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {diagnosis.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {diagnosis.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-50">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {diagnosis.nextFocus ? (
        <p className="text-sm leading-6 text-amber-50/85">{diagnosis.nextFocus}</p>
      ) : null}
    </div>
  );
}
