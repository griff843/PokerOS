import type { CanonicalDrill } from "./schemas";
import type { InterventionSessionPlanMetadata } from "./intervention-planner";
import {
  analyzeWeaknessAnalytics,
  buildAttemptInsights,
  buildWeaknessPriorityByDrill,
  selectWeaknessTargetsForPool,
  type AttemptInsight,
  type WeaknessPool,
  type WeaknessTarget,
} from "./weakness-analytics";

export interface SessionGeneratorAttemptRow {
  attempt_id: string;
  drill_id: string;
  ts: string;
  user_answer_json: string;
  correct_bool: number;
  score: number;
  elapsed_ms: number;
  missed_tags_json: string;
  active_pool?: "baseline" | "A" | "B" | "C" | null;
}

export interface SessionGeneratorSrsRow {
  drill_id: string;
  due_at: string;
  interval_days: number;
  ease: number;
  repetitions: number;
  last_score: number;
}

export type SessionSelectionKind = "review" | "new";
export type SessionSelectionReason =
  | "due_review"
  | "weakness_review"
  | "weakness_new"
  | "new_material_fill";

export interface SessionRequest {
  count: number;
  reviewRatio?: number;
  activePool?: WeaknessPool;
  weaknessThreshold?: number;
  minAttemptsForWeakness?: number;
}

export interface GeneratorInputs {
  drills: CanonicalDrill[];
  attempts: SessionGeneratorAttemptRow[];
  srs: SessionGeneratorSrsRow[];
  now?: Date;
}

export type { WeaknessTarget } from "./weakness-analytics";

export interface SelectedDrill {
  drill: CanonicalDrill;
  kind: SessionSelectionKind;
  reason: SessionSelectionReason;
  matchedWeaknessTargets: string[];
  metadata: {
    dueAt?: string;
    priorAttempts: number;
    lastScore?: number;
    weaknessPriority?: number;
    interventionConceptKey?: string;
    interventionConceptLabel?: string;
    interventionRole?: "repair" | "retest" | "calibration";
  };
}

export interface SessionPlanMetadata {
  requestedCount: number;
  selectedCount: number;
  reviewCount: number;
  newCount: number;
  dueReviewCount: number;
  weaknessReviewCount: number;
  weaknessNewCount: number;
  newMaterialFillCount: number;
  activePool: WeaknessPool;
  generatedAt: string;
  weaknessTargets: WeaknessTarget[];
  notes: string[];
  intervention?: InterventionSessionPlanMetadata;
}

export interface SessionPlan {
  drills: SelectedDrill[];
  metadata: SessionPlanMetadata;
}

interface AttemptStats {
  count: number;
  averageScore: number;
  lastScore?: number;
}

interface CandidateEntry {
  drill: CanonicalDrill;
  priorAttempts: number;
  lastScore?: number;
  weaknessPriority: number;
  matchedWeaknessTargets: string[];
  dueAt?: string;
}

const DEFAULT_REVIEW_RATIO = 0.6;
const DEFAULT_WEAKNESS_THRESHOLD = 0.5;
const DEFAULT_MIN_ATTEMPTS_FOR_WEAKNESS = 2;

