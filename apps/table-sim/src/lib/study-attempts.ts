import type { AttemptRow } from "../../../../packages/db/src/repository";
import type { TableSimAnswer, TableSimDrill } from "./drill-schema";
import type { TableSimActivePool, TableSimSelectedDrill } from "./session-plan";
import type { DecisionConfidence, DrillAttempt, DrillAttemptDiagnostic } from "./session-types";

export interface StoredAttemptPayload {
  selection: TableSimSelectedDrill;
  resolvedAnswer: TableSimAnswer;
  userSizeBucket: number | null;
  matchedTags: string[];
  actionScore: number;
  sizingScore: number;
  tagScore: number;
  diagnostic?: DrillAttemptDiagnostic | null;
}

export interface PersistedAttemptRecord {
  attemptId: string;
  sessionId: string | null;
  drillId: string;
  selectedAction: string;
  correctness: boolean;
  confidence: DecisionConfidence;
  tags: string[];
  reflection: string;
  timestamp: string;
  score: number;
  elapsedMs: number;
  missedTags: string[];
  activePool: TableSimActivePool;
  payload: StoredAttemptPayload;
}

export interface ReviewQueueEntry {
  attemptId: string;
  drillId: string;
  title: string;
  nodeId: string;
  score: number;
  correct: boolean;
  confidence: DecisionConfidence;
  timestamp: string;
  reviewTag: string | null;
  conceptTags: string[];
}

export interface ConceptMistakeEntry {
  conceptKey: string;
  label: string;
  mistakeCount: number;
  latestAttemptId: string;
  latestTimestamp: string;
}

export interface UnresolvedConceptEntry {
  conceptKey: string;
  label: string;
  summary: string;
  recommendedPool: TableSimActivePool;
}

export interface PersistentReviewSnapshot {
  generatedAt: string;
  attempts: DrillAttempt[];
  reviewQueue: ReviewQueueEntry[];
  recentMistakes: ReviewQueueEntry[];
  conceptMistakes: ConceptMistakeEntry[];
  unresolvedConcepts: UnresolvedConceptEntry[];
}

interface ParsedUserAnswerPayload {
  selection?: TableSimSelectedDrill;
  resolvedAnswer?: TableSimAnswer;
  userSizeBucket?: number | null;
  matchedTags?: string[];
  actionScore?: number;
  sizingScore?: number;
  tagScore?: number;
  diagnostic?: DrillAttemptDiagnostic | null;
}

export function toPersistedAttemptRecord(attempt: DrillAttempt, sessionId: string): PersistedAttemptRecord {
  return {
    attemptId: attempt.attemptId,
    sessionId,
    drillId: attempt.drill.drill_id,
    selectedAction: attempt.userAction,
    correctness: attempt.correct,
    confidence: attempt.confidence,
    tags: attempt.userTags,
    reflection: attempt.reflection,
    timestamp: attempt.timestamp,
    score: attempt.score,
    elapsedMs: attempt.elapsedMs,
    missedTags: attempt.missedTags,
    activePool: attempt.activePool,
    payload: {
      selection: attempt.selection,
      resolvedAnswer: attempt.resolvedAnswer,
      userSizeBucket: attempt.userSizeBucket,
      matchedTags: attempt.matchedTags,
      actionScore: attempt.actionScore,
      sizingScore: attempt.sizingScore,
      tagScore: attempt.tagScore,
      diagnostic: attempt.diagnostic,
    },
  };
}

export function toAttemptInsertRow(record: PersistedAttemptRecord): AttemptRow {
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

export function hydrateDrillAttempt(row: AttemptRow, drill: TableSimDrill): DrillAttempt {
  const payload = parsePayload(row.user_answer_json);
  const selection = payload.selection ?? {
    drill,
    kind: "review",
    reason: "due_review",
    matchedWeaknessTargets: [],
    metadata: { priorAttempts: 0 },
  };
  const resolvedAnswer = payload.resolvedAnswer ?? drill.answer;
  const confidence = normalizeConfidence(row.confidence) ?? "pretty_sure";

  return {
    attemptId: row.attempt_id,
    timestamp: row.ts,
    reflection: row.reflection ?? "",
    diagnostic: payload.diagnostic ?? null,
    drill,
    selection,
    activePool: normalizePool(row.active_pool),
    resolvedAnswer,
    userAction: row.selected_action ?? resolvedAnswer.correct,
    userSizeBucket: payload.userSizeBucket ?? null,
    userTags: parseStringArray(row.tags_json),
    confidence,
    score: row.score,
    actionScore: payload.actionScore ?? row.score,
    sizingScore: payload.sizingScore ?? 1,
    tagScore: payload.tagScore ?? row.score,
    correct: row.correct_bool === 1,
    missedTags: parseStringArray(row.missed_tags_json),
    matchedTags: payload.matchedTags ?? [],
    elapsedMs: row.elapsed_ms,
  };
}

function parsePayload(raw: string): ParsedUserAnswerPayload {
  try {
    const parsed = JSON.parse(raw) as ParsedUserAnswerPayload;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseStringArray(raw?: string): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function normalizeConfidence(value?: string | null): DecisionConfidence | null {
  return value === "not_sure" || value === "pretty_sure" || value === "certain" ? value : null;
}

function normalizePool(value: AttemptRow["active_pool"]): TableSimActivePool {
  return value === "A" || value === "B" || value === "C" || value === "baseline" ? value : "baseline";
}

