import type { ConceptGraph } from "./concept-graph";
import { collectDrillConceptSources, mapSignalToConceptKeys } from "./concept-graph";
import {
  formatPlanningReason,
  planningReasonWeight,
  type ConceptRecoveryStage,
  type SessionPlanningReason,
} from "./coaching-memory";
import type { DiagnosticErrorType } from "./schemas";
import type { PlayerConceptSnapshot, PlayerIntelligenceSnapshot } from "./player-intelligence";
import { createNeutralAdaptiveCoachingProfile } from "./adaptive-coaching";
import { collectPatternBiases, type PatternInterventionBias } from "./patterns";
import type { SessionGeneratorSrsRow, SessionPlan, SessionPlanMetadata, SelectedDrill } from "./session-generator";
import type { CanonicalDrill } from "./schemas";
import type { WeaknessPool, WeaknessTarget } from "./weakness-analytics";

export interface InterventionPlannerRecentAttempt {
  drillId: string;
  nodeId: string;
  title?: string;
  score: number;
  correct: boolean;
  ts: string;
  activePool: WeaknessPool | null;
  diagnosticErrorType?: DiagnosticErrorType | null;
  diagnosticConceptKey?: string | null;
  confidenceMiscalibration?: boolean;
}

export interface InterventionTrainingBlock {
  conceptKey: string;
  label: string;
  reps: number;
  role: "repair" | "retest" | "calibration";
  reason: string;
  planningReasons: SessionPlanningReason[];
}

export interface InterventionPlan {
  id: string;
  generatedAt: string;
  activePool: WeaknessPool;
  rootConceptKey: string;
  rootConceptLabel: string;
  upstreamConceptKey?: string;
  upstreamConceptLabel?: string;
  rootLeakDiagnosis: string;
  rationale: string;
  recommendedSessionTitle: string;
  nextSessionFocus: string;
  targetConcepts: string[];
  planningReasons: SessionPlanningReason[];
  recoveryStage: ConceptRecoveryStage;
  trainingBlocks: InterventionTrainingBlock[];
  totalTargetReps: number;
}

export interface InterventionSessionPlanMetadata {
  id: string;
  title: string;
  rootConceptKey: string;
  rootConceptLabel: string;
  upstreamConceptKey?: string;
  upstreamConceptLabel?: string;
  rootLeakDiagnosis: string;
  rationale: string;
  nextSessionFocus: string;
  totalTargetReps: number;
  totalPlannedReps: number;
  planningReasons: SessionPlanningReason[];
  recoveryStage: ConceptRecoveryStage;
  trainingBlocks: Array<InterventionTrainingBlock & { plannedReps: number }>;
}

interface CandidateDrill {
  drill: CanonicalDrill;
  priorAttempts: number;
  lastScore?: number;
  dueAt?: string;
}

interface RankedConceptCandidate {
  conceptKey: string;
  snapshot: PlayerConceptSnapshot;
  score: number;
  diagnosticWeight: number;
  recentMissCount: number;
  planningReasons: SessionPlanningReason[];
  patternBiases: PatternInterventionBias[];
}

const ERROR_WEIGHTS: Record<DiagnosticErrorType, number> = {
  line_misunderstanding: 1,
  threshold_error: 1.25,
  range_construction_error: 1.2,
  blocker_blindness: 1.15,
  pool_assumption_error: 1.1,
  confidence_miscalibration: 0.9,
};

