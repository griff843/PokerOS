import type { ConceptRecoveryStage, InterventionLifecycleStatus, MemoryDiagnosisHistoryEntry, MemoryInterventionHistoryEntry, SessionPlanningReason } from "./coaching-memory";
import type { CoachingPattern, CoachingPatternType } from "./patterns";
import type { InterventionRecommendation, InterventionRecommendationAction, InterventionRecommendationReasonCode, InterventionRecommendationStrength, InterventionStrategyType } from "./intervention-recommendations";
import type { RetentionScheduleReason, RetentionScheduleState } from "./retention-scheduler";

export type ConceptCaseDecisionStability = "stable" | "shifting" | "flipping";
export type ConceptCaseRecoveryConfidence = "low" | "medium" | "high";
export type ConceptCaseRiskFlag =
  | "recurring_leak"
  | "retention_due"
  | "retention_overdue"
  | "regression_risk"
  | "decision_instability"
  | "transfer_gap"
  | "intervention_not_sticking"
  | "review_pressure"
  | "active_repair";
export type ConceptCaseNextActionType = "repair" | "retention" | "transfer" | "monitor" | "close_loop";
export type ConceptCasePriorityBucket = "low" | "medium" | "high" | "urgent";

export interface ConceptCaseRetentionSummaryInput {
  latestState?: RetentionScheduleState;
  latestReason?: RetentionScheduleReason;
  latestScheduledFor?: string;
  dueCount: number;
  overdueCount: number;
  lastResult?: "pass" | "fail" | null;
  validationState: "none" | "provisional" | "validated" | "failed";
}

export interface ConceptCaseDecisionSummaryInput {
  latestAction?: InterventionRecommendationAction;
  latestStrategy?: InterventionStrategyType;
  latestPriority?: number;
  latestCreatedAt?: string;
  latestActedUpon?: boolean;
  latestDecisionChanged: boolean;
  currentRecommendationChanged: boolean;
  escalationCount: number;
  stability: ConceptCaseDecisionStability;
}

export interface ConceptCaseRecentAttemptSummaryInput {
  sampleSize: number;
  recentAverage?: number;
  averageScore?: number;
  lastAttemptAt?: string;
  failedCount: number;
  trendDirection?: "improving" | "worsening" | "stable";
}

export interface ConceptCaseHistoryInput {
  conceptKey: string;
  label: string;
  summary?: string;
  diagnosisHistory: MemoryDiagnosisHistoryEntry[];
  interventionHistory: MemoryInterventionHistoryEntry[];
  recoveryStage: ConceptRecoveryStage;
  patterns: CoachingPattern[];
  latestInterventionRecommendation?: InterventionRecommendation;
  decisionSummary?: ConceptCaseDecisionSummaryInput;
  retentionSummary: ConceptCaseRetentionSummaryInput;
  recentAttempts: ConceptCaseRecentAttemptSummaryInput;
  recurrenceCount: number;
  reviewPressure: number;
  planningReasons: SessionPlanningReason[];
}

export interface ConceptCaseEvidenceItem {
  kind: "diagnosis" | "intervention" | "pattern" | "retention" | "decision" | "attempt" | "planning";
  code: string;
  detail: string;
}

