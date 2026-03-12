import type { ConceptRecoveryStage, InterventionLifecycleStatus } from "./coaching-memory";
import type { CoachingPatternType } from "./patterns";
import type { RetentionScheduleState } from "./retention-scheduler";

export type ConceptTransferStatus =
  | "no_real_play_evidence"
  | "transfer_uncertain"
  | "transfer_progressing"
  | "transfer_validated"
  | "transfer_gap"
  | "transfer_regressed";

export type ConceptTransferConfidence = "low" | "medium" | "high";
export type TransferEvidenceSufficiency = "none" | "sparse" | "moderate" | "strong";
export type TransferPressure = "low" | "medium" | "high";
export type TransferRiskFlag =
  | "sparse_real_play_evidence"
  | "study_ahead_of_real_play"
  | "real_play_review_pressure"
  | "validated_transfer_slipping"
  | "recovery_contradicted_by_real_play";

export interface ConceptTransferEvaluationInput {
  conceptKey: string;
  label: string;
  recoveryStage: ConceptRecoveryStage;
  studySampleSize: number;
  recentStudyAverage?: number;
  studyAverage?: number;
  studyTrendDirection?: "improving" | "worsening" | "stable";
  studyFailedCount: number;
  diagnosisCount: number;
  interventionCount: number;
  interventionImprovedCount: number;
  interventionFailedCount: number;
  latestInterventionStatus?: InterventionLifecycleStatus;
  patternTypes: CoachingPatternType[];
  retentionValidationState?: "none" | "provisional" | "validated" | "failed";
  retentionLatestState?: RetentionScheduleState;
  retentionLastResult?: "pass" | "fail" | null;
  realPlay?: {
    occurrences: number;
    reviewSpotCount: number;
    weight: number;
    latestHandAt?: string;
    evidence: string[];
  };
}

export interface ConceptTransferEvaluation {
  conceptKey: string;
  label: string;
  status: ConceptTransferStatus;
  confidence: ConceptTransferConfidence;
  evidenceSufficiency: TransferEvidenceSufficiency;
  pressure: TransferPressure;
  studyPerformance?: number;
  realPlayPerformance?: number;
  studyVsRealPlayDelta?: number;
  supportingEvidence: string[];
  riskFlags: TransferRiskFlag[];
  summary: string;
  coachExplanation: string;
  realPlayEvidence: {
    occurrences: number;
    reviewSpotCount: number;
    latestHandAt?: string;
  };
}

export function evaluateConceptTransfer(input: ConceptTransferEvaluationInput): ConceptTransferEvaluation {
  const occurrences = input.realPlay?.occurrences ?? 0;
  const reviewSpotCount = input.realPlay?.reviewSpotCount ?? 0;
  const evidenceSufficiency = deriveEvidenceSufficiency(occurrences, reviewSpotCount);
  const studyPerformance = normalizeStudyPerformance(input);
  const realPlayLeakPressure = input.realPlay ? deriveRealPlayLeakPressure(input.realPlay.occurrences, input.realPlay.reviewSpotCount, input.realPlay.weight) : undefined;
  const realPlayPerformance = realPlayLeakPressure === undefined ? undefined : round(1 - realPlayLeakPressure);
  const studyVsRealPlayDelta =
    studyPerformance !== undefined && realPlayPerformance !== undefined
      ? round(studyPerformance - realPlayPerformance)
      : undefined;
  const priorValidatedTransfer = input.retentionValidationState === "validated" || input.retentionLastResult === "pass";
  const recoveryContradicted =
    (input.recoveryStage === "recovered" || input.recoveryStage === "stabilizing")
    && realPlayLeakPressure !== undefined
    && realPlayLeakPressure >= 0.56;
  const transferPattern = input.patternTypes.includes("real_play_transfer_gap");

  let status: ConceptTransferStatus;
  if (!input.realPlay || occurrences === 0) {
    status = "no_real_play_evidence";
  } else if (evidenceSufficiency === "sparse") {
    status = "transfer_uncertain";
  } else if ((priorValidatedTransfer || input.patternTypes.includes("regression_after_recovery")) && (realPlayLeakPressure ?? 0) >= 0.68) {
    status = "transfer_regressed";
  } else if ((studyPerformance ?? 0) >= 0.68 && (realPlayLeakPressure ?? 1) <= 0.22) {
    status = "transfer_validated";
  } else if ((studyPerformance ?? 0) >= 0.6 && (realPlayLeakPressure ?? 1) <= 0.4) {
    status = "transfer_progressing";
  } else if (((studyPerformance ?? 0) >= 0.66 && (realPlayLeakPressure ?? 0) >= 0.5) || transferPattern) {
    status = priorValidatedTransfer && (realPlayLeakPressure ?? 0) >= 0.58 ? "transfer_regressed" : "transfer_gap";
  } else {
    status = "transfer_uncertain";
  }

  const riskFlags = collectRiskFlags({
    status,
    evidenceSufficiency,
    studyVsRealPlayDelta,
    realPlayLeakPressure,
    recoveryContradicted,
    priorValidatedTransfer,
  });
  const confidence = deriveConfidence(status, evidenceSufficiency, input.studySampleSize, occurrences, reviewSpotCount);
  const pressure = derivePressure(status, evidenceSufficiency, realPlayLeakPressure, input.retentionLatestState);

  return {
    conceptKey: input.conceptKey,
    label: input.label,
    status,
    confidence,
    evidenceSufficiency,
    pressure,
    studyPerformance,
    realPlayPerformance,
    studyVsRealPlayDelta,
    supportingEvidence: buildSupportingEvidence(input, {
      studyPerformance,
      realPlayLeakPressure,
      evidenceSufficiency,
      status,
    }),
    riskFlags,
    summary: buildSummary(input.label, status),
    coachExplanation: buildCoachExplanation(input.label, status, evidenceSufficiency, input),
    realPlayEvidence: {
      occurrences,
      reviewSpotCount,
      latestHandAt: input.realPlay?.latestHandAt,
    },
  };
}

