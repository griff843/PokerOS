import { describe, expect, it } from "vitest";
import { selectInterventionStrategyBlueprint, type InterventionStrategyContext } from "../browser";

function makeContext(overrides: Partial<InterventionStrategyContext> = {}): InterventionStrategyContext {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    recommendedAction: "assign_intervention",
    recommendedStrategy: "threshold_repair",
    suggestedIntensity: "moderate",
    recoveryStage: "active_repair",
    patternTypes: [],
    recurrenceCount: 2,
    regressionCount: 0,
    reviewPressure: 0,
    transferPressure: false,
    retentionState: undefined,
    ...overrides,
  };
}

describe("intervention strategy library", () => {
  it("resolves every current strategy type to a valid blueprint", () => {
    const strategies: InterventionStrategyContext["recommendedStrategy"][] = [
      "threshold_repair",
      "blocker_recognition",
      "street_transition_repair",
      "transfer_training",
      "stabilization_reinforcement",
      "review_habit_repair",
      "mixed_repair",
    ];

    for (const strategy of strategies) {
      const blueprint = selectInterventionStrategyBlueprint(makeContext({ recommendedStrategy: strategy }));
      expect(blueprint.strategyType).toBe(strategy);
      expect(blueprint.title.length).toBeGreaterThan(0);
      expect(blueprint.objective.length).toBeGreaterThan(0);
      expect(blueprint.recommendedAttemptWindow.attempts).toBeGreaterThan(0);
    }
  });

  it("changes threshold repair shape at higher intensity", () => {
    const medium = selectInterventionStrategyBlueprint(makeContext({
      recommendedStrategy: "threshold_repair",
      suggestedIntensity: "moderate",
    }));
    const high = selectInterventionStrategyBlueprint(makeContext({
      recommendedStrategy: "threshold_repair",
      suggestedIntensity: "intensive",
      recurrenceCount: 4,
    }));

    expect(high.intensity).toBe("high");
    expect(high.recommendedDrillMix.repair).toBeGreaterThan(medium.recommendedDrillMix.repair);
    expect(high.recommendedAttemptWindow.attempts).toBeGreaterThan(medium.recommendedAttemptWindow.attempts);
  });

  it("keeps mixed repair deterministic and sequencing-focused", () => {
    const blueprint = selectInterventionStrategyBlueprint(makeContext({
      recommendedStrategy: "mixed_repair",
      patternTypes: ["persistent_threshold_leak", "downstream_river_symptom"],
    }));

    expect(blueprint.strategyType).toBe("mixed_repair");
    expect(blueprint.sessionEmphasis.some((item) => item.includes("primary"))).toBe(true);
    expect(blueprint.modifiers).toContain("upstream_first");
  });

  it("increases transfer emphasis in transfer-heavy contexts", () => {
    const blueprint = selectInterventionStrategyBlueprint(makeContext({
      recommendedStrategy: "transfer_training",
      suggestedIntensity: "high",
      transferPressure: true,
      patternTypes: ["real_play_transfer_gap"],
    }));

    expect(blueprint.transferEmphasis.some((item) => item.includes("imported-hand") || item.includes("live-like"))).toBe(true);
    expect(blueprint.recommendedDrillMix.applied).toBeGreaterThan(blueprint.recommendedDrillMix.review);
  });

  it("uses lighter repair and stronger validation in stabilizing contexts", () => {
    const blueprint = selectInterventionStrategyBlueprint(makeContext({
      recommendedStrategy: "stabilization_reinforcement",
      suggestedIntensity: "light",
      recoveryStage: "stabilizing",
      retentionState: "due",
    }));

    expect(blueprint.intensity).toBe("low");
    expect(blueprint.recommendedDrillMix.validation).toBeGreaterThan(blueprint.recommendedDrillMix.repair);
    expect(blueprint.retentionFollowUpGuidance.some((item) => item.includes("retention"))).toBe(true);
  });
});
