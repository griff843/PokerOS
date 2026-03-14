import { describe, expect, it } from "vitest";
import type {
  CoachingDiagnosisRow,
  InterventionDecisionSnapshotRow,
  RetentionScheduleRow,
  TransferEvaluationSnapshotRow,
} from "../../../../packages/db/src/repository";
import { RECOMMENDATION_ENGINE_MANIFEST, TRANSFER_ENGINE_MANIFEST, toEngineManifestColumns } from "./engine-manifest";
import { buildConceptAuditFeed } from "./concept-audit-feed";

function makeDiagnosisRow(overrides: Partial<CoachingDiagnosisRow> = {}): CoachingDiagnosisRow {
  return {
    id: overrides.id ?? "diag-1",
    user_id: "local_user",
    attempt_id: overrides.attempt_id ?? "attempt-1",
    concept_key: overrides.concept_key ?? "river_bluff_catching",
    diagnostic_type: overrides.diagnostic_type ?? "threshold_error",
    confidence: overrides.confidence ?? 0.9,
    created_at: overrides.created_at ?? "2026-03-12T10:00:00.000Z",
  };
}

function makeDecisionRow(overrides: Partial<InterventionDecisionSnapshotRow> = {}): InterventionDecisionSnapshotRow {
  return {
    id: overrides.id ?? "decision-1",
    user_id: "local_user",
    concept_key: overrides.concept_key ?? "river_bluff_catching",
    created_at: overrides.created_at ?? "2026-03-12T12:00:00.000Z",
    ...toEngineManifestColumns(RECOMMENDATION_ENGINE_MANIFEST),
    recommended_action: overrides.recommended_action ?? "assign_intervention",
    recommended_strategy: overrides.recommended_strategy ?? "threshold_repair",
    confidence: overrides.confidence ?? "high",
    priority: overrides.priority ?? 82,
    suggested_intensity: overrides.suggested_intensity ?? "high",
    recovery_stage: overrides.recovery_stage ?? "active_repair",
    current_intervention_status: overrides.current_intervention_status ?? null,
    reason_codes_json: overrides.reason_codes_json ?? JSON.stringify(["persistent_recurring_leak"]),
    supporting_signals_json: overrides.supporting_signals_json ?? JSON.stringify([]),
    evidence_json: overrides.evidence_json ?? JSON.stringify(["Threshold misses are recurring."]),
    pattern_types_json: overrides.pattern_types_json ?? JSON.stringify(["persistent_threshold_leak"]),
    recurring_leak_bool: overrides.recurring_leak_bool ?? 1,
    transfer_gap_bool: overrides.transfer_gap_bool ?? 0,
    acted_upon_bool: overrides.acted_upon_bool ?? 0,
    linked_intervention_id: overrides.linked_intervention_id ?? null,
    source_context: overrides.source_context ?? "concept_case_api",
    supersedes_decision_id: overrides.supersedes_decision_id ?? null,
    ...overrides,
  };
}

function makeTransferRow(overrides: Partial<TransferEvaluationSnapshotRow> = {}): TransferEvaluationSnapshotRow {
  return {
    id: overrides.id ?? "transfer-1",
    user_id: "local_user",
    concept_key: overrides.concept_key ?? "river_bluff_catching",
    created_at: overrides.created_at ?? "2026-03-12T13:00:00.000Z",
    ...toEngineManifestColumns(TRANSFER_ENGINE_MANIFEST),
    transfer_status: overrides.transfer_status ?? "transfer_gap",
    transfer_confidence: overrides.transfer_confidence ?? "high",
    evidence_sufficiency: overrides.evidence_sufficiency ?? "strong",
    pressure: overrides.pressure ?? "high",
    study_sample_size: overrides.study_sample_size ?? 6,
    study_performance: overrides.study_performance ?? 0.76,
    study_recent_average: overrides.study_recent_average ?? 0.76,
    study_average: overrides.study_average ?? 0.64,
    study_failed_count: overrides.study_failed_count ?? 1,
    real_play_performance: overrides.real_play_performance ?? 0.31,
    real_play_occurrences: overrides.real_play_occurrences ?? 3,
    real_play_review_spot_count: overrides.real_play_review_spot_count ?? 2,
    real_play_latest_hand_at: overrides.real_play_latest_hand_at ?? "2026-03-12T12:30:00.000Z",
    study_vs_real_play_delta: overrides.study_vs_real_play_delta ?? 0.45,
    recovery_stage: overrides.recovery_stage ?? "recovered",
    retention_state: overrides.retention_state ?? "due",
    retention_result: overrides.retention_result ?? null,
    pattern_types_json: overrides.pattern_types_json ?? JSON.stringify(["real_play_transfer_gap"]),
    supporting_evidence_json: overrides.supporting_evidence_json ?? JSON.stringify(["Real-play proof is lagging."]),
    risk_flags_json: overrides.risk_flags_json ?? JSON.stringify(["recovery_contradicted_by_real_play"]),
    linked_decision_snapshot_id: overrides.linked_decision_snapshot_id ?? "decision-1",
    linked_retention_schedule_id: overrides.linked_retention_schedule_id ?? "ret-1",
    source_context: overrides.source_context ?? "concept_case_api",
    supersedes_snapshot_id: overrides.supersedes_snapshot_id ?? null,
    ...overrides,
  };
}

