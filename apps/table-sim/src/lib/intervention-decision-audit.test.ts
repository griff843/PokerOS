import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../../packages/db/src";
import { createIntervention } from "../../../../packages/db/src/repository";
import type { InterventionRecommendation } from "@poker-coach/core/browser";
import type { InterventionDecisionSnapshotRow } from "../../../../packages/db/src/repository";
import {
  buildConceptDecisionAuditSummary,
  linkInterventionDecisionToIntervention,
  persistInterventionDecisionSnapshot,
} from "./intervention-decision-audit";

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-coach-decision-audit-"));
  tempDirs.push(dir);
  return path.join(dir, "coach.db");
}

function makeRecommendation(overrides: Partial<InterventionRecommendation> = {}): InterventionRecommendation {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    action: "assign_intervention",
    recommendedStrategy: "threshold_repair",
    reasonCodes: ["new_diagnosis_without_intervention", "threshold_pattern"],
    confidence: "high",
    priority: 90,
    evidence: ["Repeated threshold misses are still clustered here."],
    summary: "Assign a threshold repair block for River Bluff Catching.",
    decisionReason: "River Bluff Catching keeps showing threshold misses without an active intervention.",
    supportingSignals: [
      { kind: "recovery", code: "active_repair", detail: "Recovery stage is active repair." },
      { kind: "diagnosis", code: "diagnosis_count", detail: "2 stored diagnosis entries are attached to this concept." },
    ],
    whyNotOtherActions: ["There is no active intervention to continue yet."],
    suggestedIntensity: "high",
    metadata: {
      currentInterventionId: undefined,
      currentInterventionStatus: undefined,
      patternTypes: ["persistent_threshold_leak"],
      requiresNewAssignment: true,
      requiresStrategyChange: false,
      transferFocus: false,
    },
    ...overrides,
  };
}