export function buildInterventionPlan(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  recentAttempts: InterventionPlannerRecentAttempt[];
  activePool: WeaknessPool;
  now?: Date;
}): InterventionPlan {
  const now = args.now ?? new Date();
  const byConcept = aggregateDiagnostics(args.recentAttempts);
  const conceptsByKey = new Map(args.playerIntelligence.concepts.map((concept) => [concept.conceptKey, concept]));
  const ranked = rankConceptCandidates(args.playerIntelligence.concepts, byConcept, args.playerIntelligence.patterns.patterns);

  const lead = ranked[0];
  const fallback = args.playerIntelligence.priorities[0] ?? args.playerIntelligence.concepts[0];
  const rootSnapshot = lead?.snapshot ?? fallback;
  const rootConceptKey = rootSnapshot?.conceptKey ?? lead?.conceptKey ?? "balanced_reinforcement";
  const rootConceptLabel = rootSnapshot?.label ?? toTitleCase(rootConceptKey);
  const rootPlanningReasons = dedupeReasons(lead?.planningReasons ?? rootSnapshot?.planningReasons ?? ["weakness_balance"]);
  const rootRecoveryStage = rootSnapshot?.recoveryStage ?? "unaddressed";
  const upstreamSnapshot = pickUpstreamConcept(rootSnapshot, args.playerIntelligence.graph, conceptsByKey);
  const rootPatternBiases = lead?.patternBiases ?? collectPatternBiases(args.playerIntelligence.patterns.patterns, [rootConceptKey, upstreamSnapshot?.conceptKey].filter(Boolean) as string[]);
  const confidenceMiscalibrationCount = args.recentAttempts.filter((attempt) => attempt.confidenceMiscalibration).length;
  const topError = getTopError(byConcept.get(rootConceptKey));
  const diagnosticLead = lead?.diagnosticWeight ?? 0;

  const trainingBlocks: InterventionTrainingBlock[] = [];
  if (upstreamSnapshot && upstreamSnapshot.conceptKey !== rootConceptKey) {
    trainingBlocks.push({
      conceptKey: upstreamSnapshot.conceptKey,
      label: upstreamSnapshot.label,
      reps: rootPlanningReasons.includes("active_intervention") ? 10 : 8,
      role: "repair",
      reason: `Repair the upstream concept feeding the current ${rootConceptLabel.toLowerCase()} misses before the next retest.`,
      planningReasons: dedupeReasons(["weakness_balance", ...getPlanningReasons(upstreamSnapshot)]),
    });
  }

  trainingBlocks.push({
    conceptKey: rootConceptKey,
    label: rootConceptLabel,
    reps: rootPlanningReasons.includes("active_intervention") || rootPlanningReasons.includes("regression_recovery")
      ? 12
      : rootPatternBiases.includes("repair_intensity")
        ? 12
        : upstreamSnapshot
          ? 8
          : 10,
    role: rootRecoveryStage === "recovered" ? "retest" : upstreamSnapshot ? "retest" : "repair",
    reason: buildRootBlockReason(rootSnapshot, rootPlanningReasons, rootPatternBiases, upstreamSnapshot),
    planningReasons: rootPlanningReasons,
  });

  if (confidenceMiscalibrationCount >= 2) {
    trainingBlocks.push({
      conceptKey: rootConceptKey,
      label: `${rootConceptLabel} Calibration Retest`,
      reps: 4,
      role: "calibration",
      reason: "Confidence has drifted away from actual outcomes often enough that calibration should be trained directly.",
      planningReasons: dedupeReasons([...rootPlanningReasons, "weakness_balance"]),
    });
  }

  const adaptiveProfile = args.playerIntelligence.adaptiveProfile ?? createNeutralAdaptiveCoachingProfile(now);
  const adaptiveBlocks = applyAdaptiveInterventionWeighting({
    blocks: trainingBlocks,
    adaptiveProfile,
    rootConceptLabel,
    rootSnapshot,
    confidenceMiscalibrationCount,
    patternBiases: rootPatternBiases,
  });

  const rootLeakDiagnosis = buildRootLeakDiagnosis({
    rootSnapshot,
    rootConceptLabel,
    rootPlanningReasons,
    topError,
    adaptiveProfile,
    diagnosticLead,
    patternBiases: rootPatternBiases,
  });
  const rationale = buildPlanRationale({
    rootSnapshot,
    rootConceptLabel,
    rootPlanningReasons,
    upstreamSnapshot,
    rootLeakDiagnosis,
    adaptiveProfile,
    patternBiases: rootPatternBiases,
  });
  const recommendedSessionTitle = buildRecommendedSessionTitle({
    rootConceptLabel,
    upstreamSnapshot,
    rootPlanningReasons,
    adaptiveProfile,
    patternBiases: rootPatternBiases,
  });
  const nextSessionFocus = buildNextSessionFocus({
    rootConceptLabel,
    rootPlanningReasons,
    rootRecoveryStage,
    upstreamSnapshot,
    adaptiveProfile,
    patternBiases: rootPatternBiases,
  });

  return {
    id: buildPlanId(args.activePool, rootConceptKey, upstreamSnapshot?.conceptKey),
    generatedAt: now.toISOString(),
    activePool: args.activePool,
    rootConceptKey,
    rootConceptLabel,
    upstreamConceptKey: upstreamSnapshot?.conceptKey,
    upstreamConceptLabel: upstreamSnapshot?.label,
    rootLeakDiagnosis,
    rationale,
    recommendedSessionTitle,
    nextSessionFocus,
    targetConcepts: [...new Set(adaptiveBlocks.map((block) => block.conceptKey))],
    planningReasons: rootPlanningReasons,
    recoveryStage: rootRecoveryStage,
    trainingBlocks: adaptiveBlocks,
    totalTargetReps: adaptiveBlocks.reduce((sum, block) => sum + block.reps, 0),
  };
}

