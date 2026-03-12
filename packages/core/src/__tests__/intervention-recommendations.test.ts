import { describe, expect, it } from "vitest";
import { recommendIntervention } from "../intervention-recommendations";

const baseInput = {
  conceptKey: "river_bluff_catching",
  label: "River Bluff Catching",
  diagnosisHistory: [] as Array<{ conceptKey: string; diagnosticType: string; confidence: number; createdAt: string }>,
  interventionHistory: [] as Array<any>,
  recoveryStage: "unaddressed" as const,
  patterns: [] as Array<any>,
  recurrenceCount: 1,
  reviewPressure: 0,
  trainingUrgency: 0.62,
  trendDirection: "stable" as const,
  recentAverage: 0.45,
  averageScore: 0.45,
  realPlayReviewSpotCount: 0,
  realPlayEvidence: [],
};

describe("intervention recommendations", () => {
  it("assigns a new intervention for a newly diagnosed concept", () => {
    const recommendation = recommendIntervention({
      ...baseInput,
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-12T10:00:00.000Z" },
      ],
      patterns: [
        {
          id: "p1",
          type: "persistent_threshold_leak",
          confidence: "medium",
          severity: 0.7,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["Threshold errors are recurring."],
          coachingImplication: "Retest thresholds.",
          suggestedBiases: ["threshold_retest"],
        },
      ],
    });

    expect(recommendation.action).toBe("assign_intervention");
    expect(recommendation.recommendedStrategy).toBe("threshold_repair");
  });

  it("continues an active intervention when signals are improving", () => {
    const recommendation = recommendIntervention({
      ...baseInput,
      recoveryStage: "active_repair",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "in_progress", createdAt: "2026-03-10T10:00:00.000Z" },
      ],
      trendDirection: "improving",
      recentAverage: 0.66,
      averageScore: 0.52,
    });

    expect(recommendation.action).toBe("continue_intervention");
  });

  it("changes or escalates when the intervention is not sticking", () => {
    const recommendation = recommendIntervention({
      ...baseInput,
      recoveryStage: "active_repair",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "in_progress", createdAt: "2026-03-10T10:00:00.000Z" },
      ],
      patterns: [
        {
          id: "p1",
          type: "intervention_not_sticking",
          confidence: "high",
          severity: 0.82,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["The current intervention has not held."],
          coachingImplication: "Change the repair angle.",
          suggestedBiases: ["repair_intensity"],
        },
      ],
    });

    expect(["change_intervention_strategy", "escalate_intervention"]).toContain(recommendation.action);
  });

  it("runs a retention check on recovered concepts with recurrence risk", () => {
    const recommendation = recommendIntervention({
      ...baseInput,
      recoveryStage: "recovered",
      recurrenceCount: 2,
      reviewPressure: 1,
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "completed", createdAt: "2026-03-08T10:00:00.000Z", improved: true },
      ],
    });

    expect(recommendation.action).toBe("run_retention_check");
    expect(recommendation.recommendedStrategy).toBe("stabilization_reinforcement");
  });

  it("reopens intervention after regression following prior completion", () => {
    const recommendation = recommendIntervention({
      ...baseInput,
      recoveryStage: "regressed",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "completed", createdAt: "2026-03-08T10:00:00.000Z", improved: true },
        { id: "i2", conceptKey: "river_bluff_catching", source: "command_center", status: "regressed", createdAt: "2026-03-12T10:00:00.000Z", improved: false },
      ],
      patterns: [
        {
          id: "p1",
          type: "regression_after_recovery",
          confidence: "high",
          severity: 0.9,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["Recovered once, then regressed."],
          coachingImplication: "Reopen the repair loop.",
          suggestedBiases: ["repair_intensity"],
        },
      ],
    });

    expect(recommendation.action).toBe("reopen_intervention");
  });

  it("adds a transfer block when study improvement is not transferring", () => {
    const recommendation = recommendIntervention({
      ...baseInput,
      recoveryStage: "recovered",
      trendDirection: "improving",
      recentAverage: 0.74,
      averageScore: 0.61,
      realPlayReviewSpotCount: 3,
      patterns: [
        {
          id: "p1",
          type: "real_play_transfer_gap",
          confidence: "high",
          severity: 0.86,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["Real-play transfer has not happened yet."],
          coachingImplication: "Bridge drills to hands.",
          suggestedBiases: ["real_play_transfer"],
        },
      ],
    });

    expect(recommendation.action).toBe("add_transfer_block");
    expect(recommendation.recommendedStrategy).toBe("transfer_training");
  });

  it("escalates intervention intensity when repeated diagnoses do not stabilize", () => {
    const recommendation = recommendIntervention({
      ...baseInput,
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-10T10:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.85, createdAt: "2026-03-11T10:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.8, createdAt: "2026-03-12T10:00:00.000Z" },
      ],
      recurrenceCount: 4,
      trendDirection: "worsening",
      trainingUrgency: 0.83,
    });

    expect(recommendation.action).toBe("escalate_intervention");
    expect(["high", "intensive"]).toContain(recommendation.suggestedIntensity);
  });
});
