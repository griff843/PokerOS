import {
  buildAttemptInsights,
  buildInterventionPlan,
  buildInterventionSessionPlan,
  buildPlayerIntelligenceSnapshot,
  collectDrillConceptSources,
  type CanonicalDrill,
  type GeneratorInputs,
  mapSignalToConceptKeys,
  type RealPlayConceptSignal,
  generateSessionPlan,
  type SessionRequest,
} from "@poker-coach/core/browser";
import { openDatabase } from "../../../../packages/db/src";
import { resolveDbPath } from "./local-study-data";
import { ensureInterventionForPlan, markInterventionStarted, toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "./coaching-memory";
import { TableSimSessionPlanSchema, type TableSimSessionPlan } from "./session-plan";
import { buildPrimaryInterventionRecommendation, shouldPersistInterventionRecommendation } from "./intervention-decision";
import type { FollowUpUncertaintyProfile } from "./real-hands";
import type { DailyPlanSessionOverride } from "./daily-plan-session-bridge";
import {
  buildDiagnosticInsightsFromAttempts,
  buildInterventionRecentAttempts,
  buildPatternAttemptSignals,
  hydratePersistedStudyAttempts,
} from "./intervention-support";
import { getLocalCoachingUserId } from "./coaching-memory";
import {
  getUserDiagnosisHistory,
  getUserInterventionDecisionSnapshots,
  getUserInterventions,
} from "../../../../packages/db/src/repository";
import { syncRetentionScheduling, toCoreRetentionSchedule } from "./retention-scheduling";

interface CreateTableSimSessionPlanArgs {
  request: Pick<SessionRequest, "count" | "reviewRatio" | "activePool" | "focusConceptKey"> & {
    interventionId?: string | null;
    dailyPlanOverride?: DailyPlanSessionOverride | null;
  };
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
      focusConceptKey: request.focusConceptKey ?? undefined,
    },
    {
      drills,
      attempts: inputs.attempts,
      srs: inputs.srs,
      now: inputs.now,
    }
  );

  if (request.dailyPlanOverride) {
    return TableSimSessionPlanSchema.parse({
      ...basePlan,
      metadata: {
        ...basePlan.metadata,
        dailyPlanOverride: request.dailyPlanOverride,
        notes: [
          request.dailyPlanOverride.focusConceptKey
            ? `Daily plan bridge focused this session on ${request.dailyPlanOverride.focusConceptLabel ?? request.dailyPlanOverride.focusConceptKey.replace(/_/g, " ")}.`
            : `Daily plan bridge carried ${request.dailyPlanOverride.recommendedCount} recommended reps into session launch.`,
          ...basePlan.metadata.notes,
        ],
      },
    });
  }

  const hydratedAttempts = hydratePersistedStudyAttempts(inputs.attempts, drills);
  const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);
  const attemptInsights = buildAttemptInsights(inputs.attempts, new Map(drills.map((drill) => [drill.drill_id, drill])));
  const playerIntelligence = buildPlayerIntelligenceSnapshot({
    drills,
    attemptInsights,
    srs: inputs.srs,
    activePool: request.activePool,
    diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
    diagnosisHistory,
    interventionHistory,
    patternAttempts,
    now: inputs.now,
  });
  const interventionRecommendation = buildPrimaryInterventionRecommendation({
    playerIntelligence,
    diagnosisHistory,
    interventionHistory,
    conceptKey: playerIntelligence.priorities[0]?.conceptKey,
  });
  const retentionSchedules = syncPlannerRetentionSchedules(playerIntelligence, inputs.attempts, inputs.now);
  const interventionPlan = buildInterventionPlan({
    playerIntelligence,
    recentAttempts: buildInterventionRecentAttempts(hydratedAttempts),
    activePool: request.activePool ?? "baseline",
    retentionSchedules,
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
      if (interventionRecommendation && shouldPersistInterventionRecommendation(interventionRecommendation)) {
        const intervention = ensureInterventionForPlan({
          db,
          conceptKey: interventionRecommendation.conceptKey,
          source: "command_center",
          createdAt: interventionPlan.generatedAt,
        });
        markInterventionStarted(db, intervention.id);
      }
    } finally {
      db.close();
    }
  }

  return TableSimSessionPlanSchema.parse(plan);
}