export function buildInterventionSessionPlan(args: {
  interventionPlan: InterventionPlan;
  drills: CanonicalDrill[];
  recentAttempts: InterventionPlannerRecentAttempt[];
  srs: SessionGeneratorSrsRow[];
  activePool: WeaknessPool;
  generatedAt?: Date;
  weaknessTargets?: WeaknessTarget[];
  baseNotes?: string[];
}): SessionPlan {
  const now = args.generatedAt ?? new Date();
  const attemptStats = buildAttemptStats(args.recentAttempts);
  const srsMap = new Map(args.srs.map((row) => [row.drill_id, row.due_at]));
  const selectedIds = new Set<string>();
  const drills: SelectedDrill[] = [];
  const plannedBlocks: Array<InterventionTrainingBlock & { plannedReps: number }> = [];
  const notes = [
    ...(args.baseNotes ?? []),
    `Session was prioritized from coaching memory: ${args.interventionPlan.planningReasons.join(", ")}.`,
  ];

  for (const block of args.interventionPlan.trainingBlocks) {
    const candidates = args.drills
      .filter((drill) => matchesInterventionConcept(drill, block.conceptKey))
      .map((drill) => ({
        drill,
        priorAttempts: attemptStats.get(drill.drill_id)?.count ?? 0,
        lastScore: attemptStats.get(drill.drill_id)?.lastScore,
        dueAt: srsMap.get(drill.drill_id),
      }))
      .sort(compareInterventionCandidates);

    let plannedReps = 0;
    for (const candidate of candidates) {
      if (plannedReps >= block.reps) {
        break;
      }
      if (selectedIds.has(candidate.drill.drill_id)) {
        continue;
      }

      selectedIds.add(candidate.drill.drill_id);
      plannedReps += 1;
      const prioritizationReasons = dedupeReasons([
        ...block.planningReasons,
        ...(candidate.priorAttempts === 0 ? ["freshness_mix" as const] : []),
      ]);
      drills.push({
        drill: candidate.drill,
        kind: candidate.priorAttempts > 0 || candidate.dueAt ? "review" : "new",
        reason: candidate.dueAt
          ? "due_review"
          : candidate.priorAttempts > 0
            ? "weakness_review"
            : "weakness_new",
        matchedWeaknessTargets: [`intervention:${block.conceptKey}`],
        metadata: {
          dueAt: candidate.dueAt,
          priorAttempts: candidate.priorAttempts,
          lastScore: candidate.lastScore,
          weaknessPriority: 1,
          interventionConceptKey: block.conceptKey,
          interventionConceptLabel: block.label,
          interventionRole: block.role,
          prioritizationReasons,
        },
      });
    }

    plannedBlocks.push({ ...block, plannedReps });
  }

  const totalPlannedReps = plannedBlocks.reduce((sum, block) => sum + block.plannedReps, 0);
  if (totalPlannedReps < args.interventionPlan.totalTargetReps) {
    notes.push(`Current drill truth supports ${totalPlannedReps} of ${args.interventionPlan.totalTargetReps} planned intervention reps, so the block is truthful but content-limited.`);
  }

  const metadata: SessionPlanMetadata = {
    requestedCount: args.interventionPlan.totalTargetReps,
    selectedCount: drills.length,
    reviewCount: drills.filter((entry) => entry.kind === "review").length,
    newCount: drills.filter((entry) => entry.kind === "new").length,
    dueReviewCount: drills.filter((entry) => entry.reason === "due_review").length,
    weaknessReviewCount: drills.filter((entry) => entry.reason === "weakness_review").length,
    weaknessNewCount: drills.filter((entry) => entry.reason === "weakness_new").length,
    newMaterialFillCount: 0,
    activePool: args.activePool,
    generatedAt: now.toISOString(),
    weaknessTargets: args.weaknessTargets ?? [],
    notes,
    intervention: {
      id: args.interventionPlan.id,
      title: args.interventionPlan.recommendedSessionTitle,
      rootConceptKey: args.interventionPlan.rootConceptKey,
      rootConceptLabel: args.interventionPlan.rootConceptLabel,
      upstreamConceptKey: args.interventionPlan.upstreamConceptKey,
      upstreamConceptLabel: args.interventionPlan.upstreamConceptLabel,
      rootLeakDiagnosis: args.interventionPlan.rootLeakDiagnosis,
      rationale: args.interventionPlan.rationale,
      nextSessionFocus: args.interventionPlan.nextSessionFocus,
      totalTargetReps: args.interventionPlan.totalTargetReps,
      totalPlannedReps,
      planningReasons: args.interventionPlan.planningReasons,
      recoveryStage: args.interventionPlan.recoveryStage,
      trainingBlocks: plannedBlocks,
    },
  };

  return { drills, metadata };
}

