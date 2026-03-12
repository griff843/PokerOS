import {
  buildFallbackCoachResponse,
  buildNextFocusSummary,
  buildWeaknessSummary,
  matchesWeaknessTarget,
  selectWeaknessTargetsForPool,
  type AttemptInsight,
  type CanonicalDrill,
  type RealPlayConceptSignal,
  type WeaknessPool,
  type WeaknessTarget,
} from "@poker-coach/core/browser";
import { analyzeWeaknessAnalyticsFromInsights } from "../../../../packages/core/src/weakness-analytics";
import { formatSessionLabel } from "./study-session-ui";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";

const DEFAULT_WEAKNESS_THRESHOLD = 0.5;
const DEFAULT_MIN_ATTEMPTS = 2;

export interface WeaknessExplorerSnapshot {
  generatedAt: string;
  header: {
    headline: string;
    summary: string;
    orientation: string;
    activePoolLabel: string;
  };
  priorityWeaknesses: Array<{
    key: string;
    label: string;
    typeLabel: string;
    urgency: string;
    recurrence: string;
    whyItMatters: string;
    recommendedAction: string;
    recommendedPool: WeaknessPool;
    dueReviewCount: number;
    trend?: {
      label: string;
      detail: string;
      direction: "improving" | "worsening" | "stable";
    };
    dimensions: string[];
    relatedDrills: Array<{
      drillId: string;
      title: string;
      nodeId: string;
    }>;
  }>;
  movementSignals: Array<{
    label: string;
    detail: string;
    tone: "good" | "warning" | "neutral";
  }>;
  trainingActions: Array<{
    label: string;
    detail: string;
    recommendedPool: WeaknessPool;
    weaknessKey: string;
  }>;
  deepReviewGroups: Array<{
    title: string;
    detail: string;
    recommendedPool: WeaknessPool;
    drills: Array<{
      drillId: string;
      title: string;
      nodeId: string;
    }>;
  }>;
}

export function buildWeaknessExplorerSnapshot(args: {
  drills: CanonicalDrill[];
  attemptInsights: AttemptInsight[];
  srs: Array<{ drill_id: string; due_at: string }>;
  activePool: WeaknessPool;
  realPlaySignals?: RealPlayConceptSignal[];
  now?: Date;
}): WeaknessExplorerSnapshot {
  const now = args.now ?? new Date();
  const report = analyzeWeaknessAnalyticsFromInsights({
    attemptInsights: args.attemptInsights,
    weaknessThreshold: DEFAULT_WEAKNESS_THRESHOLD,
    minAttempts: DEFAULT_MIN_ATTEMPTS,
    now,
  });
  const playerIntelligence = buildTableSimPlayerIntelligence({
    drills: args.drills,
    attemptInsights: args.attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    realPlaySignals: args.realPlaySignals,
    now,
  });
  const weaknessSummary = buildWeaknessSummary({ report, activePool: args.activePool });
  const weaknessCoach = buildFallbackCoachResponse(weaknessSummary);
  const topTargets = selectWeaknessTargetsForPool(report, args.activePool, 5);
  const nextFocusSummary = buildNextFocusSummary({
    activePool: args.activePool,
    weaknessReport: report,
    playerIntelligence,
  });
  const weaknessCards = playerIntelligence.priorities.slice(0, 5).map((concept) => buildWeaknessCard(concept, topTargets, args.drills, args.srs, args.activePool, now, playerIntelligence.adaptiveProfile.surfaceSignals.weaknessExplorer));

  return {
    generatedAt: report.generatedAt,
    header: {
      headline: weaknessCoach.headline,
      summary: buildHeaderSummary(weaknessCards, args.activePool, playerIntelligence.adaptiveProfile.surfaceSignals.weaknessExplorer),
      orientation: "Use this screen to see which leaks are recurring, which are structural, and which need a different coaching emphasis for this learner.",
      activePoolLabel: args.activePool === "baseline" ? "Baseline" : `Pool ${args.activePool}`,
    },
    priorityWeaknesses: weaknessCards,
    movementSignals: buildMovementSignals(weaknessCards),
    trainingActions: buildTrainingActions(weaknessCards, nextFocusSummary, playerIntelligence.adaptiveProfile.surfaceSignals.weaknessExplorer),
    deepReviewGroups: weaknessCards.slice(0, 3).map((card) => ({
      title: card.label,
      detail: card.relatedDrills.length > 0
        ? `These related drills are the cleanest way to inspect how ${card.label.toLowerCase()} is showing up in the current map.`
        : `No direct drill matches are ready yet, so the next best move is another focused block in ${card.recommendedPool === "baseline" ? "baseline" : `Pool ${card.recommendedPool}`}.`,
      recommendedPool: card.recommendedPool,
      drills: card.relatedDrills,
    })),
  };
}

