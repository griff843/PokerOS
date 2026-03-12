import { describe, expect, it } from "vitest";
import { buildDiagnosticCapture } from "../diagnostics";
import type { CanonicalDrill } from "../schemas";

describe("diagnostics", () => {
  const drill: CanonicalDrill = {
    drill_id: "d1",
    node_id: "hu_01",
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
      explanation: "Call the bluff catcher.",
    },
    tags: ["concept:blocker_effect", "decision:bluff_catch"],
    difficulty: 2,
    diagnostic_prompts: [
      {
        id: "river_reasoning",
        prompt: "What bluffs still reach this river?",
        type: "threshold",
        concept: "river bluff catching",
        expected_reasoning: "Missed draws still survive often enough that high bluff catchers must continue.",
        options: [
          {
            id: "size_only",
            label: "The size is large enough that most bluff catchers should fold automatically.",
            diagnosis: "threshold_error",
          },
          {
            id: "survive",
            label: "Missed draws still survive often enough that high bluff catchers keep defending.",
            matches_expected: true,
          },
        ],
      },
    ],
  };

  it("classifies threshold misses deterministically", () => {
    const result = buildDiagnosticCapture({
      drill,
      correct: false,
      confidence: "certain",
      promptId: "river_reasoning",
      optionId: "size_only",
    });

    expect(result?.errorType).toBe("threshold_error");
    expect(result?.confidenceMiscalibration).toBe(true);
    expect(result?.conceptKey).toBe("river_bluff_catching");
  });

  it("keeps the diagnosis calm when the reasoning matches", () => {
    const result = buildDiagnosticCapture({
      drill,
      correct: true,
      confidence: "pretty_sure",
      promptId: "river_reasoning",
      optionId: "survive",
    });

    expect(result?.matchedExpectedReasoning).toBe(true);
    expect(result?.errorType).toBe(null);
    expect(result?.headline).toContain("right reasoning");
  });
});
