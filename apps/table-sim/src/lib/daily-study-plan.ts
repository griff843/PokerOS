import type { PlayerIntelligenceSnapshot } from "@poker-coach/core/browser";

export type DailyPlanState = "ready" | "sparse_history" | "no_history";
export type DailySessionLength = 20 | 45 | 90;

export const DAILY_SESSION_LENGTHS: readonly DailySessionLength[] = [20, 45, 90] as const;

export type DailyPlanBlockKind =
  | "focus_concept"
  | "secondary_concept"
  | "execute_intervention"
  | "review_real_hands"
  | "retention_check"
  | "inspect_replay_drift";

export interface DailyPlanBlock {
  kind: DailyPlanBlockKind;
  title: string;
  estimatedMinutes: number;
  reason: string;
  conceptKey: string | null;
  conceptLabel: string | null;
  destination: string | null;
  priority: number;
}

export interface DailyStudyPlan {
  sessionLength: DailySessionLength;
  planSummary: string;
  whyThisPlan: string;
  blocks: DailyPlanBlock[];
  urgencySignals: string[];
  expectedOutcome: string;
  totalEstimatedMinutes: number;
}

export interface DailyStudyPlanBundle {
  state: DailyPlanState;
  generatedAt: string;
  availableSessionLengths: readonly DailySessionLength[];
  defaultSessionLength: DailySessionLength;
  plan20: DailyStudyPlan;
  plan45: DailyStudyPlan;
  plan90: DailyStudyPlan;
  urgencySignals: string[];
  primaryConceptKey: string | null;
  primaryConceptLabel: string | null;
}

export interface DailyStudyPlanInput {
  playerIntelligence: PlayerIntelligenceSnapshot;
  totalAttempts: number;
  overdueRetentionConceptKeys: string[];
  dueRetentionConceptKeys: string[];
  importedHandCount: number;
  activeInterventionConceptKey: string | null;
  activeInterventionConceptLabel: string | null;
  now?: Date;
}

function derivePlanState(input: DailyStudyPlanInput): DailyPlanState {
  const conceptCount = input.playerIntelligence.concepts.length;
  if (input.totalAttempts === 0 || conceptCount === 0) {
    return "no_history";
  }
  if (conceptCount < 3 || input.totalAttempts < 10) {
    return "sparse_history";
  }
  return "ready";
}