function buildWeaknessCard(
  concept: ReturnType<typeof buildTableSimPlayerIntelligence>["priorities"][number],
  fallbackTargets: WeaknessTarget[],
  drills: CanonicalDrill[],
  srs: Array<{ drill_id: string; due_at: string }>,
  activePool: WeaknessPool,
  now: Date,
  adaptiveSignal: string
): WeaknessExplorerSnapshot["priorityWeaknesses"][number] {
  const fallbackTarget = fallbackTargets.find((target) => formatSessionLabel(target.key) === concept.label);
  const relatedDrills = concept.relatedDrills.length > 0
    ? concept.relatedDrills
    : drills
        .filter((drill) => fallbackTarget ? matchesWeaknessTarget(drill, fallbackTarget, fallbackTarget.scope === "pool" && fallbackTarget.pool ? fallbackTarget.pool : activePool) : false)
        .slice(0, 3)
        .map((drill) => ({
          drillId: drill.drill_id,
          title: drill.title,
          nodeId: drill.node_id,
        }));
  const dueReviewCount = srs.filter((row) => new Date(row.due_at) <= now && relatedDrills.some((drill) => drill.drillId === row.drill_id)).length;

  return {
    key: `${concept.conceptKey}:${concept.scope}:${concept.recommendedPool}`,
    label: concept.label,
    typeLabel: concept.weaknessRole === "upstream" ? "Structural leak" : concept.weaknessRole === "downstream" ? "Downstream symptom" : "Weak concept",
    urgency: buildUrgencyLabel(concept, dueReviewCount),
    recurrence: concept.recurrenceCount > 0
      ? `${concept.recurrenceCount} repeat misses in scope`
      : `${concept.sampleSize} reps tracked${concept.averageScore !== undefined ? ` · ${Math.round(concept.averageScore * 100)}% average` : ""}`,
    whyItMatters: buildWhyItMatters(concept, dueReviewCount, adaptiveSignal),
    recommendedAction: buildRecommendedAction(concept, adaptiveSignal),
    recommendedPool: concept.recommendedPool,
    dueReviewCount,
    trend: concept.trend ? {
      label: concept.trend.direction === "worsening" ? "Worsening" : concept.trend.direction === "improving" ? "Improving" : "Stable",
      detail: concept.trend.detail,
      direction: concept.trend.direction,
    } : undefined,
    dimensions: [...concept.evidence.slice(0, 2), ...concept.inferredFrom.slice(0, 1)].slice(0, 3),
    relatedDrills,
  };
}

function buildHeaderSummary(
  cards: WeaknessExplorerSnapshot["priorityWeaknesses"],
  activePool: WeaknessPool,
  adaptiveSignal: string
): string {
  const top = cards[0];
  if (!top) {
    return activePool === "baseline"
      ? "There is not enough stored history yet to rank strong long-horizon weaknesses cleanly."
      : `There is not enough ${activePool} history yet to separate strong pool-specific leaks from the rest.`;
  }

  return `Your biggest current leak is ${top.label.toLowerCase()}, and it is staying near the top because ${top.whyItMatters.toLowerCase()} ${adaptiveSignal}`;
}

