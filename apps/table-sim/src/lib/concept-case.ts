import {
  buildConceptCaseHistory,
  deriveConceptCoachingExplanation,
  deriveConceptNextStep,
  type ConceptTransferEvaluation,
  type InterventionStrategyBlueprint,
  selectPatternsForConcept,
  type ConceptCaseExplanation,
  type ConceptCaseHistory,
  type ConceptCaseNextStep,
  type InterventionHistoryEntry,
  type InterventionRecommendation,
  type PlayerDiagnosisHistoryEntry,
  type PlayerIntelligenceSnapshot,
  type RealPlayConceptSignal,
} from "@poker-coach/core/browser";
import type { InterventionDecisionSnapshotRow, RetentionScheduleRow } from "../../../../packages/db/src/repository";
import { buildConceptDecisionAuditSummary, type InterventionDecisionAuditSummary } from "./intervention-decision-audit";
import { buildInterventionStrategyBlueprint } from "./intervention-strategy";
import { buildConceptRetentionSummary, type RetentionSummary } from "./retention-scheduling";
import { buildConceptTransferAuditSummary, type TransferAuditSummary } from "./transfer-audit";
import { buildConceptTransferEvaluationMap } from "./transfer-evaluation";

export interface ConceptCaseBundle {
  history: ConceptCaseHistory;
  explanation: ConceptCaseExplanation;
  nextStep: ConceptCaseNextStep;
  decisionAudit?: InterventionDecisionAuditSummary;
  retention: RetentionSummary;
  transferEvaluation: ConceptTransferEvaluation;
  transferAudit?: TransferAuditSummary;
  recommendation?: InterventionRecommendation;
  strategyBlueprint?: InterventionStrategyBlueprint;
}

export interface ConceptCaseResponse {
  conceptKey: string;
  history: ConceptCaseHistory;
  explanation: ConceptCaseExplanation;
  nextStep: ConceptCaseNextStep;
  decisionAudit?: InterventionDecisionAuditSummary;
  retention: RetentionSummary;
  transferEvaluation: ConceptTransferEvaluation;
  transferAudit?: TransferAuditSummary;
  recommendation?: InterventionRecommendation;
  strategyBlueprint?: InterventionStrategyBlueprint;
}

export function buildConceptCaseMap(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  decisionSnapshots?: InterventionDecisionSnapshotRow[];
  retentionSchedules?: RetentionScheduleRow[];
  transferSnapshots?: import("../../../../packages/db/src/repository").TransferEvaluationSnapshotRow[];
  realPlaySignals?: RealPlayConceptSignal[];
  recommendations?: InterventionRecommendation[];
  now?: Date;
}): Map<string, ConceptCaseBundle> {
  const diagnosisHistory = args.diagnosisHistory ?? [];
  const interventionHistory = args.interventionHistory ?? [];
  const retentionSchedules = args.retentionSchedules ?? [];
  const recommendationsByConcept = new Map((args.recommendations ?? []).map((entry) => [entry.conceptKey, entry]));
  const transferEvaluations = buildConceptTransferEvaluationMap({
    playerIntelligence: args.playerIntelligence,
    diagnosisHistory,
    interventionHistory,
    realPlaySignals: args.realPlaySignals,
    retentionSchedules,
    now: args.now,
  });
  const bundles = new Map<string, ConceptCaseBundle>();

  for (const concept of args.playerIntelligence.concepts) {
    const decisionAudit = buildConceptDecisionAuditSummary({
      conceptKey: concept.conceptKey,
      decisions: (args.decisionSnapshots ?? []) as Parameters<typeof buildConceptDecisionAuditSummary>[0]["decisions"],
      currentRecommendation: recommendationsByConcept.get(concept.conceptKey),
    });
    const retention = buildConceptRetentionSummary(concept.conceptKey, retentionSchedules, args.now);
    const recommendation = recommendationsByConcept.get(concept.conceptKey);
    const transferEvaluation = transferEvaluations.get(concept.conceptKey);
    const transferAudit = buildConceptTransferAuditSummary({
      conceptKey: concept.conceptKey,
      snapshots: args.transferSnapshots ?? [],
      currentEvaluation: transferEvaluation,
    });
    const history = buildConceptCaseHistory({
      conceptKey: concept.conceptKey,
      label: concept.label,
      summary: concept.summary,
      diagnosisHistory: diagnosisHistory.filter((entry) => entry.conceptKey === concept.conceptKey),
      interventionHistory: interventionHistory.filter((entry) => entry.conceptKey === concept.conceptKey),
      recoveryStage: concept.recoveryStage,
      patterns: selectPatternsForConcept(args.playerIntelligence.patterns.patterns, concept.conceptKey),
      latestInterventionRecommendation: recommendation,
      decisionSummary: decisionAudit.latestDecision
        ? {
            latestAction: decisionAudit.latestDecision.action,
            latestStrategy: decisionAudit.latestDecision.recommendedStrategy,
            latestPriority: decisionAudit.latestDecision.priority,
            latestCreatedAt: decisionAudit.latestDecision.createdAt,
            latestActedUpon: decisionAudit.latestDecision.actedUpon,
            latestDecisionChanged: decisionAudit.latestDecisionChanged,
            currentRecommendationChanged: decisionAudit.currentRecommendationChanged,
            escalationCount: decisionAudit.escalationCount,
            stability: decisionAudit.stability,
          }
        : undefined,
      retentionSummary: {
        latestState: retention.latestSchedule?.state,
        latestReason: retention.latestSchedule?.reason,
        latestScheduledFor: retention.latestSchedule?.scheduledFor,
        dueCount: retention.dueCount,
        overdueCount: retention.overdueCount,
        lastResult: retention.lastResult ?? null,
        validationState: retention.validationState,
      },
      recentAttempts: {
        sampleSize: concept.sampleSize,
        recentAverage: concept.recentAverage,
        averageScore: concept.averageScore,
        lastAttemptAt: undefined,
        failedCount: concept.failedCount,
        trendDirection: concept.trend?.direction,
      },
      recurrenceCount: concept.recurrenceCount,
      reviewPressure: concept.reviewPressure,
      planningReasons: concept.planningReasons,
      transferEvaluation,
    });
    const explanation = deriveConceptCoachingExplanation(history);
    const nextStep = deriveConceptNextStep(history);
    const strategyBlueprint = buildInterventionStrategyBlueprint({
      playerIntelligence: args.playerIntelligence,
      recommendation,
      retentionSchedules,
      now: args.now,
    });

    bundles.set(concept.conceptKey, {
      history,
      explanation,
      nextStep,
      decisionAudit,
      retention,
      transferEvaluation: transferEvaluation!,
      transferAudit,
      recommendation,
      strategyBlueprint,
    });
  }

  return bundles;
}

export function getConceptCaseBundle(args: {
  conceptKey: string;
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  decisionSnapshots?: Parameters<typeof buildConceptDecisionAuditSummary>[0]["decisions"];
  retentionSchedules?: RetentionScheduleRow[];
  transferSnapshots?: import("../../../../packages/db/src/repository").TransferEvaluationSnapshotRow[];
  realPlaySignals?: RealPlayConceptSignal[];
  recommendations?: InterventionRecommendation[];
  now?: Date;
}): ConceptCaseBundle | undefined {
  return buildConceptCaseMap(args).get(args.conceptKey);
}