function rankConceptCandidates(
  concepts: PlayerConceptSnapshot[],
  byConcept: Map<string, { label: string; count: number; errorCounts: Map<DiagnosticErrorType, number> }>,
  playerPatterns: PlayerIntelligenceSnapshot["patterns"]["patterns"]
): RankedConceptCandidate[] {
  return concepts
    .filter((concept) => concept.status !== "strength" || getPlanningReasons(concept).includes("retention_check"))
    .map((concept) => {
      const group = byConcept.get(concept.conceptKey);
      const diagnosticWeight = [...(group?.errorCounts.entries() ?? [])].reduce(
        (sum, [errorType, count]) => sum + (ERROR_WEIGHTS[errorType] ?? 1) * count,
        0
      );
      const recentMissCount = group?.count ?? 0;
      const patternBiases = collectPatternBiases(playerPatterns, [concept.conceptKey, ...concept.supportingConceptKeys]);
      const score = scoreConceptCandidate(concept, diagnosticWeight, recentMissCount, patternBiases);
      return {
        conceptKey: concept.conceptKey,
        snapshot: concept,
        score,
        diagnosticWeight,
        recentMissCount,
        planningReasons: getPlanningReasons(concept),
        patternBiases,
      };
    })
    .sort((a, b) => b.score - a.score || a.snapshot.label.localeCompare(b.snapshot.label));
}

function scoreConceptCandidate(
  snapshot: PlayerConceptSnapshot,
  diagnosticWeight: number,
  recentMissCount: number,
  patternBiases: PatternInterventionBias[]
): number {
  const planningReasons = getPlanningReasons(snapshot);
  let score = snapshot.trainingUrgency * 20 + diagnosticWeight * 5 + recentMissCount * 3 + snapshot.reviewPressure * 2;

  for (const reason of planningReasons) {
    score += planningReasonWeight(reason) * 10;
  }

  if (snapshot.recoveryStage === "recovered" && !planningReasons.includes("retention_check")) {
    score -= 22;
  }

  if (snapshot.recoveryStage === "regressed") {
    score += 16;
  }

  if (snapshot.recoveryStage === "stabilizing") {
    score += 10;
  }

  for (const bias of patternBiases) {
    score += patternBiasWeight(bias);
  }

  return score;
}

