import React, { type ReactNode } from "react";
import Link from "next/link";
import type { ConceptCaseResponse } from "@/lib/concept-case";
import type { EngineReplaySummary } from "@/lib/input-snapshots";
import type { InterventionStrategyBlueprint } from "@poker-coach/core/browser";
import type { ConceptTransferEvaluation } from "@poker-coach/core/browser";
import type { TransferAuditSummary } from "@/lib/transfer-audit";
import type { RetentionSummary } from "@/lib/retention-scheduling";
import type { InterventionDecisionAuditSummary } from "@/lib/intervention-decision-audit";
import type {
  CalibrationSurfaceAdapter,
  CalibrationSurfaceConceptSummary,
} from "@/lib/calibration-surface";

export interface ConceptCaseScreenState {
  loading: boolean;
  error?: string | null;
  data?: ConceptCaseResponse | null;
  calibration?: CalibrationSurfaceAdapter | null;
  conceptCalibration?: CalibrationSurfaceConceptSummary | null;
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
        <ConceptCalibrationPanel
          calibration={state.calibration}
          conceptCalibration={state.conceptCalibration}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
          <ConceptStatusCard data={state.data} />
          <ConceptNextStepCard data={state.data} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <ConceptHistoryCard data={state.data} />
          <ConceptEvidenceCard data={state.data} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <ConceptStrategyPanel blueprint={state.data.strategyBlueprint} />
          <ConceptTransferPanel
            transferEvaluation={state.data.transferEvaluation}
            transferAudit={state.data.transferAudit}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <ConceptDecisionPanel decisionAudit={decisionAudit} />
          <ConceptRetentionPanel retention={retention} />
        </div>

