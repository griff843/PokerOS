import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  InterventionHistoryEntry,
  PlayerDiagnosisHistoryEntry,
  PlayerIntelligenceSnapshot,
  RealPlayConceptSignal,
} from "@poker-coach/core/browser";
import { selectPatternsForConcept } from "@poker-coach/core/browser";
import type {
  CoachingInputSnapshotRow,
  CoachingInputSnapshotType,
  RetentionScheduleRow,
} from "../../../../packages/db/src/repository";
import {
  createCoachingInputSnapshot,
  getLatestCoachingInputSnapshot,
} from "../../../../packages/db/src/repository";
import { getLocalCoachingUserId } from "./coaching-memory";
import { buildConceptRetentionSummary } from "./retention-scheduling";
import { buildConceptTransferEvaluationMap } from "./transfer-evaluation";

export const INTERVENTION_INPUT_SCHEMA_VERSION = "intervention_recommendation_input.v1";
export const TRANSFER_INPUT_SCHEMA_VERSION = "transfer_evaluation_input.v1";

export interface InterventionRecommendationInputSnapshotPayload {
  schemaVersion: typeof INTERVENTION_INPUT_SCHEMA_VERSION;
  conceptKey: string;
  label: string;
  diagnosisSummary: {
    count: number;
    types: string[];
  };
  interventionSummary: {
    count: number;
    activeCount: number;
    improvedCount: number;
    failedCount: number;
    latestStatus?: string;
  };
  recoveryStage: string;
  patternSummary: {
    count: number;
    types: string[];
  };
  recurrenceCount: number;
  reviewPressure: number;
  trainingUrgency: number;
  trendSummary: {
    direction?: "improving" | "worsening" | "stable";
    recentAverage?: number;
    averageScore?: number;
  };
  retentionSummary: {
    latestState?: string;
    validationState: "none" | "provisional" | "validated" | "failed";
    lastResult?: "pass" | "fail" | null;
    dueCount: number;
    overdueCount: number;
  };
  transferSummary?: {
    status: string;
    confidence: string;
    evidenceSufficiency: string;
    pressure: string;
    studyVsRealPlayDelta?: number;
    realPlayOccurrences: number;
    realPlayReviewSpotCount: number;
  };
}

export interface TransferEvaluationInputSnapshotPayload {
  schemaVersion: typeof TRANSFER_INPUT_SCHEMA_VERSION;
  conceptKey: string;
  label: string;
  studySummary: {
    sampleSize: number;
    recentAverage?: number;
    averageScore?: number;
    trendDirection?: "improving" | "worsening" | "stable";
    failedCount: number;
  };
  realPlaySummary: {
    occurrences: number;
    reviewSpotCount: number;
    weight?: number;
    latestHandAt?: string;
    evidenceCount: number;
  };
  diagnosisSummary: {
    count: number;
  };
  interventionSummary: {
    count: number;
    improvedCount: number;
    failedCount: number;
    latestStatus?: string;
  };
  recoveryStage: string;
  retentionSummary: {
    latestState?: string;
    validationState: "none" | "provisional" | "validated" | "failed";
    lastResult?: "pass" | "fail" | null;
  };
  patternSummary: {
    count: number;
    types: string[];
  };
}

export interface CoachingInputSnapshotRecord {
  id: string;
  conceptKey: string;
  snapshotType: CoachingInputSnapshotType;
  schemaVersion: string;
  createdAt: string;
  recoveryStage: string;
  retentionState?: string | null;
  patternTypes: string[];
  diagnosisCount: number;
  interventionCount: number;
  studySampleSize: number;
  realPlayOccurrences: number;
  linkedDecisionSnapshotId?: string | null;
  linkedTransferSnapshotId?: string | null;
  sourceContext?: string | null;
  supersedesSnapshotId?: string | null;
  payload: InterventionRecommendationInputSnapshotPayload | TransferEvaluationInputSnapshotPayload;
}

export interface EngineReplaySummary {
  latestInputSnapshot?: CoachingInputSnapshotRecord;
  previousInputSnapshot?: CoachingInputSnapshotRecord;
  latestOutputSnapshotId?: string;
  previousOutputSnapshotId?: string;
  inputChanged: boolean;
  outputChanged: boolean;
  changedEvidenceFields: string[];
  interpretation: "stable" | "evidence_changed" | "output_changed_without_input_delta";
}