export function createRecommendedInterventionDecision(args: {
  drills: CanonicalDrill[];
  attempts: GeneratorInputs["attempts"];
  srs: GeneratorInputs["srs"];
  activePool: SessionRequest["activePool"];
  diagnosisHistory?: ReturnType<typeof toDiagnosisHistoryEntries>;
  interventionHistory?: ReturnType<typeof toInterventionHistoryEntries>;
  realPlaySignals?: RealPlayConceptSignal[];
  now?: Date;
}) {
  const hydratedAttempts = hydratePersistedStudyAttempts(args.attempts, args.drills);
  const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);
  const attemptInsights = buildAttemptInsights(args.attempts, new Map(args.drills.map((drill) => [drill.drill_id, drill])));
  const playerIntelligence = buildPlayerIntelligenceSnapshot({
    drills: args.drills,
    attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    realPlaySignals: args.realPlaySignals,
    patternAttempts,
    now: args.now,
  });

  return buildPrimaryInterventionRecommendation({
    playerIntelligence,
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    realPlaySignals: args.realPlaySignals,
    conceptKey: playerIntelligence.priorities[0]?.conceptKey,
  });
}

export function createRecommendedInterventionPlan(args: {
  drills: CanonicalDrill[];
  attempts: GeneratorInputs["attempts"];
  srs: GeneratorInputs["srs"];
  activePool: SessionRequest["activePool"];
  diagnosisHistory?: ReturnType<typeof toDiagnosisHistoryEntries>;
  interventionHistory?: ReturnType<typeof toInterventionHistoryEntries>;
  realPlaySignals?: RealPlayConceptSignal[];
  now?: Date;
}) {
  const hydratedAttempts = hydratePersistedStudyAttempts(args.attempts, args.drills);
  const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);
  const attemptInsights = buildAttemptInsights(args.attempts, new Map(args.drills.map((drill) => [drill.drill_id, drill])));
  const playerIntelligence = buildPlayerIntelligenceSnapshot({
    drills: args.drills,
    attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    realPlaySignals: args.realPlaySignals,
    patternAttempts,
    now: args.now,
  });

  const retentionSchedules = syncPlannerRetentionSchedules(playerIntelligence, args.attempts, args.now);

  return buildInterventionPlan({
    playerIntelligence,
    recentAttempts: buildInterventionRecentAttempts(hydratedAttempts),
    activePool: args.activePool ?? "baseline",
    retentionSchedules,
    now: args.now,
  });
}