function buildCandidateBlocks(
  input: DailyStudyPlanInput,
  state: DailyPlanState,
): DailyPlanBlock[] {
  if (state === "no_history") {
    return [
      {
        kind: "focus_concept",
        title: "Start Your First Session",
        estimatedMinutes: 20,
        reason: "Complete your first drill session to build a coaching baseline.",
        conceptKey: null,
        conceptLabel: null,
        destination: "/app/session",
        priority: 10,
      },
    ];
  }

  if (state === "sparse_history") {
    const topRec = input.playerIntelligence.recommendations[0];
    const blocks: DailyPlanBlock[] = [
      {
        kind: "focus_concept",
        title: topRec ? `Drill: ${topRec.label}` : "Continue Drilling",
        estimatedMinutes: 15,
        reason: topRec
          ? `${topRec.label} is your highest-priority concept. Keep building evidence.`
          : "Continue drilling to generate enough data for personalized coaching.",
        conceptKey: topRec?.conceptKey ?? null,
        conceptLabel: topRec?.label ?? null,
        destination: "/app/session",
        priority: 10,
      },
    ];

    if (input.overdueRetentionConceptKeys.length > 0) {
      const key = input.overdueRetentionConceptKeys[0];
      const concept = input.playerIntelligence.concepts.find((c) => c.conceptKey === key);
      blocks.push({
        kind: "retention_check",
        title: "Retention Check",
        estimatedMinutes: 10,
        reason: "A retention check is overdue. Run a short verification session.",
        conceptKey: key,
        conceptLabel: concept?.label ?? key,
        destination: "/app/session",
        priority: 8,
      });
    }

    return blocks.sort((a, b) => b.priority - a.priority);
  }

  // ready state — full candidate set
  const blocks: DailyPlanBlock[] = [];
  const conceptMap = new Map(input.playerIntelligence.concepts.map((c) => [c.conceptKey, c]));
  const recommendations = input.playerIntelligence.recommendations;

  // Active intervention block (highest priority)
  if (input.activeInterventionConceptKey) {
    const label = input.activeInterventionConceptLabel ?? input.activeInterventionConceptKey;
    blocks.push({
      kind: "execute_intervention",
      title: `Execute Intervention: ${label}`,
      estimatedMinutes: 15,
      reason:
        "You have an active intervention in progress. Running intervention reps is your most impactful daily activity.",
      conceptKey: input.activeInterventionConceptKey,
      conceptLabel: label,
      destination: `/app/concepts/${encodeURIComponent(input.activeInterventionConceptKey)}/execution`,
      priority: 10,
    });
  }

  // Overdue retention check (second highest priority)
  if (input.overdueRetentionConceptKeys.length > 0) {
    const key = input.overdueRetentionConceptKeys[0];
    const concept = conceptMap.get(key);
    blocks.push({
      kind: "retention_check",
      title: `Retention Check: ${concept?.label ?? key}`,
      estimatedMinutes: 10,
      reason:
        "This retention check is overdue. Delayed validation reduces your ability to track real progress.",
      conceptKey: key,
      conceptLabel: concept?.label ?? key,
      destination: "/app/session",
      priority: 9,
    });
  }

  // Primary focus concept
  const primaryRec = recommendations[0];
  if (primaryRec) {
    const basePriority = input.activeInterventionConceptKey ? 7 : 9;
    blocks.push({
      kind: "focus_concept",
      title: `Focus Concept: ${primaryRec.label}`,
      estimatedMinutes: 15,
      reason: `${primaryRec.label} is your top-priority weakness. ${primaryRec.rationale}`,
      conceptKey: primaryRec.conceptKey,
      conceptLabel: primaryRec.label,
      destination: `/app/concepts/${encodeURIComponent(primaryRec.conceptKey)}`,
      priority: basePriority,
    });
  }

  // Due retention check (not already overdue)
  const dueKey = input.dueRetentionConceptKeys.find(
    (key) => !input.overdueRetentionConceptKeys.includes(key),
  );
  if (dueKey) {
    const concept = conceptMap.get(dueKey);
    blocks.push({
      kind: "retention_check",
      title: `Retention Check: ${concept?.label ?? dueKey}`,
      estimatedMinutes: 10,
      reason: "A retention check is due. Confirm your recent gains are holding.",
      conceptKey: dueKey,
      conceptLabel: concept?.label ?? dueKey,
      destination: "/app/session",
      priority: 7,
    });
  }

  // Real hands review
  if (input.importedHandCount > 0) {
    const handWord = input.importedHandCount === 1 ? "hand" : "hands";
    blocks.push({
      kind: "review_real_hands",
      title: "Review Real Hands",
      estimatedMinutes: 15,
      reason: `You have ${input.importedHandCount} imported ${handWord} available. Real play review closes the gap between drills and the table.`,
      conceptKey: null,
      conceptLabel: null,
      destination: "/app/hands",
      priority: 6,
    });
  }

  // Secondary concept
  const secondaryRec = recommendations[1];
  if (secondaryRec) {
    blocks.push({
      kind: "secondary_concept",
      title: `Secondary Concept: ${secondaryRec.label}`,
      estimatedMinutes: 10,
      reason: `${secondaryRec.label} is your second-priority weakness. Adding breadth alongside depth work reinforces your overall game.`,
      conceptKey: secondaryRec.conceptKey,
      conceptLabel: secondaryRec.label,
      destination: `/app/concepts/${encodeURIComponent(secondaryRec.conceptKey)}`,
      priority: 5,
    });
  }

  // Replay drift inspection for top recurring leak (if different from primary/secondary)
  const recurringLeakKey = input.playerIntelligence.memory.recurringLeakConcepts[0];
  if (
    recurringLeakKey &&
    recurringLeakKey !== primaryRec?.conceptKey &&
    recurringLeakKey !== secondaryRec?.conceptKey
  ) {
    const concept = conceptMap.get(recurringLeakKey);
    blocks.push({
      kind: "inspect_replay_drift",
      title: `Inspect Replay: ${concept?.label ?? recurringLeakKey}`,
      estimatedMinutes: 10,
      reason:
        "This concept has recurred across multiple sessions. The replay inspector can reveal why the pattern persists.",
      conceptKey: recurringLeakKey,
      conceptLabel: concept?.label ?? recurringLeakKey,
      destination: `/app/concepts/${encodeURIComponent(recurringLeakKey)}/replay`,
      priority: 4,
    });
  }

  return blocks.sort((a, b) => b.priority - a.priority);
}

function selectBlocksForBudget(
  candidates: DailyPlanBlock[],
  budgetMinutes: DailySessionLength,
): DailyPlanBlock[] {
  const selected: DailyPlanBlock[] = [];
  let remaining = budgetMinutes;

  for (const block of candidates) {
    if (block.estimatedMinutes <= remaining) {
      selected.push(block);
      remaining -= block.estimatedMinutes;
    }
    if (remaining < 5) break;
  }

  // Always include at least 1 block
  if (selected.length === 0 && candidates.length > 0) {
    selected.push(candidates[0]);
  }

  return selected;
}

function buildUrgencySignals(input: DailyStudyPlanInput, state: DailyPlanState): string[] {
  if (state === "no_history") return [];

  if (state === "sparse_history") {
    return ["Limited history — continue drilling to enable full coaching."];
  }

  const signals: string[] = [];

  if (input.overdueRetentionConceptKeys.length > 0) {
    const n = input.overdueRetentionConceptKeys.length;
    signals.push(`${n} retention check${n > 1 ? "s" : ""} overdue`);
  }
  if (input.dueRetentionConceptKeys.length > 0) {
    const n = input.dueRetentionConceptKeys.length;
    signals.push(`${n} retention check${n > 1 ? "s" : ""} due`);
  }
  if (input.activeInterventionConceptKey) {
    const label = input.activeInterventionConceptLabel ?? input.activeInterventionConceptKey;
    signals.push(`Active intervention: ${label}`);
  }
  const leakCount = input.playerIntelligence.memory.recurringLeakConcepts.length;
  if (leakCount > 0) {
    signals.push(`${leakCount} recurring leak${leakCount > 1 ? "s" : ""} identified`);
  }

  return signals;
}

