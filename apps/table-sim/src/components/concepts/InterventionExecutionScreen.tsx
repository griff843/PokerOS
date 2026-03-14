import React, { type ReactNode } from "react";
import Link from "next/link";
import type {
  InterventionActionSummary,
  InterventionEvidenceSummary,
  InterventionExecutionBundle,
  InterventionHistoryContext,
} from "@/lib/intervention-execution";
import type { InterventionStrategyBlueprint } from "@poker-coach/core/browser";

export interface InterventionExecutionScreenState {
  loading: boolean;
  error?: string | null;
  data?: InterventionExecutionBundle | null;
}

export function InterventionExecutionScreen({
  state,
}: {
  state: InterventionExecutionScreenState;
}) {
  if (state.loading) {
    return (
      <ExecutionPageFrame>
        <ExecutionPanel tone="neutral" title="Loading intervention" eyebrow="Execution View">
          <p className="text-sm leading-6 text-slate-300">
            Reading the active intervention, strategy blueprint, and coaching evidence for this concept.
          </p>
        </ExecutionPanel>
      </ExecutionPageFrame>
    );
  }

  if (state.error) {
    return (
      <ExecutionPageFrame>
        <ExecutionPanel tone="warning" title="Execution data unavailable" eyebrow="Execution View">
          <p className="text-sm leading-6 text-slate-200">{state.error}</p>
        </ExecutionPanel>
      </ExecutionPageFrame>
    );
  }

  if (!state.data) {
    return (
      <ExecutionPageFrame>
        <ExecutionPanel tone="neutral" title="No execution data found" eyebrow="Execution View">
          <p className="text-sm leading-6 text-slate-300">
            This concept does not have enough stored coaching history to produce an execution view.
          </p>
        </ExecutionPanel>
      </ExecutionPageFrame>
    );
  }

  const { actionSummary, evidenceSummary, strategyBlueprint, historyContext, nextStep } =
    state.data;

  if (state.data.executionStatus === "no_intervention") {
    return (
      <ExecutionPageFrame>
        <div className="space-y-6">
          <InterventionExecutionHeader data={state.data} />
          <ExecutionPanel tone="neutral" title="No active intervention" eyebrow="Execution Status">
            <p className="text-sm leading-6 text-slate-300">
              No intervention is currently active or recommended for this concept. The coaching engine
              has not flagged it as requiring immediate action.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Recovery stage: <span className="text-slate-200">{historyContext.recoveryStage.replace(/_/g, " ")}</span>.
              {" "}Diagnosis count: <span className="text-slate-200">{historyContext.diagnosisCount}</span>.
            </p>
            <ExecutionNavFooter conceptKey={state.data.conceptKey} executionStatus={state.data.executionStatus} />
          </ExecutionPanel>
        </div>
      </ExecutionPageFrame>
    );
  }

  return (
    <ExecutionPageFrame>
      <div className="space-y-6">
        <InterventionExecutionHeader data={state.data} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <BlueprintExecutionPanel blueprint={strategyBlueprint} />
          <ExecutionActionPanel actionSummary={actionSummary!} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <SuccessCriteriaPanel blueprint={strategyBlueprint} />
          <EscalationPanel blueprint={strategyBlueprint} />
        </div>

        <ExecutionEvidencePanel
          evidenceSummary={evidenceSummary!}
          historyContext={historyContext}
        />

        <ExecutionFooterSection data={state.data} />
      </div>
    </ExecutionPageFrame>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

export function InterventionExecutionHeader({ data }: { data: InterventionExecutionBundle }) {
  const { actionSummary, executionStatus, label, conceptKey, nextStep } = data;

  const statusLabel =
    executionStatus === "active"
      ? "Active Intervention"
      : executionStatus === "recommended"
        ? "Recommended Intervention"
        : "No Intervention";

  return (
    <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <ExecChip label="Intervention Execution" />
          <ExecChip label={statusLabel} subtle={false} />
          {actionSummary && (
            <>
              <ExecChip label={`${actionSummary.intensity} intensity`} subtle />
              <ExecChip label={`${actionSummary.confidence} confidence`} subtle />
            </>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{conceptKey}</p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">
            {label}
          </h1>
          {actionSummary ? (
            <p className="max-w-3xl text-sm leading-7 text-blue-50/88 sm:text-base">
              {actionSummary.summary}
            </p>
          ) : (
            <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              No active or recommended intervention for this concept right now.
            </p>
          )}
        </div>
        {actionSummary && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ExecMetric label="Action" value={actionSummary.action.replace(/_/g, " ")} />
            <ExecMetric label="Strategy" value={actionSummary.strategy.replace(/_/g, " ")} />
            <ExecMetric label="Priority" value={String(actionSummary.priority)} />
            <ExecMetric label="Next move" value={nextStep.nextAction.replace(/_/g, " ")} />
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Blueprint Execution Panel ────────────────────────────────────────────────

export function BlueprintExecutionPanel({ blueprint }: { blueprint?: InterventionStrategyBlueprint }) {
  if (!blueprint) {
    return (
      <ExecutionPanel tone="neutral" title="Strategy Blueprint" eyebrow="Blueprint">
        <p className="text-sm leading-6 text-slate-300">
          No strategy blueprint is available yet. A blueprint is generated when a clear strategy is
          assigned for this concept.
        </p>
      </ExecutionPanel>
    );
  }

  const { recommendedDrillMix: mix, recommendedAttemptWindow: window, sessionEmphasis, reviewEmphasis, transferEmphasis, stabilizationEmphasis } = blueprint;
  const allEmphasis = [
    ...sessionEmphasis.map((e) => ({ label: e, kind: "session" })),
    ...reviewEmphasis.map((e) => ({ label: e, kind: "review" })),
    ...transferEmphasis.map((e) => ({ label: e, kind: "transfer" })),
    ...stabilizationEmphasis.map((e) => ({ label: e, kind: "stabilization" })),
  ];

  return (
    <ExecutionPanel tone="neutral" title={blueprint.title} eyebrow="Blueprint">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <ExecChip label={blueprint.strategyType.replace(/_/g, " ")} />
          <ExecChip label={`${blueprint.intensity} intensity`} subtle />
          <ExecChip label={`${window.sessions} sessions · ${window.attempts} attempts`} subtle />
        </div>
        <ExecInfoBlock title="Objective" detail={blueprint.objective} />
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Recommended drill mix
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {(
              [
                { label: "Repair", value: mix.repair },
                { label: "Review", value: mix.review },
                { label: "Applied", value: mix.applied },
                { label: "Validation", value: mix.validation },
              ] as const
            ).map(({ label, value }) => (
              <div key={label} className="rounded-[16px] border border-white/8 bg-white/5 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-1.5 text-lg font-semibold text-white">{Math.round(value * 100)}%</p>
              </div>
            ))}
          </div>
        </div>
        {allEmphasis.length > 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Emphasis
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {allEmphasis.map((item, i) => (
                <span
                  key={`${item.kind}:${i}`}
                  className="rounded-full border border-blue-400/18 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100"
                >
                  {item.label.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
        {blueprint.rationale && (
          <ExecInfoBlock title="Rationale" detail={blueprint.rationale} />
        )}
      </div>
    </ExecutionPanel>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

export function ExecutionActionPanel({ actionSummary }: { actionSummary: InterventionActionSummary }) {
  return (
    <ExecutionPanel tone="neutral" title="Execution Details" eyebrow="Active Move">
      <div className="space-y-4">
        <div className="grid gap-3">
          <ActionField label="Recommended action" value={actionSummary.action.replace(/_/g, " ")} />
          <ActionField label="Strategy" value={actionSummary.strategy.replace(/_/g, " ")} />
          <ActionField label="Intensity" value={actionSummary.intensity} />
          <ActionField label="Confidence" value={actionSummary.confidence} />
          <ActionField label="Priority score" value={String(actionSummary.priority)} />
        </div>
        <ExecInfoBlock title="Decision reason" detail={actionSummary.decisionReason} />
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Assignment flags
          </p>
          <div className="mt-3 space-y-1.5 text-sm text-slate-200">
            <p>Requires new assignment: <span className={actionSummary.requiresNewAssignment ? "text-amber-200" : "text-slate-400"}>{actionSummary.requiresNewAssignment ? "yes" : "no"}</span></p>
            <p>Requires strategy change: <span className={actionSummary.requiresStrategyChange ? "text-amber-200" : "text-slate-400"}>{actionSummary.requiresStrategyChange ? "yes" : "no"}</span></p>
            <p>Transfer focus: <span className={actionSummary.transferFocus ? "text-blue-200" : "text-slate-400"}>{actionSummary.transferFocus ? "yes" : "no"}</span></p>
          </div>
        </div>
        {actionSummary.currentInterventionId && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Active intervention
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              ID: <span className="font-mono text-slate-300">{actionSummary.currentInterventionId}</span>
            </p>
            {actionSummary.currentInterventionStatus && (
              <p className="mt-1 text-sm text-slate-300">
                Status: <span className="text-slate-200">{actionSummary.currentInterventionStatus.replace(/_/g, " ")}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </ExecutionPanel>
  );
}

// ─── Success Criteria Panel ───────────────────────────────────────────────────

export function SuccessCriteriaPanel({ blueprint }: { blueprint?: InterventionStrategyBlueprint }) {
  if (!blueprint) {
    return (
      <ExecutionPanel tone="neutral" title="Success Criteria" eyebrow="Exit Conditions">
        <p className="text-sm leading-6 text-slate-300">
          No success criteria available. A blueprint is required to define exit conditions for this intervention.
        </p>
      </ExecutionPanel>
    );
  }

  return (
    <ExecutionPanel tone="good" title="Success Criteria" eyebrow="Exit Conditions">
      <div className="space-y-4">
        {blueprint.successCriteriaHints.length > 0 ? (
          <div className="rounded-[22px] border border-emerald-500/16 bg-emerald-500/8 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
              Success signals
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-50/92">
              {blueprint.successCriteriaHints.map((hint, i) => (
                <li key={i}>• {hint}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-300">
            No explicit success criteria are attached to this blueprint.
          </p>
        )}
        {blueprint.retentionFollowUpGuidance.length > 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Retention follow-up
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
              {blueprint.retentionFollowUpGuidance.map((hint, i) => (
                <li key={i}>• {hint}</li>
              ))}
            </ul>
          </div>
        )}
        {blueprint.coachNotes.length > 0 && (
          <ExecInfoBlock title="Coach note" detail={blueprint.coachNotes[0]!} />
        )}
      </div>
    </ExecutionPanel>
  );
}

// ─── Escalation Panel ─────────────────────────────────────────────────────────

export function EscalationPanel({ blueprint }: { blueprint?: InterventionStrategyBlueprint }) {
  if (!blueprint) {
    return (
      <ExecutionPanel tone="neutral" title="Escalation Triggers" eyebrow="Risk Signals">
        <p className="text-sm leading-6 text-slate-300">
          No escalation triggers available. A blueprint is required to define when to escalate this intervention.
        </p>
      </ExecutionPanel>
    );
  }

  return (
    <ExecutionPanel tone="warning" title="Escalation Triggers" eyebrow="Risk Signals">
      <div className="space-y-4">
        {blueprint.escalationTriggerHints.length > 0 ? (
          <div className="rounded-[22px] border border-amber-500/18 bg-amber-500/8 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
              Escalate if
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50/88">
              {blueprint.escalationTriggerHints.map((hint, i) => (
                <li key={i}>• {hint}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-300">
            No explicit escalation triggers are attached to this blueprint.
          </p>
        )}
        {blueprint.modifiers.length > 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Modifiers
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {blueprint.modifiers.map((mod, i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300"
                >
                  {mod.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ExecutionPanel>
  );
}

// ─── Evidence Panel ───────────────────────────────────────────────────────────

export function ExecutionEvidencePanel({
  evidenceSummary,
  historyContext,
}: {
  evidenceSummary: InterventionEvidenceSummary;
  historyContext: InterventionHistoryContext;
}) {
  return (
    <ExecutionPanel tone="neutral" title="Why This Intervention" eyebrow="Supporting Evidence">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <ExecStat title="Diagnosis count" detail={`${historyContext.diagnosisCount} persisted diagnosis ${historyContext.diagnosisCount === 1 ? "entry" : "entries"}.`} />
          <ExecStat title="Recurrence" detail={`${historyContext.recurrenceCount} recurrence${historyContext.recurrenceCount === 1 ? "" : "s"} flagged.${historyContext.recurringLeak ? " Classified as recurring leak." : ""}`} />
          <ExecStat title="Recovery stage" detail={historyContext.recoveryStage.replace(/_/g, " ")} />
        </div>

        {evidenceSummary.evidence.length > 0 && (
          <div className="rounded-[22px] border border-blue-500/16 bg-blue-500/8 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200">
              Canonical evidence
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-blue-50/92">
              {evidenceSummary.evidence.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {evidenceSummary.reasonCodes.length > 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Reason codes
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceSummary.reasonCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300"
                >
                  {code.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {evidenceSummary.supportingSignals.length > 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Supporting signals
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
              {evidenceSummary.supportingSignals.map((sig, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 rounded-full border border-white/8 bg-slate-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {sig.kind}
                  </span>
                  <span>{sig.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {evidenceSummary.patternTypes.length > 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Pattern types
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceSummary.patternTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-blue-400/18 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100"
                >
                  {type.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {evidenceSummary.whyNotOtherActions.length > 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Why not other actions
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {evidenceSummary.whyNotOtherActions.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ExecutionPanel>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function ExecutionFooterSection({ data }: { data: InterventionExecutionBundle }) {
  const { historyContext, nextStep } = data;

  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(9,14,27,0.86))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div className="grid gap-4 lg:grid-cols-3">
        <ExecMiniMetric
          label="Diagnosis count"
          value={String(historyContext.diagnosisCount)}
          detail={`Recovery stage: ${historyContext.recoveryStage.replace(/_/g, " ")}.`}
        />
        <ExecMiniMetric
          label="Interventions"
          value={`${historyContext.interventionCount} total`}
          detail={`${historyContext.activeCount} active, ${historyContext.improvedCount} improved, ${historyContext.failedCount} failed.`}
        />
        <ExecMiniMetric
          label="Next move"
          value={nextStep.nextAction.replace(/_/g, " ")}
          detail={nextStep.nextActionReason}
        />
      </div>
      <ExecutionNavFooter conceptKey={data.conceptKey} executionStatus={data.executionStatus} />
    </section>
  );
}

function ExecutionNavFooter({
  conceptKey,
  executionStatus,
}: {
  conceptKey: string;
  executionStatus: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <Link
        href={`/app/concepts/${encodeURIComponent(conceptKey)}`}
        className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
      >
        Concept Detail
      </Link>
      <Link
        href={`/app/concepts/${encodeURIComponent(conceptKey)}/replay`}
        className="rounded-[18px] border border-amber-400/18 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/28 hover:bg-amber-500/16"
      >
        Replay Inspector
      </Link>
      <Link
        href="/app/session"
        className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
      >
        Command Center
      </Link>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function ExecutionPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

function ExecutionPanel({
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
  const toneClass =
    tone === "good"
      ? "border-emerald-500/14 bg-[linear-gradient(180deg,rgba(7,18,24,0.94),rgba(8,16,28,0.9))]"
      : tone === "warning"
        ? "border-amber-500/14 bg-[linear-gradient(180deg,rgba(24,17,7,0.92),rgba(20,14,8,0.88))]"
        : "border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(9,14,27,0.86))]";

  return (
    <section
      className={`rounded-[30px] border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm ${toneClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ExecInfoBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

function ExecStat({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

function ActionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function ExecMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function ExecMiniMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function ExecChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
        subtle
          ? "border-white/8 bg-white/5 text-slate-300"
          : "border-blue-400/25 bg-blue-500/10 text-blue-100"
      }`}
    >
      {label}
    </span>
  );
}
