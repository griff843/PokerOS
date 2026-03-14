import { describe, expect, it } from "vitest";
import type {
  CoachingInputSnapshotRow,
  InterventionDecisionSnapshotRow,
  TransferEvaluationSnapshotRow,
} from "../../../../packages/db/src/repository";
import { RECOMMENDATION_ENGINE_MANIFEST, TRANSFER_ENGINE_MANIFEST, toEngineManifestColumns } from "./engine-manifest";
import { buildReplayInspector } from "./replay-inspector";

function makeRecommendationInputRow(overrides: Partial<CoachingInputSnapshotRow> = {}): CoachingInputSnapshotRow {
  return {
    id: overrides.id ?? "rec-input-1",
    user_id: "local_user",
    concept_key: "river_bluff_catching",
    snapshot_type: "intervention_recommendation",
    schema_version: "intervention_recommendation_input.v1",
    created_at: overrides.created_at ?? "2026-03-13T12:00:00.000Z",
    ...toEngineManifestColumns(RECOMMENDATION_ENGINE_MANIFEST),
    payload_json: overrides.payload_json ?? JSON.stringify({
      schemaVersion: "intervention_recommendation_input.v1",
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      diagnosisSummary: { count: 3, types: ["threshold_error"] },
      interventionSummary: { count: 1, activeCount: 1, improvedCount: 0, failedCount: 0, latestStatus: "in_progress" },
      recoveryStage: "active_repair",
      patternSummary: { count: 1, types: ["persistent_threshold_leak"] },
      recurrenceCount: 2,
      reviewPressure: 1,
      trainingUrgency: 0.72,
      trendSummary: { direction: "stable", recentAverage: 0.52, averageScore: 0.51 },
      retentionSummary: { latestState: "scheduled", validationState: "provisional", lastResult: null, dueCount: 0, overdueCount: 0 },
      transferSummary: { status: "transfer_gap", confidence: "medium", evidenceSufficiency: "moderate", pressure: "high", studyVsRealPlayDelta: 0.21, realPlayOccurrences: 3, realPlayReviewSpotCount: 2 },
    }),
    recovery_stage: "active_repair",
    retention_state: "scheduled",
    pattern_types_json: JSON.stringify(["persistent_threshold_leak"]),
    diagnosis_count: 3,
    intervention_count: 1,
    study_sample_size: 0,
    real_play_occurrences: 3,
    linked_decision_snapshot_id: overrides.linked_decision_snapshot_id ?? "dec-1",
    linked_transfer_snapshot_id: overrides.linked_transfer_snapshot_id ?? null,
    source_context: "intervention_plan_api",
    supersedes_snapshot_id: overrides.supersedes_snapshot_id ?? null,
    ...overrides,
  };
}

function makeDecisionRow(overrides: Partial<InterventionDecisionSnapshotRow> = {}): InterventionDecisionSnapshotRow {
  return {
    id: overrides.id ?? "dec-1",
    user_id: "local_user",
    concept_key: "river_bluff_catching",
    created_at: overrides.created_at ?? "2026-03-13T12:00:00.000Z",
    ...toEngineManifestColumns(RECOMMENDATION_ENGINE_MANIFEST),
    recommended_action: overrides.recommended_action ?? "assign_intervention",
    recommended_strategy: overrides.recommended_strategy ?? "threshold_repair",
    confidence: overrides.confidence ?? "high",
    priority: overrides.priority ?? 81,
    suggested_intensity: overrides.suggested_intensity ?? "high",
    recovery_stage: overrides.recovery_stage ?? "active_repair",
    current_intervention_status: overrides.current_intervention_status ?? "in_progress",
    reason_codes_json: overrides.reason_codes_json ?? JSON.stringify(["persistent_recurring_leak"]),
    supporting_signals_json: overrides.supporting_signals_json ?? JSON.stringify([]),
    evidence_json: overrides.evidence_json ?? JSON.stringify(["Recurring threshold misses remain active."]),
    pattern_types_json: overrides.pattern_types_json ?? JSON.stringify(["persistent_threshold_leak"]),
    recurring_leak_bool: overrides.recurring_leak_bool ?? 1,
    transfer_gap_bool: overrides.transfer_gap_bool ?? 0,
    acted_upon_bool: overrides.acted_upon_bool ?? 1,
    linked_intervention_id: overrides.linked_intervention_id ?? "int-1",
    source_context: overrides.source_context ?? "intervention_plan_api",
    supersedes_decision_id: overrides.supersedes_decision_id ?? null,
    ...overrides,
  };
}

