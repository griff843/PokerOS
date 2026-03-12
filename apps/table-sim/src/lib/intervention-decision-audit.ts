import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  InterventionHistoryEntry,
  InterventionRecommendation,
  InterventionRecommendationReasonCode,
  InterventionSupportingSignal,
  PlayerDiagnosisHistoryEntry,
  PlayerIntelligenceSnapshot,
  RealPlayConceptSignal,
} from "@poker-coach/core/browser";
import {
  createInterventionDecisionSnapshot,
  getLatestInterventionDecisionSnapshot,
  getUserInterventionDecisionSnapshots,
  markInterventionDecisionActedUpon,
  type InterventionDecisionSnapshotRow,
  type RetentionScheduleRow,
} from "../../../../packages/db/src/repository";
import { getLocalCoachingUserId } from "./coaching-memory";
import {
  INTERVENTION_INPUT_SCHEMA_VERSION,
  buildRecommendationInputSnapshotPayloadMap,
  persistCoachingInputSnapshot,
  type InterventionRecommendationInputSnapshotPayload,
} from "./input-snapshots";

const DECISION_DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export interface InterventionDecisionAuditRecord {
  id: string;
  conceptKey: string;
  createdAt: string;
  action: InterventionRecommendation["action"];
  recommendedStrategy: InterventionRecommendation["recommendedStrategy"];
  confidence: InterventionRecommendation["confidence"];
  priority: number;
  suggestedIntensity: InterventionRecommendation["suggestedIntensity"];
  recoveryStage: string;
  currentInterventionStatus?: string | null;
  reasonCodes: InterventionRecommendationReasonCode[];
  supportingSignals: InterventionSupportingSignal[];
  evidence: string[];
  patternTypes: string[];
  recurringLeak: boolean;
  transferGap: boolean;
  actedUpon: boolean;
  linkedInterventionId?: string | null;
  sourceContext?: string | null;
  supersedesDecisionId?: string | null;
}

export interface InterventionDecisionAuditSummary {
  conceptKey: string;
  latestDecision?: InterventionDecisionAuditRecord;
  previousDecision?: InterventionDecisionAuditRecord;
  latestDecisionChanged: boolean;
  currentRecommendationChanged: boolean;
  escalationCount: number;
  stability: "stable" | "shifting" | "flipping";
  lastActedOnDecision?: InterventionDecisionAuditRecord;
  lastUnactedDecision?: InterventionDecisionAuditRecord;
}

export interface PersistInterventionDecisionSnapshotArgs {
  db: Database.Database;
  recommendation: InterventionRecommendation;
  inputPayload?: InterventionRecommendationInputSnapshotPayload;
  createdAt?: string;
  sourceContext?: string;
  userId?: string;
}

export interface PersistInterventionDecisionSnapshotResult {
  record: InterventionDecisionAuditRecord;
  suppressed: boolean;
}

export function persistInterventionDecisionSnapshot(
  args: PersistInterventionDecisionSnapshotArgs
): PersistInterventionDecisionSnapshotResult {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const userId = args.userId ?? getLocalCoachingUserId();
  const latest = getLatestInterventionDecisionSnapshot(args.db, userId, args.recommendation.conceptKey);

  if (latest && shouldSuppressDecisionSnapshot(latest, args.recommendation, createdAt)) {
    if (args.inputPayload) {
      persistCoachingInputSnapshot({
        db: args.db,
        conceptKey: args.recommendation.conceptKey,
        snapshotType: "intervention_recommendation",
        schemaVersion: INTERVENTION_INPUT_SCHEMA_VERSION,
        payload: args.inputPayload,
        recoveryStage: latest.recovery_stage,
        retentionState: args.inputPayload.retentionSummary.latestState ?? null,
        patternTypes: args.inputPayload.patternSummary.types,
        diagnosisCount: args.inputPayload.diagnosisSummary.count,
        interventionCount: args.inputPayload.interventionSummary.count,
        studySampleSize: 0,
        realPlayOccurrences: args.inputPayload.transferSummary?.realPlayOccurrences ?? 0,
        linkedDecisionSnapshotId: latest.id,
        sourceContext: args.sourceContext,
        createdAt,
        userId,
      });
    }
    return {
      record: toInterventionDecisionAuditRecord(latest),
      suppressed: true,
    };
  }

  const row: InterventionDecisionSnapshotRow = {
    id: randomUUID(),
    user_id: userId,
    concept_key: args.recommendation.conceptKey,
    created_at: createdAt,
    recommended_action: args.recommendation.action,
    recommended_strategy: args.recommendation.recommendedStrategy,
    confidence: args.recommendation.confidence,
    priority: args.recommendation.priority,
    suggested_intensity: args.recommendation.suggestedIntensity,
    recovery_stage: latestRecoveryStage(args.recommendation),
    current_intervention_status: args.recommendation.metadata.currentInterventionStatus ?? null,
    reason_codes_json: JSON.stringify(args.recommendation.reasonCodes),
    supporting_signals_json: JSON.stringify(args.recommendation.supportingSignals),
    evidence_json: JSON.stringify(args.recommendation.evidence),
    pattern_types_json: JSON.stringify(args.recommendation.metadata.patternTypes),
    recurring_leak_bool: args.recommendation.reasonCodes.includes("persistent_recurring_leak") ? 1 : 0,
    transfer_gap_bool: args.recommendation.metadata.transferFocus || args.recommendation.reasonCodes.includes("real_play_transfer_gap") ? 1 : 0,
    acted_upon_bool: 0,
    linked_intervention_id: null,
    source_context: args.sourceContext ?? null,
    supersedes_decision_id: latest?.id ?? null,
  };

  createInterventionDecisionSnapshot(args.db, row);
  if (args.inputPayload) {
    persistCoachingInputSnapshot({
      db: args.db,
      conceptKey: args.recommendation.conceptKey,
      snapshotType: "intervention_recommendation",
      schemaVersion: INTERVENTION_INPUT_SCHEMA_VERSION,
      payload: args.inputPayload,
      recoveryStage: row.recovery_stage,
      retentionState: args.inputPayload.retentionSummary.latestState ?? null,
      patternTypes: args.inputPayload.patternSummary.types,
      diagnosisCount: args.inputPayload.diagnosisSummary.count,
      interventionCount: args.inputPayload.interventionSummary.count,
      studySampleSize: 0,
      realPlayOccurrences: args.inputPayload.transferSummary?.realPlayOccurrences ?? 0,
      linkedDecisionSnapshotId: row.id,
      sourceContext: args.sourceContext,
      createdAt,
      userId,
    });
  }
  return {
    record: toInterventionDecisionAuditRecord(row),
    suppressed: false,
  };
}

