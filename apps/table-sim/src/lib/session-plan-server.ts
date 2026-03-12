import {
  buildAttemptInsights,
  buildInterventionPlan,
  buildInterventionSessionPlan,
  buildPlayerIntelligenceSnapshot,
  type CanonicalDrill,
  type GeneratorInputs,
  generateSessionPlan,
  type SessionRequest,
} from "@poker-coach/core/browser";
import { openDatabase } from "../../../../packages/db/src";
import { resolveDbPath } from "./local-study-data";
import { ensureInterventionForPlan, markInterventionStarted, toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "./coaching-memory";
import { TableSimSessionPlanSchema, type TableSimSessionPlan } from "./session-plan";
import {
  buildDiagnosticInsightsFromAttempts,
  buildInterventionRecentAttempts,
  hydratePersistedStudyAttempts,
} from "./intervention-support";

interface CreateTableSimSessionPlanArgs {
  request: Pick<SessionRequest, "count" | "reviewRatio" | "activePool"> & { interventionId?: string | null };
  inputs: Pick<GeneratorInputs, "drills" | "attempts" | "srs" | "now">;
  diagnosisHistory?: ReturnType<typeof toDiagnosisHistoryEntries>;
  interventionHistory?: ReturnType<typeof toInterventionHistoryEntries>;
}

export function createTableSimSessionPlan({
  request,
  inputs,
  diagnosisHistory,
  interventionHistory,
}: CreateTableSimSessionPlanArgs): TableSimSessionPlan {
  const drills = inputs.drills as CanonicalDrill[];
  const basePlan = generateSessionPlan(
    {
      count: request.count,
      reviewRatio: request.reviewRatio,
      activePool: request.activePool,
    },
    {
      drills,
      attempts: inputs.attempts,
      srs: inputs.srs,
      now: inputs.now,
    }
  );

  const hydratedAttempts = hydratePersistedStudyAttempts(inputs.attempts, drills);
  const attemptInsights = buildAttemptInsights(inputs.attempts, new Map(drills.map((drill) => [drill.drill_id, drill])));
  const playerIntelligence = buildPlayerIntelligenceSnapshot({
    drills,
    attemptInsights,
    srs: inputs.srs,
    activePool: request.activePool,
    diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
    diagnosisHistory,
    interventionHistory,
    now: inputs.now,
  });
  const interventionPlan = buildInterventionPlan({
    playerIntelligence,
    recentAttempts: buildInterventionRecentAttempts(hydratedAttempts),
    activePool: request.activePool ?? "baseline",
    now: inputs.now,
  });

  if (request.interventionId && interventionPlan.id !== request.interventionId) {
    throw new Error(`Intervention plan ${request.interventionId} is no longer current.`);
  }

  const plan = buildInterventionSessionPlan({
    interventionPlan,
    drills,
    recentAttempts: buildInterventionRecentAttempts(hydratedAttempts),
    srs: inputs.srs,
    activePool: request.activePool ?? "baseline",
    generatedAt: inputs.now,
    weaknessTargets: basePlan.metadata.weaknessTargets,
    baseNotes: basePlan.metadata.notes,
  });

  const dbPath = resolveDbPath();
  if (dbPath) {
    const db = openDatabase(dbPath);
    try {
      const intervention = ensureInterventionForPlan({
        db,
        conceptKey: interventionPlan.rootConceptKey,
        source: "command_center",
        createdAt: interventionPlan.generatedAt,
      });
      markInterventionStarted(db, intervention.id);
    } finally {
      db.close();
    }
  }

  return TableSimSessionPlanSchema.parse(plan);
}

export function createRecommendedInterventionPlan(args: {
  drills: CanonicalDrill[];
  attempts: GeneratorInputs["attempts"];
  srs: GeneratorInputs["srs"];
  activePool: SessionRequest["activePool"];
  diagnosisHistory?: ReturnType<typeof toDiagnosisHistoryEntries>;
  interventionHistory?: ReturnType<typeof toInterventionHistoryEntries>;
  now?: Date;
}) {
  const hydratedAttempts = hydratePersistedStudyAttempts(args.attempts, args.drills);
  const attemptInsights = buildAttemptInsights(args.attempts, new Map(args.drills.map((drill) => [drill.drill_id, drill])));
  const playerIntelligence = buildPlayerIntelligenceSnapshot({
    drills: args.drills,
    attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    now: args.now,
  });

  return buildInterventionPlan({
    playerIntelligence,
    recentAttempts: buildInterventionRecentAttempts(hydratedAttempts),
    activePool: args.activePool ?? "baseline",
    now: args.now,
  });
}
