export type InterventionLifecycleStatus =
  | "assigned"
  | "in_progress"
  | "stabilizing"
  | "completed"
  | "regressed"
  | "abandoned";

export type ConceptRecoveryStage = "unaddressed" | "active_repair" | "stabilizing" | "recovered" | "regressed";

export type SessionPlanningReason =
  | "active_intervention"
  | "recurring_leak"
  | "regression_recovery"
  | "weakness_balance"
  | "retention_check"
  | "freshness_mix";

export interface MemoryInterventionHistoryEntry {
  id: string;
  conceptKey: string;
  source: string;
  status: InterventionLifecycleStatus;
  createdAt: string;
  improved?: boolean | null;
  preScore?: number | null;
  postScore?: number | null;
  evaluationWindow?: string | null;
  outcomeCreatedAt?: string | null;
}

export interface MemoryDiagnosisHistoryEntry {
  conceptKey: string;
  diagnosticType: string;
  confidence: number;
  createdAt: string;
}

export function deriveConceptRecoveryStage(args: {
  diagnosisHistory: MemoryDiagnosisHistoryEntry[];
  interventionHistory: MemoryInterventionHistoryEntry[];
  worseningTrend?: boolean;
}): ConceptRecoveryStage {
  const diagnoses = [...args.diagnosisHistory].sort(compareDescByCreatedAt);
  const interventions = [...args.interventionHistory].sort(compareInterventionHistory);
  const latestIntervention = interventions[0];
  const latestDiagnosis = diagnoses[0];
  const latestOutcomeAt = latestIntervention?.outcomeCreatedAt ?? latestIntervention?.createdAt;
  const diagnosisAfterLatestOutcome = Boolean(
    latestDiagnosis
      && latestOutcomeAt
      && new Date(latestDiagnosis.createdAt).getTime() > new Date(latestOutcomeAt).getTime()
  );

  if (latestIntervention?.status === "regressed") {
    return "regressed";
  }

  if (latestIntervention?.status === "stabilizing") {
    return args.worseningTrend || diagnosisAfterLatestOutcome ? "regressed" : "stabilizing";
  }

  if (latestIntervention && (latestIntervention.status === "assigned" || latestIntervention.status === "in_progress")) {
    return "active_repair";
  }

  if (latestIntervention?.status === "completed") {
    if (latestIntervention.improved === false || args.worseningTrend || diagnosisAfterLatestOutcome) {
      return "regressed";
    }
    if (latestIntervention.improved === true) {
      return "recovered";
    }
  }

  return diagnoses.length > 0 ? "unaddressed" : "unaddressed";
}

export function buildPlanningReasons(args: {
  recoveryStage: ConceptRecoveryStage;
  recurrenceCount: number;
  reviewPressure: number;
  trainingUrgency: number;
  diagnosisCount: number;
  activeInterventionCount: number;
  preferredFreshness?: boolean;
}): SessionPlanningReason[] {
  const reasons: SessionPlanningReason[] = [];

  if (args.recoveryStage === "active_repair" || args.recoveryStage === "stabilizing" || args.activeInterventionCount > 0) {
    reasons.push("active_intervention");
  }

  if (args.recoveryStage === "regressed") {
    reasons.push("regression_recovery");
  }

  if (args.recurrenceCount >= 2 || args.diagnosisCount >= 2) {
    reasons.push("recurring_leak");
  }

  if (args.recoveryStage === "recovered" && args.reviewPressure > 0) {
    reasons.push("retention_check");
  }

  if (args.trainingUrgency >= 0.35 || reasons.length === 0) {
    reasons.push("weakness_balance");
  }

  if (args.preferredFreshness) {
    reasons.push("freshness_mix");
  }

  return dedupeReasons(reasons);
}

export function scorePlanningReasons(reasons: SessionPlanningReason[]): number {
  return reasons.reduce((sum, reason) => sum + planningReasonWeight(reason), 0);
}

export function planningReasonWeight(reason: SessionPlanningReason): number {
  switch (reason) {
    case "active_intervention":
      return 3.2;
    case "recurring_leak":
      return 2.4;
    case "regression_recovery":
      return 2.1;
    case "weakness_balance":
      return 1.1;
    case "retention_check":
      return 0.7;
    case "freshness_mix":
      return 0.35;
  }
}

export function formatPlanningReason(reason: SessionPlanningReason): string {
  switch (reason) {
    case "active_intervention":
      return "Active intervention";
    case "recurring_leak":
      return "Recurring leak";
    case "regression_recovery":
      return "Regression recovery";
    case "weakness_balance":
      return "Weakness balance";
    case "retention_check":
      return "Retention check";
    case "freshness_mix":
      return "Freshness mix";
  }
}

function dedupeReasons(reasons: SessionPlanningReason[]): SessionPlanningReason[] {
  return [...new Set(reasons)];
}

function compareDescByCreatedAt(a: { createdAt: string }, b: { createdAt: string }): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function compareInterventionHistory(a: MemoryInterventionHistoryEntry, b: MemoryInterventionHistoryEntry): number {
  const outcomeDiff = new Date(b.outcomeCreatedAt ?? b.createdAt).getTime() - new Date(a.outcomeCreatedAt ?? a.createdAt).getTime();
  if (outcomeDiff !== 0) {
    return outcomeDiff;
  }
  return compareDescByCreatedAt(a, b);
}
