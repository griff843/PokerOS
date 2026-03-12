import type { SessionPlan, SessionPlanMetadata, SelectedDrill } from "./session-generator";
import type { WeaknessAnalyticsReport, WeaknessPool, WeaknessTarget } from "./weakness-analytics";
import type { PlayerIntelligenceSnapshot } from "./player-intelligence";

export type StudySummaryKind = "planned_session" | "completed_session" | "weakness_focus" | "next_focus";
export type StudySummaryTone = "supportive" | "neutral";
export type SummaryHighlightKind = "info" | "strength" | "warning" | "next_step";

export interface SummaryHighlight {
  kind: SummaryHighlightKind;
  label: string;
  value?: string;
  detail?: string;
}

export interface SummarySection {
  id: string;
  title: string;
  bullets: string[];
  highlights: SummaryHighlight[];
}

export interface LlmSummaryPayload {
  kind: StudySummaryKind;
  activePool: WeaknessPool;
  tone: StudySummaryTone;
  headline: string;
  sections: Array<{
    title: string;
    bullets: string[];
  }>;
  highlights: SummaryHighlight[];
}

export interface PlannedSessionSummary {
  kind: "planned_session";
  activePool: WeaknessPool;
  headline: string;
  sections: SummarySection[];
  highlights: SummaryHighlight[];
  llmPayload: LlmSummaryPayload;
}

export interface CompletedSessionAttemptInput {
  drillId: string;
  nodeId: string;
  title?: string;
  selectionKind: "review" | "new";
  selectionReason: "due_review" | "weakness_review" | "weakness_new" | "new_material_fill";
  matchedWeaknessTargets: string[];
  activePool?: WeaknessPool;
  score: number;
  correct: boolean;
  missedTags: string[];
  matchedTags: string[];
}

export interface CompletedSessionSummary {
  kind: "completed_session";
  activePool: WeaknessPool;
  headline: string;
  sections: SummarySection[];
  highlights: SummaryHighlight[];
  metrics: {
    totalAttempts: number;
    accuracy: number;
    averageScore: number;
    reviewAccuracy?: number;
    newAccuracy?: number;
  };
  llmPayload: LlmSummaryPayload;
}

export interface WeaknessSummary {
  kind: "weakness_focus";
  activePool: WeaknessPool;
  headline: string;
  sections: SummarySection[];
  highlights: SummaryHighlight[];
  primaryTargets: WeaknessTarget[];
  llmPayload: LlmSummaryPayload;
}

export interface NextFocusRecommendation {
  label: string;
  rationale: string;
  emphasis: "review" | "expand" | "pool_focus" | "stabilize";
  targetKeys: string[];
  recommendedPool: WeaknessPool;
}

export interface NextFocusSummary {
  kind: "next_focus";
  activePool: WeaknessPool;
  headline: string;
  sections: SummarySection[];
  highlights: SummaryHighlight[];
  recommendations: NextFocusRecommendation[];
  llmPayload: LlmSummaryPayload;
}

export function buildPlannedSessionSummary(plan: Pick<SessionPlan, "drills" | "metadata">): PlannedSessionSummary {
  const { metadata, drills } = plan;
  const reviewReasons = drills.filter((drill) => drill.kind === "review").map((drill) => drill.reason);
  const targetedCount = drills.filter((drill) => drill.matchedWeaknessTargets.length > 0).length;
  const poolSpecific = metadata.weaknessTargets.filter((target) => target.scope === "pool").length;

  const sections: SummarySection[] = [
    {
      id: "rationale",
      title: "Why This Session Was Built",
      bullets: [
        `This plan balances ${metadata.reviewCount} review drills and ${metadata.newCount} new drills across ${metadata.selectedCount} total spots.`,
        metadata.dueReviewCount > 0
          ? `${metadata.dueReviewCount} drills were pulled in because they were due for review.`
          : "No due-review pressure was present, so the session leaned on weakness targeting and new material.",
        targetedCount > 0
          ? `${targetedCount} selected drills directly match current weakness targets.`
          : "This session is mostly covering general reinforcement and fresh material because weakness evidence is still limited.",
      ],
      highlights: [
        { kind: "info", label: "Pool", value: metadata.activePool },
        { kind: "info", label: "Review/New", value: `${metadata.reviewCount}/${metadata.newCount}` },
      ],
    },
  ];

  if (metadata.weaknessTargets.length > 0) {
    sections.push({
      id: "targets",
      title: "Weakness Focus",
      bullets: metadata.weaknessTargets.slice(0, 4).map((target) =>
        target.scope === "pool" && target.pool
          ? `${target.key} is a ${target.pool}-specific weakness target.`
          : `${target.key} is showing up as an overall weakness target.`
      ),
      highlights: [
        {
          kind: poolSpecific > 0 ? "warning" : "info",
          label: "Pool-Specific Targets",
          value: String(poolSpecific),
          detail: poolSpecific > 0 ? "Pool-segmented weaknesses influenced the plan." : "Plan relied on overall weakness signals.",
        },
      ],
    });
  }

  if (metadata.notes.length > 0 || reviewReasons.length > 0) {
    sections.push({
      id: "selection-notes",
      title: "Selection Notes",
      bullets: [...metadata.notes.slice(0, 3)],
      highlights: [
        { kind: "info", label: "Review Reasons", value: compactReasons(reviewReasons) },
      ],
    });
  }

  const headline = metadata.activePool === "baseline"
    ? `Planned a ${metadata.reviewCount}/${metadata.newCount} review-to-new session around your current overall weaknesses.`
    : `Planned a ${metadata.activePool}-focused session with review priority and exploit-aware weakness targeting.`;

  return {
    kind: "planned_session",
    activePool: metadata.activePool,
    headline,
    sections,
    highlights: sections.flatMap((section) => section.highlights).slice(0, 6),
    llmPayload: buildLlmPayload("planned_session", metadata.activePool, headline, sections),
  };
}