export function persistCoachingInputSnapshot(args: {
  db: Database.Database;
  conceptKey: string;
  snapshotType: CoachingInputSnapshotType;
  schemaVersion: string;
  payload: InterventionRecommendationInputSnapshotPayload | TransferEvaluationInputSnapshotPayload;
  recoveryStage: string;
  retentionState?: string | null;
  patternTypes: string[];
  diagnosisCount: number;
  interventionCount: number;
  studySampleSize: number;
  realPlayOccurrences: number;
  linkedDecisionSnapshotId?: string | null;
  linkedTransferSnapshotId?: string | null;
  sourceContext?: string;
  createdAt?: string;
  userId?: string;
}): CoachingInputSnapshotRecord {
  const userId = args.userId ?? getLocalCoachingUserId();
  const createdAt = args.createdAt ?? new Date().toISOString();
  const latest = getLatestCoachingInputSnapshot(args.db, userId, args.conceptKey, args.snapshotType);
  const row: CoachingInputSnapshotRow = {
    id: randomUUID(),
    user_id: userId,
    concept_key: args.conceptKey,
    snapshot_type: args.snapshotType,
    schema_version: args.schemaVersion,
    created_at: createdAt,
    payload_json: JSON.stringify(args.payload),
    recovery_stage: args.recoveryStage,
    retention_state: args.retentionState ?? null,
    pattern_types_json: JSON.stringify(args.patternTypes),
    diagnosis_count: args.diagnosisCount,
    intervention_count: args.interventionCount,
    study_sample_size: args.studySampleSize,
    real_play_occurrences: args.realPlayOccurrences,
    linked_decision_snapshot_id: args.linkedDecisionSnapshotId ?? null,
    linked_transfer_snapshot_id: args.linkedTransferSnapshotId ?? null,
    source_context: args.sourceContext ?? null,
    supersedes_snapshot_id: latest?.id ?? null,
  };
  createCoachingInputSnapshot(args.db, row);
  return toCoachingInputSnapshotRecord(row);
}

export function buildRecommendationInputSnapshotPayloadMap(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  retentionSchedules?: RetentionScheduleRow[];
}): Map<string, InterventionRecommendationInputSnapshotPayload> {
  const diagnosisHistory = args.diagnosisHistory ?? [];
  const interventionHistory = args.interventionHistory ?? [];
  const transferEvaluations = buildConceptTransferEvaluationMap({
    playerIntelligence: args.playerIntelligence,
    diagnosisHistory,
    interventionHistory,
    realPlaySignals: args.realPlaySignals,
    retentionSchedules: args.retentionSchedules,
  });
  const payloads = new Map<string, InterventionRecommendationInputSnapshotPayload>();

  for (const concept of args.playerIntelligence.concepts) {
    const diagnoses = diagnosisHistory.filter((entry) => entry.conceptKey === concept.conceptKey);
    const interventions = interventionHistory.filter((entry) => entry.conceptKey === concept.conceptKey);
    const retention = buildConceptRetentionSummary(concept.conceptKey, args.retentionSchedules ?? []);
    const patterns = selectPatternsForConcept(args.playerIntelligence.patterns.patterns, concept.conceptKey);
    const transfer = transferEvaluations.get(concept.conceptKey);

    payloads.set(concept.conceptKey, {
      schemaVersion: INTERVENTION_INPUT_SCHEMA_VERSION,
      conceptKey: concept.conceptKey,
      label: concept.label,
      diagnosisSummary: {
        count: diagnoses.length,
        types: [...new Set(diagnoses.map((entry) => entry.diagnosticType))],
      },
      interventionSummary: {
        count: interventions.length,
        activeCount: interventions.filter((entry) => ["assigned", "in_progress", "stabilizing"].includes(entry.status)).length,
        improvedCount: interventions.filter((entry) => entry.improved === true).length,
        failedCount: interventions.filter((entry) => entry.improved === false || entry.status === "regressed").length,
        latestStatus: [...interventions].sort(compareInterventions)[0]?.status,
      },
      recoveryStage: concept.recoveryStage,
      patternSummary: {
        count: patterns.length,
        types: patterns.map((pattern) => pattern.type),
      },
      recurrenceCount: concept.recurrenceCount,
      reviewPressure: concept.reviewPressure,
      trainingUrgency: concept.trainingUrgency,
      trendSummary: {
        direction: concept.trend?.direction,
        recentAverage: concept.recentAverage,
        averageScore: concept.averageScore,
      },
      retentionSummary: {
        latestState: retention.latestSchedule?.state,
        validationState: retention.validationState,
        lastResult: retention.lastResult ?? null,
        dueCount: retention.dueCount,
        overdueCount: retention.overdueCount,
      },
      transferSummary: transfer ? {
        status: transfer.status,
        confidence: transfer.confidence,
        evidenceSufficiency: transfer.evidenceSufficiency,
        pressure: transfer.pressure,
        studyVsRealPlayDelta: transfer.studyVsRealPlayDelta,
        realPlayOccurrences: transfer.realPlayEvidence.occurrences,
        realPlayReviewSpotCount: transfer.realPlayEvidence.reviewSpotCount,
      } : undefined,
    });
  }

  return payloads;
}

