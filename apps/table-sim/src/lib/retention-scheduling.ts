import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  deriveRetentionScheduleState,
  recommendRetentionSchedule,
  type PlayerIntelligenceSnapshot,
  type RetentionScheduleLike,
} from "@poker-coach/core/browser";
import {
  completeRetentionSchedule,
  createRetentionSchedule,
  getLatestRetentionSchedule,
  getUserRetentionSchedules,
  supersedeRetentionSchedule,
  updateInterventionStatus,
  updateRetentionScheduleStatus,
  type AttemptRow,
  type CoachingDiagnosisRow,
  type CoachingInterventionWithOutcomeRow,
  type InterventionDecisionSnapshotRow,
  type RetentionScheduleRow,
} from "../../../../packages/db/src/repository";
import { getLocalCoachingUserId } from "./coaching-memory";

const RETENTION_COMPLETION_ATTEMPTS = 2;
const RETENTION_PASS_THRESHOLD = 0.68;

export interface RetentionSummary {
  conceptKey: string;
  latestSchedule?: {
    id: string;
    scheduledFor: string;
    status: RetentionScheduleRow["status"];
    state: ReturnType<typeof deriveRetentionScheduleState>;
    reason: RetentionScheduleRow["reason"];
    result?: "pass" | "fail" | null;
    priority: number;
  };
  dueCount: number;
  overdueCount: number;
  lastResult?: "pass" | "fail" | null;
  validationState: "none" | "provisional" | "validated" | "failed";
}

export function syncRetentionScheduling(args: {
  db: Database.Database;
  playerIntelligence: PlayerIntelligenceSnapshot;
  attempts: AttemptRow[];
  diagnoses: CoachingDiagnosisRow[];
  interventions: CoachingInterventionWithOutcomeRow[];
  decisionSnapshots: InterventionDecisionSnapshotRow[];
  now?: Date;
}): RetentionScheduleRow[] {
  const now = args.now ?? new Date();
  refreshRetentionSchedules({
    db: args.db,
    attempts: args.attempts,
    diagnoses: args.diagnoses,
    now,
  });

  const userId = getLocalCoachingUserId();
  for (const concept of args.playerIntelligence.concepts) {
    const interventionHistory = args.interventions.filter((entry) => entry.concept_key === concept.conceptKey);
    const latestIntervention = [...interventionHistory].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const latestDecision = [...args.decisionSnapshots]
      .filter((entry) => entry.concept_key === concept.conceptKey)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const latestRetention = getLatestRetentionSchedule(args.db, userId, concept.conceptKey);
    const conceptAttempts = args.attempts.filter((attempt) => extractAttemptConceptKeys(attempt).has(concept.conceptKey));
    const latestCompletedRetention = [...getUserRetentionSchedules(args.db, userId)]
      .filter((entry) => entry.concept_key === concept.conceptKey && (entry.status === "completed_pass" || entry.status === "completed_fail"))
      .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime())[0];

    const recommendation = recommendRetentionSchedule({
      conceptKey: concept.conceptKey,
      label: concept.label,
      recoveryStage: concept.recoveryStage,
      interventionStatus: latestIntervention?.status,
      lastInterventionImproved: latestIntervention?.improved === null || latestIntervention?.improved === undefined ? null : latestIntervention.improved === 1,
      recurrenceCount: concept.recurrenceCount,
      regressionCount: args.interventions.filter((entry) => entry.concept_key === concept.conceptKey && entry.status === "regressed").length,
      reviewPressure: concept.reviewPressure,
      reviewAvoidancePattern: args.playerIntelligence.patterns.patterns.some((pattern) => pattern.type === "review_avoidance_pattern" && pattern.implicatedConcepts.includes(concept.conceptKey)),
      lastAttemptAt: conceptAttempts[0]?.ts,
      latestRetentionSchedule: latestRetention ? toCoreRetentionSchedule(latestRetention) : undefined,
      lastRetentionResult: latestCompletedRetention?.result ?? null,
      lastRecoveryAt: latestIntervention?.outcome_created_at ?? latestIntervention?.created_at,
    }, now);

    if (!recommendation.shouldSchedule || !recommendation.scheduledFor) {
      continue;
    }

    const row: RetentionScheduleRow = {
      id: randomUUID(),
      user_id: userId,
      concept_key: concept.conceptKey,
      created_at: now.toISOString(),
      scheduled_for: recommendation.scheduledFor,
      status: "scheduled",
      reason: recommendation.reason,
      linked_intervention_id: latestIntervention?.id ?? null,
      linked_decision_snapshot_id: latestDecision?.id ?? null,
      recovery_stage_at_scheduling: concept.recoveryStage,
      priority: recommendation.priority,
      completed_at: null,
      result: null,
      supersedes_schedule_id: latestRetention && ["scheduled", "due", "overdue"].includes(latestRetention.status) ? latestRetention.id : null,
      superseded_by_schedule_id: null,
      evidence_json: JSON.stringify(recommendation.evidence),
    };

    createRetentionSchedule(args.db, row);
    if (row.supersedes_schedule_id) {
      supersedeRetentionSchedule(args.db, row.supersedes_schedule_id, row.id);
    }
  }

  return getUserRetentionSchedules(args.db, userId);
}

