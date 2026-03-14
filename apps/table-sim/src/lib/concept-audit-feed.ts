import type {
  CoachingDiagnosisRow,
  InterventionDecisionSnapshotRow,
  RetentionScheduleRow,
  TransferEvaluationSnapshotRow,
} from "../../../../packages/db/src/repository";
import { toInterventionDecisionAuditRecord } from "./intervention-decision-audit";
import { compareEngineManifests } from "./engine-manifest";
import { toTransferAuditRecord } from "./transfer-audit";

export type ConceptAuditEventType =
  | "diagnosis_recorded"
  | "intervention_assigned"
  | "intervention_continued"
  | "intervention_escalated"
  | "intervention_reopened"
  | "intervention_closed"
  | "intervention_strategy_changed"
  | "intervention_transfer_block_added"
  | "intervention_monitored"
  | "transfer_status_recorded"
  | "retention_scheduled"
  | "retention_due"
  | "retention_overdue"
  | "retention_completed_pass"
  | "retention_completed_fail";

export type ConceptAuditSourceFamily =
  | "diagnosis"
  | "intervention"
  | "transfer"
  | "retention";

export type ConceptAuditSeverity = "info" | "notable" | "important" | "critical";
export type ConceptAuditHistoryState = "no_history" | "diagnosis_only" | "partial_history" | "audit_history";

export interface ConceptAuditEvent {
  id: string;
  timestamp: string;
  eventType: ConceptAuditEventType;
  sourceFamily: ConceptAuditSourceFamily;
  label: string;
  severity: ConceptAuditSeverity;
  metadata: Record<string, unknown>;
}

export interface ConceptAuditFeedResponse {
  conceptKey: string;
  state: ConceptAuditHistoryState;
  eventCount: number;
  familiesPresent: ConceptAuditSourceFamily[];
  events: ConceptAuditEvent[];
}

export function buildConceptAuditFeed(args: {
  conceptKey: string;
  diagnoses?: CoachingDiagnosisRow[];
  decisionSnapshots?: InterventionDecisionSnapshotRow[];
  transferSnapshots?: TransferEvaluationSnapshotRow[];
  retentionSchedules?: RetentionScheduleRow[];
}): ConceptAuditFeedResponse {
  const events = [
    ...mapDiagnosisEvents(args.conceptKey, args.diagnoses ?? []),
    ...mapDecisionEvents(args.conceptKey, args.decisionSnapshots ?? []),
    ...mapTransferEvents(args.conceptKey, args.transferSnapshots ?? []),
    ...mapRetentionEvents(args.conceptKey, args.retentionSchedules ?? []),
  ].sort(compareEventsDesc);

  const familiesPresent = [...new Set(events.map((event) => event.sourceFamily))].sort() as ConceptAuditSourceFamily[];

  return {
    conceptKey: args.conceptKey,
    state: deriveHistoryState(familiesPresent),
    eventCount: events.length,
    familiesPresent,
    events,
  };
}

function mapDiagnosisEvents(conceptKey: string, diagnoses: CoachingDiagnosisRow[]): ConceptAuditEvent[] {
  return diagnoses
    .filter((row) => row.concept_key === conceptKey)
    .map((row) => ({
      id: `diagnosis:${row.id}`,
      timestamp: row.created_at,
      eventType: "diagnosis_recorded",
      sourceFamily: "diagnosis",
      label: `Diagnosis recorded: ${row.diagnostic_type.replace(/_/g, " ")}`,
      severity: "notable",
      metadata: {
        diagnosisId: row.id,
        diagnosticType: row.diagnostic_type,
        confidence: row.confidence,
      },
    }));
}

function mapDecisionEvents(conceptKey: string, decisions: InterventionDecisionSnapshotRow[]): ConceptAuditEvent[] {
  const conceptDecisions = decisions
    .filter((row) => row.concept_key === conceptKey)
    .sort(compareSnapshotRowsDesc)
    .map((row) => toInterventionDecisionAuditRecord(row));

  return conceptDecisions.map((decision, index) => {
    const previous = conceptDecisions[index + 1];
    const actionEventType = toDecisionEventType(decision.action);
    const manifestDrift = compareEngineManifests(decision.engineManifest, previous?.engineManifest);
    const changedFromPrior = previous
      ? decision.action !== previous.action
        || decision.recommendedStrategy !== previous.recommendedStrategy
        || JSON.stringify([...decision.reasonCodes].sort()) !== JSON.stringify([...previous.reasonCodes].sort())
      : false;

    return {
      id: `decision:${decision.id}`,
      timestamp: decision.createdAt,
      eventType: actionEventType,
      sourceFamily: "intervention",
      label: buildDecisionLabel(decision.action, changedFromPrior),
      severity: decision.action === "escalate_intervention" || decision.action === "reopen_intervention"
        ? "important"
        : decision.action === "close_intervention_loop"
          ? "notable"
          : "info",
      metadata: {
        decisionId: decision.id,
        action: decision.action,
        recommendedStrategy: decision.recommendedStrategy,
        confidence: decision.confidence,
        priority: decision.priority,
        actedUpon: decision.actedUpon,
        linkedInterventionId: decision.linkedInterventionId ?? null,
        replaySignificance: previous
          ? changedFromPrior
            ? "output_changed"
            : "output_stable"
          : "first_recorded",
        manifestDrift,
      },
    } satisfies ConceptAuditEvent;
  });
}

