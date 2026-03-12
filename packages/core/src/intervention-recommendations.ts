import type { MemoryDiagnosisHistoryEntry, MemoryInterventionHistoryEntry, ConceptRecoveryStage, InterventionLifecycleStatus } from "./coaching-memory";
import type { CoachingPattern, CoachingPatternType } from "./patterns";
import type { ConceptTransferEvaluation } from "./transfer-evaluation";

export type InterventionRecommendationAction =
  | "assign_intervention"
  | "continue_intervention"
  | "escalate_intervention"
  | "change_intervention_strategy"
  | "add_transfer_block"
  | "run_retention_check"
  | "reopen_intervention"
  | "monitor_only"
  | "close_intervention_loop";

export type InterventionStrategyType =
  | "threshold_repair"
  | "blocker_recognition"
  | "street_transition_repair"
  | "transfer_training"
  | "stabilization_reinforcement"
  | "review_habit_repair"
  | "mixed_repair";

export type InterventionRecommendationReasonCode =
  | "new_diagnosis_without_intervention"
  | "active_intervention_improving"
  | "active_intervention_stalled"
  | "persistent_recurring_leak"
  | "regression_after_recovery"
  | "intervention_not_sticking"
  | "real_play_transfer_gap"
  | "recovered_with_recurrence_risk"
  | "recovered_and_stable"
  | "review_backlog_under_repair"
  | "limited_signal"
  | "worsening_recent_trend"
  | "improving_recent_trend"
  | "threshold_pattern"
  | "blocker_pattern"
  | "downstream_pattern";

export type InterventionRecommendationStrength = "low" | "medium" | "high";
export type InterventionIntensity = "light" | "moderate" | "high" | "intensive";

export interface InterventionSupportingSignal {
  kind: "pattern" | "diagnosis" | "intervention" | "recovery" | "trend" | "real_play";
  code: string;
  detail: string;
}

export interface InterventionRecommendationInput {
  conceptKey: string;
  label: string;
  diagnosisHistory: MemoryDiagnosisHistoryEntry[];
  interventionHistory: MemoryInterventionHistoryEntry[];
  recoveryStage: ConceptRecoveryStage;
  patterns: CoachingPattern[];
  recurrenceCount: number;
  reviewPressure: number;
  trainingUrgency: number;
  trendDirection?: "improving" | "worsening" | "stable";
  recentAverage?: number;
  averageScore?: number;
  realPlayReviewSpotCount?: number;
  realPlayEvidence?: string[];
  transferEvaluation?: ConceptTransferEvaluation;
}

export interface InterventionRecommendation {
  conceptKey: string;
  label: string;
  action: InterventionRecommendationAction;
  recommendedStrategy: InterventionStrategyType;
  reasonCodes: InterventionRecommendationReasonCode[];
  confidence: InterventionRecommendationStrength;
  priority: number;
  evidence: string[];
  summary: string;
  decisionReason: string;
  supportingSignals: InterventionSupportingSignal[];
  whyNotOtherActions: string[];
  suggestedIntensity: InterventionIntensity;
  metadata: {
    currentInterventionId?: string;
    currentInterventionStatus?: InterventionLifecycleStatus;
    patternTypes: CoachingPatternType[];
    requiresNewAssignment: boolean;
    requiresStrategyChange: boolean;
    transferFocus: boolean;
  };
}

export function buildInterventionRecommendations(inputs: InterventionRecommendationInput[]): InterventionRecommendation[] {
  return inputs
    .map((input) => recommendIntervention(input))
    .sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
}

