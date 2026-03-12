import { describe, expect, it } from "vitest";
import type { AdaptiveCoachingProfile, CanonicalDrill } from "@poker-coach/core/browser";
import type { DrillAttempt } from "./session-types";
import {
  buildDrillCoachingInputFromAttempt,
  buildDrillCoachingSnapshotFromAttempt,
  buildReviewCoachModeViews,
  getDefaultReviewCoachMode,
} from "./drill-coach-view";

function makeDrill(overrides: Partial<CanonicalDrill> = {}): CanonicalDrill {
  return {
    drill_id: overrides.drill_id ?? "d1",
    node_id: overrides.node_id ?? "hu_01",
    version: "1.0.0",
    title: overrides.title ?? "River Bluff Catch",
    prompt: overrides.prompt ?? "BTN bets 75% on the river. What should Hero do?",
    scenario: overrides.scenario ?? {
      game: "NLHE Cash",
      street: "river",
      pot_type: "SRP",
      players_to_flop: 2,
      hero_position: "BB",
      villain_position: "BTN",
      board: {
        flop: ["As", "Kd", "2c"],
        turn: "7h",
        river: "3d",
      },
      hero_hand: ["Ah", "Qc"],
      action_history: [],
    },
    decision_point: overrides.decision_point ?? {
      street: "river",
      facing: { action: "bet", size_pct_pot: 75 },
      sizing_buttons_enabled: false,
    },
    options: overrides.options ?? [
      { key: "CALL", label: "Call" },
      { key: "FOLD", label: "Fold" },
    ],
    answer: overrides.answer ?? {
      correct: "CALL",
      accepted: [],
      required_tags: ["paired_top_river"],
      explanation: "Call the bluff-catcher.",
    },
    answer_by_pool: overrides.answer_by_pool,
    tags: overrides.tags ?? ["street:river", "concept:blocker_effect", "pool:baseline"],
    difficulty: overrides.difficulty ?? 2,
    coaching_context: overrides.coaching_context ?? {
      key_concept: "Blockers define the bluff-catch threshold.",
      population_note: "Pool B underbluffs enough to fold more often.",
      follow_up: "Review more river bluff-catcher spots.",
      what_changed_by_street: [
        { street: "river", detail: "The river leaves only some missed draws alive." },
      ],
      range_support: {
        blocker_notes: ["Ace-high blockers remove key value while preserving misses."],
      },
    },
  };
}

function makeAttempt(overrides: Partial<DrillAttempt> = {}): DrillAttempt {
  const drill = overrides.drill ?? makeDrill();

  return {
    attemptId: overrides.attemptId ?? "attempt-1",
    timestamp: overrides.timestamp ?? "2026-03-10T12:00:00.000Z",
    reflection: overrides.reflection ?? "",
    drill,
    selection: overrides.selection ?? {
      drill,
      kind: "review",
      reason: "due_review",
      matchedWeaknessTargets: [],
      metadata: { priorAttempts: 1 },
    },
    activePool: overrides.activePool ?? "baseline",
    resolvedAnswer: overrides.resolvedAnswer ?? drill.answer,
    userAction: overrides.userAction ?? "FOLD",
    userSizeBucket: overrides.userSizeBucket ?? null,
    userTags: overrides.userTags ?? [],
    confidence: overrides.confidence ?? "pretty_sure",
    score: overrides.score ?? 0.25,
    actionScore: overrides.actionScore ?? 0,
    sizingScore: overrides.sizingScore ?? 0,
    tagScore: overrides.tagScore ?? 0,
    correct: overrides.correct ?? false,
    missedTags: overrides.missedTags ?? ["paired_top_river"],
    matchedTags: overrides.matchedTags ?? [],
    elapsedMs: overrides.elapsedMs ?? 1800,
  };
}