export function createRealHandFollowUpSessionPlan(args: {
  request: {
    conceptKey: string;
    count?: number;
    activePool?: SessionRequest["activePool"];
    preferredDrillIds?: string[];
    correctiveBuckets?: Array<"exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive">;
    handTitle?: string | null;
    handSource?: "paste" | "file" | "manual";
    parseStatus?: "parsed" | "partial" | "unsupported";
    uncertaintyProfile?: FollowUpUncertaintyProfile;
  };
  inputs: Pick<GeneratorInputs, "drills" | "attempts" | "srs" | "now">;
}) {
  const drills = args.inputs.drills as CanonicalDrill[];
  const activePool = args.request.activePool ?? "baseline";
  const requestedCount = Math.max(3, Math.min(args.request.count ?? 6, 10));
  const preferredIndex = new Map((args.request.preferredDrillIds ?? []).map((drillId, index) => [drillId, index]));
  const attemptStats = buildFollowUpAttemptStats(args.inputs.attempts);
  const srsMap = new Map(args.inputs.srs.map((row) => [row.drill_id, row.due_at]));
  const rankedCandidates = drills
    .filter((drill) => preferredIndex.has(drill.drill_id) || drillMatchesConcept(drill, args.request.conceptKey))
    .sort((left, right) => compareFollowUpCandidates(left, right, {
      preferredIndex,
      attemptStats,
      srsMap,
      conceptKey: args.request.conceptKey,
      uncertaintyProfile: args.request.uncertaintyProfile,
    }))
    .map((drill) => {
      const priorAttempts = attemptStats.get(drill.drill_id)?.count ?? 0;
      const lastScore = attemptStats.get(drill.drill_id)?.lastScore;
      const dueAt = srsMap.get(drill.drill_id);
      const assignment = buildFollowUpAssignmentMetadata({
        drill,
        conceptKey: args.request.conceptKey,
        uncertaintyProfile: args.request.uncertaintyProfile,
        preferred: preferredIndex.has(drill.drill_id),
      });
      return {
        drill,
        kind: dueAt || priorAttempts > 0 ? "review" as const : "new" as const,
        reason: dueAt
          ? "due_review" as const
          : priorAttempts > 0
            ? "weakness_review" as const
            : "weakness_new" as const,
        matchedWeaknessTargets: [`concept:${args.request.conceptKey}`, "source:real_hand_follow_up"],
        metadata: {
          dueAt,
          priorAttempts,
          lastScore,
          weaknessPriority: preferredIndex.has(drill.drill_id) ? 1 : 0.85,
          assignmentRationale: assignment.rationale,
          assignmentBucket: assignment.bucket,
        },
      };
    });
  const selected = buildTargetedFollowUpSelection(
    rankedCandidates,
    requestedCount,
    args.request.uncertaintyProfile,
    args.request.correctiveBuckets ?? [],
  );

  if (selected.length === 0) {
    throw new Error(`No follow-up drills are available yet for concept ${args.request.conceptKey}.`);
  }

  const reviewCount = selected.filter((entry) => entry.kind === "review").length;
  const newCount = selected.length - reviewCount;

  return TableSimSessionPlanSchema.parse({
    drills: selected,
    metadata: {
      requestedCount,
      selectedCount: selected.length,
      reviewCount,
      newCount,
      dueReviewCount: selected.filter((entry) => entry.reason === "due_review").length,
      weaknessReviewCount: selected.filter((entry) => entry.reason === "weakness_review").length,
      weaknessNewCount: selected.filter((entry) => entry.reason === "weakness_new").length,
      newMaterialFillCount: 0,
      activePool,
      generatedAt: (args.inputs.now ?? new Date()).toISOString(),
      weaknessTargets: [{
        type: "classification_tag",
        key: `concept:${args.request.conceptKey}`,
        scope: "overall",
        sampleSize: selected.length,
        priority: 1,
      }],
      notes: [
        `Targeted real-hand follow-up focused on ${args.request.conceptKey.replace(/_/g, " ")}.`,
        args.request.handTitle
          ? `Built from imported hand: ${args.request.handTitle}.`
          : "Built from an imported real-hand review recommendation.",
        buildFollowUpUncertaintyNote(args.request),
        buildCorrectiveMixNote(args.request.correctiveBuckets ?? []),
        buildFollowUpMixNote(selected),
        "Start with the closest gold-lane matches first, then use adjacent concept reps to stabilize transfer.",
      ].filter(Boolean),
      followUpAudit: {
        conceptKey: args.request.conceptKey,
        handTitle: args.request.handTitle ?? null,
        handSource: args.request.handSource,
        parseStatus: args.request.parseStatus,
        uncertaintyProfile: args.request.uncertaintyProfile,
        bucketMix: summarizeFollowUpBucketMix(selected),
        selectedDrillIds: selected.map((entry) => entry.drill.drill_id),
      },
    },
  });
}

function buildCorrectiveMixNote(
  correctiveBuckets: Array<"exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive">
) {
  if (correctiveBuckets.length === 0) {
    return "";
  }

  const labels = [...new Set(correctiveBuckets)].map((bucket) => formatAssignmentBucketLabel(bucket));
  return `Corrective weighting applied: ${labels.join(", ")}.`;
}

function buildFollowUpUncertaintyNote(request: {
  handSource?: "paste" | "file" | "manual";
  parseStatus?: "parsed" | "partial" | "unsupported";
  uncertaintyProfile?: FollowUpUncertaintyProfile;
}) {
  if (request.handSource === "manual" && request.uncertaintyProfile === "turn_line_clear") {
    return "Manual reconstruction with a clear turn-line family: prioritize turn-to-river transfer reps where the line should decisively drive the river threshold.";
  }

  if (request.uncertaintyProfile === "sizing_fuzzy_line_clear") {
    return "Sizing-fuzzy follow-up: the line family is usable, so train stable thresholds first and then compare the spots where exact sizing could still flip the answer.";
  }

  if (request.uncertaintyProfile === "memory_decisive") {
    return "Memory-decisive follow-up: prioritize drills where the river answer can flip depending on which turn version actually happened, and treat reconstruction itself as part of the assignment.";
  }

  if (request.handSource === "manual" || request.uncertaintyProfile === "turn_line_fuzzy" || request.parseStatus === "partial") {
    return "Memory-ambiguous follow-up: prioritize bridge drills over exact sizing assumptions, and treat turn-story recovery as part of the training goal.";
  }

  return "Precise import follow-up: prioritize direct transfer from the exact reviewed line into the closest gold-lane reps.";
}

