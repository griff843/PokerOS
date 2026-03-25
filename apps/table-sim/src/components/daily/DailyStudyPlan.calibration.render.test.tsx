import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalibrationSummaryPanel } from "./DailyStudyPlan";
import type { CalibrationSurfaceAdapter } from "@/lib/calibration-surface";

function makeCalibrationSurface(
  overrides: Partial<CalibrationSurfaceAdapter> = {},
): CalibrationSurfaceAdapter {
  return {
    state: "strong_evidence",
    headline: "Calibration outcomes include strong evidence.",
    detail: "Strong trust evidence is available.",
    generatedAt: "2026-03-25T01:00:00.000Z",
    conceptSummaries: [
      {
        conceptKey: "river_value_thresholds",
        label: "River Value Thresholds",
        priority: "high",
        interventionState: "regressing",
        evidenceState: "strong_evidence",
        trustLevel: "medium",
        whyThisStillMatters: "Transfer has slipped after earlier progress, so this concept remains trust-critical.",
        transferSummary: "Transfer has regressed in recent hands.",
        retentionSummary: "Recent retention validation failed, so the concept is not holding cleanly.",
        suggestedAction: {
          label: "Repair Transfer Gap",
          detail: "Replay and repair the transfer leak before the next session.",
        },
        destination: "/app/concepts/river_value_thresholds",
      },
    ],
    topConceptSummaries: [],
    highlightedConcept: undefined,
    highPriorityCount: 1,
    ...overrides,
  };
}

describe("CalibrationSummaryPanel", () => {
  it("renders highlighted calibration support when strong evidence is available", () => {
    const calibration = makeCalibrationSurface({
      topConceptSummaries: [makeCalibrationSurface().conceptSummaries[0]!],
      highlightedConcept: makeCalibrationSurface().conceptSummaries[0],
    });
    const html = renderToStaticMarkup(
      <CalibrationSummaryPanel loading={false} calibration={calibration} />
    );

    expect(html).toContain("Calibration Summary");
    expect(html).toContain("Calibration outcomes include strong evidence.");
    expect(html).toContain("River Value Thresholds");
    expect(html).toContain("Replay and repair the transfer leak before the next session.");
  });

  it("renders sparse calibration messaging cleanly", () => {
    const html = renderToStaticMarkup(
      <CalibrationSummaryPanel
        loading={false}
        calibration={makeCalibrationSurface({
          state: "no_meaningful_history",
          headline: "Calibration outcomes do not yet have meaningful history.",
          detail: "Load more outcome evidence before making strong trust claims.",
          conceptSummaries: [],
          topConceptSummaries: [],
          highlightedConcept: undefined,
          highPriorityCount: 0,
        })}
      />
    );

    expect(html).toContain("Calibration outcomes do not yet have meaningful history.");
    expect(html).toContain("Load more outcome evidence");
  });
});
