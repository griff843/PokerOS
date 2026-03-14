import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  ConceptTransferEvaluation,
  PlayerDiagnosisHistoryEntry,
  PlayerIntelligenceSnapshot,
  RealPlayConceptSignal,
  InterventionHistoryEntry,
} from "@poker-coach/core/browser";
import type {
  InterventionDecisionSnapshotRow,
  RetentionScheduleRow,
  TransferEvaluationSnapshotRow,
} from "../../../../packages/db/src/repository";
import {
  createTransferEvaluationSnapshot,
  getLatestTransferEvaluationSnapshot,
  getUserTransferEvaluationSnapshots,
} from "../../../../packages/db/src/repository";
import { getLocalCoachingUserId } from "./coaching-memory";
import {
  TRANSFER_ENGINE_MANIFEST,
  fromEngineManifestColumns,
  toEngineManifestColumns,
  type TableSimEngineManifest,
} from "./engine-manifest";
import {
  TRANSFER_INPUT_SCHEMA_VERSION,
  buildTransferInputSnapshotPayloadMap,
  persistCoachingInputSnapshot,
  type TransferEvaluationInputSnapshotPayload,
} from "./input-snapshots";
import { buildConceptRetentionSummary } from "./retention-scheduling";
import { buildConceptTransferEvaluationMap } from "./transfer-evaluation";

const TRANSFER_DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export interface TransferAuditRecord {
  id: string;
  conceptKey: string;
  createdAt: string;
  engineManifest: TableSimEngineManifest;
  status: ConceptTransferEvaluation["status"];
  confidence: ConceptTransferEvaluation["confidence"];
  evidenceSufficiency: ConceptTransferEvaluation["evidenceSufficiency"];
  pressure: ConceptTransferEvaluation["pressure"];
  studySampleSize: number;
  studyPerformance?: number | null;
  studyRecentAverage?: number | null;
  studyAverage?: number | null;
  studyFailedCount: number;
  realPlayPerformance?: number | null;
  realPlayOccurrences: number;
  realPlayReviewSpotCount: number;
  realPlayLatestHandAt?: string | null;
  studyVsRealPlayDelta?: number | null;
  recoveryStage: string;
  retentionState?: string | null;
  retentionResult?: "pass" | "fail" | null;
  patternTypes: string[];
  supportingEvidence: string[];
  riskFlags: string[];
  linkedDecisionSnapshotId?: string | null;
  linkedRetentionScheduleId?: string | null;
  sourceContext?: string | null;
  supersedesSnapshotId?: string | null;
}

export interface TransferAuditSummary {
  conceptKey: string;
  latestSnapshot?: TransferAuditRecord;
  previousSnapshot?: TransferAuditRecord;
  latestChanged: boolean;
  currentEvaluationChanged: boolean;
  firstValidatedAt?: string;
  latestGapOrRegressionAt?: string;
  stability: "stable" | "shifting" | "flipping";
  latestStrongContradiction?: TransferAuditRecord;
  latestNoEvidenceOrUncertain?: TransferAuditRecord;
}

