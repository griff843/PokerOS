import type {
  ConceptCaseNextStep,
  InterventionRecommendation,
  InterventionSupportingSignal,
} from "@poker-coach/core/browser";
import type { InterventionStrategyBlueprint } from "@poker-coach/core/browser";
import type { ConceptCaseBundle } from "./concept-case";
import type { EngineReplaySummary } from "./input-snapshots";

export type InterventionExecutionStatus = "no_intervention" | "recommended" | "active";

export interface InterventionActionSummary {
  action: string;
  strategy: string;
  intensity: string;
  confidence: string;
  priority: number;
  summary: string;
  decisionReason: string;
  requiresNewAssignment: boolean;
  requiresStrategyChange: boolean;
  transferFocus: boolean;
  currentInterventionId?: string;
  currentInterventionStatus?: string;
}

export interface InterventionEvidenceSummary {
  reasonCodes: string[];
  evidence: string[];
  supportingSignals: InterventionSupportingSignal[];
  patternTypes: string[];
  whyNotOtherActions: string[];
}

export interface InterventionHistoryContext {
  diagnosisCount: number;
  recurrenceCount: number;
  recoveryStage: string;
  interventionCount: number;
  activeCount: number;
  improvedCount: number;
  failedCount: number;
  latestStatus?: string;
  recurringLeak: boolean;
}

export interface InterventionExecutionBundle {
  conceptKey: string;
  label: string;
  executionStatus: InterventionExecutionStatus;
  recommendation?: InterventionRecommendation;
  strategyBlueprint?: InterventionStrategyBlueprint;
  actionSummary?: InterventionActionSummary;
  evidenceSummary?: InterventionEvidenceSummary;
  historyContext: InterventionHistoryContext;
  nextStep: ConceptCaseNextStep;
  replayMetadata: {
    recommendation: EngineReplaySummary;
    transfer: EngineReplaySummary;
  };
}

export function buildInterventionExecutionBundle(
  bundle: ConceptCaseBundle,
  conceptKey: string,
): InterventionExecutionBundle {
  const { recommendation, strategyBlueprint, history, nextStep, replayMetadata } = bundle;

  const executionStatus: InterventionExecutionStatus = !recommendation
    ? "no_intervention"
    : recommendation.metadata.currentInterventionId
      ? "active"
      : "recommended";

  const actionSummary: InterventionActionSummary | undefined = recommendation
    ? {
        action: recommendation.action,
        strategy: recommendation.recommendedStrategy,
        intensity: recommendation.suggestedIntensity,
        confidence: recommendation.confidence,
        priority: recommendation.priority,
        summary: recommendation.summary,
        decisionReason: recommendation.decisionReason,
        requiresNewAssignment: recommendation.metadata.requiresNewAssignment,
        requiresStrategyChange: recommendation.metadata.requiresStrategyChange,
        transferFocus: recommendation.metadata.transferFocus,
        currentInterventionId: recommendation.metadata.currentInterventionId,
        currentInterventionStatus: recommendation.metadata.currentInterventionStatus,
      }
    : undefined;

  const evidenceSummary: InterventionEvidenceSummary | undefined = recommendation
    ? {
        reasonCodes: recommendation.reasonCodes,
        evidence: recommendation.evidence,
        supportingSignals: recommendation.supportingSignals,
        patternTypes: recommendation.metadata.patternTypes,
        whyNotOtherActions: recommendation.whyNotOtherActions,
      }
    : undefined;

  return {
    conceptKey,
    label: history.label,
    executionStatus,
    recommendation,
    strategyBlueprint,
    actionSummary,
    evidenceSummary,
    historyContext: {
      diagnosisCount: history.diagnosisCount,
      recurrenceCount: history.recurrenceCount,
      recoveryStage: history.recoveryStage,
      interventionCount: history.interventionHistorySummary.total,
      activeCount: history.interventionHistorySummary.active,
      improvedCount: history.interventionOutcomeSummary.improvedCount,
      failedCount: history.interventionOutcomeSummary.failedCount,
      latestStatus: history.interventionHistorySummary.latestStatus,
      recurringLeak: history.recurringLeak,
    },
    nextStep,
    replayMetadata,
  };
}
