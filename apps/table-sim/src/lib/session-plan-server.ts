import {
  buildAttemptInsights,
  buildInterventionPlan,
  buildInterventionSessionPlan,
  buildPlayerIntelligenceSnapshot,
  type GeneratorInputs,
  generateSessionPlan,
  type SessionRequest,
} from "@poker-coach/core/browser";
import type { CanonicalDrill } from "@poker-coach/core/browser";
import { TableSimSessionPlanSchema, type TableSimSessionPlan } from "./session-plan";
import {
  buildDiagnosticInsightsFromAttempts,
  buildInterventionRecentAttempts,
  hydratePersistedStudyAttempts,
} from "./intervention-support";

interface CreateTableSimSessionPlanArgs {
  request: Pick<SessionRequest, "count" | "reviewRatio" | "activePool"> & { interventionId?: string | null };
  inputs: Pick<GeneratorInputs, "drills" | "attempts" | "srs" | "now">;
}

export function createTableSimSessionPlan({
  request,
  inputs,
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

  if (!request.interventionId) {
    return TableSimSessionPlanSchema.parse(basePlan);
  }

  const hydratedAttempts = hydratePersistedStudyAttempts(inputs.attempts, drills);
  const attemptInsights = buildAttemptInsights(inputs.attempts, new Map(drills.map((drill) => [drill.drill_id, drill])));
  const playerIntelligence = buildPlayerIntelligenceSnapshot({
    drills,
    attemptInsights,
    srs: inputs.srs,
    activePool: request.activePool,
    diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
    now: inputs.now,
  });
  const interventionPlan = buildInterventionPlan({
    playerIntelligence,
    recentAttempts: buildInterventionRecentAttempts(hydratedAttempts),
    activePool: request.activePool ?? "baseline",
    now: inputs.now,
  });

  if (interventionPlan.id !== request.interventionId) {
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

  return TableSimSessionPlanSchema.parse(plan);
}

export function createRecommendedInterventionPlan(args: {
  drills: CanonicalDrill[];
  attempts: GeneratorInputs["attempts"];
  srs: GeneratorInputs["srs"];
  activePool: SessionRequest["activePool"];
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
    now: args.now,
  });

  return buildInterventionPlan({
    playerIntelligence,
    recentAttempts: buildInterventionRecentAttempts(hydratedAttempts),
    activePool: args.activePool ?? "baseline",
    now: args.now,
  });
}