export function syncInterventionDecisionSnapshots(args: {
  db: Database.Database;
  playerIntelligence: PlayerIntelligenceSnapshot;
  recommendations: InterventionRecommendation[];
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  retentionSchedules?: RetentionScheduleRow[];
  now?: Date;
  sourceContext?: string;
  userId?: string;
}): InterventionDecisionSnapshotRow[] {
  const userId = args.userId ?? getLocalCoachingUserId();
  const inputPayloads = buildRecommendationInputSnapshotPayloadMap({
    playerIntelligence: args.playerIntelligence,
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    realPlaySignals: args.realPlaySignals,
    retentionSchedules: args.retentionSchedules,
  });

  for (const recommendation of args.recommendations) {
    const concept = args.playerIntelligence.concepts.find((entry) => entry.conceptKey === recommendation.conceptKey);
    if (!concept || !shouldTrackRecommendationSnapshot(concept, recommendation, args.diagnosisHistory ?? [], args.interventionHistory ?? [])) {
      continue;
    }

    persistInterventionDecisionSnapshot({
      db: args.db,
      recommendation,
      inputPayload: inputPayloads.get(recommendation.conceptKey),
      createdAt: args.now?.toISOString(),
      sourceContext: args.sourceContext,
      userId,
    });
  }

  return getUserInterventionDecisionSnapshots(args.db, userId);
}

export function linkInterventionDecisionToIntervention(args: {
  db: Database.Database;
  decisionId: string;
  interventionId?: string | null;
}): void {
  markInterventionDecisionActedUpon(args.db, args.decisionId, args.interventionId ?? null);
}

export function buildConceptDecisionAuditSummary(args: {
  conceptKey: string;
  decisions: InterventionDecisionSnapshotRow[];
  currentRecommendation?: InterventionRecommendation;
}): InterventionDecisionAuditSummary {
  const conceptDecisions = args.decisions
    .filter((row) => row.concept_key === args.conceptKey)
    .sort((a, b) => compareDecisionRowsDesc(a, b))
    .map((row) => toInterventionDecisionAuditRecord(row));

  const latestDecision = conceptDecisions[0];
  const previousDecision = conceptDecisions[1];
  const latestDecisionChanged = latestDecision !== undefined && previousDecision !== undefined
    ? !isSameDecisionIdentity(latestDecision, previousDecision)
    : false;
  const currentRecommendationChanged = latestDecision !== undefined && args.currentRecommendation !== undefined
    ? !isSameRecommendationIdentity(latestDecision, args.currentRecommendation)
    : false;
  const escalationCount = conceptDecisions.filter((decision) => decision.action === "escalate_intervention").length;
  const recentFingerprints = conceptDecisions.slice(0, 3).map((decision) => fingerprintDecision(decision));
  const uniqueRecentFingerprints = new Set(recentFingerprints);
  const stability = uniqueRecentFingerprints.size <= 1
    ? "stable"
    : uniqueRecentFingerprints.size === recentFingerprints.length && uniqueRecentFingerprints.size > 1
      ? "flipping"
      : "shifting";

  return {
    conceptKey: args.conceptKey,
    latestDecision,
    previousDecision,
    latestDecisionChanged,
    currentRecommendationChanged,
    escalationCount,
    stability,
    lastActedOnDecision: conceptDecisions.find((decision) => decision.actedUpon),
    lastUnactedDecision: conceptDecisions.find((decision) => !decision.actedUpon),
  };
}

