import {
  evaluateConceptTransfer,
  selectPatternsForConcept,
  type CoachingPatternType,
  type ConceptTransferEvaluation,
  type InterventionHistoryEntry,
  type PlayerDiagnosisHistoryEntry,
  type PlayerIntelligenceSnapshot,
  type RealPlayConceptSignal,
} from "@poker-coach/core/browser";
import type { RetentionScheduleRow } from "../../../../packages/db/src/repository";
import { buildConceptRetentionSummary } from "./retention-scheduling";

export function buildConceptTransferEvaluationMap(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  retentionSchedules?: RetentionScheduleRow[];
  now?: Date;
}): Map<string, ConceptTransferEvaluation> {
  const diagnosisHistory = args.diagnosisHistory ?? [];
  const interventionHistory = args.interventionHistory ?? [];
  const realPlayByConcept = new Map((args.realPlaySignals ?? []).map((signal) => [signal.conceptKey, signal]));
  const evaluations = new Map<string, ConceptTransferEvaluation>();

  for (const concept of args.playerIntelligence.concepts) {
    const conceptInterventions = interventionHistory.filter((entry) => entry.conceptKey === concept.conceptKey);
    const retention = buildConceptRetentionSummary(concept.conceptKey, args.retentionSchedules ?? [], args.now);
    evaluations.set(concept.conceptKey, evaluateConceptTransfer({
      conceptKey: concept.conceptKey,
      label: concept.label,
      recoveryStage: concept.recoveryStage,
      studySampleSize: concept.sampleSize,
      recentStudyAverage: concept.recentAverage,
      studyAverage: concept.averageScore,
      studyTrendDirection: concept.trend?.direction,
      studyFailedCount: concept.failedCount,
      diagnosisCount: diagnosisHistory.filter((entry) => entry.conceptKey === concept.conceptKey).length,
      interventionCount: conceptInterventions.length,
      interventionImprovedCount: conceptInterventions.filter((entry) => entry.improved === true).length,
      interventionFailedCount: conceptInterventions.filter((entry) => entry.improved === false || entry.status === "regressed").length,
      latestInterventionStatus: [...conceptInterventions].sort(compareInterventions)[0]?.status,
      patternTypes: selectPatternsForConcept(args.playerIntelligence.patterns.patterns, concept.conceptKey).map((pattern) => pattern.type as CoachingPatternType),
      retentionValidationState: retention.validationState,
      retentionLatestState: retention.latestSchedule?.state,
      retentionLastResult: retention.lastResult,
      realPlay: mapRealPlaySignal(realPlayByConcept.get(concept.conceptKey)),
    }));
  }

  return evaluations;
}

function mapRealPlaySignal(signal: RealPlayConceptSignal | undefined) {
  if (!signal) {
    return undefined;
  }

  return {
    occurrences: signal.occurrences,
    reviewSpotCount: signal.reviewSpotCount,
    weight: signal.weight,
    latestHandAt: signal.latestHandAt,
    evidence: signal.evidence,
  };
}

function compareInterventions(a: InterventionHistoryEntry, b: InterventionHistoryEntry): number {
  return new Date(b.outcomeCreatedAt ?? b.createdAt).getTime() - new Date(a.outcomeCreatedAt ?? a.createdAt).getTime();
}