export interface ConceptCaseHistory {
  conceptKey: string;
  label: string;
  summary?: string;
  firstDiagnosedAt?: string;
  mostRecentDiagnosisAt?: string;
  diagnosisCount: number;
  recurringLeak: boolean;
  recurrenceCount: number;
  reviewPressure: number;
  interventionHistorySummary: {
    total: number;
    active: number;
    completed: number;
    regressed: number;
    abandoned: number;
    improved: number;
    failed: number;
    latestStatus?: InterventionLifecycleStatus;
    latestInterventionAt?: string;
  };
  interventionLifecycleSummary: {
    hasActiveIntervention: boolean;
    latestStatus?: InterventionLifecycleStatus;
    activeStatuses: InterventionLifecycleStatus[];
  };
  interventionOutcomeSummary: {
    improvedCount: number;
    failedCount: number;
    latestImproved?: boolean | null;
    latestPreScore?: number | null;
    latestPostScore?: number | null;
  };
  recoveryStage: ConceptRecoveryStage;
  patternSummary: {
    count: number;
    types: CoachingPatternType[];
    topPatternType?: CoachingPatternType;
    transferGap: boolean;
    interventionNotSticking: boolean;
  };
  latestDecisionSummary?: ConceptCaseDecisionSummaryInput;
  decisionStabilitySummary?: {
    stability: ConceptCaseDecisionStability;
    escalationCount: number;
    latestDecisionChanged: boolean;
    currentRecommendationChanged: boolean;
  };
  retentionSummary: ConceptCaseRetentionSummaryInput;
  recentAttemptSummary: ConceptCaseRecentAttemptSummaryInput;
  prioritizationContext: {
    planningReasons: SessionPlanningReason[];
    recommendationReasons: InterventionRecommendationReasonCode[];
    currentRecommendationAction?: InterventionRecommendationAction;
    currentRecommendationStrategy?: InterventionStrategyType;
  };
  supportingEvidence: ConceptCaseEvidenceItem[];
}

export interface ConceptCaseExplanation {
  statusLabel: string;
  statusReason: string;
  priorityExplanation: string;
  recommendedNextAction: InterventionRecommendationAction | "run_retention_validation";
  recommendedActionReason: string;
  stabilityAssessment: string;
  recoveryConfidence: ConceptCaseRecoveryConfidence;
  riskFlags: ConceptCaseRiskFlag[];
  supportingEvidence: ConceptCaseEvidenceItem[];
}

export interface ConceptCaseNextStep {
  nextAction: InterventionRecommendationAction | "run_retention_validation";
  nextActionType: ConceptCaseNextActionType;
  nextActionPriority: ConceptCasePriorityBucket;
  nextActionReason: string;
  blockingRisks: ConceptCaseRiskFlag[];
  coachNote: string;
}

export function buildConceptCaseHistory(input: ConceptCaseHistoryInput): ConceptCaseHistory {
  const diagnosisHistory = [...input.diagnosisHistory].sort(compareDescByCreatedAt);
  const interventionHistory = [...input.interventionHistory].sort(compareInterventionHistoryDesc);
  const firstDiagnosis = diagnosisHistory[diagnosisHistory.length - 1];
  const latestDiagnosis = diagnosisHistory[0];
  const latestIntervention = interventionHistory[0];
  const improvedCount = interventionHistory.filter((entry) => entry.improved === true).length;
  const failedCount = interventionHistory.filter((entry) => entry.improved === false || entry.status === "regressed").length;
  const activeStatuses = interventionHistory
    .filter((entry) => entry.status === "assigned" || entry.status === "in_progress" || entry.status === "stabilizing")
    .map((entry) => entry.status);
  const patternTypes = input.patterns.map((pattern) => pattern.type);

  const supportingEvidence = buildSupportingEvidence(input, {
    firstDiagnosisAt: firstDiagnosis?.createdAt,
    latestDiagnosisAt: latestDiagnosis?.createdAt,
    latestIntervention,
    improvedCount,
    failedCount,
    patternTypes,
  });

  return {
    conceptKey: input.conceptKey,
    label: input.label,
    summary: input.summary,
    firstDiagnosedAt: firstDiagnosis?.createdAt,
    mostRecentDiagnosisAt: latestDiagnosis?.createdAt,
    diagnosisCount: diagnosisHistory.length,
    recurringLeak: input.recurrenceCount >= 2 || diagnosisHistory.length >= 2,
    recurrenceCount: input.recurrenceCount,
    reviewPressure: input.reviewPressure,
    interventionHistorySummary: {
      total: interventionHistory.length,
      active: activeStatuses.length,
      completed: interventionHistory.filter((entry) => entry.status === "completed").length,
      regressed: interventionHistory.filter((entry) => entry.status === "regressed").length,
      abandoned: interventionHistory.filter((entry) => entry.status === "abandoned").length,
      improved: improvedCount,
      failed: failedCount,
      latestStatus: latestIntervention?.status,
      latestInterventionAt: latestIntervention ? latestIntervention.outcomeCreatedAt ?? latestIntervention.createdAt : undefined,
    },
    interventionLifecycleSummary: {
      hasActiveIntervention: activeStatuses.length > 0,
      latestStatus: latestIntervention?.status,
      activeStatuses,
    },
    interventionOutcomeSummary: {
      improvedCount,
      failedCount,
      latestImproved: latestIntervention?.improved,
      latestPreScore: latestIntervention?.preScore,
      latestPostScore: latestIntervention?.postScore,
    },
    recoveryStage: input.recoveryStage,
    patternSummary: {
      count: input.patterns.length,
      types: patternTypes,
      topPatternType: input.patterns[0]?.type,
      transferGap: patternTypes.includes("real_play_transfer_gap"),
      interventionNotSticking: patternTypes.includes("intervention_not_sticking"),
    },
    latestDecisionSummary: input.decisionSummary,
    decisionStabilitySummary: input.decisionSummary
      ? {
          stability: input.decisionSummary.stability,
          escalationCount: input.decisionSummary.escalationCount,
          latestDecisionChanged: input.decisionSummary.latestDecisionChanged,
          currentRecommendationChanged: input.decisionSummary.currentRecommendationChanged,
        }
      : undefined,
    retentionSummary: input.retentionSummary,
    recentAttemptSummary: input.recentAttempts,
    prioritizationContext: {
      planningReasons: input.planningReasons,
      recommendationReasons: input.latestInterventionRecommendation?.reasonCodes ?? [],
      currentRecommendationAction: input.latestInterventionRecommendation?.action,
      currentRecommendationStrategy: input.latestInterventionRecommendation?.recommendedStrategy,
    },
    supportingEvidence,
  };
}