export function buildCompletedSessionSummary(args: {
  metadata?: SessionPlanMetadata | null;
  attempts: CompletedSessionAttemptInput[];
  activePool?: WeaknessPool | null;
}): CompletedSessionSummary {
  const activePool = args.activePool ?? args.metadata?.activePool ?? "baseline";
  const totalAttempts = args.attempts.length;
  const accuracy = totalAttempts > 0 ? ratio(args.attempts.filter((attempt) => attempt.correct).length, totalAttempts) : 0;
  const averageScore = totalAttempts > 0 ? round(args.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts) : 0;
  const reviewAttempts = args.attempts.filter((attempt) => attempt.selectionKind === "review");
  const newAttempts = args.attempts.filter((attempt) => attempt.selectionKind === "new");
  const reviewAccuracy = reviewAttempts.length > 0 ? ratio(reviewAttempts.filter((attempt) => attempt.correct).length, reviewAttempts.length) : undefined;
  const newAccuracy = newAttempts.length > 0 ? ratio(newAttempts.filter((attempt) => attempt.correct).length, newAttempts.length) : undefined;
  const strongestTag = topCount(flatten(args.attempts.map((attempt) => attempt.matchedTags)));
  const weakestTag = topCount(flatten(args.attempts.map((attempt) => attempt.missedTags)));
  const weakestNode = topCount(args.attempts.filter((attempt) => !attempt.correct).map((attempt) => attempt.nodeId));
  const poolSpecificMisses = args.attempts.filter((attempt) => attempt.activePool === activePool && attempt.missedTags.length > 0).length;

  const sections: SummarySection[] = [
    {
      id: "performance",
      title: "Performance Snapshot",
      bullets: totalAttempts > 0
        ? [
            `You completed ${totalAttempts} drills with ${(accuracy * 100).toFixed(0)}% accuracy and an average score of ${(averageScore * 100).toFixed(0)}%.`,
            reviewAccuracy !== undefined
              ? `Review accuracy was ${(reviewAccuracy * 100).toFixed(0)}%.`
              : "There were no review attempts to compare yet.",
            newAccuracy !== undefined
              ? `New-drill accuracy was ${(newAccuracy * 100).toFixed(0)}%.`
              : "There were no new drills to compare yet.",
          ]
        : ["No completed attempts yet, so this summary is based on limited data."],
      highlights: [
        { kind: accuracy >= 0.7 ? "strength" : "warning", label: "Accuracy", value: `${(accuracy * 100).toFixed(0)}%` },
        { kind: "info", label: "Pool", value: activePool },
      ],
    },
  ];

  sections.push({
    id: "patterns",
    title: "What Stood Out",
    bullets: [
      strongestTag ? `Your cleanest recurring pattern was ${strongestTag.key}.` : "No strong pattern stands out yet.",
      weakestTag ? `The most common missed rule tag was ${weakestTag.key}.` : "There were no repeated missed rule tags this session.",
      weakestNode ? `The weakest node this session was ${weakestNode.key}.` : "No single node stood out as especially weak in this session.",
    ],
    highlights: [
      strongestTag ? { kind: "strength", label: "Strongest Tag", value: strongestTag.key } : { kind: "info", label: "Strongest Tag", value: "Not enough data" },
      weakestTag ? { kind: "warning", label: "Most Missed Tag", value: weakestTag.key } : { kind: "info", label: "Most Missed Tag", value: "None" },
    ],
  });

  if (activePool !== "baseline") {
    sections.push({
      id: "pool-observation",
      title: "Pool Observation",
      bullets: [
        poolSpecificMisses > 0
          ? `${poolSpecificMisses} attempts in this ${activePool} session still missed key exploit tags.`
          : `This ${activePool} session did not show repeated pool-specific tag misses.`,
        `Pool context stayed at ${activePool}, so these results are usable for exploit-focused follow-up.`,
      ],
      highlights: [
        { kind: poolSpecificMisses > 0 ? "warning" : "info", label: "Pool-Specific Misses", value: String(poolSpecificMisses) },
      ],
    });
  }

  const headline = totalAttempts === 0
    ? `No completed session data yet for ${activePool}.`
    : activePool === "baseline"
      ? `Completed a baseline session with ${(accuracy * 100).toFixed(0)}% accuracy and clear next-study signals.`
      : `Completed a ${activePool}-focused session with ${(accuracy * 100).toFixed(0)}% accuracy and exploitable leak signals.`;

  return {
    kind: "completed_session",
    activePool,
    headline,
    sections,
    highlights: sections.flatMap((section) => section.highlights).slice(0, 6),
    metrics: {
      totalAttempts,
      accuracy,
      averageScore,
      reviewAccuracy,
      newAccuracy,
    },
    llmPayload: buildLlmPayload("completed_session", activePool, headline, sections),
  };
}

