import {
  buildCompletedSessionSummary,
  buildFallbackCoachResponse,
  buildInterventionPlan,
  buildNextFocusSummary,
  type InterventionPlan,
} from "@poker-coach/core/browser";
import type { SessionState, DrillAttempt, DecisionConfidence } from "./session-types";
import { formatDecisionConfidence, formatSessionLabel } from "./study-session-ui";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";
import { buildPatternBriefs } from "./pattern-summaries";

type AssignmentBucket =
  | "exact_match"
  | "turn_line_transfer"
  | "sizing_stability"
  | "bridge_reconstruction"
  | "memory_decisive";

export interface SessionReviewSnapshot {
  header: {
    focusLabel: string;
    completionLabel: string;
    headline: string;
    outcome: string;
    poolLabel: string;
    mixLabel: string;
  };
  performance: {
    items: Array<{
      label: string;
      value: string;
      detail: string;
      tone: "good" | "warning" | "neutral";
    }>;
  };
  movedToday: {
    items: Array<{
      label: string;
      title: string;
      detail: string;
      tone: "good" | "warning" | "neutral";
    }>;
  };
  coachDebrief: {
    takeaway: string;
    leak: string;
    pattern: string;
    nextFocus: string;
    followUp?: string;
    followUpConcepts: string[];
  };
  planningContext?: {
    title: string;
    detail: string;
  };
  followUpContext?: {
    title: string;
    detail: string;
  };
  assignmentAudit?: {
    title: string;
    detail: string;
    bucketMix: Array<{ label: string; count: number }>;
    selectedDrillIds: string[];
    warnings: string[];
    correctiveFocus?: string;
  };
    importantDrills: Array<{
      drillId: string;
      title: string;
      nodeId: string;
      outcome: string;
      detail: string;
      confidence: string;
      reviewTag: string | null;
      coachFollowUp?: string;
      followUpConcepts: string[];
      assignmentRationale?: string;
      assignmentBucket?: string | null;
    }>;
  importantDrillsEmptyMessage?: string;
  recommendedTrainingBlock?: {
    plan: InterventionPlan;
    href: string;
  };
  nextAction: {
    primary: SessionReviewAction;
    secondary: SessionReviewAction[];
  };
}

export interface SessionReviewAction {
  label: string;
  detail: string;
  action: "review_incorrect" | "review_all" | "command_center" | "open_intervention";
  tagFilter: string | null;
}

