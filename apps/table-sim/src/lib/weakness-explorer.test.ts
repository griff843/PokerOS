import { describe, expect, it } from "vitest";
import type { AttemptInsight, CanonicalDrill } from "@poker-coach/core/browser";
import { buildWeaknessExplorerSnapshot } from "./weakness-explorer";

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
  };
}

describe("weakness explorer snapshot", () => {
  it("ranks priority weaknesses and exposes honest movement signals", () => {
    const drills: CanonicalDrill[] = [
      makeDrill({ drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", conceptTag: "concept:blocker_effect", requiredTag: "paired_top_river" }),
      makeDrill({ drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", conceptTag: "concept:turn_probe", requiredTag: "turn_probe" }),
    ];

    const attemptInsights: AttemptInsight[] = [
      { drillId: "d1", nodeId: "hu_river_01", score: 0.22, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.28, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.32, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.42, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.4, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.38, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.55, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.58, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.6, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.12, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.18, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.16, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
    ];

    const snapshot = buildWeaknessExplorerSnapshot({
      drills,
      attemptInsights,
      srs: [{ drill_id: "d1", due_at: "2026-03-09T10:00:00.000Z" }],
      activePool: "B",
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(snapshot.priorityWeaknesses[0]?.label).toBe("Blocker Effects");
    expect(snapshot.priorityWeaknesses[0]?.urgency).toBe("Urgent now");
    expect(snapshot.movementSignals.some((signal) => signal.label.includes("Worsening"))).toBe(true);
    expect(snapshot.movementSignals.some((signal) => signal.label.includes("Improving"))).toBe(true);
    expect(snapshot.trainingActions[0]?.recommendedPool).toBe("B");
    expect(snapshot.trainingActions[0]?.detail.length).toBeGreaterThan(0);
    expect(snapshot.priorityWeaknesses[0]).toHaveProperty("coachingPattern");
    expect(snapshot.priorityWeaknesses[0]).toHaveProperty("interventionDecision");
    expect(snapshot.priorityWeaknesses[0]?.caseSummary?.statusLabel).toBeTruthy();
    expect(snapshot.deepReviewGroups[0]?.drills[0]?.title).toBe("River Bluff Catch");
  });
});