export function deriveConceptCoachingExplanation(history: ConceptCaseHistory): ConceptCaseExplanation {
  const riskFlags = collectRiskFlags(history);
  const recommendedNextAction = chooseRecommendedNextAction(history);

  return {
    statusLabel: buildStatusLabel(history),
    statusReason: buildStatusReason(history),
    priorityExplanation: buildPriorityExplanation(history, riskFlags),
    recommendedNextAction,
    recommendedActionReason: buildRecommendedActionReason(history, recommendedNextAction),
    stabilityAssessment: buildStabilityAssessment(history),
    recoveryConfidence: deriveRecoveryConfidence(history),
    riskFlags,
    supportingEvidence: history.supportingEvidence.slice(0, 6),
  };
}

export function deriveConceptNextStep(history: ConceptCaseHistory): ConceptCaseNextStep {
  const explanation = deriveConceptCoachingExplanation(history);
  const nextActionType = mapNextActionType(explanation.recommendedNextAction);
  const nextActionPriority = derivePriorityBucket(history, explanation.riskFlags, explanation.recommendedNextAction);
  const coachNote = buildCoachNote(history, explanation, nextActionPriority);

  return {
    nextAction: explanation.recommendedNextAction,
    nextActionType,
    nextActionPriority,
    nextActionReason: explanation.recommendedActionReason,
    blockingRisks: explanation.riskFlags.filter((flag) => flag !== "review_pressure"),
    coachNote,
  };
}