export function persistTransferEvaluationSnapshot(args: {
  db: Database.Database;
  evaluation: ConceptTransferEvaluation;
  inputPayload?: TransferEvaluationInputSnapshotPayload;
  studySampleSize: number;
  studyRecentAverage?: number;
  studyAverage?: number;
  studyFailedCount: number;
  recoveryStage: string;
  retentionState?: string;
  retentionResult?: "pass" | "fail" | null;
  patternTypes: string[];
  linkedDecisionSnapshotId?: string | null;
  linkedRetentionScheduleId?: string | null;
  sourceContext?: string;
  createdAt?: string;
  userId?: string;
}): { record: TransferAuditRecord; suppressed: boolean } {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const userId = args.userId ?? getLocalCoachingUserId();
  const latest = getLatestTransferEvaluationSnapshot(args.db, userId, args.evaluation.conceptKey);

  if (latest && shouldSuppressTransferSnapshot(latest, args.evaluation, createdAt)) {
    if (args.inputPayload) {
      persistCoachingInputSnapshot({
        db: args.db,
        conceptKey: args.evaluation.conceptKey,
        snapshotType: "transfer_evaluation",
        schemaVersion: TRANSFER_INPUT_SCHEMA_VERSION,
        engineManifest: TRANSFER_ENGINE_MANIFEST,
        payload: args.inputPayload,
        recoveryStage: args.recoveryStage,
        retentionState: args.retentionState ?? null,
        patternTypes: args.patternTypes,
        diagnosisCount: args.inputPayload.diagnosisSummary.count,
        interventionCount: args.inputPayload.interventionSummary.count,
        studySampleSize: args.inputPayload.studySummary.sampleSize,
        realPlayOccurrences: args.inputPayload.realPlaySummary.occurrences,
        linkedTransferSnapshotId: latest.id,
        linkedDecisionSnapshotId: args.linkedDecisionSnapshotId ?? null,
        sourceContext: args.sourceContext,
        createdAt,
        userId,
      });
    }
    return {
      record: toTransferAuditRecord(latest),
      suppressed: true,
    };
  }

  const row: TransferEvaluationSnapshotRow = {
    id: randomUUID(),
    user_id: userId,
    concept_key: args.evaluation.conceptKey,
    created_at: createdAt,
    ...toEngineManifestColumns(TRANSFER_ENGINE_MANIFEST),
    transfer_status: args.evaluation.status,
    transfer_confidence: args.evaluation.confidence,
    evidence_sufficiency: args.evaluation.evidenceSufficiency,
    pressure: args.evaluation.pressure,
    study_sample_size: args.studySampleSize,
    study_performance: args.evaluation.studyPerformance ?? null,
    study_recent_average: args.studyRecentAverage ?? null,
    study_average: args.studyAverage ?? null,
    study_failed_count: args.studyFailedCount,
    real_play_performance: args.evaluation.realPlayPerformance ?? null,
    real_play_occurrences: args.evaluation.realPlayEvidence.occurrences,
    real_play_review_spot_count: args.evaluation.realPlayEvidence.reviewSpotCount,
    real_play_latest_hand_at: args.evaluation.realPlayEvidence.latestHandAt ?? null,
    study_vs_real_play_delta: args.evaluation.studyVsRealPlayDelta ?? null,
    recovery_stage: args.recoveryStage,
    retention_state: args.retentionState ?? null,
    retention_result: args.retentionResult ?? null,
    pattern_types_json: JSON.stringify(args.patternTypes),
    supporting_evidence_json: JSON.stringify(args.evaluation.supportingEvidence),
    risk_flags_json: JSON.stringify(args.evaluation.riskFlags),
    linked_decision_snapshot_id: args.linkedDecisionSnapshotId ?? null,
    linked_retention_schedule_id: args.linkedRetentionScheduleId ?? null,
    source_context: args.sourceContext ?? null,
    supersedes_snapshot_id: latest?.id ?? null,
  };

  createTransferEvaluationSnapshot(args.db, row);
  if (args.inputPayload) {
    persistCoachingInputSnapshot({
      db: args.db,
      conceptKey: args.evaluation.conceptKey,
      snapshotType: "transfer_evaluation",
      schemaVersion: TRANSFER_INPUT_SCHEMA_VERSION,
      engineManifest: TRANSFER_ENGINE_MANIFEST,
      payload: args.inputPayload,
      recoveryStage: args.recoveryStage,
      retentionState: args.retentionState ?? null,
      patternTypes: args.patternTypes,
      diagnosisCount: args.inputPayload.diagnosisSummary.count,
      interventionCount: args.inputPayload.interventionSummary.count,
      studySampleSize: args.inputPayload.studySummary.sampleSize,
      realPlayOccurrences: args.inputPayload.realPlaySummary.occurrences,
      linkedTransferSnapshotId: row.id,
      linkedDecisionSnapshotId: args.linkedDecisionSnapshotId ?? null,
      sourceContext: args.sourceContext,
      createdAt,
      userId,
    });
  }
  return {
    record: toTransferAuditRecord(row),
    suppressed: false,
  };
}