export function buildTransferInputSnapshotPayloadMap(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  retentionSchedules?: RetentionScheduleRow[];
}): Map<string, TransferEvaluationInputSnapshotPayload> {
  const diagnosisHistory = args.diagnosisHistory ?? [];
  const interventionHistory = args.interventionHistory ?? [];
  const realPlayMap = new Map((args.realPlaySignals ?? []).map((signal) => [signal.conceptKey, signal]));
  const payloads = new Map<string, TransferEvaluationInputSnapshotPayload>();

  for (const concept of args.playerIntelligence.concepts) {
    const diagnoses = diagnosisHistory.filter((entry) => entry.conceptKey === concept.conceptKey);
    const interventions = interventionHistory.filter((entry) => entry.conceptKey === concept.conceptKey);
    const retention = buildConceptRetentionSummary(concept.conceptKey, args.retentionSchedules ?? []);
    const patterns = selectPatternsForConcept(args.playerIntelligence.patterns.patterns, concept.conceptKey);
    const realPlay = realPlayMap.get(concept.conceptKey);

    payloads.set(concept.conceptKey, {
      schemaVersion: TRANSFER_INPUT_SCHEMA_VERSION,
      conceptKey: concept.conceptKey,
      label: concept.label,
      studySummary: {
        sampleSize: concept.sampleSize,
        recentAverage: concept.recentAverage,
        averageScore: concept.averageScore,
        trendDirection: concept.trend?.direction,
        failedCount: concept.failedCount,
      },
      realPlaySummary: {
        occurrences: realPlay?.occurrences ?? 0,
        reviewSpotCount: realPlay?.reviewSpotCount ?? 0,
        weight: realPlay?.weight,
        latestHandAt: realPlay?.latestHandAt,
        evidenceCount: realPlay?.evidence.length ?? 0,
      },
      diagnosisSummary: {
        count: diagnoses.length,
      },
      interventionSummary: {
        count: interventions.length,
        improvedCount: interventions.filter((entry) => entry.improved === true).length,
        failedCount: interventions.filter((entry) => entry.improved === false || entry.status === "regressed").length,
        latestStatus: [...interventions].sort(compareInterventions)[0]?.status,
      },
      recoveryStage: concept.recoveryStage,
      retentionSummary: {
        latestState: retention.latestSchedule?.state,
        validationState: retention.validationState,
        lastResult: retention.lastResult ?? null,
      },
      patternSummary: {
        count: patterns.length,
        types: patterns.map((pattern) => pattern.type),
      },
    });
  }

  return payloads;
}

export function buildEngineReplaySummary(args: {
  conceptKey: string;
  snapshotType: CoachingInputSnapshotType;
  inputSnapshots: CoachingInputSnapshotRow[];
  outputSnapshots: Array<{ id: string; concept_key: string; created_at: string }>;
}): EngineReplaySummary {
  const inputs = args.inputSnapshots
    .filter((row) => row.concept_key === args.conceptKey && row.snapshot_type === args.snapshotType)
    .sort(compareRowsDesc)
    .map((row) => toCoachingInputSnapshotRecord(row));
  const outputs = args.outputSnapshots
    .filter((row) => row.concept_key === args.conceptKey)
    .sort(compareRowsDesc);
  const latestInput = inputs[0];
  const previousInput = inputs[1];
  const latestOutput = outputs[0];
  const previousOutput = outputs[1];
  const changedEvidenceFields = latestInput && previousInput
    ? diffSnapshotPayloads(latestInput.payload, previousInput.payload)
    : [];
  const inputChanged = changedEvidenceFields.length > 0;
  const outputChanged = latestOutput !== undefined && previousOutput !== undefined ? latestOutput.id !== previousOutput.id : false;

  return {
    latestInputSnapshot: latestInput,
    previousInputSnapshot: previousInput,
    latestOutputSnapshotId: latestOutput?.id,
    previousOutputSnapshotId: previousOutput?.id,
    inputChanged,
    outputChanged,
    changedEvidenceFields,
    interpretation: !inputChanged && !outputChanged
      ? "stable"
      : inputChanged
        ? "evidence_changed"
        : "output_changed_without_input_delta",
  };
}

