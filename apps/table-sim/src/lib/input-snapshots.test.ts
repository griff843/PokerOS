import { describe, expect, it } from "vitest";
import type { CoachingInputSnapshotRow } from "../../../../packages/db/src/repository";
import { RECOMMENDATION_ENGINE_MANIFEST, toEngineManifestColumns } from "./engine-manifest";
import {
  buildEngineReplaySummary,
  buildRecommendationInputSnapshotPayloadMap,
  buildTransferInputSnapshotPayloadMap,
  getRecentInputOutputPairs,
} from "./input-snapshots";
import type { InterventionHistoryEntry, PlayerIntelligenceSnapshot, RealPlayConceptSignal } from "@poker-coach/core/browser";

function makePlayerIntelligence(): PlayerIntelligenceSnapshot {
  return {
    generatedAt: "2026-03-12T12:00:00.000Z",
    activePool: "baseline",
    graph: { nodes: [], edges: [] },
    concepts: [
      {
        conceptKey: "river_bluff_catching",
        label: "River Bluff Catching",
        summary: "Catch river bluffs honestly.",
        scope: "overall",
        recommendedPool: "baseline",
        sampleSize: 6,
        recentAverage: 0.72,
        averageScore: 0.58,
        recurrenceCount: 2,
        failedCount: 2,
        reviewPressure: 1,
        trend: { direction: "improving", delta: 0.14, detail: "Recent results are improving." },
        trainingUrgency: 0.78,
        status: "weakness",
        weaknessRole: "primary",
        recoveryStage: "stabilizing",
        planningReasons: ["active_intervention", "retention_check"],
        interventionStatus: "stabilizing",
        directSignalKeys: ["concept:river_bluff_catching"],
        relatedConceptKeys: [],
        supportingConceptKeys: [],
        supportedConceptKeys: [],
        inferredFrom: [],
        evidence: ["Scores are improving."],
        relatedDrills: [],
      },
    ],
    priorities: [],
    strengths: [],
    recommendations: [],
    adaptiveProfile: {
      generatedAt: "2026-03-12T12:00:00.000Z",
      summary: "Adaptive profile summary.",
      tendencies: [],
      coachingEmphasis: {
        explanationBullets: [],
        interventionBullets: [],
        confidenceHandling: "Keep confidence grounded.",
        recommendationFraming: "Keep recommendations explicit.",
      },
      interventionAdjustments: {
        preferShorterReviewBlocks: false,
        prioritizeThresholdRetests: false,
        prioritizeLineReconstruction: false,
        prioritizeBlockerNotes: false,
        prioritizeConfidenceCalibration: false,
        prioritizeRealPlayReview: false,
      },
      surfaceSignals: {
        commandCenter: "Command signal.",
        studySession: "Study signal.",
        growthProfile: "Growth signal.",
        weaknessExplorer: "Weakness signal.",
        sessionReview: "Session signal.",
        review: "Review signal.",
      },
    },
    memory: {
      diagnosisCount: 2,
      activeInterventions: 1,
      completedInterventions: 0,
      interventionSuccessRate: null,
      recurringLeakConcepts: ["river_bluff_catching"],
      recoveredConcepts: [],
      regressedConcepts: [],
      stabilizingConcepts: ["river_bluff_catching"],
    },
    patterns: {
      generatedAt: "2026-03-12T12:00:00.000Z",
      patterns: [
        {
          id: "pattern:1",
          type: "real_play_transfer_gap",
          confidence: "high",
          severity: 0.82,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["Study improvement is outpacing real play."],
          coachingImplication: "Bridge drills into imported-hand review.",
          suggestedBiases: ["real_play_transfer"],
        },
      ],
      topPatterns: [],
    },
  };
}

