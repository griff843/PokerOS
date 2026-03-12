import type { ConceptRecoveryStage, InterventionLifecycleStatus, SessionPlanningReason } from "./coaching-memory";

export type RetentionScheduleStatus =
  | "scheduled"
  | "due"
  | "overdue"
  | "completed_pass"
  | "completed_fail"
  | "canceled"
  | "superseded";

export type RetentionScheduleState =
  | "upcoming"
  | "due"
  | "overdue"
  | "completed_pass"
  | "completed_fail"
  | "canceled"
  | "superseded";

export type RetentionScheduleReason =
  | "stabilizing_followup"
  | "recovered_validation"
  | "recurrence_guard"
  | "regression_watch"
  | "failed_retention_recheck";

export type RetentionScheduleUrgency = "low" | "medium" | "high";

export interface RetentionScheduleLike {
  id?: string;
  conceptKey: string;
  createdAt: string;
  scheduledFor: string;
  status: RetentionScheduleStatus;
  reason: RetentionScheduleReason;
  linkedInterventionId?: string | null;
  linkedDecisionSnapshotId?: string | null;
  recoveryStageAtScheduling: ConceptRecoveryStage;
  priority: number;
  completedAt?: string | null;
  result?: "pass" | "fail" | null;
}

export interface RetentionScheduleInput {
  conceptKey: string;
  label: string;
  recoveryStage: ConceptRecoveryStage;
  interventionStatus?: InterventionLifecycleStatus;
  lastInterventionImproved?: boolean | null;
  recurrenceCount: number;
  regressionCount: number;
  reviewPressure: number;
  reviewAvoidancePattern: boolean;
  lastAttemptAt?: string;
  latestRetentionSchedule?: RetentionScheduleLike;
  lastRetentionResult?: "pass" | "fail" | null;
  lastRecoveryAt?: string;
}

export interface RetentionScheduleRecommendation {
  eligible: boolean;
  shouldSchedule: boolean;
  scheduledFor?: string;
  priority: number;
  urgency: RetentionScheduleUrgency;
  planningReasons: SessionPlanningReason[];
  reason: RetentionScheduleReason;
  evidence: string[];
  duplicateSuppressed: boolean;
}

const DUE_WINDOW_MS = 24 * 60 * 60 * 1000;
const OVERDUE_WINDOW_MS = 48 * 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function deriveRetentionScheduleState(
  schedule: Pick<RetentionScheduleLike, "scheduledFor" | "status">
    & Partial<Pick<RetentionScheduleLike, "completedAt" | "result">>,
  now = new Date()
): RetentionScheduleState {
  if (schedule.status === "completed_pass" || schedule.result === "pass") {
    return "completed_pass";
  }
  if (schedule.status === "completed_fail" || schedule.result === "fail") {
    return "completed_fail";
  }
  if (schedule.status === "canceled") {
    return "canceled";
  }
  if (schedule.status === "superseded") {
    return "superseded";
  }

  const scheduledAt = new Date(schedule.scheduledFor).getTime();
  const nowMs = now.getTime();

  if (scheduledAt > nowMs) {
    return "upcoming";
  }
  if (scheduledAt + OVERDUE_WINDOW_MS < nowMs) {
    return "overdue";
  }
  return "due";
}