function aggregateDiagnostics(attempts: InterventionPlannerRecentAttempt[]) {
  const groups = new Map<string, { label: string; count: number; errorCounts: Map<DiagnosticErrorType, number> }>();
  for (const attempt of attempts) {
    if (!attempt.diagnosticConceptKey || !attempt.diagnosticErrorType) {
      continue;
    }

    const current = groups.get(attempt.diagnosticConceptKey) ?? {
      label: toTitleCase(attempt.diagnosticConceptKey),
      count: 0,
      errorCounts: new Map<DiagnosticErrorType, number>(),
    };
    current.count += 1;
    current.errorCounts.set(
      attempt.diagnosticErrorType,
      (current.errorCounts.get(attempt.diagnosticErrorType) ?? 0) + 1
    );
    groups.set(attempt.diagnosticConceptKey, current);
  }
  return groups;
}

function getTopError(group: { errorCounts: Map<DiagnosticErrorType, number> } | undefined) {
  return group ? [...group.errorCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : undefined;
}

function pickUpstreamConcept(
  rootSnapshot: PlayerConceptSnapshot | undefined,
  graph: ConceptGraph,
  conceptsByKey: Map<string, PlayerConceptSnapshot>
): PlayerConceptSnapshot | undefined {
  if (!rootSnapshot) {
    return undefined;
  }

  const explicit = rootSnapshot.supportingConceptKeys
    .map((key) => conceptsByKey.get(key))
    .filter((concept): concept is PlayerConceptSnapshot => Boolean(concept))
    .sort((a, b) => b.trainingUrgency - a.trainingUrgency)[0];
  if (explicit) {
    return explicit;
  }

  return graph.edges
    .filter((edge) => edge.type === "supports" && edge.to === rootSnapshot.conceptKey)
    .map((edge) => conceptsByKey.get(edge.from))
    .filter((concept): concept is PlayerConceptSnapshot => Boolean(concept))
    .sort((a, b) => b.trainingUrgency - a.trainingUrgency)[0];
}

function buildAttemptStats(attempts: InterventionPlannerRecentAttempt[]) {
  const stats = new Map<string, { count: number; lastScore: number }>();
  for (const attempt of attempts) {
    const current = stats.get(attempt.drillId);
    if (!current) {
      stats.set(attempt.drillId, { count: 1, lastScore: attempt.score });
      continue;
    }
    current.count += 1;
  }
  return stats;
}

function matchesInterventionConcept(drill: CanonicalDrill, conceptKey: string): boolean {
  const conceptKeys = new Set<string>();
  for (const source of collectDrillConceptSources(drill)) {
    for (const key of mapSignalToConceptKeys(source)) {
      conceptKeys.add(key);
    }
  }
  return conceptKeys.has(conceptKey)
    || drill.tags.includes(`concept:${conceptKey}`)
    || (drill.diagnostic_prompts ?? []).some((prompt) => normalizeConceptKey(prompt.concept) === conceptKey);
}

function compareInterventionCandidates(a: CandidateDrill, b: CandidateDrill): number {
  const dueDiff = compareOptionalDates(a.dueAt, b.dueAt);
  if (dueDiff !== 0) {
    return dueDiff;
  }
  const aScore = a.lastScore ?? Number.POSITIVE_INFINITY;
  const bScore = b.lastScore ?? Number.POSITIVE_INFINITY;
  if (aScore !== bScore) {
    return aScore - bScore;
  }
  if (a.priorAttempts !== b.priorAttempts) {
    return a.priorAttempts - b.priorAttempts;
  }
  return a.drill.drill_id.localeCompare(b.drill.drill_id);
}

function compareOptionalDates(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function buildPlanId(activePool: WeaknessPool, rootConceptKey: string, upstreamConceptKey?: string) {
  return ["plan", activePool, upstreamConceptKey ?? "root", rootConceptKey].join("-");
}

function normalizeConceptKey(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || null;
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function applyAdaptiveInterventionWeighting(args: {
  blocks: InterventionTrainingBlock[];
  adaptiveProfile: PlayerIntelligenceSnapshot["adaptiveProfile"];
  rootConceptLabel: string;
  rootSnapshot?: PlayerConceptSnapshot;
  confidenceMiscalibrationCount: number;
  patternBiases: PatternInterventionBias[];
}): InterventionTrainingBlock[] {
  const blocks = args.blocks.map((block) => ({ ...block, planningReasons: [...block.planningReasons] }));
  const adjustments = args.adaptiveProfile.interventionAdjustments;
  const rootIndex = blocks.findIndex((block) => block.label === args.rootConceptLabel || block.conceptKey === args.rootSnapshot?.conceptKey);
  const rootBlock = rootIndex >= 0 ? blocks[rootIndex] : blocks[blocks.length - 1];
  const repairBlock = blocks.find((block) => block.role === "repair");

  if (adjustments.prioritizeLineReconstruction && repairBlock) {
    repairBlock.reps += 4;
    repairBlock.reason = `${repairBlock.reason} Lead with line reconstruction so the street story is stable before the final action gets retested.`;
  }

  if ((adjustments.prioritizeThresholdRetests || args.patternBiases.includes("threshold_retest")) && rootBlock) {
    rootBlock.reps += 4;
    rootBlock.reason = `${rootBlock.reason} Keep the retest anchored on practical thresholds rather than category labels.`;
  }

  if ((adjustments.prioritizeBlockerNotes || args.patternBiases.includes("blocker_explicitness")) && rootBlock) {
    rootBlock.reason = `${rootBlock.reason} Surface blocker effects explicitly during the review.`;
  }

  if ((adjustments.prioritizeRealPlayReview || args.patternBiases.includes("real_play_transfer")) && rootBlock) {
    rootBlock.reason = `${rootBlock.reason} Tie the reps back to imported hands so transfer improves, not just lab accuracy.`;
  }

  if (adjustments.preferShorterReviewBlocks) {
    for (const block of blocks) {
      block.reps = Math.max(4, block.role === "calibration" ? block.reps : Math.round(block.reps * 0.75));
    }
  }

  if (args.patternBiases.includes("repair_intensity") && rootBlock) {
    rootBlock.reps += 2;
  }

  if (args.patternBiases.includes("review_follow_through")) {
    for (const block of blocks) {
      if (block.role !== "calibration") {
        block.reps += 1;
      }
    }
  }

  if (adjustments.prioritizeConfidenceCalibration && args.confidenceMiscalibrationCount < 2 && rootBlock) {
    blocks.push({
      conceptKey: rootBlock.conceptKey,
      label: `${args.rootConceptLabel} Confidence Check`,
      reps: 4,
      role: "calibration",
      reason: "Confidence is part of the current learner pattern, so the plan should calibrate certainty directly instead of leaving it implicit.",
      planningReasons: dedupeReasons([...rootBlock.planningReasons, "weakness_balance"]),
    });
  }

  return blocks;
}

function patternBiasWeight(bias: PatternInterventionBias): number {
  switch (bias) {
    case "repair_intensity":
      return 9;
    case "upstream_repair":
      return 8;
    case "real_play_transfer":
      return 7;
    case "threshold_retest":
      return 6;
    case "stabilization_check":
      return 5;
    case "review_follow_through":
      return 4;
    case "blocker_explicitness":
      return 4;
  }
}

function buildRootLeakDiagnosis(args: {
  rootSnapshot?: PlayerConceptSnapshot;
  rootConceptLabel: string;
  rootPlanningReasons: SessionPlanningReason[];
  topError?: [DiagnosticErrorType, number];
  adaptiveProfile: PlayerIntelligenceSnapshot["adaptiveProfile"];
  diagnosticLead: number;
  patternBiases: PatternInterventionBias[];
}): string {
  const rootLeakDiagnosisBase = args.rootPlanningReasons.includes("active_intervention")
    ? `${args.rootConceptLabel} already has an active intervention, so the next session should continue the same repair thread.`
    : args.rootPlanningReasons.includes("regression_recovery")
      ? `${args.rootConceptLabel} improved once but has regressed, so it returns to the front of the queue.`
      : args.rootPlanningReasons.includes("recurring_leak")
        ? `${args.rootConceptLabel} keeps recurring across persisted diagnoses, so it is a real leak instead of a one-off miss.`
        : args.topError
          ? `Repeated ${args.topError[0].replace(/_/g, " ")} signals are showing up inside ${args.rootConceptLabel.toLowerCase()}.`
          : args.rootSnapshot?.weaknessRole === "downstream" && args.rootSnapshot.supportingConceptKeys[0]
            ? `${args.rootConceptLabel} is still showing up, but it looks downstream of ${toTitleCase(args.rootSnapshot.supportingConceptKeys[0])}.`
            : `${args.rootConceptLabel} is the clearest live concept to train next.`;

  if (args.patternBiases.includes("real_play_transfer")) {
    return `${rootLeakDiagnosisBase} Drill improvement is not yet transferring cleanly into real play, so the next block should bridge lab reps into imported-hand review.`;
  }

  return args.adaptiveProfile.interventionAdjustments.prioritizeRealPlayReview
    ? `${rootLeakDiagnosisBase} The same family is now showing up in imported hands too, so this is a transfer leak as well as a drill leak.`
    : rootLeakDiagnosisBase;
}

function buildPlanRationale(args: {
  rootSnapshot?: PlayerConceptSnapshot;
  rootConceptLabel: string;
  rootPlanningReasons: SessionPlanningReason[];
  upstreamSnapshot?: PlayerConceptSnapshot;
  rootLeakDiagnosis: string;
  adaptiveProfile: PlayerIntelligenceSnapshot["adaptiveProfile"];
  patternBiases: PatternInterventionBias[];
}): string {
  const planningTrace = args.rootPlanningReasons.map(formatPlanningReason).join(", ").toLowerCase();
  const rationaleBase = args.upstreamSnapshot
    ? `${args.rootLeakDiagnosis} The cleaner intervention is to repair ${args.upstreamSnapshot.label.toLowerCase()} first, then retest ${args.rootConceptLabel.toLowerCase()}.`
    : `${args.rootLeakDiagnosis} The next block should stay narrow enough to repair the core concept instead of spreading volume across unrelated spots.`;
  const patternTrace = describePatternBiases(args.patternBiases);
  return `${rationaleBase} Priority came from ${planningTrace}.${patternTrace ? ` Pattern weighting: ${patternTrace}.` : ""} ${args.adaptiveProfile.coachingEmphasis.interventionBullets[0] ?? ""}`.trim();
}

function buildRecommendedSessionTitle(args: {
  rootConceptLabel: string;
  upstreamSnapshot?: PlayerConceptSnapshot;
  rootPlanningReasons: SessionPlanningReason[];
  adaptiveProfile: PlayerIntelligenceSnapshot["adaptiveProfile"];
  patternBiases: PatternInterventionBias[];
}): string {
  if (args.rootPlanningReasons.includes("regression_recovery")) {
    return `${args.rootConceptLabel} Recovery Block`;
  }
  if (args.rootPlanningReasons.includes("active_intervention")) {
    return `${args.rootConceptLabel} Continuation Block`;
  }
  if (args.patternBiases.includes("real_play_transfer")) {
    return `${args.upstreamSnapshot ? `${args.upstreamSnapshot.label} Lab -> ` : ""}${args.rootConceptLabel} Transfer Block`;
  }

  return args.adaptiveProfile.interventionAdjustments.prioritizeRealPlayReview
    ? `${args.upstreamSnapshot ? `${args.upstreamSnapshot.label} Lab -> ` : ""}${args.rootConceptLabel} Transfer Block`
    : args.upstreamSnapshot
      ? `${args.upstreamSnapshot.label} Lab -> ${args.rootConceptLabel} Retest`
      : `${args.rootConceptLabel} Intervention Block`;
}

function buildNextSessionFocus(args: {
  rootConceptLabel: string;
  rootPlanningReasons: SessionPlanningReason[];
  rootRecoveryStage: ConceptRecoveryStage;
  upstreamSnapshot?: PlayerConceptSnapshot;
  adaptiveProfile: PlayerIntelligenceSnapshot["adaptiveProfile"];
  patternBiases: PatternInterventionBias[];
}): string {
  const nextSessionFocusBase = args.rootPlanningReasons.includes("retention_check")
    ? `Retest ${args.rootConceptLabel} just enough to confirm the recovery is holding.`
    : args.rootPlanningReasons.includes("regression_recovery")
      ? `Re-enter ${args.rootConceptLabel} with repair-first reps until the concept stops slipping.`
      : args.upstreamSnapshot
        ? `${args.upstreamSnapshot.label} first, then ${args.rootConceptLabel} retest.`
        : `Stay with ${args.rootConceptLabel} until the signal stabilizes.`;
  const patternTail = args.patternBiases.includes("real_play_transfer")
    ? "Bridge the concept back into imported hands before you treat the gain as real-play stable."
    : args.patternBiases.includes("stabilization_check")
      ? "Keep a stabilization check in the loop before you move on."
      : "";
  return `${nextSessionFocusBase} ${patternTail} ${args.adaptiveProfile.surfaceSignals.commandCenter}`.trim();
}

function buildRootBlockReason(
  rootSnapshot: PlayerConceptSnapshot | undefined,
  rootPlanningReasons: SessionPlanningReason[],
  patternBiases: PatternInterventionBias[],
  upstreamSnapshot?: PlayerConceptSnapshot
): string {
  if (rootPlanningReasons.includes("active_intervention")) {
    return `Continue the existing intervention thread so the learner gets repetition on the same concept instead of fragmenting the repair.`;
  }
  if (rootPlanningReasons.includes("regression_recovery")) {
    return `This concept regressed after earlier work, so the next block should reopen repair before the leak hardens again.`;
  }
  if (rootPlanningReasons.includes("retention_check")) {
    return `This concept looks recovered, so the next reps should verify that the gain is holding rather than assuming it is permanent.`;
  }
  if (rootPlanningReasons.includes("recurring_leak")) {
    return `Persisted diagnoses keep mapping back here, so the next block should close a recurring leak instead of chasing novelty.`;
  }
  if (patternBiases.includes("real_play_transfer")) {
    return `This concept is improving in drills but not yet transferring into real play, so the next reps should bridge authored work into imported-hand review.`;
  }
  if (patternBiases.includes("upstream_repair") && upstreamSnapshot) {
    return `The visible leak still looks downstream of ${upstreamSnapshot.label.toLowerCase()}, so the next block should repair the upstream concept first and then retest transfer.`;
  }
  if (upstreamSnapshot) {
    return `Retest the visible leak after ${upstreamSnapshot.label.toLowerCase()} gets the first intervention block.`;
  }
  return rootSnapshot?.recoveryStage === "recovered"
    ? `Run a small retention check to keep the recovered concept from quietly slipping.`
    : `Stay with the live leak until the action and reasoning both stabilize.`;
}

function describePatternBiases(patternBiases: PatternInterventionBias[]): string {
  const labels = patternBiases.map((bias) => {
    switch (bias) {
      case "threshold_retest":
        return "threshold retests";
      case "blocker_explicitness":
        return "explicit blocker notes";
      case "upstream_repair":
        return "upstream repair";
      case "real_play_transfer":
        return "real-play transfer review";
      case "repair_intensity":
        return "higher repair intensity";
      case "stabilization_check":
        return "stabilization checks";
      case "review_follow_through":
        return "follow-through review";
    }
  });
  return [...new Set(labels)].join(", ");
}

function getPlanningReasons(snapshot: Pick<PlayerConceptSnapshot, "planningReasons">): SessionPlanningReason[] {
  return snapshot.planningReasons && snapshot.planningReasons.length > 0 ? snapshot.planningReasons : ["weakness_balance"];
}

function dedupeReasons(reasons: SessionPlanningReason[]): SessionPlanningReason[] {
  return [...new Set(reasons)];
}



