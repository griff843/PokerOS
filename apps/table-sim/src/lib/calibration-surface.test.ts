import { describe, expect, it, vi } from "vitest";
import type { CalibrationOutcomesBundle } from "./calibration-outcomes";
import { buildCalibrationSurfaceAdapter, fetchCalibrationSurface } from "./calibration-surface";

function makeBundle(overrides: Partial<CalibrationOutcomesBundle> = {}): CalibrationOutcomesBundle {
  return {
    generatedAt: "2026-03-24T16:00:00.000Z",
    state: "strong_evidence",
    summary: {
      headline: "Calibration outcomes include strong evidence.",
      detail: "2 concepts already have strong evidence.",
      conceptCount: 2,
      regressingCount: 1,
      helpingCount: 1,
      inconclusiveCount: 0,
      strongEvidenceCount: 2,
    },
    concepts: [
      {
        conceptKey: "river_value_thresholds",
        label: "River Value Thresholds",
        interventionState: "regressing",
        evidenceState: "strong_evidence",
        transferConfirmation: {
          status: "transfer_regressed",
          confidence: "high",
          pressure: "high",
          evidenceSufficiency: "strong",
          summary: "Transfer has regressed in recent hands.",
        },
        retentionTrend: {
          latestState: "completed_fail",
          validationState: "failed",
          lastResult: "fail",
          dueCount: 0,
          overdueCount: 0,
          summary: "Recent retention validation failed, so the concept is not holding cleanly.",
        },
        trustSignals: {
          trustLevel: "medium",
          evidenceState: "strong_evidence",
          decisionStability: "stable",
          signals: ["2 intervention cycles tracked", "transfer transfer regressed", "retention failed"],
        },
        nextStep: {
          action: "repair_transfer_gap",
          priority: "high",
          reason: "Replay and repair the transfer leak before the next session.",
        },
        whyThisStillMatters: "Transfer has slipped after earlier progress, so this concept remains trust-critical.",
      },
      {
        conceptKey: "turn_probe_discipline",
        label: "Turn Probe Discipline",
        interventionState: "helping",
        evidenceState: "strong_evidence",
        transferConfirmation: {
          status: "transfer_validated",
          confidence: "high",
          pressure: "low",
          evidenceSufficiency: "strong",
          summary: "Transfer is validated.",
        },
        retentionTrend: {
          latestState: "completed_pass",
          validationState: "validated",
          lastResult: "pass",
          dueCount: 0,
          overdueCount: 0,
          summary: "Retention has been validated recently.",
        },
        trustSignals: {
          trustLevel: "high",
          evidenceState: "strong_evidence",
          decisionStability: "stable",
          signals: ["1 intervention cycle tracked", "transfer transfer validated", "retention validated"],
        },
        nextStep: {
          action: "maintain_validated_gain",
          priority: "medium",
          reason: "Keep the concept warm with lighter follow-up.",
        },
        whyThisStillMatters: "Validated transfer means this concept can be trusted more, but should still be monitored.",
      },
    ],
    ...overrides,
  };
}

describe("calibration surface adapter", () => {
  it("returns an explicit no_calibration state when no bundle is provided", () => {
    const surface = buildCalibrationSurfaceAdapter(null);

    expect(surface.state).toBe("no_calibration");
    expect(surface.topConceptSummaries).toEqual([]);
    expect(surface.highPriorityCount).toBe(0);
  });

  it("keeps no meaningful history explicit for sparse calibration bundles", () => {
    const surface = buildCalibrationSurfaceAdapter(makeBundle({
      state: "no_meaningful_history",
      summary: {
        headline: "Calibration outcomes do not yet have meaningful history.",
        detail: "Outcome evidence is still sparse.",
        conceptCount: 1,
        regressingCount: 0,
        helpingCount: 0,
        inconclusiveCount: 1,
        strongEvidenceCount: 0,
      },
      concepts: [{
        conceptKey: "blind_defense",
        label: "Blind Defense",
        interventionState: "inconclusive",
        evidenceState: "no_meaningful_history",
        retentionTrend: {
          validationState: "none",
          dueCount: 0,
          overdueCount: 0,
          summary: "Retention evidence is still sparse.",
        },
        trustSignals: {
          trustLevel: "low",
          evidenceState: "no_meaningful_history",
          signals: [],
        },
        whyThisStillMatters: "The app still lacks enough outcome evidence to clear this concept confidently.",
      }],
    }));

    expect(surface.state).toBe("no_meaningful_history");
    expect(surface.topConceptSummaries[0]?.priority).toBe("medium");
    expect(surface.topConceptSummaries[0]?.trustLevel).toBe("low");
  });

  it("surfaces partial evidence bundles cleanly", () => {
    const surface = buildCalibrationSurfaceAdapter(makeBundle({
      state: "partial_evidence",
      summary: {
        headline: "Calibration outcomes have partial evidence.",
        detail: "Only partial trust evidence exists so far.",
        conceptCount: 1,
        regressingCount: 0,
        helpingCount: 0,
        inconclusiveCount: 1,
        strongEvidenceCount: 0,
      },
      concepts: [{
        conceptKey: "blind_defense",
        label: "Blind Defense",
        interventionState: "inconclusive",
        evidenceState: "partial_evidence",
        retentionTrend: {
          validationState: "provisional",
          dueCount: 1,
          overdueCount: 0,
          summary: "Retention evidence exists, but the concept still needs confirmation.",
        },
        trustSignals: {
          trustLevel: "medium",
          evidenceState: "partial_evidence",
          decisionStability: "shifting",
          signals: ["1 intervention cycle tracked"],
        },
        whyThisStillMatters: "The concept still needs confirmation from future outcomes.",
      }],
    }));

    expect(surface.state).toBe("partial_evidence");
    expect(surface.highlightedConcept?.priority).toBe("medium");
    expect(surface.topConceptSummaries[0]?.retentionSummary).toContain("needs confirmation");
  });

  it("surfaces the highest-priority concept summary first for strong evidence bundles", () => {
    const surface = buildCalibrationSurfaceAdapter(makeBundle(), 2);

    expect(surface.state).toBe("strong_evidence");
    expect(surface.highlightedConcept?.conceptKey).toBe("river_value_thresholds");
    expect(surface.highlightedConcept?.priority).toBe("high");
    expect(surface.topConceptSummaries[0]?.suggestedAction?.label).toBe("Repair Transfer Gap");
    expect(surface.topConceptSummaries[0]?.destination).toBe("/app/concepts/river_value_thresholds");
    expect(surface.highPriorityCount).toBe(1);
  });

  it("fetches calibration outcomes and shapes them without duplicating route parsing", async () => {
    const bundle = makeBundle({
      concepts: [makeBundle().concepts[0]!],
      summary: {
        ...makeBundle().summary,
        conceptCount: 1,
      },
    });
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(bundle), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    ) as unknown as typeof fetch;

    const surface = await fetchCalibrationSurface({ limit: 5, topLimit: 1 }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/calibration-outcomes?limit=5",
      { cache: "no-store" },
    );
    expect(surface.topConceptSummaries).toHaveLength(1);
    expect(surface.highlightedConcept?.conceptKey).toBe("river_value_thresholds");
  });
});