export function buildWeaknessSummary(args: {
  report: WeaknessAnalyticsReport;
  activePool?: WeaknessPool | null;
}): WeaknessSummary {
  const activePool = args.activePool ?? "baseline";
  const poolTargets = args.report.poolTargets[activePool];
  const primaryTargets = activePool === "baseline"
    ? args.report.overallTargets.slice(0, 4)
    : [...poolTargets, ...args.report.overallTargets.filter((target) => !poolTargets.some((poolTarget) => sameTarget(poolTarget, target)))].slice(0, 4);

  const sections: SummarySection[] = [
    {
      id: "overall-weakness",
      title: "Overall Weakness Focus",
      bullets: args.report.overallTargets.length > 0
        ? args.report.overallTargets.slice(0, 4).map((target) => describeWeaknessTarget(target))
        : ["Overall weakness data is still too limited to rank strong targets."],
      highlights: [
        { kind: "info", label: "Overall Targets", value: String(args.report.overallTargets.length) },
      ],
    },
  ];

  sections.push({
    id: "pool-weakness",
    title: activePool === "baseline" ? "Baseline Weakness Focus" : `${activePool} Pool Weakness Focus`,
    bullets: activePool === "baseline"
      ? ["Baseline sessions rely on overall weakness signals unless baseline-specific evidence accumulates."]
      : poolTargets.length > 0
        ? poolTargets.slice(0, 4).map((target) => describeWeaknessTarget(target))
        : [`No strong ${activePool}-specific weakness signals yet, so overall weaknesses remain the best guide.`],
    highlights: [
      { kind: poolTargets.length > 0 ? "warning" : "info", label: "Pool Targets", value: String(poolTargets.length) },
    ],
  });

  const headline = activePool === "baseline"
    ? "Current weakness picture is driven by overall performance trends."
    : poolTargets.length > 0
      ? `${activePool} pool-specific weaknesses are now identifiable and ready for exploit-focused study.`
      : `${activePool} pool-specific weakness data is still sparse, so overall weaknesses remain the lead signal.`;

  return {
    kind: "weakness_focus",
    activePool,
    headline,
    sections,
    highlights: sections.flatMap((section) => section.highlights).slice(0, 6),
    primaryTargets,
    llmPayload: buildLlmPayload("weakness_focus", activePool, headline, sections),
  };
}