function normalizeStudyPerformance(input: ConceptTransferEvaluationInput): number | undefined {
  const candidates = [input.recentStudyAverage, input.studyAverage].filter((value): value is number => value !== undefined);
  if (candidates.length === 0) {
    return undefined;
  }
  const best = candidates[0] ?? candidates[1];
  return round(best);
}

function deriveEvidenceSufficiency(occurrences: number, reviewSpotCount: number): TransferEvidenceSufficiency {
  if (occurrences <= 0) return "none";
  if (occurrences >= 4 || reviewSpotCount >= 3) return "strong";
  if (occurrences >= 2 || reviewSpotCount >= 2) return "moderate";
  return "sparse";
}

function deriveRealPlayLeakPressure(occurrences: number, reviewSpotCount: number, weight: number): number {
  const issueRate = reviewSpotCount / Math.max(occurrences, 1);
  return round(Math.min(1, (issueRate * 0.72) + (Math.min(reviewSpotCount, 4) * 0.08) + (weight * 0.15)));
}

function collectRiskFlags(args: {
  status: ConceptTransferStatus;
  evidenceSufficiency: TransferEvidenceSufficiency;
  studyVsRealPlayDelta?: number;
  realPlayLeakPressure?: number;
  recoveryContradicted: boolean;
  priorValidatedTransfer: boolean;
}): TransferRiskFlag[] {
  const flags = new Set<TransferRiskFlag>();
  if (args.evidenceSufficiency === "sparse" || args.evidenceSufficiency === "none") {
    flags.add("sparse_real_play_evidence");
  }
  if ((args.studyVsRealPlayDelta ?? 0) >= 0.18) {
    flags.add("study_ahead_of_real_play");
  }
  if ((args.realPlayLeakPressure ?? 0) >= 0.5) {
    flags.add("real_play_review_pressure");
  }
  if (args.priorValidatedTransfer && args.status === "transfer_regressed") {
    flags.add("validated_transfer_slipping");
  }
  if (args.recoveryContradicted || args.status === "transfer_gap" || args.status === "transfer_regressed") {
    flags.add("recovery_contradicted_by_real_play");
  }
  return [...flags];
}