function makeTransferInputRow(overrides: Partial<CoachingInputSnapshotRow> = {}): CoachingInputSnapshotRow {
  return {
    id: overrides.id ?? "tx-input-1",
    user_id: "local_user",
    concept_key: "river_bluff_catching",
    snapshot_type: "transfer_evaluation",
    schema_version: "transfer_evaluation_input.v1",
    created_at: overrides.created_at ?? "2026-03-13T12:00:00.000Z",
    ...toEngineManifestColumns(TRANSFER_ENGINE_MANIFEST),
    payload_json: overrides.payload_json ?? JSON.stringify({
      schemaVersion: "transfer_evaluation_input.v1",
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      studySummary: { sampleSize: 7, recentAverage: 0.74, averageScore: 0.69, trendDirection: "improving", failedCount: 1 },
      realPlaySummary: { occurrences: 3, reviewSpotCount: 2, weight: 0.7, latestHandAt: "2026-03-12T12:00:00.000Z", evidenceCount: 3 },
      diagnosisSummary: { count: 3 },
      interventionSummary: { count: 1, improvedCount: 0, failedCount: 0, latestStatus: "in_progress" },
      recoveryStage: "stabilizing",
      retentionSummary: { latestState: "scheduled", validationState: "provisional", lastResult: null },
      patternSummary: { count: 1, types: ["real_play_transfer_gap"] },
    }),
    recovery_stage: "stabilizing",
    retention_state: "scheduled",
    pattern_types_json: JSON.stringify(["real_play_transfer_gap"]),
    diagnosis_count: 3,
    intervention_count: 1,
    study_sample_size: 7,
    real_play_occurrences: 3,
    linked_decision_snapshot_id: null,
    linked_transfer_snapshot_id: overrides.linked_transfer_snapshot_id ?? "tx-1",
    source_context: "concept_case_api",
    supersedes_snapshot_id: overrides.supersedes_snapshot_id ?? null,
    ...overrides,
  };
}

function makeTransferRow(overrides: Partial<TransferEvaluationSnapshotRow> = {}): TransferEvaluationSnapshotRow {
  return {
    id: overrides.id ?? "tx-1",
    user_id: "local_user",
    concept_key: "river_bluff_catching",
    created_at: overrides.created_at ?? "2026-03-13T12:00:00.000Z",
    ...toEngineManifestColumns(TRANSFER_ENGINE_MANIFEST),
    transfer_status: overrides.transfer_status ?? "transfer_gap",
    transfer_confidence: overrides.transfer_confidence ?? "medium",
    evidence_sufficiency: overrides.evidence_sufficiency ?? "moderate",
    pressure: overrides.pressure ?? "high",
    study_sample_size: overrides.study_sample_size ?? 7,
    study_performance: overrides.study_performance ?? 0.74,
    study_recent_average: overrides.study_recent_average ?? 0.74,
    study_average: overrides.study_average ?? 0.69,
    study_failed_count: overrides.study_failed_count ?? 1,
    real_play_performance: overrides.real_play_performance ?? 0.48,
    real_play_occurrences: overrides.real_play_occurrences ?? 3,
    real_play_review_spot_count: overrides.real_play_review_spot_count ?? 2,
    real_play_latest_hand_at: overrides.real_play_latest_hand_at ?? "2026-03-12T12:00:00.000Z",
    study_vs_real_play_delta: overrides.study_vs_real_play_delta ?? 0.26,
    recovery_stage: overrides.recovery_stage ?? "stabilizing",
    retention_state: overrides.retention_state ?? "scheduled",
    retention_result: overrides.retention_result ?? null,
    pattern_types_json: overrides.pattern_types_json ?? JSON.stringify(["real_play_transfer_gap"]),
    supporting_evidence_json: overrides.supporting_evidence_json ?? JSON.stringify(["Study gains are ahead of real-play confirmation."]),
    risk_flags_json: overrides.risk_flags_json ?? JSON.stringify(["recovery_contradicted_by_real_play"]),
    linked_decision_snapshot_id: overrides.linked_decision_snapshot_id ?? "dec-1",
    linked_retention_schedule_id: overrides.linked_retention_schedule_id ?? "ret-1",
    source_context: overrides.source_context ?? "concept_case_api",
    supersedes_snapshot_id: overrides.supersedes_snapshot_id ?? null,
    ...overrides,
  };
}