function buildSupportingEvidence(
  input: ConceptCaseHistoryInput,
  args: {
    firstDiagnosisAt?: string;
    latestDiagnosisAt?: string;
    latestIntervention?: MemoryInterventionHistoryEntry;
    improvedCount: number;
    failedCount: number;
    patternTypes: CoachingPatternType[];
  }
): ConceptCaseEvidenceItem[] {
  const evidence: ConceptCaseEvidenceItem[] = [];

  if (args.latestDiagnosisAt) {
    evidence.push({
      kind: "diagnosis",
      code: "diagnosis_count",
      detail: `${input.diagnosisHistory.length} persisted diagnosis ${input.diagnosisHistory.length === 1 ? "entry is" : "entries are"} attached to this concept.`,
    });
  }

  if (args.latestIntervention) {
    evidence.push({
      kind: "intervention",
      code: args.latestIntervention.status,
      detail: `Latest intervention status is ${args.latestIntervention.status.replace(/_/g, " ")}.`,
    });
  }

  if (args.improvedCount > 0 || args.failedCount > 0) {
    evidence.push({
      kind: "intervention",
      code: "outcome_history",
      detail: `${args.improvedCount} prior intervention ${args.improvedCount === 1 ? "result has" : "results have"} improved, while ${args.failedCount} ${args.failedCount === 1 ? "has" : "have"} failed or regressed.`,
    });
  }

  if (args.patternTypes.length > 0) {
    evidence.push({
      kind: "pattern",
      code: args.patternTypes[0],
      detail: `${args.patternTypes.length} cross-hand pattern${args.patternTypes.length === 1 ? " is" : "s are"} currently attached to the concept.`,
    });
  }

  if (input.retentionSummary.latestState) {
    evidence.push({
      kind: "retention",
      code: input.retentionSummary.latestState,
      detail: `Latest retention state is ${input.retentionSummary.latestState.replace(/_/g, " ")}.`,
    });
  }

  if (input.decisionSummary?.latestAction) {
    evidence.push({
      kind: "decision",
      code: input.decisionSummary.latestAction,
      detail: `Latest intervention decision is ${input.decisionSummary.latestAction.replace(/_/g, " ")}.`,
    });
  }

  if (input.recentAttempts.sampleSize > 0) {
    evidence.push({
      kind: "attempt",
      code: input.recentAttempts.trendDirection ?? "attempt_window",
      detail: input.recentAttempts.recentAverage !== undefined
        ? `${input.recentAttempts.sampleSize} recent concept-linked reps are averaging ${Math.round(input.recentAttempts.recentAverage * 100)}%.`
        : `${input.recentAttempts.sampleSize} recent concept-linked reps are stored for this concept.`,
    });
  }

  if (input.planningReasons.length > 0) {
    evidence.push({
      kind: "planning",
      code: input.planningReasons[0],
      detail: `Current planning context is led by ${input.planningReasons.join(", ").replace(/_/g, " ")}.`,
    });
  }

  return evidence;
}

function collectRiskFlags(history: ConceptCaseHistory): ConceptCaseRiskFlag[] {
  const flags = new Set<ConceptCaseRiskFlag>();
  if (history.recurringLeak) flags.add("recurring_leak");
  if (history.retentionSummary.latestState === "due") flags.add("retention_due");
  if (history.retentionSummary.latestState === "overdue") flags.add("retention_overdue");
  if (history.recoveryStage === "regressed" || history.patternSummary.types.includes("regression_after_recovery")) flags.add("regression_risk");
  if (history.decisionStabilitySummary && history.decisionStabilitySummary.stability !== "stable") flags.add("decision_instability");
  if (history.patternSummary.transferGap) flags.add("transfer_gap");
  if (history.patternSummary.interventionNotSticking) flags.add("intervention_not_sticking");
  if (history.recentAttemptSummary.failedCount >= 2 || history.reviewPressure > 0) flags.add("review_pressure");
  if (history.recoveryStage === "active_repair" || history.interventionLifecycleSummary.hasActiveIntervention) flags.add("active_repair");
  return [...flags];
}

function buildStatusLabel(history: ConceptCaseHistory): string {
  if (history.recoveryStage === "regressed") {
    return "Regressed";
  }
  if (history.retentionSummary.latestState === "overdue") {
    return "Recovered, Validation Overdue";
  }
  if (history.recoveryStage === "recovered" && history.retentionSummary.validationState === "validated") {
    return "Recovered and Validated";
  }
  if (history.recoveryStage === "recovered" && history.retentionSummary.validationState === "provisional") {
    return "Recovered, Pending Validation";
  }
  if (history.recoveryStage === "stabilizing") {
    return "Stabilizing";
  }
  if (history.recoveryStage === "active_repair") {
    return "Active Repair";
  }
  if (history.diagnosisCount > 0) {
    return "Diagnosed, Not Yet Repaired";
  }
  return "Light Signal";
}