function buildFollowUpMixNote(selected: Array<TableSimSessionPlan["drills"][number]>) {
  const mix = summarizeFollowUpBucketMix(selected);
  if (mix.length === 0) {
    return "The follow-up block stays concept-tight and ranks exact matches first.";
  }

  const ranked = mix.map(({ bucket, count }) => `${count} ${formatAssignmentBucketLabel(bucket)}`);

  return `Follow-up mix: ${ranked.join(", ")}.`;
}

function summarizeFollowUpBucketMix(selected: Array<TableSimSessionPlan["drills"][number]>) {
  const counts = new Map<string, number>();
  for (const entry of selected) {
    const bucket = entry.metadata.assignmentBucket;
    if (!bucket) {
      continue;
    }
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([bucket, count]) => ({
      bucket: bucket as "exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive",
      count,
    }));
}

function syncPlannerRetentionSchedules(
  playerIntelligence: ReturnType<typeof buildPlayerIntelligenceSnapshot>,
  attempts: GeneratorInputs["attempts"],
  now: Date | undefined
) {
  const dbPath = resolveDbPath();
  if (!dbPath) {
    return [];
  }

  const db = openDatabase(dbPath);
  try {
    const userId = getLocalCoachingUserId();
    return syncRetentionScheduling({
      db,
      playerIntelligence,
      attempts,
      diagnoses: getUserDiagnosisHistory(db, userId),
      interventions: getUserInterventions(db, userId),
      decisionSnapshots: getUserInterventionDecisionSnapshots(db, userId),
      now,
    }).map((schedule) => toCoreRetentionSchedule(schedule));
  } finally {
    db.close();
  }
}

function drillMatchesConcept(drill: CanonicalDrill, conceptKey: string): boolean {
  const normalizedRequested = normalizeConceptKey(conceptKey);
  if (!normalizedRequested) {
    return false;
  }

  const conceptKeys = new Set<string>();
  for (const source of collectDrillConceptSources(drill)) {
    for (const key of mapSignalToConceptKeys(source)) {
      conceptKeys.add(key);
    }
  }

  return conceptKeys.has(normalizedRequested)
    || drill.tags.includes(`concept:${normalizedRequested}`)
    || (drill.diagnostic_prompts ?? []).some((prompt) => normalizeConceptKey(prompt.concept) === normalizedRequested);
}

function compareFollowUpCandidates(
  left: CanonicalDrill,
  right: CanonicalDrill,
  args: {
    preferredIndex: Map<string, number>;
    attemptStats: Map<string, { count: number; lastScore: number }>;
    srsMap: Map<string, string>;
    conceptKey: string;
    uncertaintyProfile?: FollowUpUncertaintyProfile;
  }
) {
  const preferredLeft = args.preferredIndex.get(left.drill_id);
  const preferredRight = args.preferredIndex.get(right.drill_id);
  if (preferredLeft !== undefined || preferredRight !== undefined) {
    if (preferredLeft === undefined) return 1;
    if (preferredRight === undefined) return -1;
    return preferredLeft - preferredRight;
  }

  const dueCompare = compareOptionalDates(args.srsMap.get(left.drill_id), args.srsMap.get(right.drill_id));
  if (dueCompare !== 0) {
    return dueCompare;
  }

  const leftMatches = drillMatchesConcept(left, args.conceptKey);
  const rightMatches = drillMatchesConcept(right, args.conceptKey);
  if (leftMatches !== rightMatches) {
    return leftMatches ? -1 : 1;
  }

  const uncertaintyScoreDelta = scoreFollowUpUncertaintyFit(right, args.uncertaintyProfile, args.conceptKey)
    - scoreFollowUpUncertaintyFit(left, args.uncertaintyProfile, args.conceptKey);
  if (uncertaintyScoreDelta !== 0) {
    return uncertaintyScoreDelta;
  }

  const leftScore = args.attemptStats.get(left.drill_id)?.lastScore ?? Number.POSITIVE_INFINITY;
  const rightScore = args.attemptStats.get(right.drill_id)?.lastScore ?? Number.POSITIVE_INFINITY;
  if (leftScore !== rightScore) {
    return leftScore - rightScore;
  }

  const leftAttempts = args.attemptStats.get(left.drill_id)?.count ?? 0;
  const rightAttempts = args.attemptStats.get(right.drill_id)?.count ?? 0;
  if (leftAttempts !== rightAttempts) {
    return leftAttempts - rightAttempts;
  }

  return left.title.localeCompare(right.title);
}

