import { describe, expect, it } from "vitest";
import type { DrillAttempt } from "./session-types";
import { hydrateDrillAttempt, toAttemptInsertRow, toPersistedAttemptRecord } from "./study-attempts";

function makeAttempt(): DrillAttempt {
  const drill: DrillAttempt["drill"] = {
    drill_id: "d1",
    node_id: "hu_river_01",
    version: "1.0.0",
    title: "River Bluff Catch",
    prompt: "Call or fold?",
    scenario: {
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
      explanation: "Call the bluff-catcher.",
    },
    tags: ["concept:blocker_effect", "decision:bluff_catch"],
    difficulty: 2,
  };

  return {
    attemptId: "a1",
    timestamp: "2026-03-10T12:00:00.000Z",
    reflection: "Blockers unblock missed draws.",
    diagnostic: {
      promptId: "river_reasoning",
      prompt: "What bluffs still reach this river?",
      promptType: "range_construction",
      concept: "river bluff catching",
      expectedReasoning: "Missed delayed floats survive.",
      optionId: "missed_floats",
      optionLabel: "Missed floats survive",
      result: {
        promptId: "river_reasoning",
        prompt: "What bluffs still reach this river?",
        promptType: "range_construction",
        concept: "river bluff catching",
        conceptKey: "river_bluff_catching",
        expectedReasoning: "Missed delayed floats survive.",
        optionId: "missed_floats",
        optionLabel: "Missed floats survive",
        matchedExpectedReasoning: true,
        errorType: "confidence_miscalibration",
        confidenceMiscalibration: true,
        headline: "You matched the right reasoning and the right action in river bluff catching.",
        detail: "Expected reasoning held.",
        nextFocus: "Stay with river bluff catching.",
      },
    },
    drill,
    selection: {
      drill,
      kind: "review",
      reason: "due_review",
      matchedWeaknessTargets: ["overall:classification_tag:concept:blocker_effect"],
      metadata: { priorAttempts: 2, lastScore: 0.4, weaknessPriority: 0.8 },
    },
    activePool: "B",
    resolvedAnswer: drill.answer,
    userAction: "FOLD",
    userSizeBucket: null,
    userTags: ["paired_top_river"],
    confidence: "certain",
    score: 0.25,
    actionScore: 0,
    sizingScore: 1,
    tagScore: 0,
    correct: false,
    missedTags: ["paired_top_river"],
    matchedTags: [],
    elapsedMs: 1800,
  };
}

describe("study attempts persistence helpers", () => {
  it("round-trips a persisted attempt through the database row shape", () => {
    const original = makeAttempt();
    const record = toPersistedAttemptRecord(original, "session-1");
    const row = toAttemptInsertRow(record);
    const hydrated = hydrateDrillAttempt(row, original.drill);

    expect(row.session_id).toBe("session-1");
    expect(row.selected_action).toBe("FOLD");
    expect(row.confidence).toBe("certain");
    expect(row.tags_json).toBe(JSON.stringify(["paired_top_river"]));
    expect(hydrated?.attemptId).toBe(original.attemptId);
    expect(hydrated?.reflection).toBe(original.reflection);
    expect(hydrated?.selection.reason).toBe("due_review");
    expect(hydrated?.resolvedAnswer.correct).toBe("CALL");
    expect(hydrated?.diagnostic?.result.conceptKey).toBe("river_bluff_catching");
  });
});