describe("buildReplayInspector", () => {
  it("returns clean no-history state", () => {
    const replay = buildReplayInspector({ conceptKey: "river_bluff_catching" });

    expect(replay.summary.historyAvailability).toBe("none");
    expect(replay.recommendation.comparison.interpretation).toBe("insufficient_history");
    expect(replay.transfer.comparison.interpretation).toBe("insufficient_history");
  });

  it("builds recommendation and transfer pair comparisons from canonical snapshots", () => {
    const replay = buildReplayInspector({
      conceptKey: "river_bluff_catching",
      inputSnapshots: [
        makeRecommendationInputRow(),
        makeRecommendationInputRow({
          id: "rec-input-0",
          created_at: "2026-03-12T12:00:00.000Z",
          linked_decision_snapshot_id: "dec-0",
          payload_json: JSON.stringify({
            schemaVersion: "intervention_recommendation_input.v1",
            conceptKey: "river_bluff_catching",
            label: "River Bluff Catching",
            diagnosisSummary: { count: 2, types: ["threshold_error"] },
            interventionSummary: { count: 0, activeCount: 0, improvedCount: 0, failedCount: 0, latestStatus: undefined },
            recoveryStage: "unaddressed",
            patternSummary: { count: 0, types: [] },
            recurrenceCount: 1,
            reviewPressure: 0,
            trainingUrgency: 0.45,
            trendSummary: { direction: "stable", recentAverage: 0.5, averageScore: 0.5 },
            retentionSummary: { latestState: undefined, validationState: "none", lastResult: null, dueCount: 0, overdueCount: 0 },
          }),
        }),
        makeTransferInputRow(),
        makeTransferInputRow({
          id: "tx-input-0",
          created_at: "2026-03-12T12:00:00.000Z",
          linked_transfer_snapshot_id: "tx-0",
          payload_json: JSON.stringify({
            schemaVersion: "transfer_evaluation_input.v1",
            conceptKey: "river_bluff_catching",
            label: "River Bluff Catching",
            studySummary: { sampleSize: 5, recentAverage: 0.62, averageScore: 0.6, trendDirection: "improving", failedCount: 2 },
            realPlaySummary: { occurrences: 1, reviewSpotCount: 1, evidenceCount: 1 },
            diagnosisSummary: { count: 2 },
            interventionSummary: { count: 0, improvedCount: 0, failedCount: 0, latestStatus: undefined },
            recoveryStage: "active_repair",
            retentionSummary: { latestState: undefined, validationState: "none", lastResult: null },
            patternSummary: { count: 0, types: [] },
          }),
        }),
      ],
      decisionSnapshots: [
        makeDecisionRow(),
        makeDecisionRow({
          id: "dec-0",
          created_at: "2026-03-12T12:00:00.000Z",
          recommended_action: "monitor_only",
          recommended_strategy: "threshold_repair",
          priority: 54,
          suggested_intensity: "moderate",
          recovery_stage: "unaddressed",
          current_intervention_status: null,
          reason_codes_json: JSON.stringify(["weak_recent_attempts"]),
          pattern_types_json: JSON.stringify([]),
          recurring_leak_bool: 0,
          acted_upon_bool: 0,
          linked_intervention_id: null,
        }),
      ],
      transferSnapshots: [
        makeTransferRow(),
        makeTransferRow({
          id: "tx-0",
          created_at: "2026-03-12T12:00:00.000Z",
          transfer_status: "transfer_uncertain",
          pressure: "medium",
          real_play_occurrences: 1,
          real_play_review_spot_count: 1,
          study_vs_real_play_delta: 0.12,
          recovery_stage: "active_repair",
          retention_state: null,
          pattern_types_json: JSON.stringify([]),
          risk_flags_json: JSON.stringify([]),
          linked_decision_snapshot_id: null,
          linked_retention_schedule_id: null,
        }),
      ],
    });

    expect(replay.recommendation.latestPair?.output?.action).toBe("assign_intervention");
    expect(replay.recommendation.previousPair?.output?.action).toBe("monitor_only");
    expect(replay.recommendation.comparison.changedEvidenceFields).toContain("diagnosisSummary");
    expect(replay.recommendation.comparison.changedOutputFields).toContain("action");
    expect(replay.recommendation.comparison.interpretation).toBe("output_changed_after_evidence_shift");
    expect(replay.transfer.comparison.changedOutputFields).toContain("status");
    expect(replay.transfer.comparison.interpretation).toBe("output_changed_after_evidence_shift");
    expect(replay.summary.historyAvailability).toBe("paired");
  });

  it("identifies engine-version drift separately from evidence drift", () => {
    const replay = buildReplayInspector({
      conceptKey: "river_bluff_catching",
      inputSnapshots: [
        makeRecommendationInputRow({
          id: "rec-input-new",
          engine_version: "1.1.0",
        }),
        makeRecommendationInputRow({
          id: "rec-input-old",
          created_at: "2026-03-12T12:00:00.000Z",
          linked_decision_snapshot_id: "dec-0",
        }),
      ],
      decisionSnapshots: [
        makeDecisionRow({
          id: "dec-1",
          engine_version: "1.1.0",
        }),
        makeDecisionRow({
          id: "dec-0",
          created_at: "2026-03-12T12:00:00.000Z",
        }),
      ],
    });

    expect(replay.recommendation.comparison.inputChanged).toBe(false);
    expect(replay.recommendation.comparison.outputChanged).toBe(false);
    expect(replay.recommendation.comparison.manifestDrift.matches).toBe(false);
    expect(replay.recommendation.comparison.manifestDrift.changedFields).toContain("engineVersion");
    expect(replay.recommendation.comparison.interpretation).toBe("output_stable_after_engine_shift");
  });

  it("handles partial history when input exists without linked output", () => {
    const replay = buildReplayInspector({
      conceptKey: "river_bluff_catching",
      inputSnapshots: [makeRecommendationInputRow({ linked_decision_snapshot_id: "missing-output" })],
    });

    expect(replay.recommendation.historyState).toBe("partial");
    expect(replay.recommendation.latestPair?.linkStatus).toBe("missing_output_link");
    expect(replay.summary.historyAvailability).toBe("partial");
  });
});