export function recommendIntervention(input: InterventionRecommendationInput): InterventionRecommendation {
  const diagnosisCount = input.diagnosisHistory.length;
  const latestIntervention = [...input.interventionHistory].sort(compareInterventions)[0];
  const hasActiveIntervention = latestIntervention !== undefined && ["assigned", "in_progress", "stabilizing"].includes(latestIntervention.status);
  const hasCompletedImprovement = input.interventionHistory.some((entry) => entry.status === "completed" && entry.improved === true);
  const patternTypes = input.patterns.map((pattern) => pattern.type);
  const reasonCodes = new Set<InterventionRecommendationReasonCode>();
  const supportingSignals: InterventionSupportingSignal[] = [];

  const hasPattern = (pattern: CoachingPatternType) => patternTypes.includes(pattern);
  const recurringLeak = input.recurrenceCount >= 2 || diagnosisCount >= 2;
  const improving = input.trendDirection === "improving" || ((input.recentAverage ?? 0) - (input.averageScore ?? input.recentAverage ?? 0)) >= 0.05;
  const worsening = input.trendDirection === "worsening";
  const transferGap = input.transferEvaluation?.status === "transfer_gap"
    || input.transferEvaluation?.status === "transfer_regressed"
    || hasPattern("real_play_transfer_gap");
  const interventionNotSticking = hasPattern("intervention_not_sticking");
  const regressionAfterRecovery = hasPattern("regression_after_recovery")
    || input.transferEvaluation?.status === "transfer_regressed"
    || (input.recoveryStage === "regressed" && hasCompletedImprovement);
  const thresholdPattern = hasPattern("persistent_threshold_leak") || countDiagnoses(input.diagnosisHistory, "threshold_error") >= 2;
  const blockerPattern = hasPattern("persistent_blocker_blindness") || countDiagnoses(input.diagnosisHistory, "blocker_blindness") >= 2;
  const downstreamPattern = hasPattern("downstream_river_symptom");
  const reviewAvoidance = hasPattern("review_avoidance_pattern") || input.reviewPressure >= 3;

  if (thresholdPattern) reasonCodes.add("threshold_pattern");
  if (blockerPattern) reasonCodes.add("blocker_pattern");
  if (downstreamPattern) reasonCodes.add("downstream_pattern");
  if (recurringLeak) reasonCodes.add("persistent_recurring_leak");
  if (worsening) reasonCodes.add("worsening_recent_trend");
  if (improving) reasonCodes.add("improving_recent_trend");
  if (reviewAvoidance && (input.recoveryStage === "active_repair" || input.recoveryStage === "regressed")) {
    reasonCodes.add("review_backlog_under_repair");
  }

  addPatternSignals(input.patterns, supportingSignals);
  if (diagnosisCount > 0) {
    supportingSignals.push({
      kind: "diagnosis",
      code: "diagnosis_count",
      detail: `${diagnosisCount} stored diagnosis ${diagnosisCount === 1 ? "entry is" : "entries are"} attached to this concept.`,
    });
  }
  supportingSignals.push({
    kind: "recovery",
    code: input.recoveryStage,
    detail: `Recovery stage is ${input.recoveryStage.replace(/_/g, " ")}.`,
  });
  if (input.trendDirection) {
    supportingSignals.push({
      kind: "trend",
      code: input.trendDirection,
      detail: `Recent trend is ${input.trendDirection}.`,
    });
  }
  if (transferGap || (input.realPlayReviewSpotCount ?? 0) > 0) {
    supportingSignals.push({
      kind: "real_play",
      code: input.transferEvaluation?.status ?? "real_play_review_spots",
      detail: input.transferEvaluation
        ? input.transferEvaluation.summary
        : `${input.realPlayReviewSpotCount ?? 0} real-play review spot${(input.realPlayReviewSpotCount ?? 0) === 1 ? " still maps" : "s still map"} to this concept.`,
    });
  }
  if (latestIntervention) {
    supportingSignals.push({
      kind: "intervention",
      code: latestIntervention.status,
      detail: `Latest intervention status is ${latestIntervention.status.replace(/_/g, " ")}.`,
    });
  }

  let action: InterventionRecommendationAction;
  if (transferGap && (input.recoveryStage === "recovered" || input.recoveryStage === "stabilizing" || improving)) {
    action = "add_transfer_block";
    reasonCodes.add("real_play_transfer_gap");
  } else if (regressionAfterRecovery) {
    action = "reopen_intervention";
    reasonCodes.add("regression_after_recovery");
  } else if (hasActiveIntervention && interventionNotSticking && (thresholdPattern || blockerPattern || downstreamPattern || transferGap)) {
    action = "change_intervention_strategy";
    reasonCodes.add("intervention_not_sticking");
  } else if ((hasActiveIntervention && interventionNotSticking) || (recurringLeak && !improving && diagnosisCount >= 3)) {
    action = "escalate_intervention";
    if (hasActiveIntervention) reasonCodes.add("active_intervention_stalled");
    if (interventionNotSticking) reasonCodes.add("intervention_not_sticking");
  } else if (input.recoveryStage === "recovered" && (recurringLeak || input.reviewPressure > 0)) {
    action = "run_retention_check";
    reasonCodes.add("recovered_with_recurrence_risk");
  } else if (input.recoveryStage === "recovered") {
    action = latestIntervention ? "close_intervention_loop" : "monitor_only";
    reasonCodes.add("recovered_and_stable");
  } else if (hasActiveIntervention) {
    action = "continue_intervention";
    if (improving || input.recoveryStage === "stabilizing") {
      reasonCodes.add("active_intervention_improving");
    }
  } else if (diagnosisCount > 0 || recurringLeak || input.trainingUrgency >= 0.55) {
    action = "assign_intervention";
    reasonCodes.add("new_diagnosis_without_intervention");
  } else {
    action = "monitor_only";
    reasonCodes.add("limited_signal");
  }

  const recommendedStrategy = chooseStrategy({
    action,
    thresholdPattern,
    blockerPattern,
    downstreamPattern,
    transferGap,
    reviewAvoidance,
    recoveryStage: input.recoveryStage,
    diagnosisHistory: input.diagnosisHistory,
    patternCount: input.patterns.length,
  });
  const confidence = chooseConfidence({ reasonCodes: [...reasonCodes], patternCount: input.patterns.length, diagnosisCount, hasActiveIntervention });
  const suggestedIntensity = chooseIntensity(action, input.trainingUrgency, recurringLeak, transferGap, interventionNotSticking, reviewAvoidance);
  const priority = computePriority(action, input.trainingUrgency, confidence, input.patterns.length, diagnosisCount, transferGap, regressionAfterRecovery);
  const evidence = buildEvidence(input, action, recommendedStrategy);

  return {
    conceptKey: input.conceptKey,
    label: input.label,
    action,
    recommendedStrategy,
    reasonCodes: [...reasonCodes],
    confidence,
    priority,
    evidence,
    summary: buildSummary(input.label, action, recommendedStrategy),
    decisionReason: buildDecisionReason(input.label, action, recommendedStrategy, [...reasonCodes]),
    supportingSignals,
    whyNotOtherActions: buildWhyNotOtherActions(action, input, hasActiveIntervention, transferGap, regressionAfterRecovery),
    suggestedIntensity,
    metadata: {
      currentInterventionId: latestIntervention?.id,
      currentInterventionStatus: latestIntervention?.status,
      patternTypes,
      requiresNewAssignment: ["assign_intervention", "reopen_intervention", "escalate_intervention", "change_intervention_strategy", "add_transfer_block"].includes(action),
      requiresStrategyChange: action === "change_intervention_strategy",
      transferFocus: transferGap || recommendedStrategy === "transfer_training",
    },
  };
}

