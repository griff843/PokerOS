import type { ConceptGraph } from "./concept-graph";
import { collectDrillConceptSources, mapSignalToConceptKeys } from "./concept-graph";
import type { DiagnosticErrorType } from "./schemas";
import type { PlayerConceptSnapshot, PlayerIntelligenceSnapshot } from "./player-intelligence";
import { createNeutralAdaptiveCoachingProfile } from "./adaptive-coaching";
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
  trainingBlocks: Array<InterventionTrainingBlock & { plannedReps: number }>;
}

interface CandidateDrill {
  drill: CanonicalDrill;
  priorAttempts: number;
  lastScore?: number;
  dueAt?: string;
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

  const ranked = [...byConcept.entries()]
    .map(([conceptKey, group]) => {
      const snapshot = conceptsByKey.get(conceptKey);
      const diagnosticWeight = [...group.errorCounts.entries()].reduce(
        (sum, [errorType, count]) => sum + (ERROR_WEIGHTS[errorType] ?? 1) * count,
        0
      );
      const score = diagnosticWeight + (snapshot?.trainingUrgency ?? 0) * 4 + group.count * 0.35;
      return { conceptKey, group, snapshot, score };
    })
    .sort((a, b) => b.score - a.score || a.conceptKey.localeCompare(b.conceptKey));