export function recommendRetentionSchedule(
  input: RetentionScheduleInput,
  now = new Date()
): RetentionScheduleRecommendation {
  const evidence: string[] = [];
  const activeState = input.latestRetentionSchedule
    ? deriveRetentionScheduleState(input.latestRetentionSchedule, now)
    : undefined;
  const eligible = input.recoveryStage === "stabilizing" || input.recoveryStage === "recovered";
  const reason = chooseReason(input);

  if (!eligible) {
    return {
      eligible: false,
      shouldSchedule: false,
      priority: 0,
      urgency: "low",
      planningReasons: [],
      reason,
      evidence: [`${input.label} is currently ${input.recoveryStage.replace(/_/g, " ")}, so retention scheduling is not appropriate yet.`],
      duplicateSuppressed: false,
    };
  }

  let daysUntilCheck = input.recoveryStage === "stabilizing" ? 3 : 7;
  if (input.recurrenceCount >= 3) {
    daysUntilCheck -= 2;
    evidence.push("Recurring leak pressure shortened the retention window.");
  }
  if (input.regressionCount > 0) {
    daysUntilCheck -= 2;
    evidence.push("Prior regression history shortened the retention window.");
  }
  if (input.reviewAvoidancePattern || input.reviewPressure > 0) {
    daysUntilCheck -= 1;
    evidence.push("Open review pressure kept the retention check closer.");
  }
  if (input.lastRetentionResult === "fail") {
    daysUntilCheck = Math.min(daysUntilCheck, 2);
    evidence.push("A failed retention check triggered a shorter re-check window.");
  }

  daysUntilCheck = clampInteger(daysUntilCheck, 1, 14);
  const scheduledFor = new Date(now.getTime() + daysUntilCheck * DUE_WINDOW_MS).toISOString();
  const priority = computeRetentionPriority(input, activeState);
  const urgency = priority >= 80 ? "high" : priority >= 60 ? "medium" : "low";

  if (input.latestRetentionSchedule && !isMaterialRetentionChange(input.latestRetentionSchedule, reason, scheduledFor, input.recoveryStage)) {
    return {
      eligible: true,
      shouldSchedule: false,
      scheduledFor: input.latestRetentionSchedule.scheduledFor,
      priority,
      urgency,
      planningReasons: activeState === "due" || activeState === "overdue" ? ["retention_check"] : [],
      reason,
      evidence: [...evidence, "A materially equivalent retention schedule is already active."],
      duplicateSuppressed: true,
    };
  }

  evidence.unshift(
    input.recoveryStage === "stabilizing"
      ? `${input.label} is in a stabilizing window and needs a nearer follow-up check.`
      : `${input.label} looks recovered and now needs an explicit validation check.`
  );

  return {
    eligible: true,
    shouldSchedule: true,
    scheduledFor,
    priority,
    urgency,
    planningReasons: priority >= 70 ? ["retention_check"] : [],
    reason,
    evidence,
    duplicateSuppressed: false,
  };
}

export function computeRetentionPlanningBoost(args: {
  recoveryStage: ConceptRecoveryStage;
  recurrenceCount: number;
  regressionCount: number;
  latestRetentionSchedule?: RetentionScheduleLike;
  now?: Date;
}): { shouldPrioritize: boolean; pressure: number; reasons: SessionPlanningReason[]; state?: RetentionScheduleState } {
  const state = args.latestRetentionSchedule ? deriveRetentionScheduleState(args.latestRetentionSchedule, args.now) : undefined;
  let pressure = 0;

  if (state === "overdue") {
    pressure = 0.92;
  } else if (state === "due") {
    pressure = 0.76;
  } else if (state === "upcoming" && args.recoveryStage === "stabilizing") {
    pressure = 0.34;
  }

  pressure += Math.min(args.recurrenceCount, 3) * 0.04;
  pressure += Math.min(args.regressionCount, 2) * 0.06;
  pressure = Math.min(1, pressure);

  return {
    shouldPrioritize: pressure >= 0.5,
    pressure,
    reasons: pressure >= 0.5 ? ["retention_check"] : [],
    state,
  };
}

function computeRetentionPriority(
  input: RetentionScheduleInput,
  activeState?: RetentionScheduleState
): number {
  let priority = input.recoveryStage === "stabilizing" ? 72 : 58;
  priority += Math.min(input.recurrenceCount, 3) * 4;
  priority += Math.min(input.regressionCount, 2) * 7;
  priority += Math.min(input.reviewPressure, 3) * 3;
  if (input.reviewAvoidancePattern) {
    priority += 4;
  }
  if (input.lastRetentionResult === "fail") {
    priority += 10;
  }
  if (activeState === "due") {
    priority += 10;
  }
  if (activeState === "overdue") {
    priority += 18;
  }
  return clampInteger(priority, 0, 100);
}

function chooseReason(input: RetentionScheduleInput): RetentionScheduleReason {
  if (input.lastRetentionResult === "fail") {
    return "failed_retention_recheck";
  }
  if (input.regressionCount > 0) {
    return "regression_watch";
  }
  if (input.recurrenceCount >= 3) {
    return "recurrence_guard";
  }
  if (input.recoveryStage === "stabilizing") {
    return "stabilizing_followup";
  }
  return "recovered_validation";
}

function isMaterialRetentionChange(
  latest: RetentionScheduleLike,
  reason: RetentionScheduleReason,
  scheduledFor: string,
  recoveryStage: ConceptRecoveryStage
): boolean {
  if (!["scheduled", "due", "overdue"].includes(latest.status)) {
    return true;
  }
  const timeDiff = Math.abs(new Date(scheduledFor).getTime() - new Date(latest.scheduledFor).getTime());
  if (latest.reason !== reason) {
    return true;
  }
  if (latest.recoveryStageAtScheduling !== recoveryStage) {
    return true;
  }
  return timeDiff > DUPLICATE_WINDOW_MS;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