describe("intervention decision audit", () => {
  it("persists a first decision snapshot", () => {
    const db = openDatabase(createTempDbPath());

    const result = persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation(),
      createdAt: "2026-03-12T12:00:00.000Z",
      sourceContext: "intervention_plan_api",
    });

    db.close();

    expect(result.suppressed).toBe(false);
    expect(result.record.action).toBe("assign_intervention");
    expect(result.record.reasonCodes).toContain("threshold_pattern");
    expect(result.record.sourceContext).toBe("intervention_plan_api");
    expect(result.record.engineManifest.engineVersion).toBe("1.0.0");
  });

  it("suppresses identical near-duplicate decisions inside the anti-noise window", () => {
    const db = openDatabase(createTempDbPath());

    const first = persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation(),
      createdAt: "2026-03-12T12:00:00.000Z",
      sourceContext: "session_plan",
    });
    const duplicate = persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation({ reasonCodes: ["threshold_pattern", "new_diagnosis_without_intervention"] }),
      createdAt: "2026-03-12T12:10:00.000Z",
      sourceContext: "session_plan",
    });

    db.close();

    expect(first.suppressed).toBe(false);
    expect(duplicate.suppressed).toBe(true);
    expect(duplicate.record.id).toBe(first.record.id);
  });

  it("creates a new snapshot when the recommendation changes materially", () => {
    const db = openDatabase(createTempDbPath());

    const first = persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation(),
      createdAt: "2026-03-12T12:00:00.000Z",
    });
    const changed = persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation({
        action: "escalate_intervention",
        reasonCodes: ["intervention_not_sticking", "threshold_pattern"],
        summary: "Escalate the current threshold repair.",
        decisionReason: "The current repair is not sticking.",
        metadata: {
          currentInterventionId: "int-1",
          currentInterventionStatus: "in_progress",
          patternTypes: ["persistent_threshold_leak", "intervention_not_sticking"],
          requiresNewAssignment: true,
          requiresStrategyChange: false,
          transferFocus: false,
        },
      }),
      createdAt: "2026-03-12T12:20:00.000Z",
    });

    db.close();

    expect(changed.suppressed).toBe(false);
    expect(changed.record.id).not.toBe(first.record.id);
    expect(changed.record.supersedesDecisionId).toBe(first.record.id);
    expect(changed.record.action).toBe("escalate_intervention");
  });

  it("stamps decision and input snapshots with the canonical recommendation manifest", () => {
    const db = openDatabase(createTempDbPath());

    persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation(),
      inputPayload: {
        schemaVersion: "intervention_recommendation_input.v1",
        conceptKey: "river_bluff_catching",
        label: "River Bluff Catching",
        diagnosisSummary: { count: 1, types: ["threshold_error"] },
        interventionSummary: { count: 0, activeCount: 0, improvedCount: 0, failedCount: 0, latestStatus: undefined },
        recoveryStage: "active_repair",
        patternSummary: { count: 1, types: ["persistent_threshold_leak"] },
        studySampleSize: 6,
        recurrenceCount: 1,
        reviewPressure: 1,
        trainingUrgency: 0.8,
        trendSummary: { direction: "stable", recentAverage: 0.5, averageScore: 0.5 },
        retentionSummary: { latestState: "due", validationState: "provisional", lastResult: null, dueCount: 1, overdueCount: 0 },
      },
      createdAt: "2026-03-12T12:00:00.000Z",
    });

    const decision = db.prepare("SELECT * FROM intervention_decision_snapshots LIMIT 1").get() as InterventionDecisionSnapshotRow;
    const input = db.prepare("SELECT * FROM coaching_input_snapshots LIMIT 1").get() as {
      engine_family: string;
      engine_version: string;
      engine_schema_version: string;
    };
    db.close();

    expect(decision.engine_family).toBe("intervention_recommendation");
    expect(decision.engine_version).toBe("1.0.0");
    expect(input.engine_family).toBe("intervention_recommendation");
    expect(input.engine_schema_version).toBe("intervention_recommendation.v1");
  });

  it("links an acted-on decision to an intervention", () => {
    const db = openDatabase(createTempDbPath());

    const persisted = persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation(),
      createdAt: "2026-03-12T12:00:00.000Z",
    });
    const intervention = createIntervention(db, {
      id: "intervention-1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      source: "command_center",
      created_at: "2026-03-12T12:01:00.000Z",
      status: "assigned",
    });

    linkInterventionDecisionToIntervention({
      db,
      decisionId: persisted.record.id,
      interventionId: intervention.id,
    });

    const summary = buildConceptDecisionAuditSummary({
      conceptKey: "river_bluff_catching",
      decisions: db.prepare("SELECT * FROM intervention_decision_snapshots ORDER BY created_at DESC").all() as never[],
      currentRecommendation: makeRecommendation(),
    });

    db.close();

    expect(summary.lastActedOnDecision?.linkedInterventionId).toBe("intervention-1");
    expect(summary.lastActedOnDecision?.actedUpon).toBe(true);
  });

  it("summarizes changed actions and escalation count correctly", () => {
    const db = openDatabase(createTempDbPath());

    persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation(),
      createdAt: "2026-03-12T12:00:00.000Z",
    });
    persistInterventionDecisionSnapshot({
      db,
      recommendation: makeRecommendation({
        action: "escalate_intervention",
        reasonCodes: ["intervention_not_sticking", "threshold_pattern"],
        summary: "Escalate the current threshold repair.",
        decisionReason: "The current repair is not sticking.",
        metadata: {
          currentInterventionId: "int-1",
          currentInterventionStatus: "in_progress",
          patternTypes: ["persistent_threshold_leak", "intervention_not_sticking"],
          requiresNewAssignment: true,
          requiresStrategyChange: false,
          transferFocus: false,
        },
      }),
      createdAt: "2026-03-12T12:20:00.000Z",
    });

    const summary = buildConceptDecisionAuditSummary({
      conceptKey: "river_bluff_catching",
      decisions: db.prepare("SELECT * FROM intervention_decision_snapshots ORDER BY created_at DESC").all() as never[],
      currentRecommendation: makeRecommendation({
        action: "change_intervention_strategy",
        recommendedStrategy: "blocker_recognition",
        reasonCodes: ["intervention_not_sticking", "blocker_pattern"],
      }),
    });

    db.close();

    expect(summary.latestDecision?.action).toBe("escalate_intervention");
    expect(summary.latestDecisionChanged).toBe(true);
    expect(summary.currentRecommendationChanged).toBe(true);
    expect(summary.escalationCount).toBe(1);
    expect(summary.stability).toBe("flipping");
  });
});