export function buildSessionReviewSnapshot(
  state: Pick<SessionState, "attempts" | "config" | "planMetadata" | "drills">
): SessionReviewSnapshot {
  const { attempts, config, planMetadata, drills } = state;
  const completedSummary = buildCompletedSessionSummary({
    metadata: planMetadata,
    attempts: attempts.map((attempt) => ({
      drillId: attempt.drill.drill_id,
      nodeId: attempt.drill.node_id,
      title: attempt.drill.title,
      selectionKind: attempt.selection.kind,
      selectionReason: attempt.selection.reason,
      matchedWeaknessTargets: attempt.selection.matchedWeaknessTargets,
      activePool: attempt.activePool,
      score: attempt.score,
      correct: attempt.correct,
      missedTags: attempt.missedTags,
      matchedTags: attempt.matchedTags,
    })),
    activePool: config.activePool,
  });
  const patternAttempts = attempts.map((attempt) => ({
    drillId: attempt.drill.drill_id,
    nodeId: attempt.drill.node_id,
    ts: attempt.timestamp,
    sessionId: planMetadata?.generatedAt ?? "current-session",
    conceptKeys: attempt.drill.tags.filter((tag) => tag.startsWith("concept:")).map((tag) => tag.slice("concept:".length)),
    missedTags: attempt.missedTags,
    score: attempt.score,
    correct: attempt.correct,
    diagnosticType: attempt.diagnostic?.result.errorType ?? null,
    diagnosticConceptKey: attempt.diagnostic?.result.conceptKey ?? null,
    activePool: attempt.activePool,
  }));

  const playerIntelligence = buildTableSimPlayerIntelligence({
    drills: drills.map((entry) => entry.drill),
    attemptInsights: attempts.map((attempt) => ({
      drillId: attempt.drill.drill_id,
      nodeId: attempt.drill.node_id,
      score: attempt.score,
      correct: attempt.correct,
      missedTags: attempt.missedTags,
      classificationTags: attempt.drill.tags,
      activePool: attempt.activePool,
    })),
    activePool: config.activePool,
    confidenceInsights: attempts.map((attempt) => ({
      confidence: attempt.confidence,
      correct: attempt.correct,
      classificationTags: attempt.drill.tags,
      missedTags: attempt.missedTags,
    })),
    diagnosticInsights: attempts.flatMap((attempt) => attempt.diagnostic?.result.errorType ? [{
      conceptKey: attempt.diagnostic.result.conceptKey,
      concept: attempt.diagnostic.result.concept,
      errorType: attempt.diagnostic.result.errorType,
      confidenceMiscalibration: attempt.diagnostic.result.confidenceMiscalibration,
    }] : []),
    patternAttempts,
  });
  const interventionPlan = buildInterventionPlan({
    playerIntelligence,
    recentAttempts: attempts.map((attempt) => ({
      drillId: attempt.drill.drill_id,
      nodeId: attempt.drill.node_id,
      title: attempt.drill.title,
      score: attempt.score,
      correct: attempt.correct,
      ts: attempt.timestamp,
      activePool: attempt.activePool,
      diagnosticErrorType: attempt.diagnostic?.result.errorType ?? null,
      diagnosticConceptKey: attempt.diagnostic?.result.conceptKey ?? null,
      confidenceMiscalibration: attempt.diagnostic?.result.confidenceMiscalibration ?? false,
    })),
    activePool: config.activePool,
  });
  const nextFocusSummary = buildNextFocusSummary({
    activePool: config.activePool,
    completedSummary,
    planMetadata,
    playerIntelligence,
  });
  const completedCoach = buildFallbackCoachResponse(completedSummary);
  const focusLabel = buildSessionFocusLabel(attempts);
  const topMatched = findTopKey(attempts.flatMap((attempt) => attempt.correct ? collectStrengthKeys(attempt) : []));
  const topMissedTag = findTopKey(attempts.flatMap((attempt) => attempt.missedTags));
  const weakestConcept = playerIntelligence.priorities[0];
  const weakestNode = findTopKey(attempts.filter((attempt) => !attempt.correct).map((attempt) => attempt.drill.node_id));
  const calibration = buildCalibrationSignal(attempts);
  const reviewVsNew = buildReviewVsNewSignal(attempts);
  const importantDrills = rankImportantDrills(attempts);
  const authoredFollowUp = buildAuthoredFollowUpSummary(importantDrills);
  const recurringMistakeLabel = topMissedTag ? formatSessionLabel(topMissedTag.key) : weakestNode ? formatSessionLabel(weakestNode.key) : "No repeated leak";
  const recurringMistakeDetail = topMissedTag
    ? `${topMissedTag.count} misses clustered around this rule tag, making it the clearest review thread from the block.`
    : weakestNode
      ? `${formatSessionLabel(weakestNode.key)} produced the weakest repeat outcomes in the session.`
      : "This block did not produce a repeat mistake cluster strong enough to outrank the rest.";
  const incorrectAttempts = attempts.filter((attempt) => !attempt.correct).length;
  const topReviewTag = importantDrills[0]
    ? importantDrills[0].missedTags[0] ?? importantDrills[0].drill.answer.required_tags[0] ?? null
    : topMissedTag?.key ?? null;
  const adaptive = playerIntelligence.adaptiveProfile;
  const primaryTendency = adaptive.tendencies[0];
  const leadPattern = buildPatternBriefs(playerIntelligence.patterns.topPatterns, 1)[0];
  const planningContextNote = planMetadata?.notes.find((note) =>
    note.includes("Memory-ambiguous follow-up")
    || note.includes("Manual reconstruction with a clear turn-line family")
    || note.includes("Sizing-fuzzy follow-up")
    || note.includes("Memory-decisive follow-up")
    || note.includes("Precise import follow-up"),
  );
  const followUpContext = buildFollowUpContext(attempts);
  const assignmentAudit = buildAssignmentAudit(planMetadata);

  return {
    header: {
      focusLabel,
      completionLabel: `${attempts.length} deliberate reps complete`,
      headline: completedCoach.headline,
      outcome: buildOutcomeFraming(completedSummary.metrics.accuracy, completedSummary.metrics.averageScore),
      poolLabel: config.activePool === "baseline" ? "Baseline" : `Pool ${config.activePool}`,
      mixLabel: planMetadata ? `${planMetadata.reviewCount} review / ${planMetadata.newCount} new` : `${attempts.length} total reps`,
    },
    performance: {
      items: [
        {
          label: "Drills completed",
          value: String(completedSummary.metrics.totalAttempts),
          detail: "A complete block with enough volume to surface a usable session read.",
          tone: "neutral",
        },
        {
          label: "Decision quality",
          value: `${Math.round(completedSummary.metrics.accuracy * 100)}%`,
          detail: `${attempts.filter((attempt) => attempt.correct).length} of ${attempts.length} decisions landed cleanly.`,
          tone: completedSummary.metrics.accuracy >= 0.7 ? "good" : completedSummary.metrics.accuracy < 0.5 ? "warning" : "neutral",
        },
        {
          label: "Calibration",
          value: calibration.label,
          detail: calibration.detail,
          tone: calibration.tone,
        },
        {
          label: config.timed ? "Pace" : "Session mode",
          value: config.timed ? `${formatAverageSeconds(attempts)}s` : "Untimed",
          detail: config.timed ? "Average time per decision across the block." : "This block prioritized deliberation over a shot clock.",
          tone: "neutral",
        },
      ],
    },
    movedToday: {
      items: [
        {
          label: "Strongest theme",
          title: topMatched ? formatSessionLabel(topMatched.key) : focusLabel,
          detail: topMatched
            ? `${topMatched.count} clean decisions reinforced this concept most clearly.`
            : "No single strength theme separated strongly from the rest of the session.",
          tone: "good",
        },
        {
          label: weakestConcept?.weaknessRole === "upstream" ? "Structural leak" : "Biggest leak",
          title: weakestConcept?.label ?? (topMissedTag ? formatSessionLabel(topMissedTag.key) : "No single leak dominated"),
          detail: weakestConcept
            ? `${weakestConcept.evidence[0] ?? weakestConcept.summary} ${weakestConcept.inferredFrom[0] ?? ""}`.trim()
            : topMissedTag
              ? `${topMissedTag.count} misses concentrated here, making it the sharpest leak surfaced today.`
              : "Leak distribution stayed fairly flat, so no single concept dominated the downside.",
          tone: weakestConcept || topMissedTag ? "warning" : "neutral",
        },
        {
          label: primaryTendency ? "Learning pattern" : "Recurring mistake cluster",
          title: primaryTendency?.label ?? recurringMistakeLabel,
          detail: primaryTendency?.summary ?? recurringMistakeDetail,
          tone: primaryTendency ? "warning" : topMissedTag || weakestNode ? "warning" : "neutral",
        },
        {
          label: "Session pattern",
          title: reviewVsNew.label,
          detail: `${reviewVsNew.detail} ${adaptive.surfaceSignals.sessionReview}`.trim(),
          tone: reviewVsNew.tone,
        },
      ],
    },
    coachDebrief: {
      takeaway: completedSummary.headline,
      leak: `${interventionPlan.rootLeakDiagnosis} ${adaptive.surfaceSignals.sessionReview}`.trim(),
      pattern: leadPattern ? `${leadPattern.title}: ${leadPattern.detail}` : "No recurring cross-hand pattern separated strongly enough to outrank the session leak yet.",
      nextFocus: authoredFollowUp?.summary ?? (nextFocusSummary.recommendations[0]
        ? `${interventionPlan.recommendedSessionTitle}: ${nextFocusSummary.recommendations[0].rationale} ${adaptive.surfaceSignals.sessionReview}`.trim()
        : `${interventionPlan.recommendedSessionTitle}: ${interventionPlan.nextSessionFocus}`),
      followUp: authoredFollowUp?.detail,
      followUpConcepts: authoredFollowUp?.concepts ?? [],
    },
    planningContext: planningContextNote
      ? {
          title: "Why This Block Was Selected",
          detail: planningContextNote,
        }
      : undefined,
    followUpContext,
    assignmentAudit,
    importantDrills: importantDrills.map((attempt) => ({
      drillId: attempt.drill.drill_id,
      title: attempt.drill.title,
      nodeId: attempt.drill.node_id,
      outcome: attempt.correct
        ? `Worth a second pass at ${Math.round(attempt.score * 100)}%`
        : `Review first at ${Math.round(attempt.score * 100)}%`,
      detail: buildImportantDrillDetail(attempt, adaptive.surfaceSignals.review),
      confidence: formatDecisionConfidence(attempt.confidence),
      reviewTag: attempt.missedTags[0] ?? attempt.drill.answer.required_tags[0] ?? null,
      coachFollowUp: attempt.drill.coaching_context?.follow_up,
      followUpConcepts: [...(attempt.drill.coaching_context?.follow_up_concepts ?? [])],
      assignmentRationale: attempt.selection.metadata.assignmentRationale,
      assignmentBucket: attempt.selection.metadata.assignmentBucket ?? null,
    })),
    importantDrillsEmptyMessage: importantDrills.length === 0
      ? "This block did not produce standout review targets. Return to Command Center to set up the next deliberate session."
      : undefined,
    recommendedTrainingBlock: {
      plan: interventionPlan,
      href: `/app/training/session/${interventionPlan.id}`,
    },
    nextAction: {
      primary: incorrectAttempts > 0
        ? {
            label: "Review key mistakes",
            detail: topReviewTag
              ? `Start with ${formatSessionLabel(topReviewTag)} while the leak pattern is still fresh.`
              : "Start with the highest-value misses from this block while the decision context is still fresh.",
            action: "review_incorrect",
            tagFilter: topReviewTag,
          }
        : {
            label: "Open coach intervention",
            detail: `${interventionPlan.recommendedSessionTitle} is ready as the next deliberate block.`,
            action: "open_intervention",
            tagFilter: null,
          },
      secondary: [
        {
          label: "Open coach intervention",
          detail: `${interventionPlan.recommendedSessionTitle} is the clearest next training prescription from this block.`,
          action: "open_intervention",
          tagFilter: null,
        },
        {
          label: "Review all decisions",
          detail: "Open the full review surface if you want the entire block, not just the mistakes.",
          action: "review_all",
          tagFilter: null,
        },
        {
          label: "Return to Command Center",
          detail: "Go back to mission control and choose the next training move with the new context in hand.",
          action: "command_center",
          tagFilter: null,
        },
      ],
    },
  };
}

