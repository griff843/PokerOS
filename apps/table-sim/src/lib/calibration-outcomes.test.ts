import { describe, expect, it } from "vitest";
import { buildCalibrationOutcomesBundle } from "./calibration-outcomes";

function makeConcept(overrides: Partial<Parameters<typeof buildCalibrationOutcomesBundle>[0]["concepts"][number]> = {}) {
  return {
    conceptKey: "concept_0",
    label: "Concept 0",
    whyThisStillMattersSeed: "Concept 0 still carries enough pressure that the app should keep it visible.",
    reviewPressure: 1,
    trainingUrgency: 78,
    recoveryStage: "active_repair",
    interventionHistorySummary: {
      total: 1,
      active: 1,
      improved: 0,
      failed: 0,
      latestStatus: "in_progress",
      latestInterventionAt: "2026-03-24T10:00:00.000Z",
    },
    interventionOutcomeSummary: {
      improvedCount: 0,
      failedCount: 0,
      latestImproved: null,
      latestPreScore: null,
      latestPostScore: null,
    },
    retentionSummary: {
      latestState: "scheduled",
      validationState: "provisional" as const,
      lastResult: null,
      dueCount: 0,
      overdueCount: 0,
    },
    transferSummary: {
      status: "transfer_uncertain",
      confidence: "medium",
      pressure: "medium",
      evidenceSufficiency: "moderate",
      reviewSpotCount: 2,
      occurrences: 2,
      summary: "Transfer evidence is still mixed.",
    },
    decisionStability: "shifting" as const,
    recommendation: {
      action: "continue_intervention" as const,
      strategy: "threshold_repair" as const,
      priority: 78,
      summary: "Continue the intervention on Concept 0.",
    },
    nextStep: {
      action: "continue_intervention",
      priority: "high",
      reason: "Keep the current repair block alive.",
    },
    ...overrides,
  };
}

describe("calibration outcomes bundle", () => {
  it("returns an explicit no_meaningful_history state", () => {
    const bundle = buildCalibrationOutcomesBundle({
      concepts: [makeConcept({
        interventionHistorySummary: {
          total: 0,
          active: 0,
          improved: 0,
          failed: 0,
        },
        interventionOutcomeSummary: {
          improvedCount: 0,
          failedCount: 0,
        },
        retentionSummary: {
          validationState: "none",
          dueCount: 0,
          overdueCount: 0,
        },
        transferSummary: {
          status: "no_real_play_evidence",
          confidence: "low",
          pressure: "low",
          evidenceSufficiency: "none",
          reviewSpotCount: 0,
          occurrences: 0,
          summary: "No real-play evidence yet.",
        },
      })],
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.state).toBe("no_meaningful_history");
    expect(bundle.concepts[0]?.evidenceState).toBe("no_meaningful_history");
    expect(bundle.concepts[0]?.trustSignals.trustLevel).toBe("low");
  });

  it("marks partial evidence as inconclusive when outcome proof is still mixed", () => {
    const bundle = buildCalibrationOutcomesBundle({
      concepts: [makeConcept()],
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.state).toBe("partial_evidence");
    expect(bundle.concepts[0]?.interventionState).toBe("inconclusive");
    expect(bundle.concepts[0]?.retentionTrend.summary).toContain("needs confirmation");
  });

  it("marks helping concepts when intervention and transfer evidence are positive", () => {
    const bundle = buildCalibrationOutcomesBundle({
      concepts: [makeConcept({
        interventionHistorySummary: {
          total: 2,
          active: 0,
          improved: 1,
          failed: 0,
          latestStatus: "completed",
          latestInterventionAt: "2026-03-24T10:00:00.000Z",
        },
        interventionOutcomeSummary: {
          improvedCount: 1,
          failedCount: 0,
          latestImproved: true,
          latestPreScore: 0.42,
          latestPostScore: 0.74,
        },
        retentionSummary: {
          latestState: "completed_pass",
          validationState: "validated",
          lastResult: "pass",
          dueCount: 0,
          overdueCount: 0,
        },
        transferSummary: {
          status: "transfer_validated",
          confidence: "high",
          pressure: "low",
          evidenceSufficiency: "strong",
          reviewSpotCount: 3,
          occurrences: 4,
          summary: "Transfer is validated.",
        },
        decisionStability: "stable",
      })],
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.state).toBe("strong_evidence");
    expect(bundle.concepts[0]?.interventionState).toBe("helping");
    expect(bundle.concepts[0]?.evidenceState).toBe("strong_evidence");
    expect(bundle.concepts[0]?.trustSignals.trustLevel).toBe("high");
  });

  it("marks regressing concepts when retention or transfer have slipped", () => {
    const bundle = buildCalibrationOutcomesBundle({
      concepts: [makeConcept({
        recoveryStage: "regressed",
        interventionHistorySummary: {
          total: 2,
          active: 0,
          improved: 1,
          failed: 1,
          latestStatus: "regressed",
          latestInterventionAt: "2026-03-24T10:00:00.000Z",
        },
        interventionOutcomeSummary: {
          improvedCount: 1,
          failedCount: 1,
          latestImproved: false,
          latestPreScore: 0.65,
          latestPostScore: 0.49,
        },
        retentionSummary: {
          latestState: "completed_fail",
          validationState: "failed",
          lastResult: "fail",
          dueCount: 0,
          overdueCount: 0,
        },
        transferSummary: {
          status: "transfer_regressed",
          confidence: "high",
          pressure: "high",
          evidenceSufficiency: "strong",
          reviewSpotCount: 3,
          occurrences: 4,
          summary: "Transfer has regressed.",
        },
      })],
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.concepts[0]?.interventionState).toBe("regressing");
    expect(bundle.concepts[0]?.whyThisStillMatters).toContain("Transfer has slipped");
    expect(bundle.summary.regressingCount).toBe(1);
  });
});
