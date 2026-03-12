import { randomUUID } from "node:crypto";
import type {
  AttemptRow,
  CoachingDiagnosisRow,
  CoachingInterventionSource,
  CoachingInterventionWithOutcomeRow,
  InterventionOutcomeRow,
} from "../../../../packages/db/src/repository";
import {
  completeIntervention,
  createDiagnosis,
  createIntervention,
  createReflection,
  deleteDiagnosisByAttempt,
  deleteReflectionByAttempt,
  getInterventionOutcome,
  getUserInterventions,
  recordInterventionOutcome,
  startIntervention,
  updateInterventionStatus,
  type CoachingInterventionRow,
} from "../../../../packages/db/src/repository";
import type Database from "better-sqlite3";
import type {
  DiagnosticInsight,
  InterventionHistoryEntry,
  PlayerDiagnosisHistoryEntry,
} from "@poker-coach/core/browser";
import type { PersistedAttemptRecord, StoredAttemptPayload } from "./study-attempts";

const LOCAL_USER_ID = "local_user";
const OUTCOME_WINDOW_ATTEMPTS = 3;
const IMPROVEMENT_THRESHOLD = 0.05;
const STABILIZATION_TOLERANCE = 0.03;

interface ParsedAttemptPayload {
  selection?: {
    drill?: {
      tags?: string[];
    };
  };
  diagnostic?: StoredAttemptPayload["diagnostic"] & {
    result?: {
      conceptKey?: string;
      errorType?: string | null;
      confidenceMiscalibration?: boolean;
    };
  };
}

export function getLocalCoachingUserId(): string {
  return LOCAL_USER_ID;
}

export function syncCoachingMemoryForPersistedAttempt(db: Database.Database, record: PersistedAttemptRecord): void {
  syncDiagnosisRow(db, toAttemptRow(record));
  syncReflectionRow(db, toAttemptRow(record));
  evaluateInterventionOutcomes(db, getAllAttemptsForEvaluation(db));
}

export function syncCoachingMemoryForAttemptRow(db: Database.Database, row: AttemptRow): void {
  syncDiagnosisRow(db, row);
  syncReflectionRow(db, row);
  evaluateInterventionOutcomes(db, getAllAttemptsForEvaluation(db));
}

export function ensureInterventionForPlan(args: {
  db: Database.Database;
  conceptKey: string;
  source: CoachingInterventionSource;
  createdAt?: string;
}): CoachingInterventionRow {
  return createIntervention(args.db, {
    id: randomUUID(),
    user_id: LOCAL_USER_ID,
    concept_key: args.conceptKey,
    source: args.source,
    created_at: args.createdAt ?? new Date().toISOString(),
    status: "assigned",
  });
}

export function markInterventionStarted(db: Database.Database, interventionId: string): void {
  startIntervention(db, interventionId);
}

export function toDiagnosisHistoryEntries(rows: CoachingDiagnosisRow[]): PlayerDiagnosisHistoryEntry[] {
  return rows.map((row) => ({
    conceptKey: row.concept_key,
    diagnosticType: row.diagnostic_type,
    confidence: row.confidence,
    createdAt: row.created_at,
  }));
}

export function toInterventionHistoryEntries(rows: CoachingInterventionWithOutcomeRow[]): InterventionHistoryEntry[] {
  return rows.map((row) => ({
    id: row.id,
    conceptKey: row.concept_key,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    improved: row.improved === null || row.improved === undefined ? null : row.improved === 1,
    preScore: row.pre_score ?? null,
    postScore: row.post_score ?? null,
    evaluationWindow: row.evaluation_window ?? null,
    outcomeCreatedAt: row.outcome_created_at ?? null,
  }));
}

export function buildAttemptDiagnosticInsight(payload: StoredAttemptPayload["diagnostic"] | null | undefined): DiagnosticInsight | null {
  const result = payload?.result;
  if (!result?.conceptKey || !result.errorType) {
    return result?.confidenceMiscalibration && result?.conceptKey
      ? {
          conceptKey: result.conceptKey,
          errorType: "confidence_miscalibration",
          confidenceMiscalibration: true,
        }
      : null;
  }

  return {
    conceptKey: result.conceptKey,
    errorType: normalizeDiagnosticType(result.errorType),
    confidenceMiscalibration: Boolean(result.confidenceMiscalibration),
  };
}

function syncDiagnosisRow(db: Database.Database, row: AttemptRow): void {
  const payload = parseAttemptPayload(row.user_answer_json);
  const result = payload.diagnostic?.result;
  if (!result?.conceptKey || !result.errorType) {
    deleteDiagnosisByAttempt(db, row.attempt_id);
    return;
  }

  createDiagnosis(db, {
    id: `diag:${row.attempt_id}`,
    user_id: LOCAL_USER_ID,
    attempt_id: row.attempt_id,
    concept_key: result.conceptKey,
    diagnostic_type: normalizeDiagnosticType(result.errorType),
    confidence: normalizeConfidenceScore(row.confidence),
    created_at: row.ts,
  });
}

function syncReflectionRow(db: Database.Database, row: AttemptRow): void {
  const reflection = row.reflection?.trim() ?? "";
  if (!reflection) {
    deleteReflectionByAttempt(db, row.attempt_id);
    return;
  }

  createReflection(db, {
    id: `reflection:${row.attempt_id}`,
    user_id: LOCAL_USER_ID,
    attempt_id: row.attempt_id,
    reflection_text: reflection,
    confidence_level: row.confidence ?? null,
    created_at: row.ts,
  });
}

