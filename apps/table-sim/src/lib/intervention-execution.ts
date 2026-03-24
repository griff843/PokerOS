import type {
  ConceptCaseNextStep,
  InterventionRecommendation,
  InterventionSupportingSignal,
} from "@poker-coach/core/browser";
import type { InterventionStrategyBlueprint } from "@poker-coach/core/browser";
import type { ConceptCaseBundle } from "./concept-case";
import type { ConceptAuditEvent, ConceptAuditFeedResponse } from "./concept-audit-feed";
import type { EngineReplaySummary } from "./input-snapshots";

export type InterventionExecutionStatus = "no_intervention" | "recommended" | "active";

export type InterventionProgressSummary =
  | "no_history"
  | "stable"
  | "approaching_success"
  | "approaching_escalation";

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

export interface ConceptRecentFeedSummary {
  state: ConceptAuditFeedResponse["state"];
  eventCount: number;
  recentEvents: ConceptAuditEvent[];
  hasEscalations: boolean;
  hasRecentSuccess: boolean;
  mostRecentAt?: string;
}

export interface InterventionProgressContext {
  progressSummary: InterventionProgressSummary;
  recentSuccessSignals: string[];
  recentEscalationSignals: string[];
  mostRecentEventLabel?: string;
  mostRecentEventAt?: string;
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
  recentFeed?: ConceptRecentFeedSummary;
  progressContext?: InterventionProgressContext;
}

export function buildInterventionExecutionBundle(
  bundle: ConceptCaseBundle,
  conceptKey: string,
  auditFeed?: ConceptAuditFeedResponse,
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

  const recentFeed = auditFeed ? buildRecentFeedSummary(auditFeed) : undefined;
  const progressContext = recentFeed ? deriveProgressContext(recentFeed) : undefined;

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
    recentFeed,
    progressContext,
  };
}

function buildRecentFeedSummary(feed: ConceptAuditFeedResponse): ConceptRecentFeedSummary {
  const recentEvents = feed.events.slice(0, 7);
  const escalationTypes = new Set([
    "intervention_escalated",
    "intervention_reopened",
    "retention_overdue",
    "retention_completed_fail",
  ]);
  const successTypes = new Set([
    "retention_completed_pass",
    "intervention_closed",
  ]);

  const hasEscalations = feed.events.some((e) => escalationTypes.has(e.eventType));
  const hasRecentSuccess = feed.events.some(
    (e) =>
      successTypes.has(e.eventType) ||
      (e.eventType === "transfer_status_recorded" &&
        (e.metadata as Record<string, unknown>)["status"] === "transfer_validated"),
  );

  return {
    state: feed.state,
    eventCount: feed.eventCount,
    recentEvents,
    hasEscalations,
    hasRecentSuccess,
    mostRecentAt: feed.events[0]?.timestamp,
  };
}

function deriveProgressContext(feed: ConceptRecentFeedSummary): InterventionProgressContext {
  if (feed.state === "no_history" || feed.eventCount === 0) {
    return {
      progressSummary: "no_history",
      recentSuccessSignals: [],
      recentEscalationSignals: [],
    };
  }

  const recentSuccessSignals: string[] = [];
  const recentEscalationSignals: string[] = [];

  for (const event of feed.recentEvents) {
    if (event.eventType === "retention_completed_pass") {
      recentSuccessSignals.push("Retention check passed recently — gain is holding.");
    } else if (event.eventType === "intervention_closed") {
      recentSuccessSignals.push("Intervention was closed successfully.");
    } else if (
      event.eventType === "transfer_status_recorded" &&
      (event.metadata as Record<string, unknown>)["status"] === "transfer_validated"
    ) {
      recentSuccessSignals.push("Transfer validated in recent evaluation.");
    } else if (event.eventType === "intervention_escalated") {
      recentEscalationSignals.push("Intervention was escalated — previous approach was not sufficient.");
    } else if (event.eventType === "intervention_reopened") {
      recentEscalationSignals.push("Intervention was reopened after apparent recovery.");
    } else if (event.eventType === "retention_overdue") {
      recentEscalationSignals.push("Retention check is overdue — validation has not been completed.");
    } else if (event.eventType === "retention_completed_fail") {
      recentEscalationSignals.push("Retention check failed — gain may not be holding.");
    }
  }

  let progressSummary: InterventionProgressSummary;
  if (recentEscalationSignals.length > 0) {
    progressSummary = "approaching_escalation";
  } else if (recentSuccessSignals.length > 0) {
    progressSummary = "approaching_success";
  } else {
    progressSummary = "stable";
  }

  const mostRecent = feed.recentEvents[0];
  return {
    progressSummary,
    recentSuccessSignals,
    recentEscalationSignals,
    mostRecentEventLabel: mostRecent?.label,
    mostRecentEventAt: mostRecent?.timestamp,
  };
}