function makeRetentionRow(overrides: Partial<RetentionScheduleRow> = {}): RetentionScheduleRow {
  return {
    id: overrides.id ?? "ret-1",
    user_id: "local_user",
    concept_key: overrides.concept_key ?? "river_bluff_catching",
    created_at: overrides.created_at ?? "2026-03-12T11:00:00.000Z",
    scheduled_for: overrides.scheduled_for ?? "2026-03-14T11:00:00.000Z",
    status: overrides.status ?? "completed_fail",
    reason: overrides.reason ?? "recovered_validation",
    linked_intervention_id: overrides.linked_intervention_id ?? "int-1",
    linked_decision_snapshot_id: overrides.linked_decision_snapshot_id ?? "decision-1",
    recovery_stage_at_scheduling: overrides.recovery_stage_at_scheduling ?? "recovered",
    priority: overrides.priority ?? 68,
    completed_at: overrides.completed_at ?? "2026-03-14T11:05:00.000Z",
    result: overrides.result ?? "fail",
    supersedes_schedule_id: overrides.supersedes_schedule_id ?? null,
    superseded_by_schedule_id: overrides.superseded_by_schedule_id ?? null,
    evidence_json: overrides.evidence_json ?? JSON.stringify(["Validation was scheduled after recovery."]),
  };
}

describe("buildConceptAuditFeed", () => {
  it("maps diagnosis history into audit events", () => {
    const feed = buildConceptAuditFeed({
      conceptKey: "river_bluff_catching",
      diagnoses: [makeDiagnosisRow()],
    });

    expect(feed.state).toBe("diagnosis_only");
    expect(feed.events[0]?.eventType).toBe("diagnosis_recorded");
    expect(feed.events[0]?.sourceFamily).toBe("diagnosis");
  });

  it("maps intervention decision snapshots into audit events", () => {
    const feed = buildConceptAuditFeed({
      conceptKey: "river_bluff_catching",
      decisionSnapshots: [
        makeDecisionRow({
          id: "decision-2",
          created_at: "2026-03-12T12:30:00.000Z",
          recommended_action: "escalate_intervention",
          supersedes_decision_id: "decision-1",
        }),
        makeDecisionRow(),
      ],
    });

    expect(feed.events.find((event) => event.id === "decision:decision-2")?.eventType).toBe("intervention_escalated");
    expect(feed.events.find((event) => event.id === "decision:decision-2")?.metadata).toHaveProperty("replaySignificance", "output_changed");
  });

  it("maps transfer snapshots into audit events", () => {
    const feed = buildConceptAuditFeed({
      conceptKey: "river_bluff_catching",
      transferSnapshots: [
        makeTransferRow({
          id: "transfer-2",
          created_at: "2026-03-12T13:30:00.000Z",
          transfer_status: "transfer_regressed",
          supersedes_snapshot_id: "transfer-1",
        }),
        makeTransferRow(),
      ],
    });

    expect(feed.events.find((event) => event.id === "transfer:transfer-2")?.sourceFamily).toBe("transfer");
    expect(feed.events.find((event) => event.id === "transfer:transfer-2")?.label).toContain("changed");
  });

  it("maps retention creation, due, and completion into audit events", () => {
    const feed = buildConceptAuditFeed({
      conceptKey: "river_bluff_catching",
      retentionSchedules: [makeRetentionRow()],
    });

    expect(feed.events.map((event) => event.eventType)).toEqual([
      "retention_completed_fail",
      "retention_due",
      "retention_scheduled",
    ]);
  });

  it("orders mixed events newest first", () => {
    const feed = buildConceptAuditFeed({
      conceptKey: "river_bluff_catching",
      diagnoses: [makeDiagnosisRow()],
      decisionSnapshots: [makeDecisionRow()],
      transferSnapshots: [makeTransferRow()],
      retentionSchedules: [makeRetentionRow()],
    });

    expect(feed.events.map((event) => event.timestamp)).toEqual([
      "2026-03-14T11:05:00.000Z",
      "2026-03-14T11:00:00.000Z",
      "2026-03-12T13:00:00.000Z",
      "2026-03-12T12:00:00.000Z",
      "2026-03-12T11:00:00.000Z",
      "2026-03-12T10:00:00.000Z",
    ]);
  });

  it("returns no-history cleanly", () => {
    const feed = buildConceptAuditFeed({
      conceptKey: "river_bluff_catching",
    });

    expect(feed.state).toBe("no_history");
    expect(feed.events).toEqual([]);
  });

  it("returns partial-history when only some audit families exist", () => {
    const feed = buildConceptAuditFeed({
      conceptKey: "river_bluff_catching",
      diagnoses: [makeDiagnosisRow()],
      decisionSnapshots: [makeDecisionRow()],
    });

    expect(feed.state).toBe("partial_history");
    expect(feed.familiesPresent).toEqual(["diagnosis", "intervention"]);
  });
});