function scoreFollowUpUncertaintyFit(
  drill: CanonicalDrill,
  uncertaintyProfile: FollowUpUncertaintyProfile | undefined,
  conceptKey: string,
) {
  let score = 0;
  const hasSteps = Boolean(drill.steps?.length);
  const hasStreetShift = Boolean(drill.coaching_context?.what_changed_by_street?.length);
  const isGoldTurnRiverBridge = String(drill.drill_id).startsWith("gold_bc_tr");
  const isDirectConcept = drillMatchesConcept(drill, conceptKey);
  const hasPoolVariants = Boolean(drill.answer_by_pool && Object.keys(drill.answer_by_pool).length > 0);

  if (uncertaintyProfile === "memory_decisive") {
    if (hasSteps) score += 6;
    if (hasStreetShift) score += 4;
    if (isGoldTurnRiverBridge) score += 4;
    if (hasPoolVariants) score += 2;
    if (isDirectConcept) score += 1;
    return score;
  }

  if (uncertaintyProfile === "turn_line_fuzzy") {
    if (hasSteps) score += 5;
    if (hasStreetShift) score += 3;
    if (isGoldTurnRiverBridge) score += 3;
    if (isDirectConcept) score += 1;
    return score;
  }

  if (uncertaintyProfile === "sizing_fuzzy_line_clear") {
    if (isGoldTurnRiverBridge) score += 4;
    if (hasStreetShift) score += 3;
    if (hasPoolVariants) score += 3;
    if (isDirectConcept) score += 2;
    if (hasSteps) score += 1;
    return score;
  }

  if (uncertaintyProfile === "turn_line_clear") {
    if (isGoldTurnRiverBridge) score += 4;
    if (hasStreetShift) score += 3;
    if (hasSteps) score += 2;
    if (isDirectConcept) score += 2;
    return score;
  }

  if (uncertaintyProfile === "precise_history") {
    if (isDirectConcept) score += 4;
    if (isGoldTurnRiverBridge) score += 1;
    return score;
  }

  return score;
}

function buildFollowUpAssignmentMetadata(args: {
  drill: CanonicalDrill;
  conceptKey: string;
  uncertaintyProfile: FollowUpUncertaintyProfile | undefined;
  preferred: boolean;
}) {
  const isBridge = String(args.drill.drill_id).startsWith("gold_bc_tr");
  const hasSteps = Boolean(args.drill.steps?.length);
  const hasStreetShift = Boolean(args.drill.coaching_context?.what_changed_by_street?.length);
  const hasPoolVariants = Boolean(args.drill.answer_by_pool && Object.keys(args.drill.answer_by_pool).length > 0);
  const directConcept = drillMatchesConcept(args.drill, args.conceptKey);
  const bucket = classifyAssignmentBucket({
    preferred: args.preferred,
    directConcept,
    isBridge,
    hasSteps,
    hasStreetShift,
    hasPoolVariants,
    uncertaintyProfile: args.uncertaintyProfile,
  });

  switch (bucket) {
    case "memory_decisive":
      return {
        bucket,
        rationale: hasSteps || hasPoolVariants
          ? "Chosen because this rep forces you to resolve which turn version actually happened before trusting the river answer."
          : "Chosen because it exposes spots where memory uncertainty itself can flip the final river decision.",
      };
    case "bridge_reconstruction":
      return {
        bucket,
        rationale: hasSteps || hasStreetShift || isBridge
          ? "Chosen as a bridge rep so you can recover the likely turn story before locking in a river threshold."
          : "Chosen because it stays inside the same concept family while tolerating incomplete turn memory.",
      };
    case "sizing_stability":
      return {
        bucket,
        rationale: hasPoolVariants
          ? "Chosen because the line family is stable, but this rep also teaches when sizing pressure can still move the answer."
          : "Chosen because the turn line is clear and this rep trains thresholds that stay stable even when exact sizing is fuzzy.",
      };
    case "turn_line_transfer":
      return {
        bucket,
        rationale: isBridge || hasStreetShift
          ? "Chosen because the remembered turn line should decisively carry forward into the river threshold in this family."
          : "Chosen because it reinforces the same turn-to-river range story from the reviewed hand.",
      };
    case "exact_match":
    default:
      return {
        bucket: "exact_match" as const,
        rationale: directConcept || args.preferred
          ? "Chosen as the closest direct match to the reviewed hand, so the block starts with exact transfer before widening out."
          : "Chosen as the closest available follow-up rep in the same concept family.",
      };
  }
}