function mapTransferEvents(conceptKey: string, snapshots: TransferEvaluationSnapshotRow[]): ConceptAuditEvent[] {
  const conceptSnapshots = snapshots
    .filter((row) => row.concept_key === conceptKey)
    .sort(compareSnapshotRowsDesc)
    .map((row) => toTransferAuditRecord(row));

  return conceptSnapshots.map((snapshot, index) => {
    const previous = conceptSnapshots[index + 1];
    const manifestDrift = compareEngineManifests(snapshot.engineManifest, previous?.engineManifest);
    const changedFromPrior = previous
      ? snapshot.status !== previous.status
        || JSON.stringify([...snapshot.riskFlags].sort()) !== JSON.stringify([...previous.riskFlags].sort())
      : false;

    return {
      id: `transfer:${snapshot.id}`,
      timestamp: snapshot.createdAt,
      eventType: "transfer_status_recorded",
      sourceFamily: "transfer",
      label: changedFromPrior
        ? `Transfer status changed to ${snapshot.status.replace(/_/g, " ")}`
        : `Transfer status recorded: ${snapshot.status.replace(/_/g, " ")}`,
      severity: snapshot.status === "transfer_regressed" || snapshot.status === "transfer_gap"
        ? "important"
        : snapshot.status === "transfer_validated"
          ? "notable"
          : "info",
      metadata: {
        transferSnapshotId: snapshot.id,
        status: snapshot.status,
        confidence: snapshot.confidence,
        evidenceSufficiency: snapshot.evidenceSufficiency,
        replaySignificance: previous
          ? changedFromPrior
            ? "output_changed"
            : "output_stable"
          : "first_recorded",
        manifestDrift,
      },
    } satisfies ConceptAuditEvent;
  });
}

function mapRetentionEvents(conceptKey: string, schedules: RetentionScheduleRow[]): ConceptAuditEvent[] {
  const conceptSchedules = schedules
    .filter((row) => row.concept_key === conceptKey)
    .sort(compareRetentionRowsDesc);
  const events: ConceptAuditEvent[] = [];

  for (const schedule of conceptSchedules) {
    events.push({
      id: `retention-created:${schedule.id}`,
      timestamp: schedule.created_at,
      eventType: "retention_scheduled",
      sourceFamily: "retention",
      label: `Retention scheduled: ${schedule.reason.replace(/_/g, " ")}`,
      severity: "info",
      metadata: {
        scheduleId: schedule.id,
        status: schedule.status,
        reason: schedule.reason,
        scheduledFor: schedule.scheduled_for,
        linkedDecisionSnapshotId: schedule.linked_decision_snapshot_id ?? null,
        linkedInterventionId: schedule.linked_intervention_id ?? null,
      },
    });

    if (["due", "overdue", "completed_pass", "completed_fail"].includes(schedule.status)) {
      events.push({
        id: `retention-due:${schedule.id}`,
        timestamp: schedule.scheduled_for,
        eventType: schedule.status === "overdue" ? "retention_overdue" : "retention_due",
        sourceFamily: "retention",
        label: schedule.status === "overdue"
          ? "Retention check became overdue"
          : "Retention check became due",
        severity: schedule.status === "overdue" ? "important" : "notable",
        metadata: {
          scheduleId: schedule.id,
          scheduledFor: schedule.scheduled_for,
          status: schedule.status,
        },
      });
    }

    if ((schedule.status === "completed_pass" || schedule.status === "completed_fail") && schedule.completed_at) {
      events.push({
        id: `retention-completed:${schedule.id}`,
        timestamp: schedule.completed_at,
        eventType: schedule.status === "completed_pass" ? "retention_completed_pass" : "retention_completed_fail",
        sourceFamily: "retention",
        label: schedule.status === "completed_pass"
          ? "Retention check passed"
          : "Retention check failed",
        severity: schedule.status === "completed_pass" ? "notable" : "important",
        metadata: {
          scheduleId: schedule.id,
          completedAt: schedule.completed_at,
          result: schedule.result ?? null,
        },
      });
    }
  }

  return events;
}

function deriveHistoryState(familiesPresent: ConceptAuditSourceFamily[]): ConceptAuditHistoryState {
  if (familiesPresent.length === 0) {
    return "no_history";
  }
  if (familiesPresent.length === 1 && familiesPresent[0] === "diagnosis") {
    return "diagnosis_only";
  }
  if (!familiesPresent.includes("intervention") || !familiesPresent.includes("transfer") || !familiesPresent.includes("retention")) {
    return "partial_history";
  }
  return "audit_history";
}

function toDecisionEventType(action: string): ConceptAuditEventType {
  switch (action) {
    case "assign_intervention":
      return "intervention_assigned";
    case "continue_intervention":
      return "intervention_continued";
    case "escalate_intervention":
      return "intervention_escalated";
    case "reopen_intervention":
      return "intervention_reopened";
    case "close_intervention_loop":
      return "intervention_closed";
    case "change_intervention_strategy":
      return "intervention_strategy_changed";
    case "add_transfer_block":
      return "intervention_transfer_block_added";
    default:
      return "intervention_monitored";
  }
}

function buildDecisionLabel(action: string, changedFromPrior: boolean): string {
  const actionLabel = action.replace(/_/g, " ");
  return changedFromPrior
    ? `Intervention decision changed: ${actionLabel}`
    : `Intervention decision recorded: ${actionLabel}`;
}

function compareSnapshotRowsDesc(a: { created_at: string }, b: { created_at: string }): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function compareRetentionRowsDesc(a: RetentionScheduleRow, b: RetentionScheduleRow): number {
  return new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function compareEventsDesc(a: ConceptAuditEvent, b: ConceptAuditEvent): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() || b.id.localeCompare(a.id);
}