export function getRecentInputOutputPairs(args: {
  inputSnapshots: CoachingInputSnapshotRow[];
  outputSnapshots: Array<{ id: string; concept_key: string; created_at: string }>;
  conceptKey: string;
  snapshotType: CoachingInputSnapshotType;
  limit?: number;
}): Array<{
  input: CoachingInputSnapshotRecord;
  outputId?: string;
}> {
  const limit = args.limit ?? 5;
  const outputsById = new Set(args.outputSnapshots.filter((row) => row.concept_key === args.conceptKey).map((row) => row.id));
  return args.inputSnapshots
    .filter((row) => row.concept_key === args.conceptKey && row.snapshot_type === args.snapshotType)
    .sort(compareRowsDesc)
    .slice(0, limit)
    .map((row) => {
      const record = toCoachingInputSnapshotRecord(row);
      return {
        input: record,
        outputId: record.linkedDecisionSnapshotId && outputsById.has(record.linkedDecisionSnapshotId)
          ? record.linkedDecisionSnapshotId
          : record.linkedTransferSnapshotId && outputsById.has(record.linkedTransferSnapshotId)
            ? record.linkedTransferSnapshotId
            : undefined,
      };
    });
}

export function toCoachingInputSnapshotRecord(row: CoachingInputSnapshotRow): CoachingInputSnapshotRecord {
  return {
    id: row.id,
    conceptKey: row.concept_key,
    snapshotType: row.snapshot_type,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    recoveryStage: row.recovery_stage,
    retentionState: row.retention_state ?? null,
    patternTypes: parseJsonArray<string>(row.pattern_types_json),
    diagnosisCount: row.diagnosis_count,
    interventionCount: row.intervention_count,
    studySampleSize: row.study_sample_size,
    realPlayOccurrences: row.real_play_occurrences,
    linkedDecisionSnapshotId: row.linked_decision_snapshot_id ?? null,
    linkedTransferSnapshotId: row.linked_transfer_snapshot_id ?? null,
    sourceContext: row.source_context ?? null,
    supersedesSnapshotId: row.supersedes_snapshot_id ?? null,
    payload: JSON.parse(row.payload_json) as InterventionRecommendationInputSnapshotPayload | TransferEvaluationInputSnapshotPayload,
  };
}

export function getLatestInputOutputSnapshotPair(args: {
  db: Database.Database;
  conceptKey: string;
  snapshotType: CoachingInputSnapshotType;
  userId?: string;
}): {
  latestInput?: CoachingInputSnapshotRecord;
} {
  const userId = args.userId ?? getLocalCoachingUserId();
  const latestInput = getLatestCoachingInputSnapshot(args.db, userId, args.conceptKey, args.snapshotType);
  return {
    latestInput: latestInput ? toCoachingInputSnapshotRecord(latestInput) : undefined,
  };
}

function diffSnapshotPayloads(
  left: InterventionRecommendationInputSnapshotPayload | TransferEvaluationInputSnapshotPayload,
  right: InterventionRecommendationInputSnapshotPayload | TransferEvaluationInputSnapshotPayload
): string[] {
  const leftRecord = left as unknown as Record<string, unknown>;
  const rightRecord = right as unknown as Record<string, unknown>;
  const fields = new Set<string>([
    ...Object.keys(leftRecord),
    ...Object.keys(rightRecord),
  ]);
  return [...fields]
    .filter((field) => JSON.stringify(leftRecord[field]) !== JSON.stringify(rightRecord[field]))
    .sort();
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function compareInterventions(a: InterventionHistoryEntry, b: InterventionHistoryEntry): number {
  return new Date(b.outcomeCreatedAt ?? b.createdAt).getTime() - new Date(a.outcomeCreatedAt ?? a.createdAt).getTime();
}

function compareRowsDesc(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id);
}
