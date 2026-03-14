import { describe, expect, it } from "vitest";
import { evaluateConceptTransfer } from "../transfer-evaluation";

function makeInput(overrides: Partial<Parameters<typeof evaluateConceptTransfer>[0]> = {}) {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    recoveryStage: "stabilizing" as const,
    studySampleSize: 6,
    recentStudyAverage: 0.72,
    studyAverage: 0.61,
    studyTrendDirection: "improving" as const,
    studyFailedCount: 2,
    diagnosisCount: 2,
    interventionCount: 1,
    interventionImprovedCount: 1,
    interventionFailedCount: 0,
    latestInterventionStatus: "stabilizing" as const,
    patternTypes: [],
    retentionValidationState: "provisional" as const,
    retentionLatestState: "upcoming" as const,
    retentionLastResult: null,
    realPlay: undefined,
    ...overrides,
  };
}

describe("transfer evaluation", () => {
  it("returns explicit no-evidence status when no real-play data exists", () => {
    const evaluation = evaluateConceptTransfer(makeInput());

    expect(evaluation.status).toBe("no_real_play_evidence");
    expect(evaluation.confidence).toBe("low");
    expect(evaluation.riskFlags).toContain("sparse_real_play_evidence");
  });

  it("stays uncertain when real-play evidence is sparse", () => {
    const evaluation = evaluateConceptTransfer(makeInput({
      realPlay: {
        occurrences: 1,
        reviewSpotCount: 0,
        weight: 0.08,
        latestHandAt: "2026-03-12T12:00:00.000Z",
        evidence: ["One imported hand mapped into this concept."],
      },
    }));

    expect(evaluation.status).toBe("transfer_uncertain");
    expect(evaluation.evidenceSufficiency).toBe("sparse");
  });

  it("flags a transfer gap when study improvement is ahead of real play", () => {
    const evaluation = evaluateConceptTransfer(makeInput({
      realPlay: {
        occurrences: 3,
        reviewSpotCount: 3,
        weight: 0.32,
        latestHandAt: "2026-03-12T12:00:00.000Z",
        evidence: ["Multiple review-worthy river decisions still map here."],
      },
      patternTypes: ["real_play_transfer_gap"],
    }));

    expect(evaluation.status).toBe("transfer_gap");
    expect(evaluation.pressure).toBe("medium");
    expect(evaluation.riskFlags).toContain("study_ahead_of_real_play");
  });

  it("validates transfer when study performance is strong and real-play pressure is light", () => {
    const evaluation = evaluateConceptTransfer(makeInput({
      recoveryStage: "recovered",
      retentionValidationState: "validated",
      retentionLastResult: "pass",
      realPlay: {
        occurrences: 4,
        reviewSpotCount: 0,
        weight: 0.24,
        latestHandAt: "2026-03-12T12:00:00.000Z",
        evidence: ["Several imported hands mapped cleanly without extracted review spots."],
      },
    }));

    expect(evaluation.status).toBe("transfer_validated");
    expect(evaluation.confidence).toBe("high");
  });

  it("marks transfer as regressed when previously validated recovery is contradicted by new real-play evidence", () => {
    const evaluation = evaluateConceptTransfer(makeInput({
      recoveryStage: "recovered",
      retentionValidationState: "validated",
      retentionLastResult: "pass",
      retentionLatestState: "due",
      realPlay: {
        occurrences: 4,
        reviewSpotCount: 4,
        weight: 0.32,
        latestHandAt: "2026-03-12T12:00:00.000Z",
        evidence: ["Imported hands are again producing repeated review spots."],
      },
    }));

    expect(evaluation.status).toBe("transfer_regressed");
    expect(evaluation.riskFlags).toContain("validated_transfer_slipping");
    expect(evaluation.pressure).toBe("high");
  });
});