export function generateSessionPlan(
  request: SessionRequest,
  inputs: GeneratorInputs
): SessionPlan {
  const now = inputs.now ?? new Date();
  const requestedCount = Math.max(1, request.count);
  const activePool = request.activePool ?? "baseline";
  const weaknessThreshold = request.weaknessThreshold ?? DEFAULT_WEAKNESS_THRESHOLD;
  const minAttemptsForWeakness = request.minAttemptsForWeakness ?? DEFAULT_MIN_ATTEMPTS_FOR_WEAKNESS;

  const drillMap = new Map(inputs.drills.map((drill) => [drill.drill_id, drill]));
  const srsMap = new Map(inputs.srs.map((row) => [row.drill_id, row]));
  const attemptInsights = buildAttemptInsights(inputs.attempts, drillMap);
  const attemptStatsByDrill = buildAttemptStatsByDrill(attemptInsights);
  const weaknessAnalytics = analyzeWeaknessAnalytics({
    attempts: inputs.attempts,
    drillMap,
    weaknessThreshold,
    minAttempts: minAttemptsForWeakness,
    now,
  });
  const weaknessTargets = selectWeaknessTargetsForPool(weaknessAnalytics, activePool);
  const hasPoolSpecificWeaknessTargets = weaknessAnalytics.poolTargets[activePool].length > 0;
  const weaknessPriorityByDrill = buildWeaknessPriorityByDrill(inputs.drills, weaknessTargets, activePool);

  const selectedIds = new Set<string>();
  const planDrills: SelectedDrill[] = [];
  const notes: string[] = [];

  const dueCandidates = inputs.drills
    .filter((drill) => {
      const srs = srsMap.get(drill.drill_id);
      return srs ? new Date(srs.due_at).getTime() <= now.getTime() : false;
    })
    .map((drill) => createCandidate(drill, attemptStatsByDrill, weaknessPriorityByDrill, srsMap.get(drill.drill_id)?.due_at))
    .sort(compareReviewCandidates);

  const targetReviewCount = Math.min(
    requestedCount,
    Math.max(dueCandidates.length, Math.round(requestedCount * (request.reviewRatio ?? DEFAULT_REVIEW_RATIO)))
  );

  selectIntoPlan(planDrills, dueCandidates, selectedIds, requestedCount, "review", "due_review");

  if (planDrills.length < targetReviewCount) {
    const reinforcementCandidates = inputs.drills
      .filter((drill) => {
        if (selectedIds.has(drill.drill_id)) return false;
        const stats = attemptStatsByDrill.get(drill.drill_id);
        return Boolean(stats && stats.count > 0);
      })
      .map((drill) => createCandidate(drill, attemptStatsByDrill, weaknessPriorityByDrill))
      .filter((candidate) => candidate.weaknessPriority > 0)
      .sort(compareReviewCandidates);

    const before = planDrills.length;
    selectIntoPlan(
      planDrills,
      reinforcementCandidates,
      selectedIds,
      targetReviewCount,
      "review",
      "weakness_review"
    );
    if (planDrills.length > before) {
      notes.push(
        activePool === "baseline"
          ? "Filled remaining review slots with weakness-targeted reinforcement drills."
          : `Filled remaining review slots with ${activePool} pool-aware weakness reinforcement before overall fallback.`
      );
    }
  }

  if (planDrills.length < requestedCount) {
    const newCandidates = inputs.drills
      .filter((drill) => !selectedIds.has(drill.drill_id) && !srsMap.has(drill.drill_id))
      .map((drill) => createCandidate(drill, attemptStatsByDrill, weaknessPriorityByDrill))
      .sort(compareNewCandidates);

    const weaknessNewCandidates = newCandidates.filter((candidate) => candidate.weaknessPriority > 0);
    const before = planDrills.length;
    selectIntoPlan(
      planDrills,
      weaknessNewCandidates,
      selectedIds,
      requestedCount,
      "new",
      "weakness_new"
    );
    if (planDrills.length > before) {
      notes.push(
        activePool === "baseline"
          ? "Added new drills that match current weakness targets."
          : `Added new drills that match ${activePool} pool-aware weakness targets before overall fallback.`
      );
    }

    if (planDrills.length < requestedCount) {
      const remainingNewCandidates = newCandidates.filter((candidate) => !selectedIds.has(candidate.drill.drill_id));
      selectIntoPlan(
        planDrills,
        remainingNewCandidates,
        selectedIds,
        requestedCount,
        "new",
        "new_material_fill"
      );
    }
  }

  if (planDrills.length < requestedCount) {
    notes.push("Available content could not fully satisfy the requested session size.");
  }
  if (activePool !== "baseline" && !hasPoolSpecificWeaknessTargets && weaknessAnalytics.overallTargets.length > 0) {
    notes.push(`No strong ${activePool} pool-specific weakness signals yet; using overall weaknesses as fallback.`);
  }
  if (weaknessTargets.length === 0) {
    notes.push(
      activePool === "baseline"
        ? "Not enough attempt history to derive strong weakness targets yet."
        : `Not enough ${activePool} pool-specific history yet; session generator fell back to overall weakness signals.`
    );
  }

  const metadata: SessionPlanMetadata = {
    requestedCount,
    selectedCount: planDrills.length,
    reviewCount: planDrills.filter((entry) => entry.kind === "review").length,
    newCount: planDrills.filter((entry) => entry.kind === "new").length,
    dueReviewCount: planDrills.filter((entry) => entry.reason === "due_review").length,
    weaknessReviewCount: planDrills.filter((entry) => entry.reason === "weakness_review").length,
    weaknessNewCount: planDrills.filter((entry) => entry.reason === "weakness_new").length,
    newMaterialFillCount: planDrills.filter((entry) => entry.reason === "new_material_fill").length,
    activePool,
    generatedAt: now.toISOString(),
    weaknessTargets,
    notes,
  };

  return { drills: planDrills, metadata };
}