function evaluateInterventionOutcomes(db: Database.Database, attempts: AttemptRow[]): void {
  const interventions = getUserInterventions(db, LOCAL_USER_ID).filter((entry) => entry.status !== "completed" && entry.status !== "abandoned");

  for (const intervention of interventions) {
    const conceptAttempts = attempts
      .filter((attempt) => extractAttemptConceptKeys(attempt).has(intervention.concept_key))
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const existingOutcome = getInterventionOutcome(db, intervention.id);
    if (!existingOutcome) {
      evaluateInitialOutcome(db, intervention, conceptAttempts);
      continue;
    }

    if (intervention.status === "stabilizing") {
      evaluateStabilizationWindow(db, intervention, existingOutcome, conceptAttempts);
    }
  }
}

function evaluateInitialOutcome(
  db: Database.Database,
  intervention: CoachingInterventionWithOutcomeRow,
  conceptAttempts: AttemptRow[]
): void {
  const preWindow = conceptAttempts
    .filter((attempt) => new Date(attempt.ts).getTime() < new Date(intervention.created_at).getTime())
    .slice(-OUTCOME_WINDOW_ATTEMPTS);
  const postWindow = conceptAttempts
    .filter((attempt) => new Date(attempt.ts).getTime() >= new Date(intervention.created_at).getTime())
    .slice(0, OUTCOME_WINDOW_ATTEMPTS);

  if (postWindow.length < OUTCOME_WINDOW_ATTEMPTS || preWindow.length === 0) {
    return;
  }

  const preScore = average(preWindow.map((attempt) => attempt.score));
  const postScore = average(postWindow.map((attempt) => attempt.score));
  const improved = postScore >= preScore + IMPROVEMENT_THRESHOLD;

  const outcome: InterventionOutcomeRow = {
    id: randomUUID(),
    intervention_id: intervention.id,
    evaluation_window: `${OUTCOME_WINDOW_ATTEMPTS}_attempts`,
    pre_score: round(preScore),
    post_score: round(postScore),
    improved: improved ? 1 : 0,
    created_at: postWindow[postWindow.length - 1]?.ts ?? new Date().toISOString(),
  };

  recordInterventionOutcome(db, outcome);
  updateInterventionStatus(db, intervention.id, improved ? "stabilizing" : "regressed");
}

function evaluateStabilizationWindow(
  db: Database.Database,
  intervention: CoachingInterventionWithOutcomeRow,
  outcome: InterventionOutcomeRow,
  conceptAttempts: AttemptRow[]
): void {
  const followupWindow = conceptAttempts
    .filter((attempt) => new Date(attempt.ts).getTime() > new Date(outcome.created_at).getTime())
    .slice(0, OUTCOME_WINDOW_ATTEMPTS);

  if (followupWindow.length < OUTCOME_WINDOW_ATTEMPTS) {
    return;
  }

  const followupAverage = average(followupWindow.map((attempt) => attempt.score));
  const heldRecovery = followupAverage >= Math.max(outcome.post_score - STABILIZATION_TOLERANCE, outcome.pre_score + IMPROVEMENT_THRESHOLD / 2);

  if (heldRecovery) {
    completeIntervention(db, intervention.id);
    return;
  }

  updateInterventionStatus(db, intervention.id, "regressed");
}

function getAllAttemptsForEvaluation(db: Database.Database): AttemptRow[] {
  return db.prepare("SELECT * FROM attempts ORDER BY ts DESC").all() as AttemptRow[];
}

function parseAttemptPayload(raw: string): ParsedAttemptPayload {
  try {
    const parsed = JSON.parse(raw) as ParsedAttemptPayload;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function extractAttemptConceptKeys(row: AttemptRow): Set<string> {
  const payload = parseAttemptPayload(row.user_answer_json);
  const conceptKeys = new Set<string>();

  for (const tag of payload.selection?.drill?.tags ?? []) {
    if (tag.startsWith("concept:")) {
      conceptKeys.add(tag.slice("concept:".length));
    }
  }

  const diagnosticConceptKey = payload.diagnostic?.result?.conceptKey;
  if (diagnosticConceptKey) {
    conceptKeys.add(diagnosticConceptKey);
  }

  return conceptKeys;
}

function normalizeDiagnosticType(value: string): "threshold_error" | "range_construction_error" | "blocker_blindness" | "line_misunderstanding" | "pool_assumption_error" | "confidence_miscalibration" {
  return value === "threshold_error" || value === "range_construction_error" || value === "blocker_blindness" || value === "line_misunderstanding" || value === "pool_assumption_error" || value === "confidence_miscalibration"
    ? value
    : "confidence_miscalibration";
}

function normalizeConfidenceScore(value?: string | null): number {
  if (value === "certain") {
    return 1;
  }
  if (value === "pretty_sure") {
    return 0.66;
  }
  if (value === "not_sure") {
    return 0.33;
  }
  return 0.5;
}

function toAttemptRow(record: PersistedAttemptRecord): AttemptRow {
  return {
    attempt_id: record.attemptId,
    drill_id: record.drillId,
    session_id: record.sessionId,
    ts: record.timestamp,
    selected_action: record.selectedAction,
    confidence: record.confidence,
    tags_json: JSON.stringify(record.tags),
    reflection: record.reflection,
    user_answer_json: JSON.stringify(record.payload),
    correct_bool: record.correctness ? 1 : 0,
    score: record.score,
    elapsed_ms: record.elapsedMs,
    missed_tags_json: JSON.stringify(record.missedTags),
    active_pool: record.activePool,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