function deriveConfidence(
  status: ConceptTransferStatus,
  evidenceSufficiency: TransferEvidenceSufficiency,
  studySampleSize: number,
  occurrences: number,
  reviewSpotCount: number
): ConceptTransferConfidence {
  if (status === "no_real_play_evidence") return "low";
  const score = (evidenceSufficiency === "strong" ? 2 : evidenceSufficiency === "moderate" ? 1 : 0)
    + (studySampleSize >= 4 ? 1 : 0)
    + (occurrences >= 3 ? 1 : 0)
    + (reviewSpotCount >= 2 ? 1 : 0);
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function derivePressure(
  status: ConceptTransferStatus,
  evidenceSufficiency: TransferEvidenceSufficiency,
  realPlayLeakPressure: number | undefined,
  retentionLatestState?: RetentionScheduleState
): TransferPressure {
  if (status === "transfer_regressed" || retentionLatestState === "overdue") {
    return "high";
  }
  if (status === "transfer_gap" || (realPlayLeakPressure ?? 0) >= 0.5 || evidenceSufficiency === "strong") {
    return "medium";
  }
  return "low";
}

function buildSupportingEvidence(
  input: ConceptTransferEvaluationInput,
  args: {
    studyPerformance?: number;
    realPlayLeakPressure?: number;
    evidenceSufficiency: TransferEvidenceSufficiency;
    status: ConceptTransferStatus;
  }
): string[] {
  const evidence: string[] = [];
  if (args.studyPerformance !== undefined) {
    evidence.push(`Recent study performance is ${Math.round(args.studyPerformance * 100)}% across ${input.studySampleSize} concept-linked rep${input.studySampleSize === 1 ? "" : "s"}.`);
  } else {
    evidence.push("Recent study performance is still too sparse to compare cleanly against real-play evidence.");
  }
  if (input.realPlay) {
    evidence.push(`${input.realPlay.occurrences} imported hand${input.realPlay.occurrences === 1 ? "" : "s"} and ${input.realPlay.reviewSpotCount} real-play review spot${input.realPlay.reviewSpotCount === 1 ? "" : "s"} currently map to this concept.`);
    evidence.push(`Real-play evidence is ${args.evidenceSufficiency}.`);
    if (args.realPlayLeakPressure !== undefined) {
      evidence.push(`Derived real-play leak pressure is ${Math.round(args.realPlayLeakPressure * 100)}%.`);
    }
    evidence.push(...input.realPlay.evidence.slice(0, 2));
  } else {
    evidence.push("No imported real-play evidence is attached to this concept yet.");
  }
  if (args.status === "transfer_regressed" && input.retentionValidationState === "validated") {
    evidence.push("Prior recovery validation exists, but current real-play evidence is now contradicting that confidence.");
  }
  return evidence;
}

function buildSummary(label: string, status: ConceptTransferStatus): string {
  switch (status) {
    case "no_real_play_evidence":
      return `${label} has no real-play transfer evidence yet.`;
    case "transfer_uncertain":
      return `${label} has some transfer evidence, but it is still too thin or mixed to judge confidently.`;
    case "transfer_progressing":
      return `${label} is starting to transfer into real play, but the signal is not yet strong enough to call fully validated.`;
    case "transfer_validated":
      return `${label} is holding up in real play strongly enough to treat transfer as validated.`;
    case "transfer_gap":
      return `${label} is improving in study faster than it is holding up in real play.`;
    case "transfer_regressed":
      return `${label} had stronger transfer confidence before, but current real-play evidence says it has slipped.`;
  }
}

function buildCoachExplanation(
  label: string,
  status: ConceptTransferStatus,
  evidenceSufficiency: TransferEvidenceSufficiency,
  input: ConceptTransferEvaluationInput
): string {
  switch (status) {
    case "no_real_play_evidence":
      return `${label} can look cleaner in drills, but there are no imported hands yet to confirm whether that gain is transferring.`;
    case "transfer_uncertain":
      return evidenceSufficiency === "sparse"
        ? `${label} has only light imported-hand evidence so far, so the system should stay honest and treat transfer as uncertain.`
        : `${label} has mixed study and real-play evidence, so transfer should stay under watch rather than be overclaimed.`;
    case "transfer_progressing":
      return `${label} is beginning to look better outside authored reps, but the real-play signal is not yet strong enough to close the transfer question.`;
    case "transfer_validated":
      return `${label} is no longer just improving in study. The imported-hand evidence is clean enough to treat transfer as genuinely showing up in play.`;
    case "transfer_gap":
      return `${label} is improving in study, but imported hands are still producing enough review pressure that the next block should bias toward transfer work.`;
    case "transfer_regressed":
      return `${label} previously had stronger recovery confidence, but current imported-hand evidence now argues for reopen or transfer repair pressure.`;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
