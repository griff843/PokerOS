import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ConceptTransferEvaluation } from "@poker-coach/core/browser";
import { openDatabase } from "../../../../packages/db/src";
import type { TransferEvaluationSnapshotRow } from "../../../../packages/db/src/repository";
import { getUserTransferEvaluationSnapshots } from "../../../../packages/db/src/repository";
import { buildConceptTransferAuditSummary, persistTransferEvaluationSnapshot } from "./transfer-audit";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-coach-transfer-audit-"));
  tempDirs.push(dir);
  return path.join(dir, "coach.db");
}

describe("transfer audit", () => {
  it("persists a first transfer snapshot and suppresses near-identical duplicates", () => {
    const db = openDatabase(createTempDbPath());
    const first = persistTransferEvaluationSnapshot({
      db,
      evaluation: makeEvaluation(),
      studySampleSize: 6,
      studyRecentAverage: 0.74,
      studyAverage: 0.61,
      studyFailedCount: 1,
      recoveryStage: "recovered",
      retentionState: "completed_pass",
      retentionResult: "pass",
      patternTypes: ["real_play_transfer_gap"],
      sourceContext: "concept_case_api",
      createdAt: "2026-03-12T12:00:00.000Z",
    });
    const duplicate = persistTransferEvaluationSnapshot({
      db,
      evaluation: makeEvaluation(),
      studySampleSize: 6,
      studyRecentAverage: 0.74,
      studyAverage: 0.61,
      studyFailedCount: 1,
      recoveryStage: "recovered",
      retentionState: "completed_pass",
      retentionResult: "pass",
      patternTypes: ["real_play_transfer_gap"],
      sourceContext: "concept_case_api",
      createdAt: "2026-03-12T12:05:00.000Z",
    });

    const snapshots = getUserTransferEvaluationSnapshots(db, "local_user");
    db.close();

    expect(first.suppressed).toBe(false);
    expect(duplicate.suppressed).toBe(true);
    expect(snapshots).toHaveLength(1);
  });

  it("creates a new snapshot when transfer status materially changes", () => {
    const db = openDatabase(createTempDbPath());
    persistTransferEvaluationSnapshot({
      db,
      evaluation: makeEvaluation({ status: "transfer_validated", riskFlags: [] as ConceptTransferEvaluation["riskFlags"] }),
      studySampleSize: 6,
      studyRecentAverage: 0.74,
      studyAverage: 0.61,
      studyFailedCount: 1,
      recoveryStage: "recovered",
      retentionState: "completed_pass",
      retentionResult: "pass",
      patternTypes: [],
      createdAt: "2026-03-12T12:00:00.000Z",
    });
    persistTransferEvaluationSnapshot({
      db,
      evaluation: makeEvaluation({
        status: "transfer_regressed",
        pressure: "high",
        riskFlags: ["validated_transfer_slipping", "recovery_contradicted_by_real_play"] as ConceptTransferEvaluation["riskFlags"],
      }),
      studySampleSize: 7,
      studyRecentAverage: 0.78,
      studyAverage: 0.65,
      studyFailedCount: 1,
      recoveryStage: "recovered",
      retentionState: "due",
      retentionResult: "pass",
      patternTypes: ["real_play_transfer_gap"],
      createdAt: "2026-03-12T13:00:00.000Z",
    });

    const snapshots = getUserTransferEvaluationSnapshots(db, "local_user");
    const summary = buildConceptTransferAuditSummary({
      conceptKey: "river_bluff_catching",
      snapshots,
    });
    db.close();

    expect(snapshots).toHaveLength(2);
    expect(summary.latestSnapshot?.status).toBe("transfer_regressed");
    expect(summary.previousSnapshot?.status).toBe("transfer_validated");
    expect(summary.firstValidatedAt).toBe("2026-03-12T12:00:00.000Z");
    expect(summary.latestGapOrRegressionAt).toBe("2026-03-12T13:00:00.000Z");
  });

  it("reads transfer history in newest-first order", () => {
    const snapshots: TransferEvaluationSnapshotRow[] = [
      makeSnapshotRow("transfer-1", "2026-03-12T12:00:00.000Z", "transfer_validated"),
      makeSnapshotRow("transfer-2", "2026-03-12T13:00:00.000Z", "transfer_gap"),
      makeSnapshotRow("transfer-3", "2026-03-12T14:00:00.000Z", "transfer_regressed"),
    ];

    const summary = buildConceptTransferAuditSummary({
      conceptKey: "river_bluff_catching",
      snapshots,
      currentEvaluation: makeEvaluation({ status: "transfer_regressed" }),
    });

    expect(summary.latestSnapshot?.id).toBe("transfer-3");
    expect(summary.previousSnapshot?.id).toBe("transfer-2");
    expect(summary.stability).toBe("flipping");
  });
});

function makeEvaluation(overrides: Partial<Parameters<typeof persistTransferEvaluationSnapshot>[0]["evaluation"]> = {}) {
  const base: ConceptTransferEvaluation = {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    status: "transfer_gap" as const,
    confidence: "high" as const,
    evidenceSufficiency: "strong" as const,
    pressure: "medium" as const,
    studyPerformance: 0.74,
    realPlayPerformance: 0.28,
    studyVsRealPlayDelta: 0.46,
    supportingEvidence: ["Study performance is ahead of real play."],
    riskFlags: ["study_ahead_of_real_play", "recovery_contradicted_by_real_play"],
    summary: "River Bluff Catching is improving in study faster than it is holding up in real play.",
    coachExplanation: "Imported hands are still producing review pressure.",
    realPlayEvidence: {
      occurrences: 3,
      reviewSpotCount: 3,
      latestHandAt: "2026-03-12T12:00:00.000Z",
    },
  };
  return { ...base, ...overrides };
}

function makeSnapshotRow(
  id: string,
  createdAt: string,
  status: TransferEvaluationSnapshotRow["transfer_status"]
): TransferEvaluationSnapshotRow {
  return {
    id,
    user_id: "local_user",
    concept_key: "river_bluff_catching",
    created_at: createdAt,
    transfer_status: status,
    transfer_confidence: "high",
    evidence_sufficiency: "strong",
    pressure: status === "transfer_regressed" ? "high" : "medium",
    study_sample_size: 6,
    study_performance: 0.74,
    study_recent_average: 0.74,
    study_average: 0.61,
    study_failed_count: 1,
    real_play_performance: status === "transfer_validated" ? 0.82 : 0.28,
    real_play_occurrences: 3,
    real_play_review_spot_count: status === "transfer_validated" ? 0 : 3,
    real_play_latest_hand_at: "2026-03-12T12:00:00.000Z",
    study_vs_real_play_delta: status === "transfer_validated" ? -0.08 : 0.46,
    recovery_stage: "recovered",
    retention_state: "completed_pass",
    retention_result: "pass",
    pattern_types_json: JSON.stringify(status === "transfer_validated" ? [] : ["real_play_transfer_gap"]),
    supporting_evidence_json: JSON.stringify(["Transfer audit evidence."]),
    risk_flags_json: JSON.stringify(status === "transfer_validated" ? [] : ["recovery_contradicted_by_real_play"]),
    linked_decision_snapshot_id: null,
    linked_retention_schedule_id: null,
    source_context: "concept_case_api",
    supersedes_snapshot_id: null,
  };
}
