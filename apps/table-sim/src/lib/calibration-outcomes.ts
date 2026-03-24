import {
  buildAttemptInsights,
  buildRealPlayConceptSignals,
  type CanonicalDrill,
  type InterventionRecommendation,
  type WeaknessPool,
} from "@poker-coach/core/browser";
import type {
  AttemptRow,
  CoachingDiagnosisRow,
  CoachingInputSnapshotRow,
  CoachingInterventionWithOutcomeRow,
  InterventionDecisionSnapshotRow,
  RetentionScheduleRow,
  SrsRow,
  TransferEvaluationSnapshotRow,
} from "../../../../packages/db/src/repository";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "./coaching-memory";
import { buildConceptCaseMap } from "./concept-case";
import { buildTableSimInterventionRecommendations } from "./intervention-decision";
import { buildDiagnosticInsightsFromAttempts, buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "./intervention-support";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";

export type CalibrationOutcomeEvidenceState = "no_meaningful_history" | "partial_evidence" | "strong_evidence";
export type CalibrationInterventionState = "helping" | "inconclusive" | "regressing";
export type CalibrationTrustLevel = "low" | "medium" | "high";

export interface CalibrationConceptInput {
  conceptKey: string;
  label: string;
  whyThisStillMattersSeed: string;
  reviewPressure: number;
  trainingUrgency: number;
  recoveryStage: string;
  interventionHistorySummary: {
    total: number;
    active: number;
    improved: number;
    failed: number;
    latestStatus?: string;
    latestInterventionAt?: string;
  };
  interventionOutcomeSummary: {
    improvedCount: number;
    failedCount: number;
    latestImproved?: boolean | null;
    latestPreScore?: number | null;
    latestPostScore?: number | null;
  };
  retentionSummary: {
    latestState?: string;
    validationState: "none" | "provisional" | "validated" | "failed";
    lastResult?: "pass" | "fail" | null;
    dueCount: number;
    overdueCount: number;
  };
  transferSummary?: {
    status: string;
    confidence: string;
    pressure: string;
    evidenceSufficiency: string;
    reviewSpotCount: number;
    occurrences: number;
    summary: string;
  };
  decisionStability?: "stable" | "shifting" | "flipping";
  recommendation?: {
    action: InterventionRecommendation["action"];
    strategy: InterventionRecommendation["recommendedStrategy"];
    priority: number;
    summary: string;
  };
  nextStep?: {
    action: string;
    priority: string;
    reason: string;
  };
}

export interface CalibrationOutcomeEntry {
  conceptKey: string;
  label: string;
  interventionState: CalibrationInterventionState;
  evidenceState: CalibrationOutcomeEvidenceState;
  transferConfirmation?: {
    status: string;
    confidence: string;
    pressure: string;
    evidenceSufficiency: string;
    summary: string;
  };
  retentionTrend: {
    latestState?: string;
    validationState: "none" | "provisional" | "validated" | "failed";
    lastResult?: "pass" | "fail" | null;
    dueCount: number;
    overdueCount: number;
    summary: string;
  };
  trustSignals: {
    trustLevel: CalibrationTrustLevel;
    evidenceState: CalibrationOutcomeEvidenceState;
    decisionStability?: "stable" | "shifting" | "flipping";
    signals: string[];
  };
  recommendation?: CalibrationConceptInput["recommendation"];
  nextStep?: CalibrationConceptInput["nextStep"];
  whyThisStillMatters: string;
}

export interface CalibrationOutcomesBundle {
  generatedAt: string;
  state: CalibrationOutcomeEvidenceState;
  summary: {
    headline: string;
    detail: string;
    conceptCount: number;
    regressingCount: number;
    helpingCount: number;
    inconclusiveCount: number;
    strongEvidenceCount: number;
  };
  concepts: CalibrationOutcomeEntry[];
}

export function buildPersistedCalibrationOutcomesBundle(args: {
  drills: CanonicalDrill[];
  attempts: AttemptRow[];
  srs?: SrsRow[];
  importedHands: import("@poker-coach/core/browser").ImportedHand[];
  diagnoses?: CoachingDiagnosisRow[];
  interventions?: CoachingInterventionWithOutcomeRow[];
  decisionSnapshots?: InterventionDecisionSnapshotRow[];
  retentionSchedules?: RetentionScheduleRow[];
  transferSnapshots?: TransferEvaluationSnapshotRow[];
  inputSnapshots?: CoachingInputSnapshotRow[];
  activePool: WeaknessPool;
  now?: Date;
  limit?: number;
}): CalibrationOutcomesBundle {
  const now = args.now ?? new Date();
  const diagnosisHistory = toDiagnosisHistoryEntries(args.diagnoses ?? []);
  const interventionHistory = toInterventionHistoryEntries(args.interventions ?? []);
  const realPlaySignals = buildRealPlayConceptSignals(args.importedHands);
  const drillMap = new Map(args.drills.map((drill) => [drill.drill_id, drill]));
  const hydratedAttempts = hydratePersistedStudyAttempts(args.attempts, args.drills);
  const playerIntelligence = buildTableSimPlayerIntelligence({
    drills: args.drills,
    attemptInsights: buildAttemptInsights(args.attempts, drillMap),
    srs: args.srs,
    activePool: args.activePool,
    diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
    diagnosisHistory,
    interventionHistory,
    realPlaySignals,
    patternAttempts: buildPatternAttemptSignals(hydratedAttempts),
    now,
  });
  const recommendations = buildTableSimInterventionRecommendations({
    playerIntelligence,
    diagnosisHistory,
    interventionHistory,
    realPlaySignals,
    retentionSchedules: args.retentionSchedules,
  });
  const conceptCases = buildConceptCaseMap({
    playerIntelligence,
    diagnosisHistory,
    interventionHistory,
    decisionSnapshots: args.decisionSnapshots,
    retentionSchedules: args.retentionSchedules,
    transferSnapshots: args.transferSnapshots,
    inputSnapshots: args.inputSnapshots,
    realPlaySignals,
    recommendations,
    now,
  });

  const concepts = [...conceptCases.values()].map((bundle) => ({
    conceptKey: bundle.history.conceptKey,
    label: bundle.history.label,
    whyThisStillMattersSeed: bundle.explanation.priorityExplanation,
    reviewPressure: bundle.history.reviewPressure,
    trainingUrgency: bundle.recommendation?.priority ?? 0,
    recoveryStage: bundle.history.recoveryStage,
    interventionHistorySummary: {
      total: bundle.history.interventionHistorySummary.total,
      active: bundle.history.interventionHistorySummary.active,
      improved: bundle.history.interventionHistorySummary.improved,
      failed: bundle.history.interventionHistorySummary.failed,
      latestStatus: bundle.history.interventionHistorySummary.latestStatus,
      latestInterventionAt: bundle.history.interventionHistorySummary.latestInterventionAt,
    },
    interventionOutcomeSummary: {
      improvedCount: bundle.history.interventionOutcomeSummary.improvedCount,
      failedCount: bundle.history.interventionOutcomeSummary.failedCount,
      latestImproved: bundle.history.interventionOutcomeSummary.latestImproved,
      latestPreScore: bundle.history.interventionOutcomeSummary.latestPreScore,
      latestPostScore: bundle.history.interventionOutcomeSummary.latestPostScore,
    },
    retentionSummary: {
      latestState: bundle.history.retentionSummary.latestState,
      validationState: bundle.history.retentionSummary.validationState,
      lastResult: bundle.history.retentionSummary.lastResult ?? null,
      dueCount: bundle.history.retentionSummary.dueCount,
      overdueCount: bundle.history.retentionSummary.overdueCount,
    },
    transferSummary: bundle.history.transferSummary
      ? {
          status: bundle.history.transferSummary.status,
          confidence: bundle.history.transferSummary.confidence,
          pressure: bundle.history.transferSummary.pressure,
          evidenceSufficiency: bundle.history.transferSummary.evidenceSufficiency,
          reviewSpotCount: bundle.history.transferSummary.reviewSpotCount,
          occurrences: bundle.history.transferSummary.occurrences,
          summary: bundle.history.transferSummary.summary,
        }
      : undefined,
    decisionStability: bundle.decisionAudit?.stability,
    recommendation: bundle.recommendation
      ? {
          action: bundle.recommendation.action,
          strategy: bundle.recommendation.recommendedStrategy,
          priority: bundle.recommendation.priority,
          summary: bundle.recommendation.summary,
        }
      : undefined,
    nextStep: {
      action: bundle.nextStep.nextAction,
      priority: bundle.nextStep.nextActionPriority,
      reason: bundle.nextStep.nextActionReason,
    },
  }));

  return buildCalibrationOutcomesBundle({
    concepts,
    now,
    limit: args.limit,
  });
}

export function buildCalibrationOutcomesBundle(args: {
  concepts: CalibrationConceptInput[];
  now?: Date;
  limit?: number;
}): CalibrationOutcomesBundle {
  const concepts = args.concepts
    .map((concept) => buildCalibrationOutcomeEntry(concept))
    .sort(compareEntries)
    .slice(0, args.limit ?? 12);
  const regressingCount = concepts.filter((concept) => concept.interventionState === "regressing").length;
  const helpingCount = concepts.filter((concept) => concept.interventionState === "helping").length;
  const inconclusiveCount = concepts.length - regressingCount - helpingCount;
  const strongEvidenceCount = concepts.filter((concept) => concept.evidenceState === "strong_evidence").length;
  const state: CalibrationOutcomeEvidenceState = concepts.length === 0
    ? "no_meaningful_history"
    : strongEvidenceCount > 0
      ? "strong_evidence"
      : concepts.some((concept) => concept.evidenceState === "partial_evidence")
        ? "partial_evidence"
        : "no_meaningful_history";

  return {
    generatedAt: (args.now ?? new Date()).toISOString(),
    state,
    summary: {
      headline: buildHeadline(state),
      detail: buildDetail(state, concepts.length, regressingCount, helpingCount, strongEvidenceCount),
      conceptCount: concepts.length,
      regressingCount,
      helpingCount,
      inconclusiveCount,
      strongEvidenceCount,
    },
    concepts,
  };
}

function buildCalibrationOutcomeEntry(concept: CalibrationConceptInput): CalibrationOutcomeEntry {
  const evidenceState = deriveEvidenceState(concept);
  const interventionState = deriveInterventionState(concept);
  const trustSignals = buildTrustSignals(concept, evidenceState, interventionState);

  return {
    conceptKey: concept.conceptKey,
    label: concept.label,
    interventionState,
    evidenceState,
    transferConfirmation: concept.transferSummary
      ? {
          status: concept.transferSummary.status,
          confidence: concept.transferSummary.confidence,
          pressure: concept.transferSummary.pressure,
          evidenceSufficiency: concept.transferSummary.evidenceSufficiency,
          summary: concept.transferSummary.summary,
        }
      : undefined,
    retentionTrend: {
      latestState: concept.retentionSummary.latestState,
      validationState: concept.retentionSummary.validationState,
      lastResult: concept.retentionSummary.lastResult ?? null,
      dueCount: concept.retentionSummary.dueCount,
      overdueCount: concept.retentionSummary.overdueCount,
      summary: buildRetentionSummary(concept.retentionSummary),
    },
    trustSignals,
    recommendation: concept.recommendation,
    nextStep: concept.nextStep,
    whyThisStillMatters: buildWhyThisStillMatters(concept, interventionState, evidenceState),
  };
}

function deriveEvidenceState(concept: CalibrationConceptInput): CalibrationOutcomeEvidenceState {
  const hasInterventionHistory = concept.interventionHistorySummary.total > 0;
  const hasMeasuredOutcome = concept.interventionOutcomeSummary.latestImproved !== undefined && concept.interventionOutcomeSummary.latestImproved !== null;
  const hasRetentionEvidence = concept.retentionSummary.validationState !== "none";
  const hasTransferEvidence = Boolean(concept.transferSummary && concept.transferSummary.status !== "no_real_play_evidence");
  const confirmedRetentionEvidence =
    concept.retentionSummary.validationState === "validated"
    || concept.retentionSummary.validationState === "failed";
  const strongTransferEvidence =
    concept.transferSummary?.evidenceSufficiency === "strong"
    && concept.transferSummary.status !== "transfer_uncertain";

  if (!hasInterventionHistory && !hasMeasuredOutcome && !hasRetentionEvidence && !hasTransferEvidence) {
    return "no_meaningful_history";
  }
  if ((hasInterventionHistory && hasMeasuredOutcome) || confirmedRetentionEvidence || strongTransferEvidence) {
    return "strong_evidence";
  }
  return "partial_evidence";
}

function deriveInterventionState(concept: CalibrationConceptInput): CalibrationInterventionState {
  if (
    concept.recoveryStage === "regressed"
    || concept.retentionSummary.lastResult === "fail"
    || concept.transferSummary?.status === "transfer_regressed"
    || concept.interventionOutcomeSummary.latestImproved === false
    || concept.interventionOutcomeSummary.failedCount > concept.interventionOutcomeSummary.improvedCount
  ) {
    return "regressing";
  }

  if (
    concept.retentionSummary.validationState === "validated"
    || concept.transferSummary?.status === "transfer_validated"
    || concept.transferSummary?.status === "transfer_progressing"
    || concept.interventionOutcomeSummary.latestImproved === true
    || concept.interventionOutcomeSummary.improvedCount > concept.interventionOutcomeSummary.failedCount
  ) {
    return "helping";
  }

  return "inconclusive";
}

function buildTrustSignals(
  concept: CalibrationConceptInput,
  evidenceState: CalibrationOutcomeEvidenceState,
  interventionState: CalibrationInterventionState,
): CalibrationOutcomeEntry["trustSignals"] {
  const signals: string[] = [];
  if (concept.interventionHistorySummary.total > 0) {
    signals.push(`${concept.interventionHistorySummary.total} intervention cycle${concept.interventionHistorySummary.total === 1 ? "" : "s"} tracked`);
  }
  if (concept.transferSummary) {
    signals.push(`transfer ${concept.transferSummary.status.replace(/_/g, " ")}`);
  }
  if (concept.retentionSummary.validationState !== "none") {
    signals.push(`retention ${concept.retentionSummary.validationState}`);
  }
  if (concept.decisionStability) {
    signals.push(`decision stability: ${concept.decisionStability}`);
  }

  const trustLevel: CalibrationTrustLevel = evidenceState === "strong_evidence" && concept.decisionStability === "stable"
    ? "high"
    : evidenceState === "no_meaningful_history"
      ? "low"
      : interventionState === "regressing"
        ? "medium"
        : "medium";

  return {
    trustLevel,
    evidenceState,
    decisionStability: concept.decisionStability,
    signals,
  };
}

function buildRetentionSummary(retention: CalibrationConceptInput["retentionSummary"]): string {
  if (retention.lastResult === "fail") {
    return "Recent retention validation failed, so the concept is not holding cleanly.";
  }
  if (retention.validationState === "validated") {
    return "Retention has been validated recently.";
  }
  if (retention.overdueCount > 0) {
    return `${retention.overdueCount} retention check${retention.overdueCount === 1 ? "" : "s"} are overdue.`;
  }
  if (retention.dueCount > 0) {
    return `${retention.dueCount} retention check${retention.dueCount === 1 ? "" : "s"} are due.`;
  }
  if (retention.validationState === "provisional") {
    return "Retention evidence exists, but the concept still needs confirmation.";
  }
  return "Retention evidence is still sparse.";
}

function buildWhyThisStillMatters(
  concept: CalibrationConceptInput,
  interventionState: CalibrationInterventionState,
  evidenceState: CalibrationOutcomeEvidenceState,
): string {
  if (interventionState === "regressing" && concept.transferSummary?.status === "transfer_regressed") {
    return `${concept.whyThisStillMattersSeed} Transfer has slipped after earlier progress, so the concept remains trust-critical.`;
  }
  if (concept.retentionSummary.lastResult === "fail") {
    return `${concept.whyThisStillMattersSeed} Recent retention failure means the gain has not held yet.`;
  }
  if (evidenceState === "no_meaningful_history") {
    return `${concept.whyThisStillMattersSeed} The app still lacks enough outcome evidence to clear this concept confidently.`;
  }
  return concept.whyThisStillMattersSeed;
}

function compareEntries(left: CalibrationOutcomeEntry, right: CalibrationOutcomeEntry): number {
  return scoreInterventionState(right.interventionState) - scoreInterventionState(left.interventionState)
    || scoreEvidenceState(right.evidenceState) - scoreEvidenceState(left.evidenceState)
    || right.trustSignals.signals.length - left.trustSignals.signals.length
    || left.label.localeCompare(right.label);
}

function scoreInterventionState(state: CalibrationInterventionState): number {
  switch (state) {
    case "regressing":
      return 3;
    case "inconclusive":
      return 2;
    case "helping":
      return 1;
  }
}

function scoreEvidenceState(state: CalibrationOutcomeEvidenceState): number {
  switch (state) {
    case "strong_evidence":
      return 3;
    case "partial_evidence":
      return 2;
    case "no_meaningful_history":
      return 1;
  }
}

function buildHeadline(state: CalibrationOutcomeEvidenceState): string {
  switch (state) {
    case "no_meaningful_history":
      return "Calibration outcomes do not yet have meaningful history.";
    case "partial_evidence":
      return "Calibration outcomes have partial evidence.";
    case "strong_evidence":
      return "Calibration outcomes include strong evidence.";
  }
}

function buildDetail(
  state: CalibrationOutcomeEvidenceState,
  conceptCount: number,
  regressingCount: number,
  helpingCount: number,
  strongEvidenceCount: number,
): string {
  switch (state) {
    case "no_meaningful_history":
      return "The adapter did not find enough persisted intervention, transfer, or retention outcome history to make strong trust claims yet.";
    case "partial_evidence":
      return `${conceptCount} concept outcome summaries are available, but only partial trust evidence exists so far.`;
    case "strong_evidence":
      return `${strongEvidenceCount} concept${strongEvidenceCount === 1 ? "" : "s"} already have strong evidence, with ${regressingCount} regressing and ${helpingCount} helping signal${helpingCount === 1 ? "" : "s"} visible.`;
  }
}