function buildMovementSignals(
  cards: WeaknessExplorerSnapshot["priorityWeaknesses"]
): WeaknessExplorerSnapshot["movementSignals"] {
  const worsening = cards.find((card) => card.trend?.direction === "worsening");
  const improving = cards.find((card) => card.trend?.direction === "improving");
  const stable = cards.find((card) => card.trend?.direction === "stable");
  const signals: WeaknessExplorerSnapshot["movementSignals"] = [];

  if (worsening?.trend) {
    signals.push({
      label: `Worsening: ${worsening.label}`,
      detail: worsening.trend.detail,
      tone: "warning",
    });
  }

  if (improving?.trend) {
    signals.push({
      label: `Improving: ${improving.label}`,
      detail: improving.trend.detail,
      tone: "good",
    });
  }

  if (stable?.trend) {
    signals.push({
      label: `Stable: ${stable.label}`,
      detail: stable.trend.detail,
      tone: "neutral",
    });
  }

  if (signals.length === 0) {
    signals.push({
      label: "Trend picture still forming",
      detail: "There is enough evidence to rank current weaknesses, but not enough windowed history yet to call strong movement directions honestly.",
      tone: "neutral",
    });
  }

  return signals;
}

function buildTrainingActions(
  cards: WeaknessExplorerSnapshot["priorityWeaknesses"],
  nextFocusSummary: ReturnType<typeof buildNextFocusSummary>,
  adaptiveSignal: string
): WeaknessExplorerSnapshot["trainingActions"] {
  const actions = cards.slice(0, 3).map((card) => ({
    label: `Train ${card.label}`,
    detail: `${card.recommendedAction} ${adaptiveSignal}`.trim(),
    recommendedPool: card.recommendedPool,
    weaknessKey: card.key,
  }));

  if (actions.length === 0 && nextFocusSummary.recommendations[0]) {
    actions.push({
      label: nextFocusSummary.recommendations[0].label,
      detail: `${nextFocusSummary.recommendations[0].rationale} ${adaptiveSignal}`.trim(),
      recommendedPool: nextFocusSummary.recommendations[0].recommendedPool,
      weaknessKey: "fallback",
    });
  }

  return actions;
}

function buildUrgencyLabel(
  concept: ReturnType<typeof buildTableSimPlayerIntelligence>["priorities"][number],
  dueReviewCount: number
): string {
  if (dueReviewCount > 0) {
    return "Urgent now";
  }

  if (concept.trend?.direction === "worsening") {
    return "Rising";
  }

  if (concept.trainingUrgency >= 0.7) {
    return "High pressure";
  }

  return "Active leak";
}

function buildWhyItMatters(
  concept: ReturnType<typeof buildTableSimPlayerIntelligence>["priorities"][number],
  dueReviewCount: number,
  adaptiveSignal: string
): string {
  const base = concept.weaknessRole === "downstream" && concept.inferredFrom[0]
    ? `${concept.evidence[0]} ${concept.inferredFrom[0]}`
    : concept.evidence[0] ?? `${concept.label} is still underperforming across enough reps to stay near the top of the queue.`;

  if (dueReviewCount > 0) {
    return `${base} ${dueReviewCount} related review reps are already due. ${adaptiveSignal}`.trim();
  }

  return `${base} ${adaptiveSignal}`.trim();
}

function buildRecommendedAction(
  concept: ReturnType<typeof buildTableSimPlayerIntelligence>["priorities"][number],
  adaptiveSignal: string
): string {
  const poolLabel = concept.recommendedPool === "baseline" ? "baseline" : `Pool ${concept.recommendedPool}`;

  if (concept.weaknessRole === "downstream" && concept.supportingConceptKeys[0]) {
    return `Run another ${poolLabel} block, but frame it around ${formatSessionLabel(concept.supportingConceptKeys[0]).toLowerCase()} first because ${concept.label.toLowerCase()} may be downstream. ${adaptiveSignal}`.trim();
  }

  if (concept.weaknessRole === "upstream") {
    return `Start another ${poolLabel} weakness block because repairing ${concept.label.toLowerCase()} should clean up multiple related leaks, not just one surface symptom. ${adaptiveSignal}`.trim();
  }

  return `Start another ${poolLabel} weakness block so the generator can keep reinforcing ${concept.label.toLowerCase()} while the signal is still active. ${adaptiveSignal}`.trim();
}