        <ConceptReplayPanel
          replayMetadata={state.data.replayMetadata}
          conceptKey={history.conceptKey}
        />

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
              href={`/app/concepts/${encodeURIComponent(history.conceptKey)}/execution`}
              className="rounded-[18px] border border-blue-400/18 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:border-blue-300/28 hover:bg-blue-500/16"
            >
              Execute Intervention
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

function ConceptCalibrationPanel({
  calibration,
  conceptCalibration,
}: {
  calibration?: CalibrationSurfaceAdapter | null;
  conceptCalibration?: CalibrationSurfaceConceptSummary | null;
}) {
  if (!calibration || calibration.state === "no_calibration") {
    return null;
  }

  const summary = conceptCalibration ?? calibration.highlightedConcept;
  const title = conceptCalibration
    ? `${conceptCalibration.label} calibration`
    : "Calibration summary";
  const tone = summary?.priority === "high"
    ? "warning"
    : calibration.state === "strong_evidence"
      ? "good"
      : "neutral";

  return (
    <ConceptPanel tone={tone} title={title} eyebrow="Calibration Trust">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label={calibration.state.replace(/_/g, " ")} />
          {summary && <HeaderChip label={summary.interventionState.replace(/_/g, " ")} subtle />}
          {summary && <HeaderChip label={`${summary.trustLevel} trust`} subtle />}
          {summary && <HeaderChip label={`${summary.priority} priority`} subtle />}
        </div>
        <InfoBlock title="Calibration read" detail={summary?.whyThisStillMatters ?? calibration.detail} />
        {summary && (
          <div className="grid gap-3 md:grid-cols-2">
            <HistoryStat title="Retention trend" detail={summary.retentionSummary} />
            <HistoryStat title="Transfer confirmation" detail={summary.transferSummary ?? "No transfer confirmation summary is attached yet."} />
          </div>
        )}
        {!summary && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-sm leading-6 text-slate-200">{calibration.headline}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{calibration.detail}</p>
          </div>
        )}
      </div>
    </ConceptPanel>
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

export function ConceptStrategyPanel({ blueprint }: { blueprint?: InterventionStrategyBlueprint }) {
  if (!blueprint) {
    return (
      <ConceptPanel tone="neutral" title="Strategy Blueprint" eyebrow="Intervention Strategy">
        <p className="text-sm leading-6 text-slate-300">No strategy blueprint is available yet. A blueprint is generated once a clear intervention strategy is recommended for this concept.</p>
      </ConceptPanel>
    );
  }

  const drillMix = blueprint.recommendedDrillMix;

  return (
    <ConceptPanel tone="good" title={blueprint.title} eyebrow="Strategy Blueprint">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label={blueprint.strategyType.replace(/_/g, " ")} />
          <HeaderChip label={`${blueprint.intensity} intensity`} subtle />
          <HeaderChip label={`${blueprint.recommendedAttemptWindow.sessions} sessions`} subtle />
        </div>
        <InfoBlock title="Objective" detail={blueprint.objective} />
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Recommended drill mix</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {([
              { label: "Repair", value: drillMix.repair },
              { label: "Review", value: drillMix.review },
              { label: "Applied", value: drillMix.applied },
              { label: "Validation", value: drillMix.validation },
            ] as const).map(({ label, value }) => (
              <div key={label} className="rounded-[16px] border border-white/8 bg-white/5 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-1.5 text-lg font-semibold text-white">{Math.round(value * 100)}%</p>
              </div>
            ))}
          </div>
        </div>
        {blueprint.successCriteriaHints.length > 0 && (
          <div className="rounded-[22px] border border-emerald-500/16 bg-emerald-500/8 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Success criteria</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-emerald-50/92">
              {blueprint.successCriteriaHints.map((hint, i) => (
                <li key={i}>• {hint}</li>
              ))}
            </ul>
          </div>
        )}
        {blueprint.escalationTriggerHints.length > 0 && (
          <div className="rounded-[22px] border border-amber-500/18 bg-amber-500/8 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">Escalation triggers</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-amber-50/88">
              {blueprint.escalationTriggerHints.map((hint, i) => (
                <li key={i}>• {hint}</li>
              ))}
            </ul>
          </div>
        )}
        {blueprint.coachNotes.length > 0 && (
          <InfoBlock title="Coach note" detail={blueprint.coachNotes[0]!} />
        )}
      </div>
    </ConceptPanel>
  );
}

export function ConceptTransferPanel({
  transferEvaluation,
  transferAudit,
}: {
  transferEvaluation: ConceptTransferEvaluation;
  transferAudit?: TransferAuditSummary;
}) {
  const tone = transferEvaluation.status === "transfer_validated"
    ? "good"
    : transferEvaluation.status === "transfer_gap" || transferEvaluation.status === "transfer_regressed"
      ? "warning"
      : "neutral";

  return (
    <ConceptPanel tone={tone} title="Transfer Status" eyebrow="Real-Play Transfer">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label={transferEvaluation.status.replace(/_/g, " ")} />
          <HeaderChip label={`${transferEvaluation.confidence} confidence`} subtle />
          <HeaderChip label={`${transferEvaluation.pressure} pressure`} subtle />
          <HeaderChip label={transferEvaluation.evidenceSufficiency.replace(/_/g, " ")} subtle />
        </div>
        <InfoBlock title="Transfer read" detail={transferEvaluation.coachExplanation} />
        <div className="grid gap-3 md:grid-cols-2">
          <HistoryStat
            title="Study performance"
            detail={transferEvaluation.studyPerformance !== undefined
              ? `${Math.round(transferEvaluation.studyPerformance * 100)}% study average`
              : "Study performance not yet available."}
          />
          <HistoryStat
            title="Real-play performance"
            detail={transferEvaluation.realPlayPerformance !== undefined
              ? `${Math.round(transferEvaluation.realPlayPerformance * 100)}% real-play average`
              : "Real-play performance not yet available."}
          />
          <HistoryStat
            title="Study vs real-play gap"
            detail={transferEvaluation.studyVsRealPlayDelta !== undefined
              ? `${Math.round(Math.abs(transferEvaluation.studyVsRealPlayDelta) * 100)} point gap${transferEvaluation.studyVsRealPlayDelta > 0 ? " (study ahead)" : " (real-play ahead)"}`
              : "No gap calculation available yet."}
          />
          <HistoryStat
            title="Real-play evidence"
            detail={`${transferEvaluation.realPlayEvidence.occurrences} occurrence${transferEvaluation.realPlayEvidence.occurrences === 1 ? "" : "s"}, ${transferEvaluation.realPlayEvidence.reviewSpotCount} review spot${transferEvaluation.realPlayEvidence.reviewSpotCount === 1 ? "" : "s"}.`}
          />
        </div>
        {transferAudit && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Transfer audit</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {`${transferAudit.stability} stability across ${transferAudit.latestSnapshot ? "recorded" : "no"} transfer history.`}
              {transferAudit.firstValidatedAt ? ` First validated ${formatDate(transferAudit.firstValidatedAt)}.` : ""}
              {transferAudit.latestGapOrRegressionAt ? ` Latest gap or regression ${formatDate(transferAudit.latestGapOrRegressionAt)}.` : ""}
            </p>
          </div>
        )}
        {transferEvaluation.riskFlags.length > 0 && (
          <div className="rounded-[22px] border border-amber-500/18 bg-amber-500/8 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">Risk flags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {transferEvaluation.riskFlags.map((flag) => (
                <span key={flag} className="rounded-full border border-amber-400/18 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                  {flag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ConceptPanel>
  );
}

export function ConceptDecisionPanel({ decisionAudit }: { decisionAudit?: InterventionDecisionAuditSummary }) {
  if (!decisionAudit || !decisionAudit.latestDecision) {
    return (
      <ConceptPanel tone="neutral" title="Intervention Decision History" eyebrow="Decision Audit">
        <p className="text-sm leading-6 text-slate-300">No intervention decision snapshots are stored yet for this concept. Decision history is persisted when coaching recommendations are generated and acted upon.</p>
      </ConceptPanel>
    );
  }

  const { latestDecision, previousDecision, stability, escalationCount, latestDecisionChanged } = decisionAudit;

  return (
    <ConceptPanel tone="neutral" title="Intervention Decision History" eyebrow="Decision Audit">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label={stability} />
          <HeaderChip label={`${escalationCount} escalation${escalationCount === 1 ? "" : "s"}`} subtle />
          {latestDecisionChanged && <HeaderChip label="decision changed" subtle />}
        </div>
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Latest decision</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DecisionField label="Action" value={latestDecision.action.replace(/_/g, " ")} />
            <DecisionField label="Strategy" value={latestDecision.recommendedStrategy.replace(/_/g, " ")} />
            <DecisionField label="Confidence" value={latestDecision.confidence} />
            <DecisionField label="Priority" value={String(latestDecision.priority)} />
            <DecisionField label="Intensity" value={latestDecision.suggestedIntensity} />
            <DecisionField label="Acted upon" value={latestDecision.actedUpon ? "yes" : "no"} />
          </div>
          {latestDecision.reasonCodes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {latestDecision.reasonCodes.map((code) => (
                <span key={code} className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  {code.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Recorded {formatDate(latestDecision.createdAt)}</p>
        </div>
        {previousDecision && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Previous decision</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DecisionField label="Action" value={previousDecision.action.replace(/_/g, " ")} />
              <DecisionField label="Confidence" value={previousDecision.confidence} />
              <DecisionField label="Priority" value={String(previousDecision.priority)} />
              <DecisionField label="Acted upon" value={previousDecision.actedUpon ? "yes" : "no"} />
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Recorded {formatDate(previousDecision.createdAt)}</p>
          </div>
        )}
      </div>
    </ConceptPanel>
  );
}

export function ConceptRetentionPanel({ retention }: { retention: RetentionSummary }) {
  const latestSchedule = retention.latestSchedule;
  const tone = latestSchedule?.state === "overdue"
    ? "warning"
    : latestSchedule?.result === "pass" || retention.validationState === "validated"
      ? "good"
      : "neutral";

  return (
    <ConceptPanel tone={tone} title="Retention Schedule" eyebrow="Retention Validation">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label={retention.validationState.replace(/_/g, " ")} />
          {latestSchedule && <HeaderChip label={latestSchedule.state.replace(/_/g, " ")} subtle />}
          {retention.dueCount > 0 && <HeaderChip label={`${retention.dueCount} due`} subtle />}
          {retention.overdueCount > 0 && <HeaderChip label={`${retention.overdueCount} overdue`} subtle />}
        </div>
        {latestSchedule ? (
          <div className="grid gap-3 md:grid-cols-2">
            <HistoryStat
              title="Current state"
              detail={`${latestSchedule.state.replace(/_/g, " ")}. Reason: ${latestSchedule.reason.replace(/_/g, " ")}.`}
            />
            <HistoryStat
              title="Scheduled for"
              detail={latestSchedule.scheduledFor ? formatDate(latestSchedule.scheduledFor) : "Not yet scheduled."}
            />
            <HistoryStat
              title="Last result"
              detail={latestSchedule.result ? latestSchedule.result : "No result recorded yet."}
            />
            <HistoryStat
              title="Priority"
              detail={`Retention priority score: ${latestSchedule.priority}.`}
            />
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-300">No retention schedule is attached yet. A schedule is generated after an intervention stabilizes far enough to warrant a validation check.</p>
        )}
        {retention.lastResult && (
          <div className={`rounded-[22px] border p-4 ${retention.lastResult === "pass" ? "border-emerald-500/16 bg-emerald-500/8" : "border-amber-500/18 bg-amber-500/8"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${retention.lastResult === "pass" ? "text-emerald-200" : "text-amber-200"}`}>
              Last result
            </p>
            <p className={`mt-2 text-sm leading-6 ${retention.lastResult === "pass" ? "text-emerald-50/92" : "text-amber-50/88"}`}>
              {retention.lastResult === "pass"
                ? "The most recent retention validation passed. The concept gain is confirmed as holding."
                : "The most recent retention validation failed. The gain may need to be reopened for repair."}
            </p>
          </div>
        )}
      </div>
    </ConceptPanel>
  );
}

export function ConceptReplayPanel({
  replayMetadata,
  conceptKey,
}: {
  replayMetadata: ConceptCaseResponse["replayMetadata"];
  conceptKey: string;
}) {
  const { recommendation, transfer } = replayMetadata;

  return (
    <ConceptPanel tone="neutral" title="Replayability Summary" eyebrow="Replay Metadata">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Recommendation replay</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{formatReplayInterpretation(recommendation.interpretation)}</p>
            {recommendation.changedEvidenceFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {recommendation.changedEvidenceFields.map((field) => (
                  <span key={field} className="rounded-full border border-white/8 bg-slate-950/60 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {field}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Transfer replay</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{formatReplayInterpretation(transfer.interpretation)}</p>
            {transfer.changedEvidenceFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {transfer.changedEvidenceFields.map((field) => (
                  <span key={field} className="rounded-full border border-white/8 bg-slate-950/60 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {field}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-[22px] border border-amber-500/14 bg-amber-500/6 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">Engine manifest</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {recommendation.manifestDrift.matches && transfer.manifestDrift.matches
              ? "Both recommendation and transfer engines are running under the same manifest versions as when the latest snapshots were recorded."
              : "Engine manifest drift is present. See the Replay Inspector for the full version-drift breakdown."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/app/concepts/${encodeURIComponent(conceptKey)}/replay`}
            className="rounded-[18px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-500/16"
          >
            Open Replay Inspector
          </Link>
        </div>
      </div>
    </ConceptPanel>
  );
}

function formatReplayInterpretation(interpretation: EngineReplaySummary["interpretation"]): string {
  switch (interpretation) {
    case "stable":
      return "No meaningful change in evidence or output across the latest stored snapshot pair.";
    case "evidence_changed_output_changed":
      return "Evidence shifted and the output also changed in the latest comparable pair.";
    case "evidence_changed_output_stable":
      return "Evidence shifted but the output held stable across the latest comparable pair.";
    case "engine_changed":
      return "Engine manifest changed between the latest two stored snapshots with no evidence shift.";
    case "evidence_and_engine_changed_output_changed":
      return "Both evidence and engine manifest changed, and the output also shifted.";
    case "evidence_and_engine_changed_output_stable":
      return "Both evidence and engine manifest changed, but the output held stable.";
    case "output_changed_without_input_delta":
      return "The output shifted without a detectable evidence or manifest change. Worth reviewing in the inspector.";
  }
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

function DecisionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
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