function buildAssignmentAudit(planMetadata: SessionState["planMetadata"]): SessionReviewSnapshot["assignmentAudit"] | undefined {
  const audit = planMetadata?.followUpAudit;
  if (!audit) {
    return undefined;
  }

  const bucketMix = audit.bucketMix.map((entry) => ({
    label: formatAssignmentBucketLabel(entry.bucket),
    count: entry.count,
  }));
  const profile = audit.uncertaintyProfile ? formatSessionLabel(audit.uncertaintyProfile) : "Unknown profile";
  const handLabel = audit.handTitle ? ` for ${audit.handTitle}` : "";

  return {
    title: "Assignment Audit",
    detail: `This follow-up block was built from ${formatSessionLabel(audit.conceptKey)}${handLabel} using ${profile}. The mix below shows what kinds of reps the planner actually assigned.`,
    bucketMix,
    selectedDrillIds: audit.selectedDrillIds,
    warnings: buildAssignmentAuditWarnings(audit),
    correctiveFocus: buildCorrectiveFocus(planMetadata?.notes ?? []),
  };
}

function buildFollowUpContext(attempts: DrillAttempt[]): { title: string; detail: string } | undefined {
  const buckets = attempts
    .map((attempt) => attempt.selection.metadata.assignmentBucket)
    .filter(isAssignmentBucket);

  if (buckets.length === 0) {
    return undefined;
  }

  const counts = new Map<AssignmentBucket, number>();
  for (const bucket of buckets) {
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const topBucket = ranked[0]?.[0];
  const topCount = ranked[0]?.[1] ?? 0;
  const total = buckets.length;
  const share = Math.round((topCount / total) * 100);

  if (!topBucket) {
    return undefined;
  }

  switch (topBucket) {
    case "memory_decisive":
      return {
        title: "Memory-Decisive Follow-Up",
        detail: `${topCount} of ${total} follow-up reps (${share}%) force a turn-story decision before the river answer can be trusted, so reconstruction itself is part of the training goal.`,
      };
    case "bridge_reconstruction":
      return {
        title: "Bridge Reconstruction",
        detail: `${topCount} of ${total} follow-up reps (${share}%) are bridge-style drills that recover the likely turn story before checking the river threshold.`,
      };
    case "sizing_stability":
      return {
        title: "Sizing-Stable Follow-Up",
        detail: `${topCount} of ${total} follow-up reps (${share}%) keep the line family stable while testing where sizing pressure can still flip the answer.`,
      };
    case "turn_line_transfer":
      return {
        title: "Turn-Line Transfer",
        detail: `${topCount} of ${total} follow-up reps (${share}%) are direct carryover spots where the remembered turn line should shape the river threshold decisively.`,
      };
    case "exact_match":
    default:
      return {
        title: "Precise Transfer",
        detail: `${topCount} of ${total} follow-up reps (${share}%) are close matches to the reviewed hand, so the next work starts from the exact line family before widening out.`,
      };
  }
}

function formatAssignmentBucketLabel(bucket: AssignmentBucket) {
  switch (bucket) {
    case "memory_decisive":
      return "Memory Decisive";
    case "bridge_reconstruction":
      return "Bridge Reconstruction";
    case "sizing_stability":
      return "Sizing Stability";
    case "turn_line_transfer":
      return "Turn-Line Transfer";
    case "exact_match":
    default:
      return "Exact Match";
  }
}

function buildAssignmentAuditWarnings(audit: NonNullable<NonNullable<SessionState["planMetadata"]>["followUpAudit"]>) {
  const counts = new Map(audit.bucketMix.map((entry) => [entry.bucket, entry.count]));
  const warnings: string[] = [];

  switch (audit.uncertaintyProfile) {
    case "memory_decisive":
      if ((counts.get("memory_decisive") ?? 0) === 0) {
        warnings.push("This block was tagged memory-decisive, but it contains no memory-decisive reps.");
      }
      if ((counts.get("bridge_reconstruction") ?? 0) === 0) {
        warnings.push("Memory-decisive blocks usually still need at least one bridge-style reconstruction rep.");
      }
      break;
    case "turn_line_fuzzy":
      if ((counts.get("bridge_reconstruction") ?? 0) === 0) {
        warnings.push("Turn-line-fuzzy follow-ups should usually contain bridge reconstruction reps.");
      }
      if ((counts.get("exact_match") ?? 0) === 0) {
        warnings.push("Turn-line-fuzzy follow-ups may be over-indexed on bridge reps if no exact-match transfer reps appear.");
      }
      break;
    case "sizing_fuzzy_line_clear":
      if ((counts.get("sizing_stability") ?? 0) === 0) {
        warnings.push("Sizing-fuzzy follow-ups should include at least one sizing-stability rep.");
      }
      break;
    case "turn_line_clear":
      if ((counts.get("turn_line_transfer") ?? 0) === 0) {
        warnings.push("Turn-line-clear follow-ups should usually contain turn-line transfer reps.");
      }
      break;
    case "precise_history":
      if ((counts.get("exact_match") ?? 0) === 0) {
        warnings.push("Precise-history follow-ups should stay anchored in exact-match reps first.");
      }
      break;
    default:
      break;
  }

  return warnings;
}

function buildCorrectiveFocus(notes: string[]) {
  return notes.find((note) => note.startsWith("Corrective weighting applied:"));
}

function isAssignmentBucket(value: DrillAttempt["selection"]["metadata"]["assignmentBucket"]): value is AssignmentBucket {
  return value === "exact_match"
    || value === "turn_line_transfer"
    || value === "sizing_stability"
    || value === "bridge_reconstruction"
    || value === "memory_decisive";
}

function buildSessionFocusLabel(attempts: DrillAttempt[]): string {
  const concept = findTopKey(attempts.flatMap((attempt) => collectConceptKeys(attempt)));
  if (concept) {
    return formatSessionLabel(concept.key);
  }

  const node = findTopKey(attempts.map((attempt) => attempt.drill.node_id));
  return node ? formatSessionLabel(node.key) : "Deliberate practice block";
}

function collectConceptKeys(attempt: DrillAttempt): string[] {
  return attempt.drill.tags.filter((tag) => tag.startsWith("concept:"));
}

function collectStrengthKeys(attempt: DrillAttempt): string[] {
  const matched = attempt.matchedTags.length > 0 ? attempt.matchedTags : collectConceptKeys(attempt);
  return matched.length > 0 ? matched : [attempt.drill.node_id];
}

function buildCalibrationSignal(attempts: DrillAttempt[]): { label: string; detail: string; tone: "good" | "warning" | "neutral" } {
  const certainWrong = attempts.filter((attempt) => !attempt.correct && attempt.confidence === "certain").length;
  const notSureCorrect = attempts.filter((attempt) => attempt.correct && attempt.confidence === "not_sure").length;

  if (certainWrong >= 2) {
    return {
      label: "Overpressing",
      detail: `${certainWrong} misses came with Certain confidence, so calibration is part of the review, not just the raw answer quality.`,
      tone: "warning",
    };
  }

  if (notSureCorrect >= 2) {
    return {
      label: "Underselling good reads",
      detail: `${notSureCorrect} correct decisions came with Not Sure confidence, so your process is landing better than it feels.`,
      tone: "good",
    };
  }

  return {
    label: "Steady",
    detail: "Confidence stayed reasonably aligned with results across the block.",
    tone: "neutral",
  };
}

function buildReviewVsNewSignal(attempts: DrillAttempt[]): { label: string; detail: string; tone: "good" | "warning" | "neutral" } {
  const reviewAttempts = attempts.filter((attempt) => attempt.selection.kind === "review");
  const newAttempts = attempts.filter((attempt) => attempt.selection.kind === "new");

  if (reviewAttempts.length === 0 || newAttempts.length === 0) {
    return {
      label: "Single-lens block",
      detail: "This session leaned heavily toward one kind of rep, so the next block should use the surfaced leak rather than compare review and expansion directly.",
      tone: "neutral",
    };
  }

  const reviewAccuracy = ratio(reviewAttempts.filter((attempt) => attempt.correct).length, reviewAttempts.length);
  const newAccuracy = ratio(newAttempts.filter((attempt) => attempt.correct).length, newAttempts.length);

  if (reviewAccuracy + 0.15 < newAccuracy) {
    return {
      label: "Review work lagged",
      detail: `Review decisions landed at ${Math.round(reviewAccuracy * 100)}%, below new spots at ${Math.round(newAccuracy * 100)}%, so reinforcement still needs attention.`,
      tone: "warning",
    };
  }

  if (newAccuracy + 0.15 < reviewAccuracy) {
    return {
      label: "New spots were the stretch",
      detail: `New material landed at ${Math.round(newAccuracy * 100)}%, below review at ${Math.round(reviewAccuracy * 100)}%, which means expansion is where the edge is being tested.`,
      tone: "neutral",
    };
  }

  return {
    label: "Balanced across the block",
    detail: `Review and new material stayed in a similar range, so the biggest edge is in the leak cluster rather than the session mix itself.`,
    tone: "good",
  };
}

function rankImportantDrills(attempts: DrillAttempt[]): DrillAttempt[] {
  const incorrect = [...attempts]
    .filter((attempt) => !attempt.correct)
    .sort((a, b) => scoreImportantDrill(b) - scoreImportantDrill(a));

  if (incorrect.length > 0) {
    return incorrect.slice(0, 3);
  }

  return [...attempts]
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.min(2, attempts.length));
}

