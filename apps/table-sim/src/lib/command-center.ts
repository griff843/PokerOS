import {
  buildFallbackCoachResponse,
  buildNextFocusSummary,
  formatPlanningReason,
  type AttemptInsight,
  type InterventionHistoryEntry,
  type InterventionPlan,
  type PlayerDiagnosisHistoryEntry,
  type RealPlayConceptSignal,
  type SessionPlanningReason,
  type WeaknessPool,
} from "@poker-coach/core/browser";
import type { TableSimSessionPlan } from "./session-plan";
import { formatSessionLabel } from "./study-session-ui";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";

export interface CommandCenterRecentAttempt {
  drillId: string;
  nodeId: string;
  title: string;
  score: number;
  correct: boolean;
  ts: string;
  activePool: WeaknessPool | null;
}

export interface CommandCenterSnapshot {
  generatedAt: string;
  recommendedConfig: {
    count: number;
    timed: boolean;
    activePool: WeaknessPool;
  };
  dailyFocus: {
    title: string;
    concept: string;
    nodeId: string;
    rationale: string;
    effort: string;
    mix: string;
    pool: string;
    reasons: string[];
  };
  momentum: {
    cadence: { label: string; detail: string };
    improving?: { label: string; detail: string };
    slipping?: { label: string; detail: string };
    readiness?: { label: string; detail: string };
  };
  priorityLeaks: Array<{
    label: string;
    detail: string;
    emphasis: string;
  }>;
  coachBriefing: {
    headline: string;
    reminder: string;
    recommendation: string;
  };
  interventions: {
    active: Array<{ concept: string; status: string; detail: string }>;
    completed: Array<{ concept: string; status: string; detail: string }>;
  };
  recommendedTrainingBlock: {
    plan: InterventionPlan;
    href: string;
  };
  recentWork: Array<{
    title: string;
    detail: string;
    outcome: string;
    tsLabel: string;
  }>;
}

interface BuildCommandCenterSnapshotArgs {
  plan: TableSimSessionPlan;
  attemptInsights: AttemptInsight[];
  recentAttempts: CommandCenterRecentAttempt[];
  activePool: WeaknessPool;
  count: number;
  interventionPlan: InterventionPlan;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  now?: Date;
}

export function buildCommandCenterSnapshot({
  plan,
  attemptInsights,
  recentAttempts,
  activePool,
  count,
  interventionPlan,
  diagnosisHistory = [],
  interventionHistory = [],
  realPlaySignals,
  now = new Date(),
}: BuildCommandCenterSnapshotArgs): CommandCenterSnapshot {
  const playerIntelligence = buildTableSimPlayerIntelligence({
    drills: plan.drills.map((entry) => entry.drill),
    attemptInsights,
    activePool,
    diagnosisHistory,
    interventionHistory,
    realPlaySignals,
    now,
  });
  const nextFocusSummary = buildNextFocusSummary({
    activePool,
    planMetadata: plan.metadata,
    playerIntelligence,
  });
  const nextFocusCoach = buildFallbackCoachResponse(nextFocusSummary);
  const firstDrill = plan.drills[0]?.drill;
  const leadTarget = plan.metadata.weaknessTargets[0];
  const leadConcept = playerIntelligence.priorities[0];
  const concept = leadConcept?.conceptKey
    ?? (firstDrill ? firstDrill.tags.find((tag) => tag.startsWith("concept:")) ?? `node:${firstDrill.node_id}` : leadTarget?.key ?? "Balanced reinforcement");
  const [improving, slipping] = buildTrendSignals(attemptInsights);
  const adaptive = playerIntelligence.adaptiveProfile;

  return {
    generatedAt: now.toISOString(),
    recommendedConfig: {
      count,
      timed: true,
      activePool,
    },
    dailyFocus: {
      title: interventionPlan.recommendedSessionTitle,
      concept: leadConcept?.label ?? formatSessionLabel(concept),
      nodeId: leadConcept?.relatedDrills[0]?.nodeId ?? firstDrill?.node_id ?? leadTarget?.key ?? "baseline",
      rationale: interventionPlan.rationale,
      effort: `${interventionPlan.totalTargetReps} deliberate reps`,
      mix: `${plan.metadata.reviewCount} review / ${plan.metadata.newCount} new`,
      pool: activePool === "baseline" ? "Baseline" : `Pool ${activePool}`,
      reasons: buildDailyFocusReasons(plan, leadTarget, leadConcept, recentAttempts, adaptive.surfaceSignals.commandCenter),
    },
    momentum: {
      cadence: buildCadenceSignal(recentAttempts),
      improving,
      slipping,
      readiness: buildReadinessSignal(recentAttempts),
    },
    priorityLeaks: buildPriorityLeaks(plan, attemptInsights, playerIntelligence),
    coachBriefing: {
      headline: nextFocusCoach.headline,
      reminder: adaptive.surfaceSignals.commandCenter,
      recommendation: `${interventionPlan.nextSessionFocus}`,
    },
    interventions: buildInterventionSection(interventionHistory, playerIntelligence),
    recommendedTrainingBlock: {
      plan: interventionPlan,
      href: `/app/training/session/${interventionPlan.id}`,
    },
    recentWork: recentAttempts.slice(0, 4).map((attempt) => ({
      title: attempt.title,
      detail: `${attempt.nodeId} · ${attempt.activePool && attempt.activePool !== "baseline" ? `Pool ${attempt.activePool}` : "Baseline"}`,
      outcome: attempt.correct ? `Locked in at ${Math.round(attempt.score * 100)}%` : `Needs review at ${Math.round(attempt.score * 100)}%`,
      tsLabel: formatRecentDate(attempt.ts),
    })),
  };
}

