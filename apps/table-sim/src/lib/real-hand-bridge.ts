import {
  buildAttemptInsights,
  buildRealPlayConceptSignals,
  type CanonicalDrill,
  type ConceptTransferEvaluation,
  type ImportedHand,
  type InterventionHistoryEntry,
  type InterventionRecommendation,
  type PlayerIntelligenceSnapshot,
  type RealPlayConceptSignal,
  type WeaknessPool,
} from "@poker-coach/core/browser";
import type {
  AttemptRow,
  CoachingDiagnosisRow,
  CoachingInterventionWithOutcomeRow,
  RetentionScheduleRow,
  SrsRow,
} from "../../../../packages/db/src/repository";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "./coaching-memory";
import { buildTableSimInterventionRecommendations } from "./intervention-decision";
import { buildDiagnosticInsightsFromAttempts, buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "./intervention-support";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";
import { buildConceptTransferEvaluationMap } from "./transfer-evaluation";

export type RealHandBridgeState = "no_recent_evidence" | "weak_linkage" | "linked_candidates";
export type RealHandBridgeLinkageStrength = "weak" | "strong";
export type RealHandBridgeUrgency = "low" | "medium" | "high";
export type RealHandBridgeReviewTargetType = "hand_review" | "concept_review" | "intervention_review" | "transfer_review";
export type RealHandBridgeNextActionType =
  | "review_recent_hand"
  | "review_concept_detail"
  | "open_intervention_execution"
  | "schedule_transfer_review_block";

export interface RealHandBridgeBundle {
  generatedAt: string;
  state: RealHandBridgeState;
  summary: {
    headline: string;
    detail: string;
    candidateCount: number;
    linkedCandidateCount: number;
    weakCandidateCount: number;
  };
  candidates: RealHandBridgeCandidate[];
}

export interface RealHandBridgeCandidate {
  conceptKey: string | null;
  conceptLabel: string;
  linkageStrength: RealHandBridgeLinkageStrength;
  bridgeReason: string;
  urgency: RealHandBridgeUrgency;
  realPlaySummary: {
    occurrences: number;
    reviewSpotCount: number;
    latestHandAt?: string;
  };
  supportingHands: Array<{
    importedHandId: string;
    title: string;
    playedAt?: string;
    reviewSpotCount: number;
  }>;
  recommendedReviewTarget: {
    type: RealHandBridgeReviewTargetType;
    label: string;
    handId?: string;
    conceptKey?: string;
    interventionId?: string;
  };
  suggestedNextAction: {
    type: RealHandBridgeNextActionType;
    label: string;
    detail: string;
  };
  relatedIntervention?: {
    interventionId?: string | null;
    action?: InterventionRecommendation["action"];
    recommendedStrategy?: InterventionRecommendation["recommendedStrategy"];
    status?: InterventionHistoryEntry["status"];
    summary: string;
  };
  transferPressureSummary?: {
    status: ConceptTransferEvaluation["status"];
    pressure: ConceptTransferEvaluation["pressure"];
    confidence: ConceptTransferEvaluation["confidence"];
    evidenceSufficiency: ConceptTransferEvaluation["evidenceSufficiency"];
    summary: string;
    riskFlags: ConceptTransferEvaluation["riskFlags"];
    occurrences: number;
    reviewSpotCount: number;
    latestHandAt?: string;
  };
}

export function buildPersistedRealHandInterventionBridgeBundle(args: {
  drills: CanonicalDrill[];
  attempts: AttemptRow[];
  srs?: SrsRow[];
  importedHands: ImportedHand[];
  diagnoses?: CoachingDiagnosisRow[];
  interventions?: CoachingInterventionWithOutcomeRow[];
  retentionSchedules?: RetentionScheduleRow[];
  activePool: WeaknessPool;
  now?: Date;
  limit?: number;
}): RealHandBridgeBundle {
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
  const transferEvaluations = buildConceptTransferEvaluationMap({
    playerIntelligence,
    diagnosisHistory,
    interventionHistory,
    realPlaySignals,
    retentionSchedules: args.retentionSchedules,
    now,
  });

  return buildRealHandInterventionBridgeBundle({
    importedHands: args.importedHands,
    playerIntelligence,
    realPlaySignals,
    interventionHistory,
    recommendations,
    transferEvaluations,
    now,
    limit: args.limit,
  });
}

export function buildRealHandInterventionBridgeBundle(args: {
  importedHands: ImportedHand[];
  playerIntelligence: PlayerIntelligenceSnapshot;
  realPlaySignals?: RealPlayConceptSignal[];
  interventionHistory?: InterventionHistoryEntry[];
  recommendations?: InterventionRecommendation[];
  transferEvaluations?: Map<string, ConceptTransferEvaluation>;
  now?: Date;
  limit?: number;
}): RealHandBridgeBundle {
  const now = args.now ?? new Date();
  const realPlaySignals = args.realPlaySignals ?? buildRealPlayConceptSignals(args.importedHands);
  const recommendationsByConcept = new Map((args.recommendations ?? []).map((entry) => [entry.conceptKey, entry]));
  const conceptsByKey = new Map(args.playerIntelligence.concepts.map((concept) => [concept.conceptKey, concept]));
  const latestInterventions = buildLatestInterventionMap(args.interventionHistory ?? []);
  const candidates = realPlaySignals
    .slice()
    .sort(compareSignals)
    .slice(0, args.limit ?? 5)
    .map((signal) => buildCandidate({
      signal,
      concept: conceptsByKey.get(signal.conceptKey),
      recommendation: recommendationsByConcept.get(signal.conceptKey),
      intervention: latestInterventions.get(signal.conceptKey),
      transferEvaluation: args.transferEvaluations?.get(signal.conceptKey),
      supportingHands: collectSupportingHands(signal.conceptKey, args.importedHands),
    }));

  const linkedCandidateCount = candidates.filter((candidate) => candidate.linkageStrength === "strong").length;
  const weakCandidateCount = candidates.length - linkedCandidateCount;
  const state: RealHandBridgeState = candidates.length === 0
    ? "no_recent_evidence"
    : linkedCandidateCount === 0
      ? "weak_linkage"
      : "linked_candidates";

  return {
    generatedAt: now.toISOString(),
    state,
    summary: {
      headline: buildHeadline(state),
      detail: buildDetail(state, candidates.length, linkedCandidateCount, weakCandidateCount),
      candidateCount: candidates.length,
      linkedCandidateCount,
      weakCandidateCount,
    },
    candidates,
  };
}

function buildCandidate(args: {
  signal: RealPlayConceptSignal;
  concept?: PlayerIntelligenceSnapshot["concepts"][number];
  recommendation?: InterventionRecommendation;
  intervention?: InterventionHistoryEntry;
  transferEvaluation?: ConceptTransferEvaluation;
  supportingHands: RealHandBridgeCandidate["supportingHands"];
}): RealHandBridgeCandidate {
  const linkageStrength = deriveLinkageStrength(args);
  const recommendedReviewTarget = buildRecommendedReviewTarget(args, linkageStrength);
  const suggestedNextAction = buildSuggestedNextAction(args, linkageStrength);

  return {
    conceptKey: args.signal.conceptKey ?? null,
    conceptLabel: args.concept?.label ?? args.signal.label,
    linkageStrength,
    bridgeReason: buildBridgeReason(args, linkageStrength),
    urgency: deriveUrgency(args),
    realPlaySummary: {
      occurrences: args.signal.occurrences,
      reviewSpotCount: args.signal.reviewSpotCount,
      latestHandAt: args.signal.latestHandAt,
    },
    supportingHands: args.supportingHands,
    recommendedReviewTarget,
    suggestedNextAction,
    relatedIntervention: buildRelatedIntervention(args),
    transferPressureSummary: args.transferEvaluation
      ? {
          status: args.transferEvaluation.status,
          pressure: args.transferEvaluation.pressure,
          confidence: args.transferEvaluation.confidence,
          evidenceSufficiency: args.transferEvaluation.evidenceSufficiency,
          summary: args.transferEvaluation.summary,
          riskFlags: args.transferEvaluation.riskFlags,
          occurrences: args.transferEvaluation.realPlayEvidence.occurrences,
          reviewSpotCount: args.transferEvaluation.realPlayEvidence.reviewSpotCount,
          latestHandAt: args.transferEvaluation.realPlayEvidence.latestHandAt,
        }
      : undefined,
  };
}

function deriveLinkageStrength(args: {
  signal: RealPlayConceptSignal;
  concept?: PlayerIntelligenceSnapshot["concepts"][number];
  recommendation?: InterventionRecommendation;
  intervention?: InterventionHistoryEntry;
  transferEvaluation?: ConceptTransferEvaluation;
}): RealHandBridgeLinkageStrength {
  if (args.recommendation || args.intervention) {
    return "strong";
  }
  if (args.transferEvaluation && args.transferEvaluation.evidenceSufficiency !== "none") {
    return "strong";
  }
  if (args.concept && (args.signal.reviewSpotCount > 0 || args.concept.trainingUrgency >= 0.55 || args.concept.recurrenceCount > 0)) {
    return "strong";
  }
  return "weak";
}

function buildRecommendedReviewTarget(
  args: {
    signal: RealPlayConceptSignal;
    concept?: PlayerIntelligenceSnapshot["concepts"][number];
    recommendation?: InterventionRecommendation;
    intervention?: InterventionHistoryEntry;
    transferEvaluation?: ConceptTransferEvaluation;
    supportingHands: RealHandBridgeCandidate["supportingHands"];
  },
  linkageStrength: RealHandBridgeLinkageStrength
): RealHandBridgeCandidate["recommendedReviewTarget"] {
  const topHand = args.supportingHands[0];
  const interventionId = args.recommendation?.metadata.currentInterventionId ?? args.intervention?.id;
  const transferStatus = args.transferEvaluation?.status;

  if (transferStatus === "transfer_gap" || transferStatus === "transfer_regressed" || args.recommendation?.action === "add_transfer_block") {
    return {
      type: "transfer_review",
      label: `Transfer review for ${args.concept?.label ?? args.signal.label}`,
      conceptKey: args.signal.conceptKey,
      interventionId,
      handId: topHand?.importedHandId,
    };
  }
  if (interventionId || args.recommendation) {
    return {
      type: "intervention_review",
      label: `Intervention-linked review for ${args.concept?.label ?? args.signal.label}`,
      conceptKey: args.signal.conceptKey,
      interventionId,
      handId: topHand?.importedHandId,
    };
  }
  if (linkageStrength === "strong") {
    return {
      type: "concept_review",
      label: `Concept review for ${args.concept?.label ?? args.signal.label}`,
      conceptKey: args.signal.conceptKey,
      handId: topHand?.importedHandId,
    };
  }
  return {
    type: "hand_review",
    label: topHand ? `Recent hand review: ${topHand.title}` : `Recent hand review: ${args.signal.label}`,
    handId: topHand?.importedHandId,
    conceptKey: args.signal.conceptKey,
  };
}

function buildSuggestedNextAction(
  args: {
    signal: RealPlayConceptSignal;
    concept?: PlayerIntelligenceSnapshot["concepts"][number];
    recommendation?: InterventionRecommendation;
    intervention?: InterventionHistoryEntry;
    transferEvaluation?: ConceptTransferEvaluation;
    supportingHands: RealHandBridgeCandidate["supportingHands"];
  },
  linkageStrength: RealHandBridgeLinkageStrength
): RealHandBridgeCandidate["suggestedNextAction"] {
  const label = args.concept?.label ?? args.signal.label;
  const topHand = args.supportingHands[0];
  const transferStatus = args.transferEvaluation?.status;

  if (transferStatus === "transfer_gap" || transferStatus === "transfer_regressed" || args.transferEvaluation?.pressure === "high") {
    return {
      type: "schedule_transfer_review_block",
      label: `Add a transfer review block for ${label}`,
      detail: args.transferEvaluation?.coachExplanation ?? `${label} should be reviewed alongside real hands before the system treats it as transferred.`,
    };
  }
  if (args.recommendation || args.intervention) {
    return {
      type: "open_intervention_execution",
      label: `Open intervention execution for ${label}`,
      detail: args.recommendation?.summary ?? `${label} already has intervention context, so the real-hand review should reinforce that same thread.`,
    };
  }
  if (linkageStrength === "strong") {
    return {
      type: "review_concept_detail",
      label: `Review ${label} in concept detail`,
      detail: `${label} has enough real-play evidence to bridge hand review into a concept-facing study block.`,
    };
  }
  return {
    type: "review_recent_hand",
    label: topHand ? `Review ${topHand.title} before assigning study work` : `Review recent hand evidence for ${label}`,
    detail: `The current evidence is still light, so keep the next step anchored in the hand before prescribing intervention work.`,
  };
}

function buildBridgeReason(args: {
  signal: RealPlayConceptSignal;
  concept?: PlayerIntelligenceSnapshot["concepts"][number];
  recommendation?: InterventionRecommendation;
  intervention?: InterventionHistoryEntry;
  transferEvaluation?: ConceptTransferEvaluation;
}, linkageStrength: RealHandBridgeLinkageStrength): string {
  if (args.transferEvaluation?.status === "transfer_gap" || args.transferEvaluation?.status === "transfer_regressed") {
    return args.transferEvaluation.coachExplanation;
  }
  if (args.recommendation) {
    return args.recommendation.decisionReason;
  }
  if (args.intervention) {
    return `${args.concept?.label ?? args.signal.label} already has intervention history, so real-hand review should reinforce that same repair thread.`;
  }
  if (linkageStrength === "strong") {
    return `${args.signal.reviewSpotCount} real-play review spot${args.signal.reviewSpotCount === 1 ? "" : "s"} now point at ${args.concept?.label ?? args.signal.label}, so the hand evidence can feed concept review directly.`;
  }
  return `${args.signal.label} has recent hand evidence, but the linkage is still too light to confidently turn it into intervention work without reviewing the hand first.`;
}

function buildRelatedIntervention(args: {
  recommendation?: InterventionRecommendation;
  intervention?: InterventionHistoryEntry;
}): RealHandBridgeCandidate["relatedIntervention"] | undefined {
  if (!args.recommendation && !args.intervention) {
    return undefined;
  }

  return {
    interventionId: args.recommendation?.metadata.currentInterventionId ?? args.intervention?.id ?? null,
    action: args.recommendation?.action,
    recommendedStrategy: args.recommendation?.recommendedStrategy,
    status: args.intervention?.status ?? args.recommendation?.metadata.currentInterventionStatus ?? undefined,
    summary: args.recommendation?.summary
      ?? `The latest intervention thread is still ${formatStatus(args.intervention?.status)} for this concept.`,
  };
}

function deriveUrgency(args: {
  signal: RealPlayConceptSignal;
  recommendation?: InterventionRecommendation;
  intervention?: InterventionHistoryEntry;
  transferEvaluation?: ConceptTransferEvaluation;
}): RealHandBridgeUrgency {
  if (
    args.transferEvaluation?.pressure === "high"
    || args.transferEvaluation?.status === "transfer_regressed"
    || args.recommendation?.action === "escalate_intervention"
    || args.recommendation?.action === "reopen_intervention"
  ) {
    return "high";
  }
  if (
    args.transferEvaluation?.pressure === "medium"
    || args.transferEvaluation?.status === "transfer_gap"
    || args.recommendation
    || args.intervention
    || args.signal.reviewSpotCount > 0
  ) {
    return "medium";
  }
  return "low";
}

function collectSupportingHands(conceptKey: string, hands: ImportedHand[]): RealHandBridgeCandidate["supportingHands"] {
  return hands
    .filter((hand) => hand.conceptMatches.some((match) => match.conceptKey === conceptKey) || hand.reviewSpots.some((spot) => spot.concepts.includes(conceptKey)))
    .map((hand) => ({
      importedHandId: hand.importedHandId,
      title: hand.tableName ?? `Hand ${hand.sourceHandId}`,
      playedAt: hand.playedAt ?? undefined,
      reviewSpotCount: hand.reviewSpots.filter((spot) => spot.concepts.includes(conceptKey)).length,
    }))
    .sort((left, right) => compareIso(right.playedAt, left.playedAt) || right.reviewSpotCount - left.reviewSpotCount || left.title.localeCompare(right.title))
    .slice(0, 3);
}

function buildLatestInterventionMap(interventionHistory: InterventionHistoryEntry[]): Map<string, InterventionHistoryEntry> {
  const latestByConcept = new Map<string, InterventionHistoryEntry>();

  for (const entry of interventionHistory) {
    const current = latestByConcept.get(entry.conceptKey);
    if (!current || compareIso(entry.outcomeCreatedAt ?? entry.createdAt, current.outcomeCreatedAt ?? current.createdAt) > 0) {
      latestByConcept.set(entry.conceptKey, entry);
    }
  }

  return latestByConcept;
}

function buildHeadline(state: RealHandBridgeState): string {
  switch (state) {
    case "no_recent_evidence":
      return "No recent real-hand bridge candidates are available.";
    case "weak_linkage":
      return "Recent hands exist, but concept linkage is still weak.";
    case "linked_candidates":
      return "Recent real-hand evidence can now feed concept and intervention work.";
  }
}

function buildDetail(state: RealHandBridgeState, candidateCount: number, linkedCandidateCount: number, weakCandidateCount: number): string {
  switch (state) {
    case "no_recent_evidence":
      return "The adapter found no persisted real-play review evidence to bridge into today’s study loop.";
    case "weak_linkage":
      return `${candidateCount} recent hand signal${candidateCount === 1 ? " is" : "s are"} available, but all ${weakCandidateCount} still need hand-first review before stronger concept or intervention routing.`;
    case "linked_candidates":
      return `${linkedCandidateCount} linked bridge candidate${linkedCandidateCount === 1 ? "" : "s"} and ${weakCandidateCount} weaker signal${weakCandidateCount === 1 ? "" : "s"} are ready for Daily Study Plan reuse.`;
  }
}

function compareSignals(left: RealPlayConceptSignal, right: RealPlayConceptSignal): number {
  return compareIso(right.latestHandAt, left.latestHandAt)
    || right.reviewSpotCount - left.reviewSpotCount
    || right.occurrences - left.occurrences
    || right.weight - left.weight
    || left.label.localeCompare(right.label);
}

function compareIso(left?: string | null, right?: string | null): number {
  return toMillis(left) - toMillis(right);
}

function toMillis(value?: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function formatStatus(status?: string): string {
  return status ? status.replace(/_/g, " ") : "untracked";
}