function scoreImportantDrill(attempt: DrillAttempt): number {
  return ((1 - attempt.score) * 100)
    + (confidenceWeight(attempt.confidence) * 12)
    + (attempt.missedTags.length * 6);
}

function confidenceWeight(confidence: DecisionConfidence): number {
  if (confidence === "certain") {
    return 3;
  }

  if (confidence === "pretty_sure") {
    return 2;
  }

  return 1;
}

function buildImportantDrillDetail(attempt: DrillAttempt, adaptiveSignal: string): string {
  const leadTag = attempt.missedTags[0] ?? attempt.drill.answer.required_tags[0] ?? null;
  if (!attempt.correct && leadTag) {
    return `${formatSessionLabel(leadTag)} missed while you were ${formatDecisionConfidence(attempt.confidence).toLowerCase()}. This is one of the cleanest review entries from the session. ${adaptiveSignal}`.trim();
  }

  if (!attempt.correct) {
    return `Low score and weak resolution make this one of the highest-value mistakes to revisit. ${adaptiveSignal}`.trim();
  }

  return `This decision landed, but it was still one of the softest scores in the block and is worth a second pass if you want a deeper review. ${adaptiveSignal}`.trim();
}

function buildAuthoredFollowUpSummary(attempts: DrillAttempt[]): {
  summary: string;
  detail?: string;
  concepts: string[];
} | undefined {
  const followUps = attempts
    .map((attempt) => ({
      text: attempt.drill.coaching_context?.follow_up?.trim(),
      concepts: attempt.drill.coaching_context?.follow_up_concepts ?? [],
    }))
    .filter((entry): entry is { text: string; concepts: string[] } => Boolean(entry.text));

  if (followUps.length === 0) {
    return undefined;
  }

  const conceptCounts = new Map<string, number>();
  for (const concept of followUps.flatMap((entry) => entry.concepts)) {
    conceptCounts.set(concept, (conceptCounts.get(concept) ?? 0) + 1);
  }

  return {
    summary: `Coach assignment: ${followUps[0].text}`,
    detail: followUps.length > 1 ? `${followUps[0].text} Similar follow-up work appears across ${followUps.length} priority drills.` : followUps[0].text,
    concepts: [...conceptCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([concept]) => concept),
  };
}

function buildOutcomeFraming(accuracy: number, averageScore: number): string {
  if (accuracy >= 0.75 && averageScore >= 0.75) {
    return "A stable session: more decisions landed than slipped, and the debrief is about sharpening edges rather than repairing a breakdown.";
  }

  if (accuracy >= 0.55) {
    return "A usable session read: the block stayed mixed, but the strongest improvement and leak signals surfaced clearly enough to act on.";
  }

  return "A tougher session, but a productive one: the block exposed clear leak patterns that give the next review and training step real direction.";
}

function formatAverageSeconds(attempts: DrillAttempt[]): string {
  if (attempts.length === 0) {
    return "0.0";
  }

  const averageMs = attempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) / attempts.length;
  return (averageMs / 1000).toFixed(1);
}

function findTopKey(values: string[]): { key: string; count: number } | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked[0] ? { key: ranked[0][0], count: ranked[0][1] } : undefined;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}
