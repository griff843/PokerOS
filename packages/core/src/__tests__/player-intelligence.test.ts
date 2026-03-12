import { describe, expect, it } from "vitest";
import { buildPlayerIntelligenceSnapshot } from "../player-intelligence";
import type { AttemptInsight, CanonicalDrill } from "../index";

function makeDrill(options: {
  drillId: string;
  nodeId: string;
  title: string;
  conceptTag: string;
  requiredTag: string;
}): CanonicalDrill {
  return {
    drill_id: options.drillId,
    node_id: options.nodeId,
    version: "1.0.0",
    title: options.title,
    prompt: "Choose the best line.",
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
      required_tags: [options.requiredTag],
      explanation: "Call the bluff-catcher.",
    },
    tags: [options.conceptTag, "decision:bluff_catch"],
    difficulty: 2,
    diagnostic_prompts: [
      {
        id: "reasoning",
        prompt: "Why does this bluff catcher continue?",
        type: "threshold",
        concept: "river bluff catching",
        expected_reasoning: "Enough bluffs survive to defend.",
        options: [
          { id: "fold_more", label: "Fold more", diagnosis: "threshold_error" },
          { id: "defend", label: "Defend", matches_expected: true },
        ],
      },
    ],
  };
}

describe("player intelligence", () => {
  it("marks upstream concepts separately from downstream symptoms", () => {
    const drills: CanonicalDrill[] = [
      makeDrill({ drillId: "d1", nodeId: "hu_turn_01", title: "Turn Defense", conceptTag: "concept:turn_probe", requiredTag: "turn_overbet_faced" }),
      makeDrill({ drillId: "d2", nodeId: "hu_river_01", title: "River Defense", conceptTag: "concept:blocker_effect", requiredTag: "paired_top_river" }),
    ];

    const insights: AttemptInsight[] = [
      { drillId: "d1", nodeId: "hu_turn_01", score: 0.22, correct: false, missedTags: ["turn_overbet_faced"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_turn_01", score: 0.28, correct: false, missedTags: ["turn_overbet_faced"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_turn_01", score: 0.3, correct: false, missedTags: ["turn_overbet_faced"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_river_01", score: 0.34, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_river_01", score: 0.38, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_river_01", score: 0.42, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
    ];

    const snapshot = buildPlayerIntelligenceSnapshot({
      drills,
      attemptInsights: insights,
      activePool: "B",
    });

    const turnDefense = snapshot.priorities.find((concept) => concept.conceptKey === "turn_defense");
    const riverDefense = snapshot.priorities.find((concept) => concept.conceptKey === "river_defense");

    expect(turnDefense?.weaknessRole).toBe("upstream");
    expect(riverDefense?.weaknessRole).toBe("downstream");
    expect(snapshot.recommendations[0]?.rationale).toContain("supports other shaky concepts");
  });

  it("lets diagnostic signals lift the next concept recommendation", () => {
    const drills = [makeDrill({ drillId: "d1", nodeId: "hu_river_01", title: "River Defense", conceptTag: "concept:blocker_effect", requiredTag: "paired_top_river" })];
    const snapshot = buildPlayerIntelligenceSnapshot({
      drills,
      attemptInsights: [
        { drillId: "d1", nodeId: "hu_river_01", score: 0.45, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      ],
      activePool: "B",
      diagnosticInsights: [
        { conceptKey: "river_bluff_catching", concept: "river bluff catching", errorType: "threshold_error", confidenceMiscalibration: false },
        { conceptKey: "river_bluff_catching", concept: "river bluff catching", errorType: "threshold_error", confidenceMiscalibration: false },
      ],
    });

    expect(snapshot.concepts.find((concept) => concept.conceptKey === "river_bluff_catching")?.evidence.some((entry) => entry.includes("threshold error"))).toBe(true);
  });

  it("incorporates intervention history into the coaching memory summary", () => {
    const drills = [makeDrill({ drillId: "d1", nodeId: "hu_river_01", title: "River Defense", conceptTag: "concept:blocker_effect", requiredTag: "paired_top_river" })];
    const snapshot = buildPlayerIntelligenceSnapshot({
      drills,
      attemptInsights: [
        { drillId: "d1", nodeId: "hu_river_01", score: 0.41, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      ],
      activePool: "B",
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-10T10:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.8, createdAt: "2026-03-11T10:00:00.000Z" },
      ],
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "completed", improved: true, preScore: 0.35, postScore: 0.72, createdAt: "2026-03-09T10:00:00.000Z" },
      ],
    });

    expect(snapshot.memory.diagnosisCount).toBe(2);
    expect(snapshot.memory.completedInterventions).toBe(1);
    expect(snapshot.memory.interventionSuccessRate).toBe(1);
    expect(snapshot.memory.recoveredConcepts).toContain("river_bluff_catching");
  });

  it("surfaces confidence mismatch only when the evidence is real", () => {
    const drills = [makeDrill({ drillId: "d1", nodeId: "hu_river_01", title: "River Defense", conceptTag: "concept:blocker_effect", requiredTag: "paired_top_river" })];
    const insights: AttemptInsight[] = [
      { drillId: "d1", nodeId: "hu_river_01", score: 0.4, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.35, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
    ];

    const snapshot = buildPlayerIntelligenceSnapshot({
      drills,
      attemptInsights: insights,
      activePool: "B",
      confidenceInsights: [
        { confidence: "certain", correct: false, classificationTags: ["concept:blocker_effect"], missedTags: ["paired_top_river"] },
        { confidence: "certain", correct: false, classificationTags: ["concept:blocker_effect"], missedTags: ["paired_top_river"] },
      ],
    });

    expect(snapshot.priorities[0]?.confidenceMismatch?.direction).toBe("overconfident");
  });
});
