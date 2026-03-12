import { describe, expect, it } from "vitest";
import { buildCoachingPatternSnapshot, collectPatternBiases } from "../patterns";

describe("coaching patterns", () => {
  it("classifies repeated threshold leaks and transfer gaps from longitudinal evidence", () => {
    const snapshot = buildCoachingPatternSnapshot({
      attempts: [
        {
          drillId: "d1",
          nodeId: "river_1",
          ts: "2026-03-10T10:00:00.000Z",
          sessionId: "s1",
          conceptKeys: ["river_bluff_catching"],
          missedTags: ["paired_top_river"],
          score: 0.32,
          correct: false,
          diagnosticType: "threshold_error",
          diagnosticConceptKey: "river_bluff_catching",
          activePool: "B",
        },
        {
          drillId: "d2",
          nodeId: "river_2",
          ts: "2026-03-11T10:00:00.000Z",
          sessionId: "s2",
          conceptKeys: ["river_bluff_catching"],
          missedTags: ["paired_top_river"],
          score: 0.36,
          correct: false,
          diagnosticType: "threshold_error",
          diagnosticConceptKey: "river_bluff_catching",
          activePool: "B",
        },
      ],
      diagnoses: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-10T10:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.85, createdAt: "2026-03-11T10:00:00.000Z" },
      ],
      interventions: [
        {
          id: "i1",
          conceptKey: "river_bluff_catching",
          source: "command_center",
          status: "completed",
          createdAt: "2026-03-09T10:00:00.000Z",
          improved: true,
          preScore: 0.36,
          postScore: 0.72,
          outcomeCreatedAt: "2026-03-12T10:00:00.000Z",
        },
      ],
      concepts: [
        {
          conceptKey: "river_bluff_catching",
          label: "River Bluff Catching",
          recoveryStage: "recovered",
          trainingUrgency: 0.62,
          recurrenceCount: 3,
          reviewPressure: 1,
          weaknessRole: "primary",
          supportingConceptKeys: [],
          trendDirection: "improving",
          averageScore: 0.72,
          recommendedPool: "B",
          evidence: ["River bluff catching is recovering in drills."],
        },
      ],
      realPlaySignals: [
        {
          conceptKey: "river_bluff_catching",
          label: "River Bluff Catching",
          occurrences: 2,
          reviewSpotCount: 2,
          weight: 0.18,
          recommendedPool: "B",
          evidence: ["Imported hands are still surfacing this concept."],
        },
      ],
      now: new Date("2026-03-12T12:00:00.000Z"),
    });

    expect(snapshot.patterns.some((pattern) => pattern.type === "persistent_threshold_leak")).toBe(true);
    expect(snapshot.patterns.some((pattern) => pattern.type === "real_play_transfer_gap")).toBe(true);
    expect(collectPatternBiases(snapshot.patterns, ["river_bluff_catching"])).toContain("real_play_transfer");
  });

  it("flags interventions that regress after earlier recovery", () => {
    const snapshot = buildCoachingPatternSnapshot({
      attempts: [],
      diagnoses: [],
      interventions: [
        {
          id: "i1",
          conceptKey: "turn_defense",
          source: "session_review",
          status: "completed",
          createdAt: "2026-03-01T10:00:00.000Z",
          improved: true,
          preScore: 0.31,
          postScore: 0.68,
          outcomeCreatedAt: "2026-03-04T10:00:00.000Z",
        },
        {
          id: "i2",
          conceptKey: "turn_defense",
          source: "command_center",
          status: "regressed",
          createdAt: "2026-03-08T10:00:00.000Z",
          improved: false,
          preScore: 0.61,
          postScore: 0.41,
          outcomeCreatedAt: "2026-03-12T10:00:00.000Z",
        },
      ],
      concepts: [
        {
          conceptKey: "turn_defense",
          label: "Turn Defense",
          recoveryStage: "regressed",
          trainingUrgency: 0.84,
          recurrenceCount: 2,
          reviewPressure: 3,
          weaknessRole: "primary",
          supportingConceptKeys: [],
          trendDirection: "worsening",
          averageScore: 0.41,
          recommendedPool: "B",
          evidence: ["Turn defense slipped after earlier recovery."],
        },
      ],
      now: new Date("2026-03-12T12:00:00.000Z"),
    });

    expect(snapshot.topPatterns.some((pattern) => pattern.type === "intervention_not_sticking")).toBe(true);
    expect(snapshot.topPatterns.some((pattern) => pattern.type === "regression_after_recovery")).toBe(true);
  });
});