export function refreshRetentionSchedules(args: {
  db: Database.Database;
  attempts: AttemptRow[];
  diagnoses: CoachingDiagnosisRow[];
  now?: Date;
}): RetentionScheduleRow[] {
  const now = args.now ?? new Date();
  const schedules = getUserRetentionSchedules(args.db, getLocalCoachingUserId());

  for (const schedule of schedules) {
    const state = deriveRetentionScheduleState(toCoreRetentionSchedule(schedule), now);

    if (schedule.status !== "completed_pass" && schedule.status !== "completed_fail" && schedule.status !== "canceled" && schedule.status !== "superseded") {
      if (state === "due" && schedule.status !== "due") {
        updateRetentionScheduleStatus(args.db, schedule.id, "due");
      } else if (state === "overdue" && schedule.status !== "overdue") {
        updateRetentionScheduleStatus(args.db, schedule.id, "overdue");
      }
    }

    if ((state === "due" || state === "overdue") && !schedule.completed_at) {
      const completion = evaluateRetentionCompletion(schedule, args.attempts, args.diagnoses);
      if (!completion) {
        continue;
      }

      completeRetentionSchedule(args.db, schedule.id, completion.result, completion.completedAt);
      if (completion.result === "fail" && schedule.linked_intervention_id) {
        updateInterventionStatus(args.db, schedule.linked_intervention_id, "regressed");
      }
    }
  }

  return getUserRetentionSchedules(args.db, getLocalCoachingUserId());
}

export function buildConceptRetentionSummary(
  conceptKey: string,
  schedules: RetentionScheduleRow[],
  now = new Date()
): RetentionSummary {
  const conceptSchedules = schedules
    .filter((entry) => entry.concept_key === conceptKey)
    .sort((a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime() || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = conceptSchedules[0];
  const latestState = latest ? deriveRetentionScheduleState(toCoreRetentionSchedule(latest), now) : undefined;
  const dueCount = conceptSchedules.filter((entry) => deriveRetentionScheduleState(toCoreRetentionSchedule(entry), now) === "due").length;
  const overdueCount = conceptSchedules.filter((entry) => deriveRetentionScheduleState(toCoreRetentionSchedule(entry), now) === "overdue").length;
  const lastCompleted = conceptSchedules.find((entry) => entry.status === "completed_pass" || entry.status === "completed_fail");

  return {
    conceptKey,
    latestSchedule: latest
      ? {
          id: latest.id,
          scheduledFor: latest.scheduled_for,
          status: latest.status,
          state: latestState ?? "upcoming",
          reason: latest.reason,
          result: latest.result ?? null,
          priority: latest.priority,
        }
      : undefined,
    dueCount,
    overdueCount,
    lastResult: lastCompleted?.result ?? null,
    validationState: lastCompleted?.result === "pass"
      ? "validated"
      : lastCompleted?.result === "fail"
        ? "failed"
        : latest && ["scheduled", "due", "overdue"].includes(latest.status)
          ? "provisional"
          : "none",
  };
}

function evaluateRetentionCompletion(
  schedule: RetentionScheduleRow,
  attempts: AttemptRow[],
  diagnoses: CoachingDiagnosisRow[]
): { result: "pass" | "fail"; completedAt: string } | undefined {
  const conceptAttempts = attempts
    .filter((attempt) => extractAttemptConceptKeys(attempt).has(schedule.concept_key))
    .filter((attempt) => new Date(attempt.ts).getTime() >= new Date(schedule.scheduled_for).getTime())
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .slice(0, RETENTION_COMPLETION_ATTEMPTS);

  if (conceptAttempts.length < RETENTION_COMPLETION_ATTEMPTS) {
    return undefined;
  }

  const averageScore = conceptAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / conceptAttempts.length;
  const newDiagnoses = diagnoses.some((diagnosis) =>
    diagnosis.concept_key === schedule.concept_key
    && new Date(diagnosis.created_at).getTime() >= new Date(schedule.scheduled_for).getTime()
  );
  const result = averageScore >= RETENTION_PASS_THRESHOLD && !newDiagnoses ? "pass" : "fail";

  return {
    result,
    completedAt: conceptAttempts[conceptAttempts.length - 1]?.ts ?? schedule.scheduled_for,
  };
}

export function toCoreRetentionSchedule(row: RetentionScheduleRow): RetentionScheduleLike {
  return {
    id: row.id,
    conceptKey: row.concept_key,
    createdAt: row.created_at,
    scheduledFor: row.scheduled_for,
    status: row.status,
    reason: row.reason,
    linkedInterventionId: row.linked_intervention_id ?? null,
    linkedDecisionSnapshotId: row.linked_decision_snapshot_id ?? null,
    recoveryStageAtScheduling: row.recovery_stage_at_scheduling as RetentionScheduleLike["recoveryStageAtScheduling"],
    priority: row.priority,
    completedAt: row.completed_at ?? null,
    result: row.result ?? null,
  };
}

function extractAttemptConceptKeys(row: AttemptRow): Set<string> {
  const conceptKeys = new Set<string>();
  addConceptTags(conceptKeys, safelyParseJsonArray(row.tags_json));

  try {
    const payload = JSON.parse(row.user_answer_json) as {
      selection?: { drill?: { tags?: string[] } };
      diagnostic?: { result?: { conceptKey?: string } };
    };
    addConceptTags(conceptKeys, payload.selection?.drill?.tags ?? []);
    if (payload.diagnostic?.result?.conceptKey) {
      conceptKeys.add(payload.diagnostic.result.conceptKey);
    }
  } catch {
    // Best-effort extraction only.
  }

  return conceptKeys;
}

function addConceptTags(set: Set<string>, tags: string[]): void {
  for (const tag of tags) {
    if (tag.startsWith("concept:")) {
      set.add(tag.slice("concept:".length));
    }
  }
}

function safelyParseJsonArray(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}