describe("input snapshots", () => {
  it("builds normalized recommendation and transfer payloads", () => {
    const playerIntelligence = makePlayerIntelligence();
    const interventionHistory: InterventionHistoryEntry[] = [{
      id: "i1",
      conceptKey: "river_bluff_catching",
      source: "command_center",
      status: "stabilizing",
      createdAt: "2026-03-12T10:00:00.000Z",
      improved: true,
      preScore: 0.34,
      postScore: 0.72,
    }];
    const realPlaySignals: RealPlayConceptSignal[] = [{
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      occurrences: 3,
      reviewSpotCount: 2,
      weight: 0.28,
      recommendedPool: "baseline",
      latestHandAt: "2026-03-12T11:00:00.000Z",
      evidence: ["Three imported hands map into this concept.", "Two review-worthy river spots are attached here."],
    }];

    const recommendationPayload = buildRecommendationInputSnapshotPayloadMap({
      playerIntelligence,
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-12T09:00:00.000Z" },
      ],
      interventionHistory,
      realPlaySignals,
    }).get("river_bluff_catching");
    const transferPayload = buildTransferInputSnapshotPayloadMap({
      playerIntelligence,
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-12T09:00:00.000Z" },
      ],
      interventionHistory,
      realPlaySignals,
    }).get("river_bluff_catching");

    expect(recommendationPayload?.diagnosisSummary.count).toBe(1);
    expect(recommendationPayload?.studySampleSize).toBe(6);
    expect(recommendationPayload?.transferSummary?.status).toBe("transfer_gap");
    expect(transferPayload?.studySummary.sampleSize).toBe(6);
    expect(transferPayload?.realPlaySummary.occurrences).toBe(3);
  });

  it("compares recent input/output snapshot pairs", () => {
    const inputSnapshots: CoachingInputSnapshotRow[] = [
      makeInputSnapshot("input-1", "2026-03-12T12:00:00.000Z", { recurrenceCount: 1 }),
      makeInputSnapshot("input-2", "2026-03-12T13:00:00.000Z", { recurrenceCount: 3 }),
    ];
    const outputSnapshots = [
      { id: "decision-1", concept_key: "river_bluff_catching", created_at: "2026-03-12T12:00:00.000Z" },
      { id: "decision-2", concept_key: "river_bluff_catching", created_at: "2026-03-12T13:00:00.000Z" },
    ];

    const summary = buildEngineReplaySummary({
      conceptKey: "river_bluff_catching",
      snapshotType: "intervention_recommendation",
      inputSnapshots,
      outputSnapshots,
    });
    const pairs = getRecentInputOutputPairs({
      conceptKey: "river_bluff_catching",
      snapshotType: "intervention_recommendation",
      inputSnapshots,
      outputSnapshots,
    });

    expect(summary.inputChanged).toBe(true);
    expect(summary.outputChanged).toBe(true);
    expect(summary.changedEvidenceFields).toContain("recurrenceCount");
    expect(summary.manifestDrift.matches).toBe(true);
    expect(pairs[0]?.outputId).toBe("decision-2");
  });

  it("distinguishes engine drift from evidence drift", () => {
    const summary = buildEngineReplaySummary({
      conceptKey: "river_bluff_catching",
      snapshotType: "intervention_recommendation",
      inputSnapshots: [
        makeInputSnapshot("input-2", "2026-03-12T13:00:00.000Z", {}, { engine_version: "1.1.0" }),
        makeInputSnapshot("input-1", "2026-03-12T12:00:00.000Z"),
      ],
      outputSnapshots: [
        { id: "decision-2", concept_key: "river_bluff_catching", created_at: "2026-03-12T13:00:00.000Z" },
        { id: "decision-1", concept_key: "river_bluff_catching", created_at: "2026-03-12T12:00:00.000Z" },
      ],
    });

    expect(summary.inputChanged).toBe(false);
    expect(summary.manifestDrift.matches).toBe(false);
    expect(summary.manifestDrift.changedFields).toContain("engineVersion");
    expect(summary.interpretation).toBe("engine_changed");
  });
});

function makeInputSnapshot(
  id: string,
  createdAt: string,
  payloadOverrides: Partial<Record<string, unknown>> = {},
  rowOverrides: Partial<CoachingInputSnapshotRow> = {}
): CoachingInputSnapshotRow {
  return {
    id,
    user_id: "local_user",
    concept_key: "river_bluff_catching",
    snapshot_type: "intervention_recommendation",
    schema_version: "intervention_recommendation_input.v1",
    created_at: createdAt,
    ...toEngineManifestColumns(RECOMMENDATION_ENGINE_MANIFEST),
    payload_json: JSON.stringify({
      schemaVersion: "intervention_recommendation_input.v1",
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      diagnosisSummary: { count: 1, types: ["threshold_error"] },
      interventionSummary: { count: 1, activeCount: 1, improvedCount: 0, failedCount: 0, latestStatus: "in_progress" },
      recoveryStage: "active_repair",
      patternSummary: { count: 1, types: ["persistent_threshold_leak"] },
      recurrenceCount: 2,
      reviewPressure: 1,
      trainingUrgency: 0.72,
      trendSummary: { direction: "improving", recentAverage: 0.66, averageScore: 0.54 },
      retentionSummary: { latestState: "due", validationState: "provisional", lastResult: null, dueCount: 1, overdueCount: 0 },
      transferSummary: { status: "transfer_gap", confidence: "medium", evidenceSufficiency: "moderate", pressure: "medium", studyVsRealPlayDelta: 0.32, realPlayOccurrences: 2, realPlayReviewSpotCount: 2 },
      ...payloadOverrides,
    }),
    recovery_stage: "active_repair",
    retention_state: "due",
    pattern_types_json: JSON.stringify(["persistent_threshold_leak"]),
    diagnosis_count: 1,
    intervention_count: 1,
    study_sample_size: 6,
    real_play_occurrences: 2,
    linked_decision_snapshot_id: id === "input-1" ? "decision-1" : "decision-2",
    linked_transfer_snapshot_id: null,
    source_context: "intervention_plan_api",
    supersedes_snapshot_id: null,
    ...rowOverrides,
  };
}