export function buildCadenceSignal(recentAttempts: CommandCenterRecentAttempt[]): { label: string; detail: string } {
  if (recentAttempts.length === 0) {
    return {
      label: "Fresh slate",
      detail: "No stored reps yet, so today's plan starts from a balanced baseline.",
    };
  }

  const window = recentAttempts.slice(0, 6);
  const accuracy = window.filter((attempt) => attempt.correct).length / window.length;

  if (accuracy >= 0.75) {
    return {
      label: "Steady recent form",
      detail: `Your last ${window.length} reps are landing with ${(accuracy * 100).toFixed(0)}% accuracy.`,
    };
  }

  if (accuracy <= 0.45) {
    return {
      label: "Precision slipping",
      detail: `Your last ${window.length} reps dipped to ${(accuracy * 100).toFixed(0)}% accuracy, so review should lead today.`,
    };
  }

  return {
    label: "Mixed but usable",
    detail: `Recent accuracy is ${(accuracy * 100).toFixed(0)}%, so the best move is targeted reinforcement over expansion.`,
  };
}

export function buildReadinessSignal(
  recentAttempts: CommandCenterRecentAttempt[]
): { label: string; detail: string } | undefined {
  if (recentAttempts.length < 3) {
    return undefined;
  }

  const recentWindow = recentAttempts.slice(0, 3);
  const recentAverage = average(recentWindow.map((attempt) => attempt.score));

  if (recentAverage >= 0.75) {
    return {
      label: "Ready to press",
      detail: `Your last ${recentWindow.length} reps averaged ${Math.round(recentAverage * 100)}%, so you can re-enter with confidence and stay on the same thread.`,
    };
  }

  if (recentAverage <= 0.45) {
    return {
      label: "Needs a reset",
      detail: `Your last ${recentWindow.length} reps averaged ${Math.round(recentAverage * 100)}%, so the next block should prioritize clean review over expansion.`,
    };
  }

  return {
    label: "Stable enough to reinforce",
    detail: `Your last ${recentWindow.length} reps averaged ${Math.round(recentAverage * 100)}%, which is usable for another deliberate block on the same concept family.`,
  };
}

function buildTrendSignals(attemptInsights: AttemptInsight[]): Array<{ label: string; detail: string } | undefined> {
  if (attemptInsights.length < 4) {
    return [undefined, undefined];
  }

  const recentWindow = [...attemptInsights].slice(0, 6);
  const previousWindow = [...attemptInsights].slice(6, 12);
  if (previousWindow.length === 0) {
    return [undefined, undefined];
  }

  const deltas = new Map<string, { recentAverage: number; previousAverage: number; delta: number }>();
  const concepts = new Set<string>();
  for (const insight of [...recentWindow, ...previousWindow]) {
    insight.classificationTags
      .filter((tag) => tag.startsWith("concept:"))
      .forEach((tag) => concepts.add(tag));
  }

  for (const concept of concepts) {
    const recentScores = recentWindow.filter((insight) => insight.classificationTags.includes(concept)).map((insight) => insight.score);
    const previousScores = previousWindow.filter((insight) => insight.classificationTags.includes(concept)).map((insight) => insight.score);
    if (recentScores.length === 0 || previousScores.length === 0) {
      continue;
    }

    const recentAverage = average(recentScores);
    const previousAverage = average(previousScores);
    deltas.set(concept, {
      recentAverage,
      previousAverage,
      delta: recentAverage - previousAverage,
    });
  }

  const ranked = [...deltas.entries()].sort((a, b) => b[1].delta - a[1].delta);
  const top = ranked.find(([, value]) => value.delta > 0.05);
  const bottom = [...ranked].reverse().find(([, value]) => value.delta < -0.05);

  return [
    top
      ? {
          label: formatSessionLabel(top[0]),
          detail: `Recent read quality improved from ${Math.round(top[1].previousAverage * 100)}% to ${Math.round(top[1].recentAverage * 100)}%.`,
        }
      : undefined,
    bottom
      ? {
          label: formatSessionLabel(bottom[0]),
          detail: `Recent read quality slipped from ${Math.round(bottom[1].previousAverage * 100)}% to ${Math.round(bottom[1].recentAverage * 100)}%.`,
        }
      : undefined,
  ];
}

