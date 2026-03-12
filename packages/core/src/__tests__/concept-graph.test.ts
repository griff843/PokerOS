import { describe, expect, it } from "vitest";
import { buildConceptGraph, mapSignalToConceptKeys } from "../concept-graph";
import type { CanonicalDrill } from "../schemas";

function makeDrill(conceptTag: string): CanonicalDrill {
  return {
    drill_id: `d_${conceptTag.replace(/[:_]/g, "_")}`,
    node_id: "hu_01",
    version: "1.0.0",
    title: "Test Drill",
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
      required_tags: ["paired_top_river"],
      explanation: "Call.",
    },
    tags: [conceptTag, "decision:bluff_catch"],
    difficulty: 2,
  };
}

describe("concept graph", () => {
  it("maps rule tags into reusable concept nodes", () => {
    expect(mapSignalToConceptKeys("scare_river_ace")).toContain("scare_card_pressure");
    expect(mapSignalToConceptKeys("paired_top_river")).toContain("river_defense");
  });

  it("adds unknown concept tags without inventing relationships", () => {
    const graph = buildConceptGraph([makeDrill("concept:turn_probe")]);
    expect(graph.nodes.some((node) => node.key === "turn_probe")).toBe(false);
    const dynamicGraph = buildConceptGraph([makeDrill("concept:stack_realization")]);
    expect(dynamicGraph.nodes.some((node) => node.key === "stack_realization")).toBe(true);
  });
});