export function toInterventionDecisionAuditRecord(row: InterventionDecisionSnapshotRow): InterventionDecisionAuditRecord {
  return {
    id: row.id,
    conceptKey: row.concept_key,
    createdAt: row.created_at,
    action: row.recommended_action,
    recommendedStrategy: row.recommended_strategy,
    confidence: row.confidence,
    priority: row.priority,
    suggestedIntensity: row.suggested_intensity,
    recoveryStage: row.recovery_stage,
    currentInterventionStatus: row.current_intervention_status ?? null,
    reasonCodes: parseJsonArray<InterventionRecommendationReasonCode>(row.reason_codes_json),
    supportingSignals: parseJsonArray<InterventionSupportingSignal>(row.supporting_signals_json),
    evidence: parseJsonArray<string>(row.evidence_json),
    patternTypes: parseJsonArray<string>(row.pattern_types_json),
    recurringLeak: row.recurring_leak_bool === 1,
    transferGap: row.transfer_gap_bool === 1,
    actedUpon: row.acted_upon_bool === 1,
    linkedInterventionId: row.linked_intervention_id ?? null,
    sourceContext: row.source_context ?? null,
    supersedesDecisionId: row.supersedes_decision_id ?? null,
  };
}

function shouldSuppressDecisionSnapshot(
  latest: InterventionDecisionSnapshotRow | undefined,
  recommendation: InterventionRecommendation,
  createdAt: string
): boolean {
  if (!latest) {
    return false;
  }

  const deltaMs = Math.abs(new Date(createdAt).getTime() - new Date(latest.created_at).getTime());
  if (!Number.isFinite(deltaMs) || deltaMs > DECISION_DUPLICATE_WINDOW_MS) {
    return false;
  }

  const latestReasons = parseJsonArray<string>(latest.reason_codes_json);
  return latest.recommended_action === recommendation.action
    && latest.recommended_strategy === recommendation.recommendedStrategy
    && normalizeReasonCodes(latestReasons) === normalizeReasonCodes(recommendation.reasonCodes);
}

function shouldTrackRecommendationSnapshot(
  concept: PlayerIntelligenceSnapshot["concepts"][number],
  recommendation: InterventionRecommendation,
  diagnosisHistory: PlayerDiagnosisHistoryEntry[],
  interventionHistory: InterventionHistoryEntry[]
): boolean {
  if (recommendation.action !== "monitor_only") {
    return true;
  }

  return concept.status === "weakness"
    || concept.trainingUrgency >= 0.35
    || diagnosisHistory.some((entry) => entry.conceptKey === concept.conceptKey)
    || interventionHistory.some((entry) => entry.conceptKey === concept.conceptKey);
}

function latestRecoveryStage(recommendation: InterventionRecommendation): string {
  const recoverySignal = recommendation.supportingSignals.find((signal) => signal.kind === "recovery");
  return recoverySignal?.code ?? "unaddressed";
}

function normalizeReasonCodes(reasonCodes: readonly string[]): string {
  return [...reasonCodes].sort().join("|");
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function compareDecisionRowsDesc(a: InterventionDecisionSnapshotRow, b: InterventionDecisionSnapshotRow): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id);
}

function fingerprintDecision(decision: Pick<InterventionDecisionAuditRecord, "action" | "recommendedStrategy" | "reasonCodes">): string {
  return `${decision.action}:${decision.recommendedStrategy}:${normalizeReasonCodes(decision.reasonCodes)}`;
}

function isSameDecisionIdentity(
  left: Pick<InterventionDecisionAuditRecord, "action" | "recommendedStrategy" | "reasonCodes">,
  right: Pick<InterventionDecisionAuditRecord, "action" | "recommendedStrategy" | "reasonCodes">
): boolean {
  return fingerprintDecision(left) === fingerprintDecision(right);
}

function isSameRecommendationIdentity(
  decision: Pick<InterventionDecisionAuditRecord, "action" | "recommendedStrategy" | "reasonCodes">,
  recommendation: Pick<InterventionRecommendation, "action" | "recommendedStrategy" | "reasonCodes">
): boolean {
  return decision.action === recommendation.action
    && decision.recommendedStrategy === recommendation.recommendedStrategy
    && normalizeReasonCodes(decision.reasonCodes) === normalizeReasonCodes(recommendation.reasonCodes);
}
