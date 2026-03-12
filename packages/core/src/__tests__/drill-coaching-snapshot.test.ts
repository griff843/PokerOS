import { describe, expect, it } from "vitest";
import { buildDrillCoachingSnapshot } from "../drill-coaching-snapshot";
import type { AdaptiveCoachingProfile } from "../adaptive-coaching";
import type { CanonicalDrill } from "../schemas";

function makeDrill(): CanonicalDrill {
  return {
    drill_id: "drill_1",
    node_id: "hu_btn_vs_bb_river",
    version: "1.0.0",
    title: "River bluff-catcher",
    prompt: "BTN barrels river for 75%. What should Hero do?",
    scenario: {
      game: "NLHE Cash",
      street: "river",
      pot_type: "SRP",
      players_to_flop: 2,
      hero_position: "BB",
      villain_position: "BTN",
      board: { flop: ["As", "Kd", "2c"], turn: "7h", river: "3d" },
      hero_hand: ["Ah", "Qc"],
      action_history: [],
    },
    decision_point: {
      street: "river",
      facing: { action: "bet", size_pct_pot: 75 },
      sizing_buttons_enabled: false,
    },
    options: [
      { key: "CALL", label: "Call" },
      { key: "FOLD", label: "Fold" },
    ],
    answer: {
      correct: "CALL",
      accepted: [],
      required_tags: ["paired_top_river"],
      explanation: "Call because the bluff-catchers with strong blockers stay in range.",
    },
    answer_by_pool: {
      B: {
        correct: "FOLD",
        accepted: [],
        required_tags: ["underfold_exploit"],
        explanation: "Pool B underbluffs enough that this becomes an exploit fold.",
      },
    },
    tags: ["street:river", "concept:blocker_effect", "pool:pool_b"],
    difficulty: 2,
    coaching_context: {
      key_concept: "Blockers matter more than absolute pair strength here.",
      common_mistake: "Calling because top pair feels too strong to fold.",
      why_preferred_line_works: "Calling works when Villain still arrives with enough missed draws after triple-barreling.",
      population_note: "Pool B does not find enough river bluffs in this line.",
      follow_up: "Review river bluff-catcher spots where underbluffing changes the threshold.",
      what_changed_by_street: [
        { street: "turn", detail: "The turn keeps bluffs alive while value stays polar." },
        { street: "river", detail: "The river decides whether enough missed draws survive." },
      ],
      range_support: {
        blocker_notes: ["Ace-high blockers remove key value while leaving natural misses."],
        threshold_notes: ["This combo sits above the baseline bluff-catching threshold."],
        bluff_catchers: [{ label: "Strong bluff catchers", combos: ["AQ", "AJ"] }],
      },
    },
  };
}

function makeAdaptiveProfile(): AdaptiveCoachingProfile {
  return {
    generatedAt: "2026-03-11T12:00:00.000Z",
    summary: "Street story and practical thresholds need more emphasis.",
    tendencies: [
      {
        key: "line_confused_player",
        label: "Street story is getting lost",
        summary: "The learner is not carrying the line cleanly street to street.",
        confidence: 0.78,
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
      prioritizeThresholdRetests: true,
      prioritizeLineReconstruction: true,
      prioritizeBlockerNotes: true,
      prioritizeConfidenceCalibration: false,
      prioritizeRealPlayReview: true,
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

describe("drill coaching snapshot", () => {
  it("builds drill-level coaching for a correct answer", () => {
    const snapshot = buildDrillCoachingSnapshot({
      drill: makeDrill(),
      activePool: "baseline",
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 1,
      correct: true,
      matchedTags: ["paired_top_river"],
      missedTags: [],
    });

    expect(snapshot.verdict.label).toBe("Correct line");
    expect(snapshot.whyCorrect.detail).toContain("Calling works");
    expect(snapshot.whyMistake).toBeNull();
    expect(snapshot.keyConcept.headline).toContain("Blockers matter");
  });

  it("builds drill-level coaching for an incorrect answer", () => {
    const snapshot = buildDrillCoachingSnapshot({
      drill: makeDrill(),
      activePool: "baseline",
      userAction: "FOLD",
      userTags: [],
      score: 0,
      correct: false,
      matchedTags: [],
      missedTags: ["paired_top_river"],
    });

    expect(snapshot.verdict.label).toBe("Adjustment needed");
    expect(snapshot.whyMistake?.headline).toContain("top pair feels too strong to fold");
    expect(snapshot.nextAdjustment.detail).toContain("Review river bluff-catcher spots");
  });

  it("adapts snapshot emphasis from the learner profile while keeping the contract stable", () => {
    const snapshot = buildDrillCoachingSnapshot({
      drill: makeDrill(),
      activePool: "baseline",
      userAction: "FOLD",
      userTags: [],
      score: 0,
      correct: false,
      matchedTags: [],
      missedTags: ["paired_top_river"],
    }, makeAdaptiveProfile());

    expect(snapshot.adaptiveContext?.headline).toContain("Street story");
    expect(snapshot.whyCorrect.detail).toContain("Street story first");
    expect(snapshot.nextAdjustment.detail).toContain("Tie the correction back to practical transfer");
  });

  it("surfaces exploit contrast when the selected pool changes the recommendation", () => {
    const snapshot = buildDrillCoachingSnapshot({
      drill: makeDrill(),
      activePool: "B",
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 0,
      correct: false,
      matchedTags: [],
      missedTags: ["underfold_exploit"],
    });

    expect(snapshot.exploitContrast.applies).toBe(true);
    expect(snapshot.exploitContrast.baselineAction).toBe("CALL");
    expect(snapshot.exploitContrast.selectedPoolAction).toBe("FOLD");
    expect(snapshot.exploitContrast.detail).toContain("Pool B does not find enough river bluffs");
  });

  it("stays compatible with drills that do not override by pool", () => {
    const drill = { ...makeDrill(), answer_by_pool: undefined };
    const snapshot = buildDrillCoachingSnapshot({
      drill,
      activePool: "C",
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 1,
      correct: true,
      matchedTags: ["paired_top_river"],
      missedTags: [],
    });

    expect(snapshot.exploitContrast.applies).toBe(false);
    expect(snapshot.exploitContrast.selectedPoolAction).toBeNull();
  });

  it("keeps a stable typed response bundle for every coaching mode", () => {
    const snapshot = buildDrillCoachingSnapshot({
      drill: makeDrill(),
      activePool: "baseline",
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 1,
      correct: true,
      matchedTags: ["paired_top_river"],
      missedTags: [],
    });

    expect(Object.keys(snapshot.responses)).toEqual([
      "correct_answer",
      "mistake_review",
      "pool_contrast",
      "next_adjustment",
    ]);
    expect(snapshot.responses.correct_answer.llmPayload.kind).toBe("drill_coaching");
  });
});