function makeAdaptiveProfile(): AdaptiveCoachingProfile {
  return {
    generatedAt: "2026-03-11T12:00:00.000Z",
    summary: "Lead with line story.",
    tendencies: [
      {
        key: "line_confused_player",
        label: "Street story is getting lost",
        summary: "The learner is not carrying the line cleanly street to street.",
        confidence: 0.74,
        evidence: ["Repeated line misunderstandings are showing up."],
        teachingAdjustments: ["Lead with line reconstruction before threshold details."],
      },
    ],
    coachingEmphasis: {
      explanationBullets: ["Lead explanations with the street-by-street story before naming the final action."],
      interventionBullets: ["Let line-reconstruction reps lead before threshold retests."],
      confidenceHandling: "Keep confidence honest.",
      recommendationFraming: "Tie the correction back to practical transfer.",
    },
    interventionAdjustments: {
      preferShorterReviewBlocks: false,
      prioritizeThresholdRetests: false,
      prioritizeLineReconstruction: true,
      prioritizeBlockerNotes: false,
      prioritizeConfidenceCalibration: false,
      prioritizeRealPlayReview: false,
    },
    surfaceSignals: {
      commandCenter: "Rebuild the line first.",
      studySession: "On this rep, rebuild what each street did to the ranges before locking the action.",
      sessionReview: "Review should emphasize where the line stopped making sense.",
      weaknessExplorer: "Read the top leaks as story-reconstruction problems.",
      growthProfile: "Learner-specific adaptation is now visible.",
      review: "Narrate the line before deciding again.",
    },
  };
}

describe("drill coach review adapter", () => {
  it("builds all four premium review modes from a drill attempt", () => {
    const views = buildReviewCoachModeViews(makeAttempt());

    expect(views).toHaveLength(4);
    expect(views.map((view) => view.mode)).toEqual([
      "mistake_review",
      "correct_answer",
      "pool_contrast",
      "next_adjustment",
    ]);
  });

  it("builds a reusable coaching snapshot for correct answers", () => {
    const snapshot = buildDrillCoachingSnapshotFromAttempt(makeAttempt({
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 1,
      correct: true,
      matchedTags: ["paired_top_river"],
      missedTags: [],
    }));

    expect(snapshot.correct).toBe(true);
    expect(snapshot.whyMistake).toBeNull();
    expect(snapshot.whyCorrect.headline).toContain("CALL");
    expect(snapshot.nextAdjustment.detail.length).toBeGreaterThan(0);
  });

  it("threads the adaptive profile into the shared coaching snapshot", () => {
    const snapshot = buildDrillCoachingSnapshotFromAttempt(makeAttempt(), makeAdaptiveProfile());

    expect(snapshot.adaptiveContext?.headline).toContain("Street story");
    expect(snapshot.whyCorrect.detail).toContain("Street story first");
  });

  it("marks pool contrast as non-applicable when the answer does not vary by pool", () => {
    const views = buildReviewCoachModeViews(makeAttempt({ activePool: "baseline" }));
    const poolContrast = views.find((view) => view.mode === "pool_contrast");

    expect(poolContrast?.applicable).toBe(false);
    expect(poolContrast?.emptyMessage).toContain("does not materially change across the active pool context");
  });

  it("preserves pool contrast when a pool override changes the answer", () => {
    const drill = makeDrill({
      answer_by_pool: {
        B: {
          correct: "FOLD",
          accepted: [],
          required_tags: ["underfold_exploit"],
          explanation: "Pool B folds more.",
        },
      },
    });
    const snapshot = buildDrillCoachingSnapshotFromAttempt(makeAttempt({
      drill,
      activePool: "B",
      resolvedAnswer: drill.answer_by_pool?.B ?? drill.answer,
      userAction: "CALL",
      missedTags: ["underfold_exploit"],
    }));

    expect(snapshot.exploitContrast.applies).toBe(true);
    expect(snapshot.exploitContrast.baselineAction).toBe("CALL");
    expect(snapshot.exploitContrast.selectedPoolAction).toBe("FOLD");
  });

  it("keeps the shared coaching input aligned with the attempt outcome", () => {
    const attempt = makeAttempt({
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 1,
      correct: true,
      matchedTags: ["paired_top_river"],
      missedTags: [],
    });
    const input = buildDrillCoachingInputFromAttempt(attempt);

    expect(input.resolvedAnswer?.correct).toBe(attempt.resolvedAnswer.correct);
    expect(input.userAction).toBe("CALL");
    expect(input.correct).toBe(true);
  });

  it("defaults the preferred review mode to correct-answer when the attempt is correct", () => {
    const mode = getDefaultReviewCoachMode(makeAttempt({ correct: true, score: 1 }));
    expect(mode).toBe("correct_answer");
  });
});