function buildStatusReason(history: ConceptCaseHistory): string {
  if (history.recoveryStage === "regressed" && history.retentionSummary.lastResult === "fail") {
    return `${history.label} failed a retention check after earlier improvement, so the concept is treated as regressed rather than safely recovered.`;
  }
  if (history.recoveryStage === "regressed") {
    return `${history.label} previously improved, but the current combination of diagnoses, outcomes, or worsening trend says the gain has slipped.`;
  }
  if (history.recoveryStage === "stabilizing") {
    return `${history.label} improved enough to leave raw repair mode, but retention is still being verified before the concept is treated as done.`;
  }
  if (history.recoveryStage === "recovered" && history.retentionSummary.latestState === "overdue") {
    return `${history.label} looks recovered on intervention history, but the scheduled retention check is overdue, so recovery remains provisional.`;
  }
  if (history.recoveryStage === "recovered" && history.retentionSummary.validationState === "validated") {
    return `${history.label} has both recovery evidence and a passed retention check, so the gain is treated as validated rather than provisional.`;
  }
  if (history.recoveryStage === "recovered") {
    return `${history.label} currently looks recovered, but the system still tracks it through retention validation and recurrence risk.`;
  }
  if (history.recoveryStage === "active_repair") {
    return `${history.label} is still under active repair because the intervention loop is open and the concept has not stabilized yet.`;
  }
  if (history.diagnosisCount > 0) {
    return `${history.label} has persisted diagnosis history, but no stabilizing intervention loop has fully taken hold yet.`;
  }
  return `${history.label} does not yet have enough longitudinal coaching signal to support a stronger status.`;
}

function buildPriorityExplanation(history: ConceptCaseHistory, riskFlags: ConceptCaseRiskFlag[]): string {
  if (riskFlags.includes("retention_overdue")) {
    return `${history.label} is high priority because recovery is still unvalidated and the retention check is overdue.`;
  }
  if (riskFlags.includes("regression_risk")) {
    return `${history.label} is high priority because the concept has already slipped after prior recovery.`;
  }
  if (history.interventionLifecycleSummary.hasActiveIntervention) {
    return `${history.label} stays prioritized because there is still an active coaching loop attached to it.`;
  }
  if (riskFlags.includes("recurring_leak")) {
    return `${history.label} stays live because the leak is recurring across more than one stored diagnosis or attempt cluster.`;
  }
  if (history.retentionSummary.latestState === "due") {
    return `${history.label} moves up because a retention validation block is due now.`;
  }
  return `${history.label} is currently guided more by general weakness balancing than by acute repair or validation pressure.`;
}

function chooseRecommendedNextAction(history: ConceptCaseHistory): InterventionRecommendationAction | "run_retention_validation" {
  if (history.retentionSummary.latestState === "due" || history.retentionSummary.latestState === "overdue") {
    return "run_retention_validation";
  }
  if (history.prioritizationContext.currentRecommendationAction) {
    return history.prioritizationContext.currentRecommendationAction;
  }
  if (history.latestDecisionSummary?.latestAction) {
    return history.latestDecisionSummary.latestAction;
  }
  return history.recoveryStage === "recovered" ? "monitor_only" : "assign_intervention";
}

function buildRecommendedActionReason(
  history: ConceptCaseHistory,
  action: InterventionRecommendationAction | "run_retention_validation"
): string {
  if (action === "run_retention_validation") {
    return history.retentionSummary.latestState === "overdue"
      ? `${history.label} already has a retention check overdue, so validation now matters more than broadening training.`
      : `${history.label} is due for an explicit retention check to confirm the gain is still holding.`;
  }

  if (history.prioritizationContext.currentRecommendationAction === action && history.prioritizationContext.recommendationReasons.length > 0) {
    return `${history.label} is currently pointed toward ${action.replace(/_/g, " ")} because ${formatReasonCode(history.prioritizationContext.recommendationReasons[0])}.`;
  }

  if (action === "reopen_intervention") {
    return `${history.label} needs to reopen intervention work because the prior recovery is no longer holding cleanly.`;
  }

  if (action === "continue_intervention") {
    return `${history.label} should stay on the current intervention thread because the concept is still under active repair.`;
  }

  if (action === "assign_intervention") {
    return `${history.label} has enough stored diagnosis pressure to justify a structured intervention now.`;
  }

  return `${history.label} does not currently need a stronger coaching move than ${action.replace(/_/g, " ")}.`;
}

