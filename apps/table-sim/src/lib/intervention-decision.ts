import {
  buildInterventionRecommendations,
  selectPatternsForConcept,
  type InterventionHistoryEntry,
  type InterventionRecommendation,
  type InterventionRecommendationInput,
  type PlayerDiagnosisHistoryEntry,
  type PlayerIntelligenceSnapshot,
  type RealPlayConceptSignal,
} from "@poker-coach/core/browser";
import type { RetentionScheduleRow } from "../../../../packages/db/src/repository";
import { buildConceptTransferEvaluationMap } from "./transfer-evaluation";

export interface PersistenceReadyInterventionAssignment {
  conceptKey: string;
  action: InterventionRecommendation["action"];
  recommendedStrategy: InterventionRecommendation["recommendedStrategy"];
  source: "command_center" | "session_review" | "weakness_explorer" | "real_hand";
  createdAt: string;
}

export function buildTableSimInterventionRecommendations(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  retentionSchedules?: RetentionScheduleRow[];
}): InterventionRecommendation[] {
  const diagnosisHistory = args.diagnosisHistory ?? [];
  const interventionHistory = args.interventionHistory ?? [];
  const realPlaySignalMap = new Map((args.realPlaySignals ?? []).map((signal) => [signal.conceptKey, signal]));
  const transferEvaluations = buildConceptTransferEvaluationMap({
    playerIntelligence: args.playerIntelligence,
    diagnosisHistory,
    interventionHistory,
    realPlaySignals: args.realPlaySignals,
    retentionSchedules: args.retentionSchedules,
  });

  const inputs: InterventionRecommendationInput[] = args.playerIntelligence.concepts.map((concept) => {
    const realPlaySignal = realPlaySignalMap.get(concept.conceptKey);
    return {
      conceptKey: concept.conceptKey,
      label: concept.label,
      diagnosisHistory: diagnosisHistory.filter((entry) => entry.conceptKey === concept.conceptKey),
      interventionHistory: interventionHistory.filter((entry) => entry.conceptKey === concept.conceptKey),
      recoveryStage: concept.recoveryStage,
      patterns: selectPatternsForConcept(args.playerIntelligence.patterns.patterns, concept.conceptKey),
      recurrenceCount: concept.recurrenceCount,
      reviewPressure: concept.reviewPressure,
      trainingUrgency: concept.trainingUrgency,
      trendDirection: concept.trend?.direction,
      recentAverage: concept.recentAverage,
      averageScore: concept.averageScore,
      realPlayReviewSpotCount: realPlaySignal?.reviewSpotCount,
      realPlayEvidence: realPlaySignal?.evidence,
      transferEvaluation: transferEvaluations.get(concept.conceptKey),
    };
  });

  return buildInterventionRecommendations(inputs);
}

export function buildPrimaryInterventionRecommendation(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  retentionSchedules?: RetentionScheduleRow[];
  conceptKey?: string;
}): InterventionRecommendation | undefined {
  const recommendations = buildTableSimInterventionRecommendations(args);
  if (args.conceptKey) {
    return recommendations.find((recommendation) => recommendation.conceptKey === args.conceptKey) ?? recommendations[0];
  }
  return recommendations[0];
}

export function shouldPersistInterventionRecommendation(recommendation: InterventionRecommendation | undefined): boolean {
  if (!recommendation) {
    return false;
  }

  return [
    "assign_intervention",
    "continue_intervention",
    "escalate_intervention",
    "change_intervention_strategy",
    "add_transfer_block",
    "reopen_intervention",
  ].includes(recommendation.action);
}

export function toPersistenceReadyInterventionAssignment(args: {
  recommendation: InterventionRecommendation;
  source: PersistenceReadyInterventionAssignment["source"];
  createdAt?: string;
}): PersistenceReadyInterventionAssignment {
  return {
    conceptKey: args.recommendation.conceptKey,
    action: args.recommendation.action,
    recommendedStrategy: args.recommendation.recommendedStrategy,
    source: args.source,
    createdAt: args.createdAt ?? new Date().toISOString(),
  };
}