const BLOCK_KIND_LABELS: Record<DailyPlanBlockKind, string> = {
  focus_concept: "concept focus",
  secondary_concept: "concept review",
  execute_intervention: "intervention execution",
  review_real_hands: "real hand review",
  retention_check: "retention check",
  inspect_replay_drift: "replay inspection",
};

function buildPlanSummary(
  blocks: DailyPlanBlock[],
  state: DailyPlanState,
  sessionLength: DailySessionLength,
): string {
  if (state === "no_history") {
    return "No history yet — start your first session.";
  }
  if (state === "sparse_history") {
    return `Lightweight ${sessionLength}-min session to build your coaching baseline.`;
  }

  const primaryBlock = blocks[0];
  if (!primaryBlock) return `${sessionLength}-min study session`;

  const primary = BLOCK_KIND_LABELS[primaryBlock.kind] ?? primaryBlock.kind;
  const additionalCount = blocks.length - 1;

  if (additionalCount === 0) {
    return `${sessionLength}-min session — ${primary}`;
  }
  return `${sessionLength}-min session — ${primary} + ${additionalCount} more block${additionalCount === 1 ? "" : "s"}`;
}

function buildWhyThisPlan(
  urgencySignals: string[],
  state: DailyPlanState,
): string {
  if (state === "no_history") {
    return "No drill history exists yet. Starting your first session will give the coaching engine the data it needs to plan for you.";
  }
  if (state === "sparse_history") {
    return "Your history is still sparse. This plan focuses on building reps across your identified weaknesses before shifting to specialized work.";
  }
  if (urgencySignals.length === 0) {
    return "This plan was selected based on your current weakness profile and recommendation engine output.";
  }
  return `Plan driven by: ${urgencySignals.join("; ")}.`;
}

function buildExpectedOutcome(blocks: DailyPlanBlock[], state: DailyPlanState): string {
  if (state === "no_history") {
    return "Your first coaching baseline will be established.";
  }
  if (state === "sparse_history") {
    return "More reps on key concepts, enabling sharper future recommendations.";
  }

  const hasIntervention = blocks.some((b) => b.kind === "execute_intervention");
  const hasFocusConcept = blocks.some((b) => b.kind === "focus_concept");
  const hasRetention = blocks.some((b) => b.kind === "retention_check");

  const outcomes: string[] = [];
  if (hasIntervention) outcomes.push("intervention progress recorded");
  if (hasFocusConcept) outcomes.push("primary weakness addressed");
  if (hasRetention) outcomes.push("retention validated");

  if (outcomes.length === 0) return "Progress recorded across your study profile.";
  return `${outcomes.join(", ")}.`;
}

function buildPlanForLength(
  candidates: DailyPlanBlock[],
  sessionLength: DailySessionLength,
  urgencySignals: string[],
  state: DailyPlanState,
): DailyStudyPlan {
  const blocks = selectBlocksForBudget(candidates, sessionLength);
  const totalEstimatedMinutes = blocks.reduce((sum, b) => sum + b.estimatedMinutes, 0);

  return {
    sessionLength,
    planSummary: buildPlanSummary(blocks, state, sessionLength),
    whyThisPlan: buildWhyThisPlan(urgencySignals, state),
    blocks,
    urgencySignals,
    expectedOutcome: buildExpectedOutcome(blocks, state),
    totalEstimatedMinutes,
  };
}

export function buildDailyStudyPlanBundle(input: DailyStudyPlanInput): DailyStudyPlanBundle {
  const state = derivePlanState(input);
  const urgencySignals = buildUrgencySignals(input, state);
  const candidateBlocks = buildCandidateBlocks(input, state);

  const plan20 = buildPlanForLength(candidateBlocks, 20, urgencySignals, state);
  const plan45 = buildPlanForLength(candidateBlocks, 45, urgencySignals, state);
  const plan90 = buildPlanForLength(candidateBlocks, 90, urgencySignals, state);

  const primaryRec = input.playerIntelligence.recommendations[0];
  const defaultSessionLength: DailySessionLength = state === "no_history" ? 20 : 45;

  return {
    state,
    generatedAt: (input.now ?? new Date()).toISOString(),
    availableSessionLengths: DAILY_SESSION_LENGTHS,
    defaultSessionLength,
    plan20,
    plan45,
    plan90,
    urgencySignals,
    primaryConceptKey: primaryRec?.conceptKey ?? null,
    primaryConceptLabel: primaryRec?.label ?? null,
  };
}