export function syncTransferEvaluationSnapshots(args: {
  db: Database.Database;
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  retentionSchedules?: RetentionScheduleRow[];
  decisionSnapshots?: InterventionDecisionSnapshotRow[];
  now?: Date;
  sourceContext?: string;
  userId?: string;
}): TransferEvaluationSnapshotRow[] {
  const userId = args.userId ?? getLocalCoachingUserId();
  const transferEvaluations = buildConceptTransferEvaluationMap({
    playerIntelligence: args.playerIntelligence,
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    realPlaySignals: args.realPlaySignals,
    retentionSchedules: args.retentionSchedules,
    now: args.now,
  });
  const inputPayloads = buildTransferInputSnapshotPayloadMap({
    playerIntelligence: args.playerIntelligence,
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    realPlaySignals: args.realPlaySignals,
    retentionSchedules: args.retentionSchedules,
  });

  for (const concept of args.playerIntelligence.concepts) {
    const evaluation = transferEvaluations.get(concept.conceptKey);
    if (!evaluation || !shouldTrackTransferSnapshot(concept, evaluation, args.diagnosisHistory ?? [], args.interventionHistory ?? [])) {
      continue;
    }

    const latestDecision = [...(args.decisionSnapshots ?? [])]
      .filter((row) => row.concept_key === concept.conceptKey)
      .sort(compareSnapshotRowsDesc)[0];
    const retention = buildConceptRetentionSummary(concept.conceptKey, args.retentionSchedules ?? [], args.now);

    persistTransferEvaluationSnapshot({
      db: args.db,
      evaluation,
      inputPayload: inputPayloads.get(concept.conceptKey),
      studySampleSize: concept.sampleSize,
      studyRecentAverage: concept.recentAverage,
      studyAverage: concept.averageScore,
      studyFailedCount: concept.failedCount,
      recoveryStage: concept.recoveryStage,
      retentionState: retention.latestSchedule?.state,
      retentionResult: retention.lastResult ?? null,
      patternTypes: args.playerIntelligence.patterns.patterns
        .filter((pattern) => pattern.implicatedConcepts.includes(concept.conceptKey))
        .map((pattern) => pattern.type),
      linkedDecisionSnapshotId: latestDecision?.id ?? null,
      linkedRetentionScheduleId: retention.latestSchedule?.id ?? null,
      sourceContext: args.sourceContext,
      createdAt: args.now?.toISOString(),
      userId,
    });
  }

  return getUserTransferEvaluationSnapshots(args.db, userId);
}

export function buildConceptTransferAuditSummary(args: {
  conceptKey: string;
  snapshots: TransferEvaluationSnapshotRow[];
  currentEvaluation?: ConceptTransferEvaluation;
}): TransferAuditSummary {
  const conceptSnapshots = args.snapshots
    .filter((row) => row.concept_key === args.conceptKey)
    .sort(compareSnapshotRowsDesc)
    .map((row) => toTransferAuditRecord(row));
  const latestSnapshot = conceptSnapshots[0];
  const previousSnapshot = conceptSnapshots[1];
  const latestChanged = latestSnapshot !== undefined && previousSnapshot !== undefined
    ? latestSnapshot.status !== previousSnapshot.status
    : false;
  const currentEvaluationChanged = latestSnapshot !== undefined && args.currentEvaluation !== undefined
    ? latestSnapshot.status !== args.currentEvaluation.status
      || normalizeFlags(latestSnapshot.riskFlags) !== normalizeFlags(args.currentEvaluation.riskFlags)
      || latestSnapshot.evidenceSufficiency !== args.currentEvaluation.evidenceSufficiency
    : false;
  const recentStatuses = conceptSnapshots.slice(0, 3).map((snapshot) => snapshot.status);
  const uniqueRecentStatuses = new Set(recentStatuses);
  const stability = uniqueRecentStatuses.size <= 1
    ? "stable"
    : uniqueRecentStatuses.size === recentStatuses.length
      ? "flipping"
      : "shifting";

  return {
    conceptKey: args.conceptKey,
    latestSnapshot,
    previousSnapshot,
    latestChanged,
    currentEvaluationChanged,
    firstValidatedAt: [...conceptSnapshots].reverse().find((snapshot) => snapshot.status === "transfer_validated")?.createdAt,
    latestGapOrRegressionAt: conceptSnapshots.find((snapshot) => snapshot.status === "transfer_gap" || snapshot.status === "transfer_regressed")?.createdAt,
    stability,
    latestStrongContradiction: conceptSnapshots.find((snapshot) => snapshot.riskFlags.includes("recovery_contradicted_by_real_play")),
    latestNoEvidenceOrUncertain: conceptSnapshots.find((snapshot) => snapshot.status === "no_real_play_evidence" || snapshot.status === "transfer_uncertain"),
  };
}