  const lead = ranked[0];
  const fallback = args.playerIntelligence.priorities[0] ?? args.playerIntelligence.concepts[0];
  const rootSnapshot = lead?.snapshot ?? fallback;
  const rootConceptKey = rootSnapshot?.conceptKey ?? lead?.conceptKey ?? "balanced_reinforcement";
  const rootConceptLabel = rootSnapshot?.label ?? lead?.group.label ?? toTitleCase(rootConceptKey);
  const upstreamSnapshot = pickUpstreamConcept(rootSnapshot, args.playerIntelligence.graph, conceptsByKey);
  const confidenceMiscalibrationCount = args.recentAttempts.filter((attempt) => attempt.confidenceMiscalibration).length;
  const topError = lead ? [...lead.group.errorCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : undefined;

  const trainingBlocks: InterventionTrainingBlock[] = [];
  if (upstreamSnapshot && upstreamSnapshot.conceptKey !== rootConceptKey) {
    trainingBlocks.push({
      conceptKey: upstreamSnapshot.conceptKey,
      label: upstreamSnapshot.label,
      reps: 12,
      role: "repair",
      reason: `Repair the upstream concept feeding the current ${rootConceptLabel.toLowerCase()} misses.`,
    });
  }

  trainingBlocks.push({
    conceptKey: rootConceptKey,
    label: rootConceptLabel,
    reps: upstreamSnapshot ? 8 : 12,
    role: upstreamSnapshot ? "retest" : "repair",
    reason: upstreamSnapshot
      ? `Retest the visible leak after ${upstreamSnapshot.label.toLowerCase()} gets the first intervention block.`
      : `Stay with the live leak until the action and reasoning both stabilize.`,
  });

  if (confidenceMiscalibrationCount >= 2) {
    trainingBlocks.push({
      conceptKey: rootConceptKey,
      label: `${rootConceptLabel} Calibration Retest`,
      reps: 4,
      role: "calibration",
      reason: "Confidence has drifted away from the actual outcome often enough that calibration should be trained directly.",
    });
  }

  const adaptiveProfile = args.playerIntelligence.adaptiveProfile ?? createNeutralAdaptiveCoachingProfile(now);
  const adaptiveBlocks = applyAdaptiveInterventionWeighting({
    blocks: trainingBlocks,
    adaptiveProfile,
    rootConceptLabel,
    rootSnapshot,
    confidenceMiscalibrationCount,
  });

  const rootLeakDiagnosisBase = lead && topError
    ? `Repeated ${topError[0].replace(/_/g, " ")} signals are showing up inside ${rootConceptLabel.toLowerCase()}.`
    : rootSnapshot?.weaknessRole === "downstream" && rootSnapshot.supportingConceptKeys[0]
      ? `${rootConceptLabel} is still showing up, but it looks downstream of ${toTitleCase(rootSnapshot.supportingConceptKeys[0])}.`
      : `${rootConceptLabel} is the clearest live leak to train next.`;

  const rootLeakDiagnosis = adaptiveProfile.interventionAdjustments.prioritizeRealPlayReview
    ? `${rootLeakDiagnosisBase} The same family is now showing up in imported hands too, so this is a transfer leak as well as a drill leak.`
    : rootLeakDiagnosisBase;

  const rationaleBase = upstreamSnapshot
    ? `${rootLeakDiagnosis} The cleaner intervention is to repair ${upstreamSnapshot.label.toLowerCase()} first, then retest ${rootConceptLabel.toLowerCase()}.`
    : `${rootLeakDiagnosis} The next block should stay narrow enough to repair the core concept instead of spreading volume across unrelated spots.`;
  const rationale = `${rationaleBase} ${adaptiveProfile.coachingEmphasis.interventionBullets[0] ?? ""}`.trim();

  const recommendedSessionTitle = adaptiveProfile.interventionAdjustments.prioritizeRealPlayReview
    ? `${upstreamSnapshot ? `${upstreamSnapshot.label} Lab -> ` : ""}${rootConceptLabel} Transfer Block`
    : upstreamSnapshot
      ? `${upstreamSnapshot.label} Lab -> ${rootConceptLabel} Retest`
      : `${rootConceptLabel} Intervention Block`;

  const nextSessionFocusBase = upstreamSnapshot
    ? `${upstreamSnapshot.label} first, then ${rootConceptLabel} retest.`
    : `Stay with ${rootConceptLabel} until the signal stabilizes.`;
  const nextSessionFocus = `${nextSessionFocusBase} ${adaptiveProfile.surfaceSignals.commandCenter}`.trim();

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
  const notes = [...(args.baseNotes ?? []), "Session was built from a diagnostic intervention plan instead of the default weakness mix."];

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
      trainingBlocks: plannedBlocks,
    },
  };

  return { drills, metadata };
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
  if (b.priorAttempts !== a.priorAttempts) {
    return b.priorAttempts - a.priorAttempts;
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
}): InterventionTrainingBlock[] {
  const blocks = args.blocks.map((block) => ({ ...block }));
  const adjustments = args.adaptiveProfile.interventionAdjustments;
  const rootIndex = blocks.findIndex((block) => block.label === args.rootConceptLabel || block.conceptKey === args.rootSnapshot?.conceptKey);
  const rootBlock = rootIndex >= 0 ? blocks[rootIndex] : blocks[blocks.length - 1];
  const repairBlock = blocks.find((block) => block.role === "repair");

  if (adjustments.prioritizeLineReconstruction && repairBlock) {
    repairBlock.reps += 4;
    repairBlock.reason = `${repairBlock.reason} Lead with line reconstruction so the street story is stable before the final action gets retested.`;
  }

  if (adjustments.prioritizeThresholdRetests && rootBlock) {
    rootBlock.reps += 4;
    rootBlock.reason = `${rootBlock.reason} Keep the retest anchored on practical thresholds rather than category labels.`;
  }

  if (adjustments.prioritizeBlockerNotes && rootBlock) {
    rootBlock.reason = `${rootBlock.reason} Surface blocker effects explicitly during the review.`;
  }

  if (adjustments.prioritizeRealPlayReview && rootBlock) {
    rootBlock.reason = `${rootBlock.reason} Tie the reps back to imported hands so transfer improves, not just lab accuracy.`;
  }

  if (adjustments.preferShorterReviewBlocks) {
    for (const block of blocks) {
      block.reps = Math.max(4, block.role === "calibration" ? block.reps : Math.round(block.reps * 0.75));
    }
  }

  if (adjustments.prioritizeConfidenceCalibration && args.confidenceMiscalibrationCount < 2 && rootBlock) {
    blocks.push({
      conceptKey: rootBlock.conceptKey,
      label: `${args.rootConceptLabel} Confidence Check`,
      reps: 4,
      role: "calibration",
      reason: "Confidence is part of the current learner pattern, so the plan should calibrate certainty directly instead of leaving it implicit.",
    });
  }

  return blocks;
}



