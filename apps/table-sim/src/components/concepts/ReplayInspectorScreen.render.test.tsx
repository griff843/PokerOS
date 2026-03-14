import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RECOMMENDATION_ENGINE_MANIFEST, TRANSFER_ENGINE_MANIFEST } from "@/lib/engine-manifest";
import { ReplayInspectorScreen } from "./ReplayInspectorScreen";
import type { ReplayInspectorResponse } from "@/lib/replay-inspector";

function makeReplayInspectorResponse(): ReplayInspectorResponse {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    generatedAt: "2026-03-13T12:00:00.000Z",
    summary: {
      historyAvailability: "paired",
      recommendationInterpretation: "output_changed_after_evidence_shift",
      transferInterpretation: "output_stable_after_evidence_shift",
      operatorInterpretation: "paired_history",
    },
    recommendation: {
      engine: "recommendation",
      historyState: "paired",
      inputHistoryCount: 2,
      outputHistoryCount: 2,
      linkedPairCount: 2,
      latestPair: {
        input: {
          id: "rec-input-1",
          conceptKey: "river_bluff_catching",
          snapshotType: "intervention_recommendation",
          schemaVersion: "intervention_recommendation_input.v1",
          engineManifest: RECOMMENDATION_ENGINE_MANIFEST,
          createdAt: "2026-03-13T12:00:00.000Z",
          recoveryStage: "active_repair",
          retentionState: "scheduled",
          patternTypes: ["persistent_threshold_leak"],
          diagnosisCount: 3,
          interventionCount: 1,
          studySampleSize: 0,
          realPlayOccurrences: 3,
          linkedDecisionSnapshotId: "dec-1",
          linkedTransferSnapshotId: null,
          sourceContext: "intervention_plan_api",
          supersedesSnapshotId: "rec-input-0",
          payload: {
            schemaVersion: "intervention_recommendation_input.v1",
            conceptKey: "river_bluff_catching",
            label: "River Bluff Catching",
            diagnosisSummary: { count: 3, types: ["threshold_error"] },
            interventionSummary: { count: 1, activeCount: 1, improvedCount: 0, failedCount: 0, latestStatus: "in_progress" },
            recoveryStage: "active_repair",
            patternSummary: { count: 1, types: ["persistent_threshold_leak"] },
            studySampleSize: 6,
            recurrenceCount: 2,
            reviewPressure: 1,
            trainingUrgency: 0.72,
            trendSummary: { direction: "stable", recentAverage: 0.52, averageScore: 0.51 },
            retentionSummary: { latestState: "scheduled", validationState: "provisional", lastResult: null, dueCount: 0, overdueCount: 0 },
            transferSummary: { status: "transfer_gap", confidence: "medium", evidenceSufficiency: "moderate", pressure: "high", studyVsRealPlayDelta: 0.21, realPlayOccurrences: 3, realPlayReviewSpotCount: 2 },
          },
        },
        output: {
          id: "dec-1",
          conceptKey: "river_bluff_catching",
          createdAt: "2026-03-13T12:00:00.000Z",
          engineManifest: RECOMMENDATION_ENGINE_MANIFEST,
          action: "assign_intervention",
          recommendedStrategy: "threshold_repair",
          confidence: "high",
          priority: 81,
          suggestedIntensity: "high",
          recoveryStage: "active_repair",
          currentInterventionStatus: "in_progress",
          reasonCodes: ["persistent_recurring_leak"],
          supportingSignals: [],
          evidence: [],
          patternTypes: ["persistent_threshold_leak"],
          recurringLeak: true,
          transferGap: false,
          actedUpon: true,
          linkedInterventionId: "int-1",
          sourceContext: "intervention_plan_api",
          supersedesDecisionId: null,
        },
        linkedOutputId: "dec-1",
        linkStatus: "linked",
      },
      previousPair: undefined,
      recentPairs: [],
      latestOutputOnly: undefined,
      comparison: {
        inputChanged: true,
        outputChanged: true,
        changedEvidenceFields: ["diagnosisSummary", "interventionSummary"],
        changedOutputFields: ["action", "priority"],
        manifestDrift: { matches: true, changedFields: [] },
        interpretation: "output_changed_after_evidence_shift",
      },
    },
    transfer: {
      engine: "transfer",
      historyState: "partial",
      inputHistoryCount: 1,
      outputHistoryCount: 1,
      linkedPairCount: 1,
      latestPair: {
        input: {
          id: "tx-input-1",
          conceptKey: "river_bluff_catching",
          snapshotType: "transfer_evaluation",
          schemaVersion: "transfer_evaluation_input.v1",
          engineManifest: TRANSFER_ENGINE_MANIFEST,
          createdAt: "2026-03-13T12:00:00.000Z",
          recoveryStage: "stabilizing",
          retentionState: "scheduled",
          patternTypes: ["real_play_transfer_gap"],
          diagnosisCount: 3,
          interventionCount: 1,
          studySampleSize: 7,
          realPlayOccurrences: 3,
          linkedDecisionSnapshotId: "dec-1",
          linkedTransferSnapshotId: "tx-1",
          sourceContext: "concept_case_api",
          supersedesSnapshotId: null,
          payload: {
            schemaVersion: "transfer_evaluation_input.v1",
            conceptKey: "river_bluff_catching",
            label: "River Bluff Catching",
            studySummary: { sampleSize: 7, recentAverage: 0.74, averageScore: 0.69, trendDirection: "improving", failedCount: 1 },
            realPlaySummary: { occurrences: 3, reviewSpotCount: 2, evidenceCount: 3 },
            diagnosisSummary: { count: 3 },
            interventionSummary: { count: 1, improvedCount: 0, failedCount: 0, latestStatus: "in_progress" },
            recoveryStage: "stabilizing",
            retentionSummary: { latestState: "scheduled", validationState: "provisional", lastResult: null },
            patternSummary: { count: 1, types: ["real_play_transfer_gap"] },
          },
        },
        output: {
          id: "tx-1",
          conceptKey: "river_bluff_catching",
          createdAt: "2026-03-13T12:00:00.000Z",
          engineManifest: TRANSFER_ENGINE_MANIFEST,
          status: "transfer_gap",
          confidence: "medium",
          evidenceSufficiency: "moderate",
          pressure: "high",
          studySampleSize: 7,
          studyPerformance: 0.74,
          studyRecentAverage: 0.74,
          studyAverage: 0.69,
          studyFailedCount: 1,
          realPlayPerformance: 0.48,
          realPlayOccurrences: 3,
          realPlayReviewSpotCount: 2,
          realPlayLatestHandAt: "2026-03-12T12:00:00.000Z",
          studyVsRealPlayDelta: 0.26,
          recoveryStage: "stabilizing",
          retentionState: "scheduled",
          retentionResult: null,
          patternTypes: ["real_play_transfer_gap"],
          supportingEvidence: ["Study gains are ahead of real-play confirmation."],
          riskFlags: ["recovery_contradicted_by_real_play"],
          linkedDecisionSnapshotId: "dec-1",
          linkedRetentionScheduleId: "ret-1",
          sourceContext: "concept_case_api",
          supersedesSnapshotId: null,
        },
        linkedOutputId: "tx-1",
        linkStatus: "linked",
      },
      previousPair: undefined,
      recentPairs: [],
      latestOutputOnly: undefined,
      comparison: {
        inputChanged: true,
        outputChanged: false,
        changedEvidenceFields: ["realPlaySummary"],
        changedOutputFields: [],
        manifestDrift: { matches: true, changedFields: [] },
        interpretation: "output_stable_after_evidence_shift",
      },
    },
  };
}

describe("ReplayInspectorScreen", () => {
  it("renders canonical replay inspector data", () => {
    const html = renderToStaticMarkup(<ReplayInspectorScreen state={{ loading: false, data: makeReplayInspectorResponse() }} />);

    expect(html).toContain("Coach Replay Inspector");
    expect(html).toContain("River Bluff Catching");
    expect(html).toContain("Recommendation input/output history");
    expect(html).toContain("diagnosisSummary");
    expect(html).toContain("/app/concepts/river_bluff_catching");
  });

  it("renders a loading state", () => {
    const html = renderToStaticMarkup(<ReplayInspectorScreen state={{ loading: true }} />);
    expect(html).toContain("Loading replay history");
  });

  it("renders an error state", () => {
    const html = renderToStaticMarkup(<ReplayInspectorScreen state={{ loading: false, error: "Failed to load replay inspector" }} />);
    expect(html).toContain("Replay inspector unavailable");
  });
});