function buildAttemptStatsByDrill(insights: AttemptInsight[]): Map<string, AttemptStats> {
  const byDrill = new Map<string, { count: number; scoreSum: number; lastScore?: number }>();
  for (const insight of insights) {
    const current = byDrill.get(insight.drillId) ?? { count: 0, scoreSum: 0, lastScore: undefined };
    current.count += 1;
    current.scoreSum += insight.score;
    if (current.lastScore === undefined) {
      current.lastScore = insight.score;
    }
    byDrill.set(insight.drillId, current);
  }

  return new Map(
    [...byDrill.entries()].map(([drillId, stats]) => [
      drillId,
      {
        count: stats.count,
        averageScore: stats.scoreSum / stats.count,
        lastScore: stats.lastScore,
      },
    ])
  );
}

function createCandidate(
  drill: CanonicalDrill,
  attemptStatsByDrill: Map<string, AttemptStats>,
  weaknessPriorityByDrill: Map<string, { priority: number; keys: string[] }>,
  dueAt?: string
): CandidateEntry {
  const attemptStats = attemptStatsByDrill.get(drill.drill_id);
  const weakness = weaknessPriorityByDrill.get(drill.drill_id) ?? { priority: 0, keys: [] };
  return {
    drill,
    priorAttempts: attemptStats?.count ?? 0,
    lastScore: attemptStats?.lastScore,
    weaknessPriority: weakness.priority,
    matchedWeaknessTargets: weakness.keys,
    dueAt,
  };
}

function selectIntoPlan(
  planDrills: SelectedDrill[],
  candidates: CandidateEntry[],
  selectedIds: Set<string>,
  limit: number,
  kind: SessionSelectionKind,
  reason: SessionSelectionReason
): void {
  for (const candidate of candidates) {
    if (planDrills.length >= limit) break;
    if (selectedIds.has(candidate.drill.drill_id)) continue;

    selectedIds.add(candidate.drill.drill_id);
    planDrills.push({
      drill: candidate.drill,
      kind,
      reason,
      matchedWeaknessTargets: candidate.matchedWeaknessTargets,
      metadata: {
        dueAt: candidate.dueAt,
        priorAttempts: candidate.priorAttempts,
        lastScore: candidate.lastScore,
        weaknessPriority: candidate.weaknessPriority > 0 ? candidate.weaknessPriority : undefined,
      },
    });
  }
}

function compareReviewCandidates(a: CandidateEntry, b: CandidateEntry): number {
  const dueDiff = compareOptionalDates(a.dueAt, b.dueAt);
  if (dueDiff !== 0) return dueDiff;
  if (b.weaknessPriority !== a.weaknessPriority) {
    return b.weaknessPriority - a.weaknessPriority;
  }
  const aLast = a.lastScore ?? Number.POSITIVE_INFINITY;
  const bLast = b.lastScore ?? Number.POSITIVE_INFINITY;
  if (aLast !== bLast) return aLast - bLast;
  return a.drill.drill_id.localeCompare(b.drill.drill_id);
}

function compareNewCandidates(a: CandidateEntry, b: CandidateEntry): number {
  if (b.weaknessPriority !== a.weaknessPriority) {
    return b.weaknessPriority - a.weaknessPriority;
  }
  if (a.drill.difficulty !== b.drill.difficulty) {
    return a.drill.difficulty - b.drill.difficulty;
  }
  return a.drill.drill_id.localeCompare(b.drill.drill_id);
}

function compareOptionalDates(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}
