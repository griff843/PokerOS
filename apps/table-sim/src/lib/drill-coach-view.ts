import {
  buildDrillCoachingSnapshot,
  buildFallbackDrillCoachResponse,
  type AdaptiveCoachingProfile,
  type DrillCoachResponse,
  type DrillCoachingInput,
  type DrillCoachingMode,
  type DrillCoachingSnapshot,
} from "@poker-coach/core/browser";
import type { DrillAttempt } from "./session-types";

export type ReviewCoachMode = DrillCoachingMode;

export interface ReviewCoachModeOption {
  mode: ReviewCoachMode;
  label: string;
  subtitle: string;
}

export interface ReviewCoachModeView extends ReviewCoachModeOption {
  response: DrillCoachResponse;
  applicable: boolean;
  emptyHeadline?: string;
  emptyMessage?: string;
}

export const REVIEW_COACH_MODE_OPTIONS: ReviewCoachModeOption[] = [
  {
    mode: "mistake_review",
    label: "Mistake Review",
    subtitle: "Why the decision missed",
  },
  {
    mode: "correct_answer",
    label: "Correct Answer",
    subtitle: "What the right line is built on",
  },
  {
    mode: "pool_contrast",
    label: "Pool Contrast",
    subtitle: "What changes by pool",
  },
  {
    mode: "next_adjustment",
    label: "Next Adjustment",
    subtitle: "What to do next time",
  },
];

export function buildDrillCoachingInputFromAttempt(attempt: DrillAttempt): DrillCoachingInput {
  return {
    drill: attempt.drill,
    activePool: attempt.activePool,
    resolvedAnswer: attempt.resolvedAnswer,
    userAction: attempt.userAction,
    userSizeBucket: attempt.userSizeBucket,
    userTags: attempt.userTags,
    score: attempt.score,
    correct: attempt.correct,
    matchedTags: attempt.matchedTags,
    missedTags: attempt.missedTags,
    actionScore: attempt.actionScore,
    tagScore: attempt.tagScore,
    sizingScore: attempt.sizingScore,
    elapsedMs: attempt.elapsedMs,
  };
}

export function buildDrillCoachingSnapshotFromAttempt(
  attempt: DrillAttempt,
  adaptiveProfile?: AdaptiveCoachingProfile
): DrillCoachingSnapshot {
  return buildDrillCoachingSnapshot(buildDrillCoachingInputFromAttempt(attempt), adaptiveProfile);
}

export function buildReviewCoachModeViews(
  attempt: DrillAttempt,
  adaptiveProfile?: AdaptiveCoachingProfile
): ReviewCoachModeView[] {
  const input = buildDrillCoachingInputFromAttempt(attempt);
  const snapshot = buildDrillCoachingSnapshotFromAttempt(attempt, adaptiveProfile);

  return REVIEW_COACH_MODE_OPTIONS.map((option) => {
    const response = snapshot.responses[option.mode] ?? buildFallbackDrillCoachResponse({
      input,
      mode: option.mode,
    });
    const applicable = option.mode !== "pool_contrast" || snapshot.exploitContrast.applies;

    return {
      ...option,
      response,
      applicable,
      ...(applicable ? {} : buildPoolContrastEmptyState(attempt)),
    };
  });
}

export function getDefaultReviewCoachMode(attempt: DrillAttempt): ReviewCoachMode {
  return attempt.correct ? "correct_answer" : "mistake_review";
}

function buildPoolContrastEmptyState(attempt: DrillAttempt): Pick<ReviewCoachModeView, "emptyHeadline" | "emptyMessage"> {
  if (attempt.activePool === "baseline") {
    return {
      emptyHeadline: "This review is already on the baseline answer.",
      emptyMessage: "This spot does not materially change across the active pool context because you are studying the baseline line.",
    };
  }

  return {
    emptyHeadline: `Pool ${attempt.activePool} does not materially change this spot.`,
    emptyMessage: "The selected pool resolves to the same practical answer here, so the coaching focus should stay on the core concept rather than a pool-specific exploit shift.",
  };
}