function buildDailyFocusReasons(
  plan: TableSimSessionPlan,
  leadTarget: TableSimSessionPlan["metadata"]["weaknessTargets"][number] | undefined,
  leadConcept: ReturnType<typeof buildTableSimPlayerIntelligence>["priorities"][number] | undefined,
  recentAttempts: CommandCenterRecentAttempt[],
  adaptiveSignal: string
): string[] {
  const reasons: string[] = [];
  const planningReasons = plan.metadata.intervention?.planningReasons ?? [];

  if (plan.metadata.dueReviewCount > 0) {
    reasons.push(`${plan.metadata.dueReviewCount} due reviews are already waiting.`);
  }

  for (const reason of planningReasons.slice(0, 3)) {
    reasons.push(describePlanningReason(reason, leadConcept?.label ?? leadTarget?.key ?? "this concept"));
  }

  if (leadConcept) {
    reasons.push(`Recovery stage: ${leadConcept.recoveryStage.replace(/_/g, " ")}.`);
  }

  if (recentAttempts.length > 0) {
    reasons.push("Recent work is available, so you can continue without a reset.");
  }

  reasons.push(adaptiveSignal);
  return [...new Set(reasons)].slice(0, 4);
}

function buildPriorityLeaks(
  plan: TableSimSessionPlan,
  attemptInsights: AttemptInsight[],
  playerIntelligence: ReturnType<typeof buildTableSimPlayerIntelligence>
): CommandCenterSnapshot["priorityLeaks"] {
  const leaks: CommandCenterSnapshot["priorityLeaks"] = [];

  if (plan.metadata.dueReviewCount > 0) {
    leaks.push({
      label: "Due review pressure",
      detail: `${plan.metadata.dueReviewCount} drills are already due, so delay will weaken retention before you add more new material.`,
      emphasis: "Review now",
    });
  }

  for (const concept of playerIntelligence.priorities.slice(0, 2)) {
    leaks.push({
      label: concept.label,
      detail: `${concept.evidence[0] ?? concept.summary} Recovery stage: ${concept.recoveryStage.replace(/_/g, " ")}.`,
      emphasis: concept.planningReasons[0] ? formatPlanningReason(concept.planningReasons[0]) : concept.scope === "pool" ? `Pool ${concept.recommendedPool}` : "Weak concept",
    });
  }

  const primaryTendency = playerIntelligence.adaptiveProfile.tendencies[0];
  if (primaryTendency) {
    leaks.push({
      label: "Coaching emphasis",
      detail: primaryTendency.summary,
      emphasis: "Learner pattern",
    });
  }

  if (leaks.length <= 1) {
    for (const target of plan.metadata.weaknessTargets) {
      leaks.push({
        label: formatSessionLabel(target.key),
        detail: describeLeak(target),
        emphasis: target.scope === "pool" && target.pool ? `Pool ${target.pool}` : target.type === "rule_tag" ? "Recurring miss" : "Weak concept",
      });
    }
  }

  const topMissedTag = findTopMissedTag(attemptInsights);
  if (topMissedTag) {
    leaks.push({
      label: formatSessionLabel(topMissedTag.tag),
      detail: `${topMissedTag.count} recent attempts missed this rule tag, so it is still showing up as a repeat mistake rather than a one-off miss.`,
      emphasis: "Repeated mistake",
    });
  }

  return dedupePriorityLeaks(leaks).slice(0, 3);
}

