import type {
  DiagnosticInsight,
  InterventionPlannerRecentAttempt,
} from "@poker-coach/core/browser";
import type { AttemptRow } from "../../../../packages/db/src/repository";
import type { TableSimDrill } from "./drill-schema";
import { hydrateDrillAttempt } from "./study-attempts";
import type { DrillAttempt } from "./session-types";

export function hydratePersistedStudyAttempts(attempts: AttemptRow[], drills: TableSimDrill[]): DrillAttempt[] {
  const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
  return attempts.flatMap((attempt) => {
    const drill = drillMap.get(attempt.drill_id);
    if (!drill) {
      return [];
    }

    return [hydrateDrillAttempt(attempt, drill)];
  });
}

export function buildDiagnosticInsightsFromAttempts(attempts: DrillAttempt[]): DiagnosticInsight[] {
  return attempts.flatMap((attempt) => attempt.diagnostic?.result.errorType
    ? [{
        conceptKey: attempt.diagnostic.result.conceptKey,
        concept: attempt.diagnostic.result.concept,
        errorType: attempt.diagnostic.result.errorType,
        confidenceMiscalibration: attempt.diagnostic.result.confidenceMiscalibration,
      }]
    : []);
}

export function buildInterventionRecentAttempts(attempts: DrillAttempt[]): InterventionPlannerRecentAttempt[] {
  return attempts.map((attempt) => ({
    drillId: attempt.drill.drill_id,
    nodeId: attempt.drill.node_id,
    title: attempt.drill.title,
    score: attempt.score,
    correct: attempt.correct,
    ts: attempt.timestamp,
    activePool: attempt.activePool,
    diagnosticErrorType: attempt.diagnostic?.result.errorType ?? null,
    diagnosticConceptKey: attempt.diagnostic?.result.conceptKey ?? null,
    confidenceMiscalibration: attempt.diagnostic?.result.confidenceMiscalibration ?? false,
  }));
}