function buildTargetedFollowUpSelection(
  candidates: Array<TableSimSessionPlan["drills"][number]>,
  requestedCount: number,
  uncertaintyProfile: FollowUpUncertaintyProfile | undefined,
  correctiveBuckets: Array<"exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive">,
) {
  const remaining = [...candidates];
  const selected: Array<TableSimSessionPlan["drills"][number]> = [];
  const seen = new Set<string>();

  const take = (
    predicate: (entry: TableSimSessionPlan["drills"][number]) => boolean,
    limit: number,
    bucketOverride?: "exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive",
  ) => {
    for (let index = 0; index < remaining.length && limit > 0; ) {
      const entry = remaining[index];
      if (!entry || seen.has(entry.drill.drill_id) || !predicate(entry)) {
        index += 1;
        continue;
      }
      selected.push(applyCorrectiveBucketOverride(entry, bucketOverride));
      seen.add(entry.drill.drill_id);
      remaining.splice(index, 1);
      limit -= 1;
      if (selected.length >= requestedCount) {
        return;
      }
    }
  };

  take((entry) => (entry.metadata.weaknessPriority ?? 0) >= 1, requestedCount);
  if (selected.length >= requestedCount) {
    return selected;
  }

  for (const target of getFollowUpBucketTargets(uncertaintyProfile, requestedCount, correctiveBuckets)) {
    take(
      (entry) => matchesFollowUpBucketTarget(entry, target.bucket),
      target.count,
      target.corrective ? target.bucket : undefined,
    );
    if (selected.length >= requestedCount) {
      return selected;
    }
  }

  take(() => true, requestedCount - selected.length);
  return selected;
}

function getFollowUpBucketTargets(
  uncertaintyProfile: FollowUpUncertaintyProfile | undefined,
  requestedCount: number,
  correctiveBuckets: Array<"exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive"> = [],
): Array<{ bucket: "exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive"; count: number; corrective?: boolean }> {
  const correctivePlan = [...new Set(correctiveBuckets)].map((bucket) => ({
    bucket,
    count: 2,
    corrective: true,
  }));
  const basePlan = (() => {
    switch (uncertaintyProfile) {
      case "memory_decisive":
        return [
          { bucket: "memory_decisive" as const, count: 2 },
          { bucket: "bridge_reconstruction" as const, count: 2 },
          { bucket: "exact_match" as const, count: 1 },
        ];
      case "turn_line_fuzzy":
        return [
          { bucket: "bridge_reconstruction" as const, count: 2 },
          { bucket: "turn_line_transfer" as const, count: 1 },
          { bucket: "exact_match" as const, count: 1 },
        ];
      case "sizing_fuzzy_line_clear":
        return [
          { bucket: "sizing_stability" as const, count: 2 },
          { bucket: "turn_line_transfer" as const, count: 2 },
          { bucket: "exact_match" as const, count: 1 },
        ];
      case "turn_line_clear":
        return [
          { bucket: "turn_line_transfer" as const, count: 2 },
          { bucket: "exact_match" as const, count: 2 },
        ];
      case "precise_history":
      default:
        return [
          { bucket: "exact_match" as const, count: 3 },
          { bucket: "turn_line_transfer" as const, count: 1 },
        ];
    }
  })();
  const plan = [...correctivePlan, ...basePlan];

  let used = 0;
  return plan
    .map((target) => {
      const remaining = Math.max(requestedCount - used, 0);
      const count = Math.min(target.count, remaining);
      used += count;
      return { ...target, count };
    })
    .filter((target) => target.count > 0);
}

