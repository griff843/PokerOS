import type { ConceptTransferEvaluation, PlayerIntelligenceSnapshot } from "@poker-coach/core/browser";
import type { RealHandBridgeBundle } from "./real-hand-bridge";
import { buildDailyPlanBridgeIntegration, findDailyPlanBridgeContext, type DailyPlanBridgeIntegration } from "./daily-plan-bridge-integration";
import { findCalibrationSurfaceConcept, type CalibrationSurfaceAdapter } from "./calibration-surface";

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
  /** v4: concrete action instruction ("what to do right now") */
  actionInstruction: string;
  /** v4: what counts as completing this block */
  completionCondition: string;
  /** v4: hint about what comes after this block (set after arc ordering) */
  nextStepHint: string | null;
}

export interface DailyStudyPlan {
  sessionLength: DailySessionLength;
  planSummary: string;
  whyThisPlan: string;
  blocks: DailyPlanBlock[];
  urgencySignals: string[];
  expectedOutcome: string;
  totalEstimatedMinutes: number;
  /** v2: one-line statement of today's primary focus */
  mainFocus: string;
  /** v2: what success looks like for this session */
  successCriteria: string;
  /** v2: the single first action the user should take */
  firstAction: { label: string; destination: string | null };
  /** v4: one-sentence session goal */
  sessionGoal: string;
  /** v4: when the session is considered complete */
  finishingCondition: string;
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
  /** v3: real-hand bridge bundle for enriching plan blocks and explanations */
  bridgeBundle?: RealHandBridgeBundle | null;
  /** v5: per-concept transfer evaluation for boosting high-pressure concepts */
  transferEvaluationMap?: Map<string, ConceptTransferEvaluation> | null;
  /** v5: calibration surface for boosting high-priority regressing concepts */
  calibrationSurface?: CalibrationSurfaceAdapter | null;
  /** v5: recently studied concept keys — deprioritized for variety control */
  recentlyStudiedConceptKeys?: string[];
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

// ─── v4: per-block action framing builders ────────────────────────────────────

function buildBlockActionInstruction(kind: DailyPlanBlockKind, label: string | null): string {
  switch (kind) {
    case "execute_intervention":
      return label
        ? `Open the ${label} execution view and run back-to-back intervention reps.`
        : "Open the execution view and run back-to-back intervention reps.";
    case "focus_concept":
      return label
        ? `Open ${label}, read the coaching context, then run drills.`
        : "Open the concept page, read the coaching context, then run drills.";
    case "retention_check":
      return label
        ? `Run a focused drill session on ${label} and score each decision honestly.`
        : "Run a focused drill session on this concept and score each decision honestly.";
    case "review_real_hands":
      return "Open your hand history and tag each relevant hand with a concept note.";
    case "secondary_concept":
      return label
        ? `Open ${label} and work through at least 3 drills.`
        : "Open the concept page and work through at least 3 drills.";
    case "inspect_replay_drift":
      return label
        ? `Open the ${label} replay inspector and trace the recurring decision pattern.`
        : "Open the replay inspector and trace the recurring decision pattern.";
  }
}

function buildBlockCompletionCondition(kind: DailyPlanBlockKind, label: string | null): string {
  switch (kind) {
    case "execute_intervention":
      return label
        ? `You've completed 10+ reps on ${label} without stopping.`
        : "You've completed 10+ intervention reps without stopping.";
    case "focus_concept":
      return label
        ? `You've drilled ${label} and can name your main error pattern.`
        : "You've drilled and can name your main error pattern.";
    case "retention_check":
      return label
        ? `You've scored ≥70% on ${label} drills.`
        : "You've scored ≥70% on retention drills.";
    case "review_real_hands":
      return "You've tagged ≥3 hands with concept-level notes.";
    case "secondary_concept":
      return label
        ? `You've completed 3+ drills on ${label}.`
        : "You've completed 3+ drills on the secondary concept.";
    case "inspect_replay_drift":
      return "You've identified the recurring decision pattern.";
  }
}

// Fills in nextStepHint for each block after arc ordering is applied.
// Last block always signals session completion.
function assignNextStepHints(blocks: DailyPlanBlock[]): DailyPlanBlock[] {
  return blocks.map((block, index) => {
    const nextBlock = blocks[index + 1];
    const nextStepHint = nextBlock
      ? `Next: ${nextBlock.title}`
      : "Session complete — record any notes before closing.";
    return { ...block, nextStepHint };
  });
}

// ─── v4: session-level guidance builders ─────────────────────────────────────

function buildSessionGoal(blocks: DailyPlanBlock[], state: DailyPlanState): string {
  if (state === "no_history") return "Establish your first coaching baseline.";
  if (state === "sparse_history") {
    const primary = blocks[0];
    return primary?.conceptLabel
      ? `Build reps on ${primary.conceptLabel} to sharpen your coaching profile.`
      : "Build enough reps to enable personalized coaching.";
  }

  const primary = blocks[0];
  if (!primary) return "Complete this study session.";

  const label = primary.conceptLabel;
  switch (primary.kind) {
    case "execute_intervention":
      return label
        ? `Complete a full set of ${label} intervention reps.`
        : "Complete a full set of intervention reps.";
    case "focus_concept":
      return label
        ? `Identify your error pattern on ${label}.`
        : "Identify your main error pattern.";
    case "retention_check":
      return label ? `Confirm your retention of ${label}.` : "Confirm your recent concept retention.";
    case "review_real_hands":
      return "Connect your real hands to your top drill weakness.";
    case "secondary_concept":
      return label ? `Expand your coverage to ${label}.` : "Expand your concept coverage.";
    case "inspect_replay_drift":
      return label
        ? `Understand why ${label} keeps recurring.`
        : "Understand your recurring decision pattern.";
  }
}

function buildFinishingCondition(blocks: DailyPlanBlock[], state: DailyPlanState): string {
  if (state === "no_history") return "When you've completed your first 10-drill session.";
  if (state === "sparse_history") return "When you've reached 20 total drill attempts.";

  if (blocks.length === 0) return "When you've completed this session.";
  if (blocks.length === 1) {
    return `When you've completed the ${BLOCK_KIND_LABELS[blocks[0].kind]} block.`;
  }
  return `When all ${blocks.length} blocks are marked done.`;
}

// ─── v5: assignment weight scoring ────────────────────────────────────────────

/** Base scores for concept rank 0–4 in recommendations[]. 2-point gap between ranks. */
const RANK_BASE_SCORES: readonly number[] = [10.0, 8.0, 6.0, 4.0, 2.0];

/**
 * Score a candidate recommendation for assignment selection.
 * Higher score = stronger candidate for focus/secondary block.
 *
 * Boosts:  high transfer pressure +2.0, medium +0.5
 *          high calibration priority +2.0, medium +0.5
 * Penalty: recently studied concept -3.0
 *
 * The -3.0 penalty drops the top-ranked concept below the next rank (gap is 2pt),
 * unless a +2.0 boost partially recovers it (net: penalised concept scores -1.0
 * vs untouched next rank — next rank still wins by 1pt).
 */
function scoreConceptForAssignment(
  conceptKey: string,
  rankIndex: number,
  transferEvaluationMap: Map<string, ConceptTransferEvaluation> | null | undefined,
  calibrationSurface: CalibrationSurfaceAdapter | null | undefined,
  recentlyStudiedConceptKeys: string[] | undefined,
): number {
  let score = RANK_BASE_SCORES[rankIndex] ?? 1.0;

  // Transfer pressure boost: drill gains not yet confirming in real play
  const transfer = transferEvaluationMap?.get(conceptKey);
  if (transfer?.pressure === "high") score += 2.0;
  else if (transfer?.pressure === "medium") score += 0.5;

  // Calibration urgency boost: concept is regressing or inconclusive in calibration
  const calibration = findCalibrationSurfaceConcept(calibrationSurface, conceptKey);
  if (calibration?.priority === "high") score += 2.0;
  else if (calibration?.priority === "medium") score += 0.5;

  // Recency penalty: deprioritize concepts worked on recently for variety
  if (recentlyStudiedConceptKeys?.includes(conceptKey)) score -= 3.0;

  return score;
}

/**
 * Enrich a block reason with transfer pressure and calibration urgency signals.
 * Returns the base reason unchanged when no additional context is available.
 */
function enrichBlockReason(
  baseReason: string,
  conceptKey: string,
  transferEvaluationMap: Map<string, ConceptTransferEvaluation> | null | undefined,
  calibrationSurface: CalibrationSurfaceAdapter | null | undefined,
): string {
  const parts: string[] = [baseReason];

  const transfer = transferEvaluationMap?.get(conceptKey);
  if (transfer?.pressure === "high") {
    parts.push(
      "Drill gains on this concept are not yet confirmed in real play — sustained direct practice is the priority.",
    );
  }

  const calibration = findCalibrationSurfaceConcept(calibrationSurface, conceptKey);
  if (calibration?.priority === "high" && calibration.whyThisStillMatters) {
    parts.push(calibration.whyThisStillMatters);
  }

  return parts.join(" ");
}

// ─── candidate block builders ─────────────────────────────────────────────────

function buildCandidateBlocks(
  input: DailyStudyPlanInput,
  state: DailyPlanState,
  bridgeIntegration: DailyPlanBridgeIntegration,
): DailyPlanBlock[] {
  if (state === "no_history") {
    return [
      {
        kind: "focus_concept",
        title: "Start Your First Session",
        estimatedMinutes: 15,
        reason:
          "Your first session builds the coaching foundation. Work through 10 drills — after that, this page adapts to your specific leaks.",
        conceptKey: null,
        conceptLabel: null,
        destination: "/app/session",
        priority: 10,
        actionInstruction: "Open the drill session and complete your first 10 hands.",
        completionCondition: "You've completed your first 10 drills.",
        nextStepHint: null,
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
          ? `${topRec.label} is your highest-priority concept. Each rep sharpens the engine's ability to target your specific leaks.`
          : "Keep drilling to generate enough data for personalized coaching.",
        conceptKey: topRec?.conceptKey ?? null,
        conceptLabel: topRec?.label ?? null,
        destination: "/app/session",
        priority: 10,
        actionInstruction: topRec
          ? `Start a drill session focused on ${topRec.label}.`
          : "Open the drill session and complete at least 5 hands.",
        completionCondition: "You've completed 10+ reps on this concept.",
        nextStepHint: null,
      },
      {
        kind: "retention_check",
        title: "Review Recent Session",
        estimatedMinutes: 10,
        reason:
          "Reviewing your recent attempts while history is sparse accelerates baseline formation and reinforces what you've learned.",
        conceptKey: null,
        conceptLabel: null,
        destination: "/app/review",
        priority: 6,
        actionInstruction: "Open the session review and check your recent attempt history.",
        completionCondition: "You've reviewed your recent session decisions.",
        nextStepHint: null,
      },
    ];

    if (input.overdueRetentionConceptKeys.length > 0) {
      const key = input.overdueRetentionConceptKeys[0];
      const concept = input.playerIntelligence.concepts.find((c) => c.conceptKey === key);
      const conceptLabel = concept?.label ?? key;
      // Replace the generic review block with the overdue check (higher priority)
      blocks.splice(1, 1, {
        kind: "retention_check",
        title: `Retention Check: ${conceptLabel}`,
        estimatedMinutes: 10,
        reason:
          "A retention check is overdue. Run a short verification session before moving forward.",
        conceptKey: key,
        conceptLabel,
        destination: "/app/session",
        priority: 8,
        actionInstruction: `Run a focused drill session on ${conceptLabel}.`,
        completionCondition: `You've scored ≥70% on ${conceptLabel} drills.`,
        nextStepHint: null,
      });
    }

    return blocks.sort((a, b) => b.priority - a.priority);
  }

  // ready state — full candidate set
  const blocks: DailyPlanBlock[] = [];
  const conceptMap = new Map(input.playerIntelligence.concepts.map((c) => [c.conceptKey, c]));
  const recommendations = input.playerIntelligence.recommendations;

  // v5: score and re-rank recommendations using transfer pressure, calibration urgency,
  // and recency penalty for variety control.
  const scoredRecs = recommendations
    .map((rec, index) => ({
      rec,
      score: scoreConceptForAssignment(
        rec.conceptKey,
        index,
        input.transferEvaluationMap,
        input.calibrationSurface,
        input.recentlyStudiedConceptKeys,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  // Active intervention block (highest priority)
  // v3: enriched with real-hand evidence when bridge has a matching candidate
  if (input.activeInterventionConceptKey) {
    const label = input.activeInterventionConceptLabel ?? input.activeInterventionConceptKey;
    const bridgeContext = findDailyPlanBridgeContext(
      bridgeIntegration,
      input.activeInterventionConceptKey,
    );
    const reason = bridgeContext
      ? bridgeContext.executeInterventionReason
      : "You have an active intervention in progress. Running intervention reps is your most impactful daily activity.";
    blocks.push({
      kind: "execute_intervention",
      title: `Execute Intervention: ${label}`,
      estimatedMinutes: 15,
      reason,
      conceptKey: input.activeInterventionConceptKey,
      conceptLabel: label,
      destination: `/app/concepts/${encodeURIComponent(input.activeInterventionConceptKey)}/execution`,
      priority: 10,
      actionInstruction: buildBlockActionInstruction("execute_intervention", label),
      completionCondition: buildBlockCompletionCondition("execute_intervention", label),
      nextStepHint: null,
    });
  }

  // Overdue retention check (second highest priority)
  if (input.overdueRetentionConceptKeys.length > 0) {
    const key = input.overdueRetentionConceptKeys[0];
    const concept = conceptMap.get(key);
    const conceptLabel = concept?.label ?? key;
    blocks.push({
      kind: "retention_check",
      title: `Retention Check: ${conceptLabel}`,
      estimatedMinutes: 10,
      reason:
        "This retention check is overdue. Delayed validation reduces your ability to track real progress.",
      conceptKey: key,
      conceptLabel,
      destination: "/app/session",
      priority: 9,
      actionInstruction: buildBlockActionInstruction("retention_check", conceptLabel),
      completionCondition: buildBlockCompletionCondition("retention_check", conceptLabel),
      nextStepHint: null,
    });
  }

  // Primary focus concept — v5: selected by assignment score, not raw rank
  const primaryRec = scoredRecs[0]?.rec ?? null;
  if (primaryRec) {
    const basePriority = input.activeInterventionConceptKey ? 7 : 9;
    blocks.push({
      kind: "focus_concept",
      title: `Focus Concept: ${primaryRec.label}`,
      estimatedMinutes: 15,
      reason: enrichBlockReason(
        `${primaryRec.label} is your top-priority weakness. ${primaryRec.rationale}`,
        primaryRec.conceptKey,
        input.transferEvaluationMap,
        input.calibrationSurface,
      ),
      conceptKey: primaryRec.conceptKey,
      conceptLabel: primaryRec.label,
      destination: `/app/concepts/${encodeURIComponent(primaryRec.conceptKey)}`,
      priority: basePriority,
      actionInstruction: buildBlockActionInstruction("focus_concept", primaryRec.label),
      completionCondition: buildBlockCompletionCondition("focus_concept", primaryRec.label),
      nextStepHint: null,
    });
  }

  // Due retention check (not already overdue)
  const dueKey = input.dueRetentionConceptKeys.find(
    (key) => !input.overdueRetentionConceptKeys.includes(key),
  );
  if (dueKey) {
    const concept = conceptMap.get(dueKey);
    const conceptLabel = concept?.label ?? dueKey;
    blocks.push({
      kind: "retention_check",
      title: `Retention Check: ${conceptLabel}`,
      estimatedMinutes: 10,
      reason: "A retention check is due. Confirm your recent gains are holding.",
      conceptKey: dueKey,
      conceptLabel,
      destination: "/app/session",
      priority: 7,
      actionInstruction: buildBlockActionInstruction("retention_check", conceptLabel),
      completionCondition: buildBlockCompletionCondition("retention_check", conceptLabel),
      nextStepHint: null,
    });
  }

  // Real hands review — v3: enriched from bridge candidate when available
  if (input.importedHandCount > 0) {
    const handWord = input.importedHandCount === 1 ? "hand" : "hands";
    const bridgeContext = bridgeIntegration.topCandidate;

    const title = bridgeContext?.reviewBlock.title ?? "Review Real Hands";
    const reason = bridgeContext
      ? bridgeContext.reviewBlock.reason
      : `You have ${input.importedHandCount} imported ${handWord} available. Real play review closes the gap between drills and the table.`;
    const destination = bridgeContext?.reviewBlock.destination ?? "/app/hands";
    const priority = bridgeContext?.reviewBlock.priority ?? 6;
    const conceptKey = bridgeContext?.reviewBlock.conceptKey ?? null;
    const conceptLabel = bridgeContext?.reviewBlock.conceptLabel ?? null;

    blocks.push({
      kind: "review_real_hands",
      title,
      estimatedMinutes: 15,
      reason,
      conceptKey,
      conceptLabel,
      destination,
      priority,
      actionInstruction: buildBlockActionInstruction("review_real_hands", null),
      completionCondition: buildBlockCompletionCondition("review_real_hands", null),
      nextStepHint: null,
    });
  }

  // Secondary concept — v5: selected by assignment score, not raw rank
  const secondaryRec = scoredRecs[1]?.rec ?? null;
  if (secondaryRec) {
    blocks.push({
      kind: "secondary_concept",
      title: `Secondary Concept: ${secondaryRec.label}`,
      estimatedMinutes: 10,
      reason: enrichBlockReason(
        `${secondaryRec.label} is your second-priority weakness. Adding breadth alongside depth work reinforces your overall game.`,
        secondaryRec.conceptKey,
        input.transferEvaluationMap,
        input.calibrationSurface,
      ),
      conceptKey: secondaryRec.conceptKey,
      conceptLabel: secondaryRec.label,
      destination: `/app/concepts/${encodeURIComponent(secondaryRec.conceptKey)}`,
      priority: 5,
      actionInstruction: buildBlockActionInstruction("secondary_concept", secondaryRec.label),
      completionCondition: buildBlockCompletionCondition("secondary_concept", secondaryRec.label),
      nextStepHint: null,
    });
  }

  // Replay drift inspection — v3: enriched with bridge context when concept matches a bridge candidate
  const recurringLeakKey = input.playerIntelligence.memory.recurringLeakConcepts[0];
  if (
    recurringLeakKey &&
    recurringLeakKey !== primaryRec?.conceptKey &&
    recurringLeakKey !== secondaryRec?.conceptKey
  ) {
    const concept = conceptMap.get(recurringLeakKey);
    const conceptLabel = concept?.label ?? recurringLeakKey;
    const bridgeContext = findDailyPlanBridgeContext(bridgeIntegration, recurringLeakKey);
    const reason = bridgeContext
      ? bridgeContext.replayInspectionReason
      : "This concept has recurred across multiple sessions. The replay inspector can reveal why the pattern persists.";
    blocks.push({
      kind: "inspect_replay_drift",
      title: `Inspect Replay: ${conceptLabel}`,
      estimatedMinutes: 10,
      reason,
      conceptKey: recurringLeakKey,
      conceptLabel,
      destination: `/app/concepts/${encodeURIComponent(recurringLeakKey)}/replay`,
      priority: 4,
      actionInstruction: buildBlockActionInstruction("inspect_replay_drift", conceptLabel),
      completionCondition: buildBlockCompletionCondition("inspect_replay_drift", null),
      nextStepHint: null,
    });
  }

  return blocks.sort((a, b) => b.priority - a.priority);
}

// v3: session arc ordering — defines the intended flow of a study session.
// Candidates are selected by priority (what gets included), then arc-ordered
// (what order to do them in) for coherent session flow.
const BLOCK_ARC_POSITION: Record<DailyPlanBlockKind, number> = {
  execute_intervention: 1, // do active intervention work first, while fresh
  focus_concept: 2,        // primary learning is the main activity
  retention_check: 3,      // validate after doing the conceptual work
  review_real_hands: 4,    // bridge drill knowledge to real-play patterns
  secondary_concept: 5,    // breadth work after depth is addressed
  inspect_replay_drift: 6, // reflection and analysis at the end
};

function applySessionArcOrder(blocks: DailyPlanBlock[]): DailyPlanBlock[] {
  return [...blocks].sort(
    (a, b) => BLOCK_ARC_POSITION[a.kind] - BLOCK_ARC_POSITION[b.kind],
  );
}

// 20-min: one high-EV action + one supporting action.
// Pick top 2 by priority; cap each block at 10 min so the pair always fits.
// Apply arc ordering so the session has intentional flow even in a short slot.
function selectBlocksFor20(candidates: DailyPlanBlock[]): DailyPlanBlock[] {
  if (candidates.length === 0) return [];
  const selected = candidates
    .slice(0, 2)
    .map((b) => ({ ...b, estimatedMinutes: Math.min(b.estimatedMinutes, 10) }));
  return applySessionArcOrder(selected);
}

// 45-min: execution + validation/review.
// Greedy up to 45 min, max 3 blocks. Arc-ordered for coherent session flow.
function selectBlocksFor45(candidates: DailyPlanBlock[]): DailyPlanBlock[] {
  const selected: DailyPlanBlock[] = [];
  let remaining = 45;
  for (const block of candidates) {
    if (selected.length >= 3) break;
    if (block.estimatedMinutes <= remaining) {
      selected.push(block);
      remaining -= block.estimatedMinutes;
    }
    if (remaining < 5) break;
  }
  if (selected.length === 0 && candidates.length > 0) selected.push(candidates[0]);
  return applySessionArcOrder(selected);
}

// 90-min: deeper concept + transfer/replay + retention mix.
// Greedy up to 90 min, max 5 blocks. Arc-ordered for coherent session flow.
function selectBlocksFor90(candidates: DailyPlanBlock[]): DailyPlanBlock[] {
  const selected: DailyPlanBlock[] = [];
  let remaining = 90;
  for (const block of candidates) {
    if (selected.length >= 5) break;
    if (block.estimatedMinutes <= remaining) {
      selected.push(block);
      remaining -= block.estimatedMinutes;
    }
    if (remaining < 5) break;
  }
  if (selected.length === 0 && candidates.length > 0) selected.push(candidates[0]);
  return applySessionArcOrder(selected);
}

function selectBlocksForLength(
  candidates: DailyPlanBlock[],
  sessionLength: DailySessionLength,
): DailyPlanBlock[] {
  if (sessionLength === 20) return selectBlocksFor20(candidates);
  if (sessionLength === 45) return selectBlocksFor45(candidates);
  return selectBlocksFor90(candidates);
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
    return `${sessionLength}-min session to build your coaching baseline.`;
  }

  const primaryBlock = blocks[0];
  if (!primaryBlock) return `${sessionLength}-min study session`;

  const focusLabel = primaryBlock.conceptLabel ?? BLOCK_KIND_LABELS[primaryBlock.kind];
  const additionalCount = blocks.length - 1;

  if (additionalCount === 0) {
    return `${sessionLength} min — ${focusLabel}`;
  }
  return `${sessionLength} min — ${focusLabel} + ${additionalCount} more`;
}

// v3: accepts optional bridgeBundle to enrich "why today" with real-play evidence
function buildWhyThisPlan(
  blocks: DailyPlanBlock[],
  urgencySignals: string[],
  state: DailyPlanState,
  bridgeIntegration?: DailyPlanBridgeIntegration,
): string {
  if (state === "no_history") {
    return "No drill history exists yet. Start one session and the coaching engine immediately begins building a model of your game. Every decision you make becomes a signal.";
  }
  if (state === "sparse_history") {
    return "Your coaching engine is still calibrating. This plan prioritizes reps on your identified weaknesses — the more you drill now, the more precisely future plans can target your specific leaks.";
  }

  const primaryBlock = blocks[0];
  if (!primaryBlock) {
    return "This plan was selected based on your current weakness profile.";
  }

  const conceptLabel = primaryBlock.conceptLabel;
  let basePart: string;
  if (urgencySignals.length === 0) {
    basePart = conceptLabel
      ? `Plan centers on ${conceptLabel}, your highest-priority weakness based on recent performance.`
      : "This plan was selected based on your current weakness profile and recommendation engine output.";
  } else {
    const urgencyPart = urgencySignals.slice(0, 2).join("; ");
    basePart = conceptLabel
      ? `${urgencyPart}. Primary focus: ${conceptLabel}.`
      : `Plan driven by: ${urgencyPart}.`;
  }

  if (bridgeIntegration?.whyThisPlanEvidence) {
    return `${basePart} ${bridgeIntegration.whyThisPlanEvidence}`;
  }

  return basePart;
}

function buildExpectedOutcome(blocks: DailyPlanBlock[], state: DailyPlanState): string {
  if (state === "no_history") {
    return "You'll have a coaching baseline and see your first personalized recommendations.";
  }
  if (state === "sparse_history") {
    return "Stronger coaching signal on your key weaknesses, enabling sharper future recommendations.";
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

function buildMainFocus(blocks: DailyPlanBlock[], state: DailyPlanState): string {
  if (state === "no_history") return "Start your first session";
  if (state === "sparse_history") {
    const primary = blocks[0];
    return primary?.conceptLabel ? `Drill: ${primary.conceptLabel}` : "Build your baseline";
  }

  const primary = blocks[0];
  if (!primary) return "Study session";

  switch (primary.kind) {
    case "execute_intervention":
      return `Execute intervention: ${primary.conceptLabel ?? "active concept"}`;
    case "retention_check":
      return `Validate retention: ${primary.conceptLabel ?? "recent concept"}`;
    case "focus_concept":
      return `Concept focus: ${primary.conceptLabel ?? "top weakness"}`;
    case "review_real_hands":
      return "Review real hands";
    case "secondary_concept":
      return `Explore: ${primary.conceptLabel ?? "secondary concept"}`;
    case "inspect_replay_drift":
      return `Inspect replay: ${primary.conceptLabel ?? "recurring leak"}`;
  }
}

function buildSuccessCriteria(blocks: DailyPlanBlock[], state: DailyPlanState): string {
  if (state === "no_history") {
    return "Complete your first 10-drill session.";
  }
  if (state === "sparse_history") {
    return "Reach 20 total attempts across your primary concepts.";
  }

  const primary = blocks[0];
  if (!primary) return "Complete this session's study blocks.";

  const label = primary.conceptLabel;
  switch (primary.kind) {
    case "execute_intervention":
      return label
        ? `Complete 10+ intervention reps on ${label}.`
        : "Complete 10+ intervention reps.";
    case "retention_check":
      return label ? `Score ≥70% on ${label} drills.` : "Score ≥70% on retention drills.";
    case "focus_concept":
      return label
        ? `Attempt 5+ drills on ${label} and identify your error pattern.`
        : "Attempt 5+ drills and identify your error pattern.";
    case "review_real_hands":
      return "Tag at least 3 hands with concept-level notes.";
    case "secondary_concept":
      return label ? `Complete 3+ drills on ${label}.` : "Complete 3+ drills on the secondary concept.";
    case "inspect_replay_drift":
      return "Identify the decision pattern that keeps recurring.";
  }
}

function buildFirstAction(
  blocks: DailyPlanBlock[],
  state: DailyPlanState,
): { label: string; destination: string | null } {
  if (state === "no_history") {
    return { label: "Start First Session", destination: "/app/session" };
  }
  if (state === "sparse_history") {
    return { label: "Start Session", destination: "/app/session" };
  }

  const primary = blocks[0];
  if (!primary) {
    return { label: "Start Session", destination: "/app/session" };
  }

  switch (primary.kind) {
    case "execute_intervention":
      return { label: "Start Intervention Reps", destination: primary.destination };
    case "retention_check":
      return { label: "Run Retention Check", destination: primary.destination };
    case "focus_concept":
      return {
        label: `Open ${primary.conceptLabel ?? "Concept"}`,
        destination: primary.destination,
      };
    case "review_real_hands":
      return { label: "Review Hands", destination: primary.destination };
    case "secondary_concept":
      return {
        label: `Open ${primary.conceptLabel ?? "Concept"}`,
        destination: primary.destination,
      };
    case "inspect_replay_drift":
      return { label: "Open Replay Inspector", destination: primary.destination };
  }
}

function buildPlanForLength(
  candidates: DailyPlanBlock[],
  sessionLength: DailySessionLength,
  urgencySignals: string[],
  state: DailyPlanState,
  bridgeIntegration?: DailyPlanBridgeIntegration,
): DailyStudyPlan {
  // v4: assign next-step hints after arc ordering so each block knows what comes after it
  const blocks = assignNextStepHints(selectBlocksForLength(candidates, sessionLength));
  const totalEstimatedMinutes = blocks.reduce((sum, b) => sum + b.estimatedMinutes, 0);

  return {
    sessionLength,
    planSummary: buildPlanSummary(blocks, state, sessionLength),
    whyThisPlan: buildWhyThisPlan(blocks, urgencySignals, state, bridgeIntegration),
    blocks,
    urgencySignals,
    expectedOutcome: buildExpectedOutcome(blocks, state),
    totalEstimatedMinutes,
    mainFocus: buildMainFocus(blocks, state),
    successCriteria: buildSuccessCriteria(blocks, state),
    firstAction: buildFirstAction(blocks, state),
    sessionGoal: buildSessionGoal(blocks, state),
    finishingCondition: buildFinishingCondition(blocks, state),
  };
}

export function buildDailyStudyPlanBundle(input: DailyStudyPlanInput): DailyStudyPlanBundle {
  const state = derivePlanState(input);
  const urgencySignals = buildUrgencySignals(input, state);
  const bridgeIntegration = buildDailyPlanBridgeIntegration(input.bridgeBundle);
  const candidateBlocks = buildCandidateBlocks(input, state, bridgeIntegration);

  const plan20 = buildPlanForLength(candidateBlocks, 20, urgencySignals, state, bridgeIntegration);
  const plan45 = buildPlanForLength(candidateBlocks, 45, urgencySignals, state, bridgeIntegration);
  const plan90 = buildPlanForLength(candidateBlocks, 90, urgencySignals, state, bridgeIntegration);

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