export function buildNextFocusSummary(args: {
  activePool?: WeaknessPool | null;
  completedSummary?: CompletedSessionSummary;
  weaknessReport?: WeaknessAnalyticsReport;
  planMetadata?: SessionPlanMetadata | null;
  playerIntelligence?: PlayerIntelligenceSnapshot | null;
}): NextFocusSummary {
  const activePool = args.activePool ?? args.completedSummary?.activePool ?? args.planMetadata?.activePool ?? "baseline";
  const weaknessSummary = args.weaknessReport ? buildWeaknessSummary({ report: args.weaknessReport, activePool }) : null;
  const topTargets = weaknessSummary?.primaryTargets ?? args.planMetadata?.weaknessTargets.slice(0, 3) ?? [];
  const accuracy = args.completedSummary?.metrics.accuracy;

  const recommendations: NextFocusRecommendation[] = args.playerIntelligence
    ? buildRecommendationsFromIntelligence(args.playerIntelligence)
    : [];

  if (recommendations.length === 0 && topTargets.length > 0) {
    recommendations.push({
      label: topTargets[0].scope === "pool" && topTargets[0].pool
        ? `Stay in Pool ${topTargets[0].pool}`
        : "Reinforce current weaknesses",
      rationale: topTargets[0].scope === "pool" && topTargets[0].pool
        ? `Your strongest live weakness signal is pool-specific, so keeping the same pool context should sharpen exploit adjustments.`
        : `Your strongest signal is still an overall weakness, so repetition and review should come before broader expansion.`,
      emphasis: topTargets[0].scope === "pool" ? "pool_focus" : "review",
      targetKeys: topTargets.slice(0, 3).map((target) => target.key),
      recommendedPool: topTargets[0].scope === "pool" && topTargets[0].pool ? topTargets[0].pool : activePool,
    });
  }

  if (accuracy !== undefined) {
    recommendations.push(
      accuracy < 0.6
        ? {
            label: "Lean into review",
            rationale: "Current session accuracy is still low enough that reinforcing known concepts should come before pushing into more new material.",
            emphasis: "review",
            targetKeys: topTargets.slice(0, 2).map((target) => target.key),
            recommendedPool: activePool,
          }
        : {
            label: "Expand selectively",
            rationale: "Performance was stable enough to keep some review while adding adjacent new material in the same concept family.",
            emphasis: "expand",
            targetKeys: topTargets.slice(0, 2).map((target) => target.key),
            recommendedPool: activePool,
          }
    );
  }

  if (recommendations.length === 0) {
    recommendations.push({
      label: "Build more data",
      rationale: "There is not enough plan or performance data yet, so the best next step is another balanced session to gather stronger signals.",
      emphasis: "stabilize",
      targetKeys: [],
      recommendedPool: activePool,
    });
  }

  const sections: SummarySection[] = [
    {
      id: "next-focus",
      title: "Recommended Next Focus",
      bullets: recommendations.map((recommendation) => `${recommendation.label}: ${recommendation.rationale}`),
      highlights: recommendations.slice(0, 2).map((recommendation) => ({
        kind: "next_step" as const,
        label: recommendation.label,
        value: recommendation.recommendedPool,
        detail: recommendation.targetKeys.join(", ") || undefined,
      })),
    },
  ];

  const headline = recommendations[0]
    ? `Next best move: ${recommendations[0].label.toLowerCase()}.`
    : "Next study direction is still forming.";

  return {
    kind: "next_focus",
    activePool,
    headline,
    sections,
    highlights: sections.flatMap((section) => section.highlights),
    recommendations,
    llmPayload: buildLlmPayload("next_focus", activePool, headline, sections),
  };
}

function buildRecommendationsFromIntelligence(playerIntelligence: PlayerIntelligenceSnapshot): NextFocusRecommendation[] {
  return playerIntelligence.recommendations.map((recommendation) => ({
    label: recommendation.label,
    rationale: recommendation.rationale,
    emphasis: recommendation.emphasis,
    targetKeys: [recommendation.conceptKey],
    recommendedPool: recommendation.recommendedPool,
  }));
}
function buildLlmPayload(
  kind: StudySummaryKind,
  activePool: WeaknessPool,
  headline: string,
  sections: SummarySection[]
): LlmSummaryPayload {
  return {
    kind,
    activePool,
    tone: "supportive",
    headline,
    sections: sections.map((section) => ({ title: section.title, bullets: section.bullets })),
    highlights: sections.flatMap((section) => section.highlights).slice(0, 8),
  };
}

function compactReasons(reasons: Array<SelectedDrill["reason"]>): string {
  if (reasons.length === 0) return "None";
  return [...new Set(reasons)].map((reason) => reason.replace(/_/g, " ")).join(", ");
}

function topCount(values: string[]): { key: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted[0] ? { key: sorted[0][0], count: sorted[0][1] } : null;
}

function flatten<T>(values: T[][]): T[] {
  return values.flat();
}

function sameTarget(a: WeaknessTarget, b: WeaknessTarget): boolean {
  return a.type === b.type && a.key === b.key;
}

function describeWeaknessTarget(target: WeaknessTarget): string {
  if (target.type === "rule_tag") {
    return target.scope === "pool" && target.pool
      ? `${target.key} is being missed too often in Pool ${target.pool}.`
      : `${target.key} is one of the most frequently missed rule tags overall.`;
  }

  if (target.type === "node") {
    return target.scope === "pool" && target.pool
      ? `${target.key} is underperforming specifically in Pool ${target.pool}.`
      : `${target.key} is underperforming across recent sessions.`;
  }

  return target.scope === "pool" && target.pool
    ? `${target.key} is showing up as a concept leak in Pool ${target.pool}.`
    : `${target.key} is showing up as a concept leak overall.`;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? round(numerator / denominator) : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}