export function toTransferAuditRecord(row: TransferEvaluationSnapshotRow): TransferAuditRecord {
  return {
    id: row.id,
    conceptKey: row.concept_key,
    createdAt: row.created_at,
    engineManifest: fromEngineManifestColumns(row),
    status: row.transfer_status,
    confidence: row.transfer_confidence,
    evidenceSufficiency: row.evidence_sufficiency,
    pressure: row.pressure,
    studySampleSize: row.study_sample_size,
    studyPerformance: row.study_performance ?? null,
    studyRecentAverage: row.study_recent_average ?? null,
    studyAverage: row.study_average ?? null,
    studyFailedCount: row.study_failed_count,
    realPlayPerformance: row.real_play_performance ?? null,
    realPlayOccurrences: row.real_play_occurrences,
    realPlayReviewSpotCount: row.real_play_review_spot_count,
    realPlayLatestHandAt: row.real_play_latest_hand_at ?? null,
    studyVsRealPlayDelta: row.study_vs_real_play_delta ?? null,
    recoveryStage: row.recovery_stage,
    retentionState: row.retention_state ?? null,
    retentionResult: row.retention_result ?? null,
    patternTypes: parseJsonArray<string>(row.pattern_types_json),
    supportingEvidence: parseJsonArray<string>(row.supporting_evidence_json),
    riskFlags: parseJsonArray<string>(row.risk_flags_json),
    linkedDecisionSnapshotId: row.linked_decision_snapshot_id ?? null,
    linkedRetentionScheduleId: row.linked_retention_schedule_id ?? null,
    sourceContext: row.source_context ?? null,
    supersedesSnapshotId: row.supersedes_snapshot_id ?? null,
  };
}

function shouldSuppressTransferSnapshot(
  latest: TransferEvaluationSnapshotRow,
  evaluation: ConceptTransferEvaluation,
  createdAt: string
): boolean {
  const deltaMs = Math.abs(new Date(createdAt).getTime() - new Date(latest.created_at).getTime());
  if (!Number.isFinite(deltaMs) || deltaMs > TRANSFER_DUPLICATE_WINDOW_MS) {
    return false;
  }

  return latest.transfer_status === evaluation.status
    && latest.evidence_sufficiency === evaluation.evidenceSufficiency
    && normalizeFlags(parseJsonArray<string>(latest.risk_flags_json)) === normalizeFlags(evaluation.riskFlags);
}

function shouldTrackTransferSnapshot(
  concept: PlayerIntelligenceSnapshot["concepts"][number],
  evaluation: ConceptTransferEvaluation,
  diagnosisHistory: PlayerDiagnosisHistoryEntry[],
  interventionHistory: InterventionHistoryEntry[]
): boolean {
  if (evaluation.status !== "no_real_play_evidence") {
    return true;
  }

  return concept.recoveryStage !== "unaddressed"
    || concept.sampleSize >= 3
    || diagnosisHistory.some((entry) => entry.conceptKey === concept.conceptKey)
    || interventionHistory.some((entry) => entry.conceptKey === concept.conceptKey);
}

function normalizeFlags(flags: readonly string[]): string {
  return [...flags].sort().join("|");
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function compareSnapshotRowsDesc(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id);
}