function chooseStrategy(args: {
  action: InterventionRecommendationAction;
  thresholdPattern: boolean;
  blockerPattern: boolean;
  downstreamPattern: boolean;
  transferGap: boolean;
  reviewAvoidance: boolean;
  recoveryStage: ConceptRecoveryStage;
  diagnosisHistory: MemoryDiagnosisHistoryEntry[];
  patternCount: number;
}): InterventionStrategyType {
  if (args.action === "run_retention_check" || args.action === "close_intervention_loop" || args.recoveryStage === "stabilizing") {
    return "stabilization_reinforcement";
  }
  if (args.transferGap) {
    return "transfer_training";
  }
  if (args.downstreamPattern) {
    return "street_transition_repair";
  }
  if (args.thresholdPattern) {
    return "threshold_repair";
  }
  if (args.blockerPattern) {
    return "blocker_recognition";
  }
  if (args.reviewAvoidance) {
    return "review_habit_repair";
  }

  const diagnosisTypes = new Set(args.diagnosisHistory.map((entry) => entry.diagnosticType));
  if (diagnosisTypes.size > 1 || args.patternCount > 1) {
    return "mixed_repair";
  }

  return "mixed_repair";
}

function chooseConfidence(args: {
  reasonCodes: InterventionRecommendationReasonCode[];
  patternCount: number;
  diagnosisCount: number;
  hasActiveIntervention: boolean;
}): InterventionRecommendationStrength {
  const score = args.reasonCodes.length + Math.min(args.patternCount, 2) + Math.min(args.diagnosisCount, 2) + (args.hasActiveIntervention ? 1 : 0);
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function chooseIntensity(
  action: InterventionRecommendationAction,
  trainingUrgency: number,
  recurringLeak: boolean,
  transferGap: boolean,
  interventionNotSticking: boolean,
  reviewAvoidance: boolean
): InterventionIntensity {
  if (action === "escalate_intervention" || action === "reopen_intervention") {
    return trainingUrgency >= 0.75 || interventionNotSticking ? "intensive" : "high";
  }
  if (action === "change_intervention_strategy" || action === "add_transfer_block") {
    return "high";
  }
  if (action === "continue_intervention" || action === "assign_intervention") {
    return recurringLeak || transferGap || reviewAvoidance ? "high" : trainingUrgency >= 0.5 ? "moderate" : "light";
  }
  if (action === "run_retention_check") {
    return "light";
  }
  return trainingUrgency >= 0.5 ? "moderate" : "light";
}

function computePriority(
  action: InterventionRecommendationAction,
  trainingUrgency: number,
  confidence: InterventionRecommendationStrength,
  patternCount: number,
  diagnosisCount: number,
  transferGap: boolean,
  regressionAfterRecovery: boolean
): number {
  const actionBase: Record<InterventionRecommendationAction, number> = {
    assign_intervention: 68,
    continue_intervention: 62,
    escalate_intervention: 90,
    change_intervention_strategy: 86,
    add_transfer_block: 82,
    run_retention_check: 44,
    reopen_intervention: 88,
    monitor_only: 18,
    close_intervention_loop: 26,
  };
  const confidenceBonus = confidence === "high" ? 10 : confidence === "medium" ? 5 : 0;
  const transferBonus = transferGap ? 6 : 0;
  const regressionBonus = regressionAfterRecovery ? 8 : 0;
  return Math.round(
    actionBase[action]
      + trainingUrgency * 20
      + confidenceBonus
      + Math.min(patternCount, 3) * 3
      + Math.min(diagnosisCount, 3) * 2
      + transferBonus
      + regressionBonus
  );
}

function buildEvidence(
  input: InterventionRecommendationInput,
  action: InterventionRecommendationAction,
  strategy: InterventionStrategyType
): string[] {
  const evidence: string[] = [
    `${input.label} is in ${input.recoveryStage.replace(/_/g, " ")} recovery state.`,
    `${input.recurrenceCount} recurring signal${input.recurrenceCount === 1 ? " is" : "s are"} currently attached to the concept.`,
    `${input.patterns.length} cross-hand pattern${input.patterns.length === 1 ? " is" : "s are"} influencing the intervention decision.`,
  ];
  if (input.transferEvaluation) {
    evidence.push(input.transferEvaluation.summary);
  }
  if ((input.realPlayReviewSpotCount ?? 0) > 0) {
    evidence.push(`${input.realPlayReviewSpotCount} real-play review spot${input.realPlayReviewSpotCount === 1 ? " still maps" : "s still map"} here.`);
  }
  evidence.push(`Recommended action is ${action.replace(/_/g, " ")} with ${strategy.replace(/_/g, " ")}.`);
  return evidence;
}

function buildSummary(label: string, action: InterventionRecommendationAction, strategy: InterventionStrategyType): string {
  return `${formatAction(action)} ${label} with ${formatStrategy(strategy)}.`;
}

function buildDecisionReason(
  label: string,
  action: InterventionRecommendationAction,
  strategy: InterventionStrategyType,
  reasonCodes: InterventionRecommendationReasonCode[]
): string {
  const leadReason = reasonCodes[0] ? formatReasonCode(reasonCodes[0]) : "the current coaching evidence";
  return `${label} should ${action.replace(/_/g, " ")} because ${leadReason}, and the cleanest strategy is ${formatStrategy(strategy).toLowerCase()}.`;
}

function buildWhyNotOtherActions(
  action: InterventionRecommendationAction,
  input: InterventionRecommendationInput,
  hasActiveIntervention: boolean,
  transferGap: boolean,
  regressionAfterRecovery: boolean
): string[] {
  if (action === "monitor_only") {
    return ["Signal is still too light to justify opening or changing an intervention."];
  }
  if (action === "close_intervention_loop") {
    return ["Recovery currently looks stable enough that more repair would likely overtrain the concept."];
  }
  if (action === "run_retention_check") {
    return ["The concept is not weak enough for full repair, but it is not clean enough to leave untested."];
  }
  if (action === "add_transfer_block") {
    return ["The lab-side gain is real, but the failure mode is transfer, not core concept ignorance."];
  }
  if (action === "reopen_intervention") {
    return [regressionAfterRecovery ? "The concept already improved once and then slipped, so monitoring would be too passive." : "Recovery has slipped enough that a closed loop would be premature."];
  }
  if (action === "change_intervention_strategy") {
    return ["The current intervention is still active, but the evidence says the existing repair angle is not sticking cleanly."];
  }
  if (action === "escalate_intervention") {
    return [hasActiveIntervention ? "Staying at the same repair intensity would underreact to the recurring evidence." : "The signal is strong enough that a light-touch assignment would undershoot the leak." ];
  }
  if (action === "continue_intervention") {
    return [transferGap ? "Transfer support may still be needed later, but the active intervention has not earned a full strategy switch yet." : "The current repair thread still has enough live evidence to continue before escalating or closing."];
  }
  return ["A fresh intervention is warranted because stored diagnoses and recurring evidence are already clear enough."];
}

function addPatternSignals(patterns: CoachingPattern[], signals: InterventionSupportingSignal[]): void {
  for (const pattern of patterns.slice(0, 3)) {
    signals.push({
      kind: "pattern",
      code: pattern.type,
      detail: pattern.evidence[0] ?? pattern.coachingImplication,
    });
  }
}

function countDiagnoses(history: MemoryDiagnosisHistoryEntry[], diagnosticType: string): number {
  return history.filter((entry) => entry.diagnosticType === diagnosticType).length;
}

function compareInterventions(a: MemoryInterventionHistoryEntry, b: MemoryInterventionHistoryEntry): number {
  return new Date(b.outcomeCreatedAt ?? b.createdAt).getTime() - new Date(a.outcomeCreatedAt ?? a.createdAt).getTime();
}

function formatAction(action: InterventionRecommendationAction): string {
  switch (action) {
    case "assign_intervention":
      return "Assign an intervention for";
    case "continue_intervention":
      return "Continue the intervention on";
    case "escalate_intervention":
      return "Escalate the intervention for";
    case "change_intervention_strategy":
      return "Change the intervention strategy for";
    case "add_transfer_block":
      return "Add a transfer block for";
    case "run_retention_check":
      return "Run a retention check on";
    case "reopen_intervention":
      return "Reopen intervention work on";
    case "monitor_only":
      return "Monitor";
    case "close_intervention_loop":
      return "Close the intervention loop for";
  }
}

function formatStrategy(strategy: InterventionStrategyType): string {
  return strategy.replace(/_/g, " ");
}

function formatReasonCode(reason: InterventionRecommendationReasonCode): string {
  switch (reason) {
    case "new_diagnosis_without_intervention":
      return "the concept is diagnosed but not yet under a structured intervention";
    case "active_intervention_improving":
      return "the current intervention is still moving in the right direction";
    case "active_intervention_stalled":
      return "the active intervention is no longer improving fast enough";
    case "persistent_recurring_leak":
      return "the leak keeps recurring across stored evidence";
    case "regression_after_recovery":
      return "the concept recovered once and then regressed";
    case "intervention_not_sticking":
      return "previous intervention effects have not held cleanly";
    case "real_play_transfer_gap":
      return "drill improvement is not transferring into real play";
    case "recovered_with_recurrence_risk":
      return "the concept looks recovered but still carries recurrence risk";
    case "recovered_and_stable":
      return "the concept currently looks recovered and stable";
    case "review_backlog_under_repair":
      return "review follow-through is lagging while the concept is still under repair";
    case "limited_signal":
      return "there is not enough hard evidence yet to justify a stronger intervention move";
    case "worsening_recent_trend":
      return "recent trend is worsening";
    case "improving_recent_trend":
      return "recent trend is improving";
    case "threshold_pattern":
      return "threshold errors are the clearest recurring pattern";
    case "blocker_pattern":
      return "blocker blindness is the clearest recurring pattern";
    case "downstream_pattern":
      return "the visible leak looks downstream of an earlier street problem";
  }
}