function buildInterventionSection(
  interventionHistory: InterventionHistoryEntry[],
  playerIntelligence: ReturnType<typeof buildTableSimPlayerIntelligence>
): CommandCenterSnapshot["interventions"] {
  const conceptsByKey = new Map(playerIntelligence.concepts.map((concept) => [concept.conceptKey, concept]));
  const active = interventionHistory
    .filter((entry) => entry.status === "assigned" || entry.status === "in_progress" || entry.status === "stabilizing")
    .slice(0, 3)
    .map((entry) => {
      const concept = conceptsByKey.get(entry.conceptKey);
      return {
        concept: formatSessionLabel(entry.conceptKey),
        status: formatSessionLabel(entry.status),
        detail: `${concept ? `Recovery stage: ${concept.recoveryStage.replace(/_/g, " ")}. ` : ""}Source: ${entry.source.replace(/_/g, " ")}. ${concept?.planningReasons[0] ? `Lead reason: ${formatPlanningReason(concept.planningReasons[0]).toLowerCase()}.` : "This concept still has an active coaching block attached."}`.trim(),
      };
    });
  const completed = interventionHistory
    .filter((entry) => entry.status === "completed" || entry.status === "regressed")
    .slice(0, 3)
    .map((entry) => {
      const concept = conceptsByKey.get(entry.conceptKey);
      return {
        concept: formatSessionLabel(entry.conceptKey),
        status: entry.status === "regressed"
          ? "Regressed"
          : entry.improved === true
            ? "Recovered"
            : entry.improved === false
              ? "Needs more work"
              : "Completed",
        detail: entry.preScore !== null && entry.preScore !== undefined && entry.postScore !== null && entry.postScore !== undefined
          ? `Score moved from ${Math.round(entry.preScore * 100)}% to ${Math.round(entry.postScore * 100)}%. ${concept ? `Recovery stage: ${concept.recoveryStage.replace(/_/g, " ")}.` : ""}`.trim()
          : concept
            ? `Latest derived recovery stage: ${concept.recoveryStage.replace(/_/g, " ")}.`
            : "This intervention has a closed status in coaching memory.",
      };
    });

  return { active, completed };
}

function describePlanningReason(reason: SessionPlanningReason, conceptLabel: string): string {
  switch (reason) {
    case "active_intervention":
      return `${formatSessionLabel(conceptLabel)} already has an active intervention, so the plan keeps that thread alive.`;
    case "recurring_leak":
      return `${formatSessionLabel(conceptLabel)} is recurring across persisted diagnoses, so it stays prioritized.`;
    case "regression_recovery":
      return `${formatSessionLabel(conceptLabel)} regressed after earlier work, so it moves back up the queue.`;
    case "weakness_balance":
      return "Weakness balancing still supports this as the clearest next concept.";
    case "retention_check":
      return `${formatSessionLabel(conceptLabel)} is in retention-check territory, so the plan verifies the gain instead of overtraining it.`;
    case "freshness_mix":
      return "The planner kept some freshness in the drill mix so the block does not collapse into one stale pattern.";
  }
}

function describeLeak(target: TableSimSessionPlan["metadata"]["weaknessTargets"][number]): string {
  if (target.type === "rule_tag") {
    return target.scope === "pool" && target.pool
      ? `Repeated misses are still showing up in Pool ${target.pool}.`
      : "This rule is still costing points often enough to stay at the top of the queue.";
  }

  if (target.type === "node") {
    return target.scope === "pool" && target.pool
      ? `This node is still underperforming in Pool ${target.pool}.`
      : "This node is still producing the weakest recent outcomes.";
  }

  return target.scope === "pool" && target.pool
    ? `This concept is still unstable in Pool ${target.pool}.`
    : "This concept is still the cleanest live weakness signal.";
}

function findTopMissedTag(attemptInsights: AttemptInsight[]): { tag: string; count: number } | undefined {
  const counts = new Map<string, number>();
  for (const insight of attemptInsights.slice(0, 12)) {
    for (const missedTag of insight.missedTags) {
      counts.set(missedTag, (counts.get(missedTag) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0];
  return top && top[1] >= 2 ? { tag: top[0], count: top[1] } : undefined;
}

function dedupePriorityLeaks(
  leaks: CommandCenterSnapshot["priorityLeaks"]
): CommandCenterSnapshot["priorityLeaks"] {
  const seen = new Set<string>();
  return leaks.filter((leak) => {
    const key = leak.label.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatRecentDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