function classifyAssignmentBucket(args: {
  preferred: boolean;
  directConcept: boolean;
  isBridge: boolean;
  hasSteps: boolean;
  hasStreetShift: boolean;
  hasPoolVariants: boolean;
  uncertaintyProfile: FollowUpUncertaintyProfile | undefined;
}) {
  if (args.preferred && args.directConcept && !args.isBridge) {
    return "exact_match" as const;
  }

  if (args.uncertaintyProfile === "memory_decisive") {
    if (args.hasSteps || args.hasPoolVariants) return "memory_decisive" as const;
    if (args.isBridge || args.hasStreetShift) return "bridge_reconstruction" as const;
    return "exact_match" as const;
  }

  if (args.uncertaintyProfile === "turn_line_fuzzy") {
    if (args.isBridge || args.hasSteps || args.hasStreetShift) return "bridge_reconstruction" as const;
    return "exact_match" as const;
  }

  if (args.uncertaintyProfile === "sizing_fuzzy_line_clear") {
    if (args.hasPoolVariants) return "sizing_stability" as const;
    if (args.isBridge || args.hasSteps || args.hasStreetShift) return "turn_line_transfer" as const;
    return "exact_match" as const;
  }

  if (args.uncertaintyProfile === "turn_line_clear") {
    if (args.isBridge || args.hasSteps || args.hasStreetShift) return "turn_line_transfer" as const;
    return "exact_match" as const;
  }

  if (args.isBridge || args.hasStreetShift) {
    return "turn_line_transfer" as const;
  }

  return "exact_match" as const;
}

function matchesFollowUpBucketTarget(
  entry: TableSimSessionPlan["drills"][number],
  targetBucket: "exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive",
) {
  if (entry.metadata.assignmentBucket === targetBucket) {
    return true;
  }

  const hasSteps = Boolean(entry.drill.steps?.length);
  const hasStreetShift = Boolean(entry.drill.coaching_context?.what_changed_by_street?.length);
  const hasPoolVariants = Boolean(entry.drill.answer_by_pool && Object.keys(entry.drill.answer_by_pool).length > 0);
  const isBridge = String(entry.drill.drill_id).startsWith("gold_bc_tr");

  switch (targetBucket) {
    case "memory_decisive":
      return hasSteps && hasPoolVariants;
    case "bridge_reconstruction":
      return isBridge || hasSteps || hasStreetShift;
    case "sizing_stability":
      return hasPoolVariants;
    case "turn_line_transfer":
      return isBridge || hasSteps || hasStreetShift;
    case "exact_match":
    default:
      return entry.metadata.assignmentBucket === "exact_match";
  }
}

function applyCorrectiveBucketOverride(
  entry: TableSimSessionPlan["drills"][number],
  bucketOverride?: "exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive",
) {
  if (!bucketOverride || entry.metadata.assignmentBucket === bucketOverride) {
    return entry;
  }

  return {
    ...entry,
    metadata: {
      ...entry.metadata,
      assignmentBucket: bucketOverride,
      assignmentRationale: `${entry.metadata.assignmentRationale ?? "Chosen for follow-up."} Weighted toward ${formatAssignmentBucketLabel(bucketOverride)} to repair the missing bucket mix.`,
    },
  };
}

function formatAssignmentBucketLabel(bucket: string) {
  switch (bucket) {
    case "memory_decisive":
      return "memory-decisive";
    case "bridge_reconstruction":
      return "bridge reconstruction";
    case "sizing_stability":
      return "sizing-stability";
    case "turn_line_transfer":
      return "turn-line transfer";
    case "exact_match":
    default:
      return "exact-match";
  }
}

function buildFollowUpAttemptStats(attempts: GeneratorInputs["attempts"]) {
  const stats = new Map<string, { count: number; lastScore: number }>();
  for (const attempt of attempts) {
    const existing = stats.get(attempt.drill_id);
    if (!existing) {
      stats.set(attempt.drill_id, { count: 1, lastScore: attempt.score });
      continue;
    }
    existing.count += 1;
    existing.lastScore = attempt.score;
  }
  return stats;
}

function compareOptionalDates(left?: string, right?: string) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return new Date(left).getTime() - new Date(right).getTime();
}

function normalizeConceptKey(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || null;
}