function buildStabilityAssessment(history: ConceptCaseHistory): string {
  const stability = history.decisionStabilitySummary?.stability;
  if (stability === "flipping") {
    return `Intervention decisions have been flipping for ${history.label}, which means the concept read is still unstable enough to merit caution.`;
  }
  if (stability === "shifting") {
    return `Intervention decisions have been shifting for ${history.label}, so the current plan should be treated as directionally useful but not fully settled.`;
  }
  if (history.retentionSummary.validationState === "validated") {
    return `${history.label} has a stable recent decision picture and validated recovery evidence.`;
  }
  return `Decision behavior is currently stable enough to keep the coaching thread coherent for ${history.label}.`;
}

function deriveRecoveryConfidence(history: ConceptCaseHistory): ConceptCaseRecoveryConfidence {
  if (history.recoveryStage === "recovered" && history.retentionSummary.validationState === "validated") {
    return "high";
  }
  if (history.recoveryStage === "stabilizing" || (history.recoveryStage === "recovered" && history.retentionSummary.validationState === "provisional")) {
    return "medium";
  }
  if (history.recoveryStage === "regressed" || history.patternSummary.interventionNotSticking) {
    return "low";
  }
  return history.diagnosisCount >= 2 || history.recentAttemptSummary.sampleSize >= 4 ? "medium" : "low";
}

function mapNextActionType(action: InterventionRecommendationAction | "run_retention_validation"): ConceptCaseNextActionType {
  if (action === "run_retention_check" || action === "run_retention_validation") return "retention";
  if (action === "add_transfer_block") return "transfer";
  if (action === "monitor_only") return "monitor";
  if (action === "close_intervention_loop") return "close_loop";
  return "repair";
}

function derivePriorityBucket(
  history: ConceptCaseHistory,
  riskFlags: ConceptCaseRiskFlag[],
  action: InterventionRecommendationAction | "run_retention_validation"
): ConceptCasePriorityBucket {
  if (riskFlags.includes("retention_overdue") || history.recoveryStage === "regressed" || action === "reopen_intervention") {
    return "urgent";
  }
  if (riskFlags.includes("retention_due") || history.interventionLifecycleSummary.hasActiveIntervention || history.recurringLeak) {
    return "high";
  }
  if (history.latestDecisionSummary?.latestPriority && history.latestDecisionSummary.latestPriority >= 55) {
    return "medium";
  }
  return "low";
}

function buildCoachNote(
  history: ConceptCaseHistory,
  explanation: ConceptCaseExplanation,
  priority: ConceptCasePriorityBucket
): string {
  if (explanation.recommendedNextAction === "run_retention_validation") {
    return `${history.label} is not asking for more broad repair right now. It needs a clean retention check so recovery can either be confirmed or honestly reopened.`;
  }
  if (explanation.recommendedNextAction === "reopen_intervention") {
    return `${history.label} improved once, then slipped. The right move is to reopen repair with more follow-through, not to assume the prior gain still counts.`;
  }
  if (explanation.recommendedNextAction === "change_intervention_strategy") {
    return `${history.label} is still a live coaching problem, but the current repair angle is not sticking well enough. The next move should change approach, not just repeat reps.`;
  }
  if (priority === "urgent") {
    return `${history.label} is carrying enough pressure that the next coaching move should happen before broader balancing or novelty work.`;
  }
  return `${history.label} now has enough stored history that the next coaching move can be explained from the evidence instead of guessed from a single session.`;
}

function formatReasonCode(reason: InterventionRecommendationReasonCode): string {
  return reason.replace(/_/g, " ");
}

function compareDescByCreatedAt(a: { createdAt: string }, b: { createdAt: string }): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function compareInterventionHistoryDesc(a: MemoryInterventionHistoryEntry, b: MemoryInterventionHistoryEntry): number {
  return new Date(b.outcomeCreatedAt ?? b.createdAt).getTime() - new Date(a.outcomeCreatedAt ?? a.createdAt).getTime();
}
