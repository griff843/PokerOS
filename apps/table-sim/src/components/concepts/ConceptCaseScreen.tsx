import React, { type ReactNode } from "react";
import Link from "next/link";
import type { ConceptCaseResponse } from "@/lib/concept-case";

export interface ConceptCaseScreenState {
  loading: boolean;
  error?: string | null;
  data?: ConceptCaseResponse | null;
}

export function ConceptCaseScreen({ state }: { state: ConceptCaseScreenState }) {
  if (state.loading) {
    return (
      <ConceptPageFrame>
        <ConceptPanel tone="neutral" title="Loading concept case" eyebrow="Concept Detail">
          <p className="text-sm leading-6 text-slate-300">Reading the full coaching history, intervention state, retention status, and next-step explanation for this concept.</p>
        </ConceptPanel>
      </ConceptPageFrame>
    );
  }

  if (state.error) {
    return (
      <ConceptPageFrame>
        <ConceptPanel tone="warning" title="Concept case unavailable" eyebrow="Concept Detail">
          <p className="text-sm leading-6 text-slate-200">{state.error}</p>
          <ConceptNavRow />
        </ConceptPanel>
      </ConceptPageFrame>
    );
  }

  if (!state.data) {
    return (
      <ConceptPageFrame>
        <ConceptPanel tone="neutral" title="No concept case found" eyebrow="Concept Detail">
          <p className="text-sm leading-6 text-slate-300">This concept does not have enough stored coaching history yet to support a dedicated case file.</p>
          <ConceptNavRow />
        </ConceptPanel>
      </ConceptPageFrame>
    );
  }

  const { history, decisionAudit, retention, recommendation } = state.data;

  return (
    <ConceptPageFrame>
      <div className="space-y-6">
        <ConceptCaseHeader data={state.data} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
          <ConceptStatusCard data={state.data} />
          <ConceptNextStepCard data={state.data} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <ConceptHistoryCard data={state.data} />
          <ConceptEvidenceCard data={state.data} />
        </div>

        <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(9,14,27,0.86))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-3">
            <MiniMetric
              label="Diagnosis count"
              value={String(history.diagnosisCount)}
              detail={history.firstDiagnosedAt ? `First diagnosed ${formatDate(history.firstDiagnosedAt)}.` : "No diagnosis timestamp recorded."}
            />
            <MiniMetric
              label="Decision stability"
              value={decisionAudit?.stability ?? "unknown"}
              detail={decisionAudit ? `${decisionAudit.escalationCount} escalation ${decisionAudit.escalationCount === 1 ? "call" : "calls"} on record.` : "No intervention decision history is stored yet."}
            />
            <MiniMetric
              label="Retention state"
              value={retention.latestSchedule?.state ?? retention.validationState}
              detail={retention.latestSchedule?.scheduledFor ? `Latest check ${formatDate(retention.latestSchedule.scheduledFor)}.` : "No retention schedule is active yet."}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/app/session"
              className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
            >
              Return To Command Center
            </Link>
            <Link
              href="/app/weaknesses"
              className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
            >
              Open Weakness Explorer
            </Link>
            <Link
              href={`/app/concepts/${encodeURIComponent(history.conceptKey)}/replay`}
              className="rounded-[18px] border border-amber-400/18 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/28 hover:bg-amber-500/16"
            >
              Open Replay Inspector
            </Link>
            {recommendation ? (
              <span className="rounded-[18px] border border-emerald-400/18 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                Current recommendation: {recommendation.action.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
        </section>
      </div>
    </ConceptPageFrame>
  );
}

export function ConceptCaseHeader({ data }: { data: ConceptCaseResponse }) {
  const { history, explanation, nextStep } = data;

  return (
    <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label="Concept Case" />
          <HeaderChip label={explanation.statusLabel} subtle={false} />
          <HeaderChip label={`Recovery ${explanation.recoveryConfidence}`} subtle />
          <HeaderChip label={nextStep.nextActionPriority} subtle />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{history.conceptKey}</p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">{history.label}</h1>
          <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">{history.summary ?? explanation.statusReason}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeaderMetric label="Next action" value={nextStep.nextAction.replace(/_/g, " ")} />
          <HeaderMetric label="Action type" value={nextStep.nextActionType.replace(/_/g, " ")} />
          <HeaderMetric label="Priority" value={nextStep.nextActionPriority} />
          <HeaderMetric label="Risk flags" value={explanation.riskFlags.length > 0 ? String(explanation.riskFlags.length) : "0"} />
        </div>
      </div>
    </section>
  );
}

export function ConceptStatusCard({ data }: { data: ConceptCaseResponse }) {
  const { explanation, nextStep } = data;

  return (
    <ConceptPanel tone="neutral" title="Status + Explanation" eyebrow="Current Read">
      <div className="space-y-4">
        <InfoBlock title="Status reason" detail={explanation.statusReason} />
        <InfoBlock title="Priority explanation" detail={explanation.priorityExplanation} />
        <InfoBlock title="Recommended action reason" detail={explanation.recommendedActionReason} />
        <InfoBlock title="Stability assessment" detail={explanation.stabilityAssessment} />
        <div className="rounded-[22px] border border-amber-500/18 bg-amber-500/8 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">Blocking risks</p>
          {nextStep.blockingRisks.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-slate-200">No acute blocking risk is outranking the current coaching move.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextStep.blockingRisks.map((risk) => (
                <span key={risk} className="rounded-full border border-amber-400/18 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                  {risk.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </ConceptPanel>
  );
}

export function ConceptHistoryCard({ data }: { data: ConceptCaseResponse }) {
  const { history, decisionAudit, retention } = data;

  return (
    <ConceptPanel tone="neutral" title="Coaching History" eyebrow="Longitudinal Record">
      <div className="grid gap-3 md:grid-cols-2">
        <HistoryStat
          title="Diagnosis summary"
          detail={`${history.diagnosisCount} diagnosis ${history.diagnosisCount === 1 ? "entry" : "entries"} recorded.${history.mostRecentDiagnosisAt ? ` Most recent ${formatDate(history.mostRecentDiagnosisAt)}.` : ""}`}
        />
        <HistoryStat
          title="Intervention summary"
          detail={`${history.interventionHistorySummary.total} intervention ${history.interventionHistorySummary.total === 1 ? "record" : "records"}, ${history.interventionHistorySummary.active} active, ${history.interventionHistorySummary.completed} completed.`}
        />
        <HistoryStat
          title="Outcome summary"
          detail={`${history.interventionOutcomeSummary.improvedCount} improved, ${history.interventionOutcomeSummary.failedCount} failed or regressed.${history.interventionOutcomeSummary.latestPreScore !== null && history.interventionOutcomeSummary.latestPreScore !== undefined && history.interventionOutcomeSummary.latestPostScore !== null && history.interventionOutcomeSummary.latestPostScore !== undefined ? ` Latest score moved from ${Math.round(history.interventionOutcomeSummary.latestPreScore * 100)}% to ${Math.round(history.interventionOutcomeSummary.latestPostScore * 100)}%.` : ""}`}
        />
        <HistoryStat
          title="Decision stability"
          detail={decisionAudit ? `${decisionAudit.stability} with ${decisionAudit.escalationCount} escalation ${decisionAudit.escalationCount === 1 ? "decision" : "decisions"} on record.${decisionAudit.latestDecisionChanged ? " The latest stored decision changed from the previous one." : ""}` : "No intervention decision audit is stored yet."}
        />
        <HistoryStat
          title="Retention summary"
          detail={retention.latestSchedule ? `${retention.latestSchedule.state.replace(/_/g, " ")}. ${retention.latestSchedule.scheduledFor ? `Scheduled ${formatDate(retention.latestSchedule.scheduledFor)}.` : ""}` : "No retention schedule is attached yet."}
        />
        <HistoryStat
          title="Planner context"
          detail={history.prioritizationContext.planningReasons.length > 0 ? history.prioritizationContext.planningReasons.map((reason) => reason.replace(/_/g, " ")).join(", ") : "No planner reasons are attached yet."}
        />
      </div>
    </ConceptPanel>
  );
}

export function ConceptEvidenceCard({ data }: { data: ConceptCaseResponse }) {
  const { history, explanation } = data;

  return (
    <ConceptPanel tone="neutral" title="Supporting Evidence" eyebrow="Why The System Believes This">
      <div className="space-y-4">
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Recent attempts</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {history.recentAttemptSummary.sampleSize > 0
              ? `${history.recentAttemptSummary.sampleSize} concept-linked reps. Recent average ${history.recentAttemptSummary.recentAverage !== undefined ? `${Math.round(history.recentAttemptSummary.recentAverage * 100)}%` : "not available"}. Trend ${history.recentAttemptSummary.trendDirection ?? "unknown"}.`
              : "No concept-linked recent attempt summary is available yet."}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Patterns</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {history.patternSummary.count > 0
              ? `${history.patternSummary.count} pattern ${history.patternSummary.count === 1 ? "is" : "s are"} attached. ${history.patternSummary.types.map((type) => type.replace(/_/g, " ")).join(", ")}.`
              : "No cross-hand pattern is strong enough yet to be attached to this concept case."}
          </p>
        </div>
        <div className="rounded-[22px] border border-emerald-500/16 bg-emerald-500/8 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Canonical evidence</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-50/92">
            {explanation.supportingEvidence.map((item, index) => (
              <li key={`${item.kind}:${item.code}:${index}`}>• {item.detail}</li>
            ))}
          </ul>
        </div>
      </div>
    </ConceptPanel>
  );
}

export function ConceptNextStepCard({ data }: { data: ConceptCaseResponse }) {
  const { nextStep, explanation } = data;

  return (
    <ConceptPanel tone="good" title="Current Coach Move" eyebrow="Next Step">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label={nextStep.nextAction.replace(/_/g, " ")} />
          <HeaderChip label={nextStep.nextActionType.replace(/_/g, " ")} subtle />
          <HeaderChip label={nextStep.nextActionPriority} subtle />
        </div>
        <InfoBlock title="Next action reason" detail={nextStep.nextActionReason} />
        <InfoBlock title="Coach note" detail={nextStep.coachNote} />
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Canonical recommendation</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{explanation.recommendedNextAction.replace(/_/g, " ")} with {explanation.recoveryConfidence} recovery confidence.</p>
        </div>
      </div>
    </ConceptPanel>
  );
}

function ConceptPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

function ConceptPanel({
  eyebrow,
  title,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  tone: "good" | "warning" | "neutral";
  children: ReactNode;
}) {
  const toneClass = tone === "good"
    ? "border-emerald-500/14 bg-[linear-gradient(180deg,rgba(7,18,24,0.94),rgba(8,16,28,0.9))]"
    : tone === "warning"
      ? "border-amber-500/14 bg-[linear-gradient(180deg,rgba(24,17,7,0.92),rgba(20,14,8,0.88))]"
      : "border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(9,14,27,0.86))]";

  return (
    <section className={`rounded-[30px] border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

function HistoryStat({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-white">{value}</p>
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

function ConceptNavRow() {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <Link
        href="/app/session"
        className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
      >
        Return To Command Center
      </Link>
      <Link
        href="/app/weaknesses"
        className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
      >
        Open Weakness Explorer
      </Link>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
