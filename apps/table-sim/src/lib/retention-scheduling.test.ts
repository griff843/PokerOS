import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../../packages/db/src";
import {
  createIntervention,
  getLatestRetentionSchedule,
  getUserInterventions,
  getUserRetentionSchedules,
  insertAttempt,
  type CoachingDiagnosisRow,
  upsertDrill,
  upsertNode,
} from "../../../../packages/db/src/repository";
import type { PlayerIntelligenceSnapshot } from "@poker-coach/core/browser";
import {
  buildConceptRetentionSummary,
  refreshRetentionSchedules,
  syncRetentionScheduling,
} from "./retention-scheduling";

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-coach-retention-"));
  tempDirs.push(dir);
  return path.join(dir, "coach.db");
}

function makeSnapshot(overrides: Partial<PlayerIntelligenceSnapshot["concepts"][number]> = {}): PlayerIntelligenceSnapshot {
  return {
    generatedAt: "2026-03-12T12:00:00.000Z",
    activePool: "B",
    graph: { nodes: [], edges: [] },
    concepts: [{
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      summary: "River defense is holding for now.",
      scope: "overall",
      recommendedPool: "B",
      sampleSize: 6,
      recentAverage: 0.78,
      averageScore: 0.74,
      recurrenceCount: 1,
      failedCount: 0,
      reviewPressure: 0,
      trainingUrgency: 0.28,
      status: "watch",
      weaknessRole: "none",
      recoveryStage: "recovered",
      planningReasons: ["weakness_balance"],
      directSignalKeys: [],
      relatedConceptKeys: [],
      supportingConceptKeys: [],
      supportedConceptKeys: [],
      inferredFrom: [],
      evidence: ["Recovered once and now needs validation."],
      relatedDrills: [],
      ...overrides,
    }],
    priorities: [],
    strengths: [],
    recommendations: [],
    adaptiveProfile: {
      generatedAt: "2026-03-12T12:00:00.000Z",
      summary: "",
      tendencies: [],
      surfaceSignals: {
        commandCenter: "",
        growthProfile: "",
        weaknessExplorer: "",
        sessionReview: "",
      },
    },
    memory: {
      diagnosisCount: 0,
      activeInterventions: 0,
      completedInterventions: 0,
      interventionSuccessRate: null,
      recurringLeakConcepts: [],
      recoveredConcepts: ["river_bluff_catching"],
      regressedConcepts: [],
      stabilizingConcepts: [],
    },
    patterns: {
      generatedAt: "2026-03-12T12:00:00.000Z",
      patterns: [],
      topPatterns: [],
    },
  } as unknown as PlayerIntelligenceSnapshot;
}

function seedAttemptDrill(db: ReturnType<typeof openDatabase>): void {
  upsertNode(db, {
    node_id: "hu_01",
    name: "Heads-Up River",
    version: "1.0.0",
    context_json: "{}",
    triggers_json: "[]",
    checklist_md: "",
    defaults_json: "{}",
  });
  upsertDrill(db, {
    drill_id: "d1",
    node_id: "hu_01",
    prompt: "Test drill",
    options_json: "[]",
    answer_json: "{}",
    tags_json: JSON.stringify(["concept:river_bluff_catching"]),
    difficulty: 1,
    content_json: "{}",
    created_at: "2026-03-12T12:00:00.000Z",
  });
}

describe("retention scheduling", () => {
  it("creates a retention schedule for recovered concepts and suppresses duplicates", () => {
    const db = openDatabase(createTempDbPath());
    const playerIntelligence = makeSnapshot();

    syncRetentionScheduling({
      db,
      playerIntelligence,
      attempts: [],
      diagnoses: [],
      interventions: [],
      decisionSnapshots: [],
      now: new Date("2026-03-12T12:00:00.000Z"),
    });
    syncRetentionScheduling({
      db,
      playerIntelligence,
      attempts: [],
      diagnoses: [],
      interventions: [],
      decisionSnapshots: [],
      now: new Date("2026-03-12T12:05:00.000Z"),
    });

    const schedules = getUserRetentionSchedules(db, "local_user");
    db.close();

    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.reason).toBe("recovered_validation");
  });

  it("gives stabilizing concepts a nearer retention schedule", () => {
    const db = openDatabase(createTempDbPath());

    syncRetentionScheduling({
      db,
      playerIntelligence: makeSnapshot({ conceptKey: "turn_defense", label: "Turn Defense", recoveryStage: "stabilizing", recurrenceCount: 0, reviewPressure: 1 }),
      attempts: [],
      diagnoses: [],
      interventions: [],
      decisionSnapshots: [],
      now: new Date("2026-03-12T12:00:00.000Z"),
    });

    const latest = getLatestRetentionSchedule(db, "local_user", "turn_defense");
    db.close();

    expect(latest?.scheduled_for).toBe("2026-03-14T12:00:00.000Z");
    expect(latest?.reason).toBe("stabilizing_followup");
  });

  it("marks due schedules completed_pass when the validation attempts hold up", () => {
    const db = openDatabase(createTempDbPath());
    seedAttemptDrill(db);

    syncRetentionScheduling({
      db,
      playerIntelligence: makeSnapshot(),
      attempts: [],
      diagnoses: [],
      interventions: [],
      decisionSnapshots: [],
      now: new Date("2026-03-12T12:00:00.000Z"),
    });

    const schedule = getLatestRetentionSchedule(db, "local_user", "river_bluff_catching");
    insertAttempt(db, {
      attempt_id: "a1",
      drill_id: "d1",
      ts: "2026-03-19T12:10:00.000Z",
      tags_json: JSON.stringify(["concept:river_bluff_catching"]),
      user_answer_json: JSON.stringify({}),
      correct_bool: 1,
      score: 0.74,
      elapsed_ms: 1200,
      missed_tags_json: JSON.stringify([]),
    });
    insertAttempt(db, {
      attempt_id: "a2",
      drill_id: "d1",
      ts: "2026-03-19T12:20:00.000Z",
      tags_json: JSON.stringify(["concept:river_bluff_catching"]),
      user_answer_json: JSON.stringify({}),
      correct_bool: 1,
      score: 0.76,
      elapsed_ms: 1200,
      missed_tags_json: JSON.stringify([]),
    });

    refreshRetentionSchedules({
      db,
      attempts: db.prepare("SELECT * FROM attempts ORDER BY ts DESC").all() as never[],
      diagnoses: [],
      now: new Date(schedule?.scheduled_for ?? "2026-03-19T12:30:00.000Z"),
    });

    const summary = buildConceptRetentionSummary("river_bluff_catching", getUserRetentionSchedules(db, "local_user"), new Date("2026-03-19T12:30:00.000Z"));
    db.close();

    expect(summary.latestSchedule?.status).toBe("completed_pass");
    expect(summary.validationState).toBe("validated");
  });

  it("marks failed retention checks and regresses linked interventions", () => {
    const db = openDatabase(createTempDbPath());
    seedAttemptDrill(db);
    const intervention = createIntervention(db, {
      id: "int-1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      source: "command_center",
      created_at: "2026-03-10T12:00:00.000Z",
      status: "stabilizing",
    });
    syncRetentionScheduling({
      db,
      playerIntelligence: makeSnapshot(),
      attempts: [],
      diagnoses: [],
      interventions: getUserInterventions(db, "local_user"),
      decisionSnapshots: [],
      now: new Date("2026-03-12T12:00:00.000Z"),
    });
    const schedule = getLatestRetentionSchedule(db, "local_user", "river_bluff_catching");
    db.prepare("UPDATE retention_schedules SET linked_intervention_id = ? WHERE id = ?").run(intervention.id, schedule?.id);

    insertAttempt(db, {
      attempt_id: "a1",
      drill_id: "d1",
      ts: "2026-03-19T12:10:00.000Z",
      tags_json: JSON.stringify(["concept:river_bluff_catching"]),
      user_answer_json: JSON.stringify({}),
      correct_bool: 0,
      score: 0.42,
      elapsed_ms: 1200,
      missed_tags_json: JSON.stringify(["paired_top_river"]),
    });
    insertAttempt(db, {
      attempt_id: "a2",
      drill_id: "d1",
      ts: "2026-03-19T12:20:00.000Z",
      tags_json: JSON.stringify(["concept:river_bluff_catching"]),
      user_answer_json: JSON.stringify({}),
      correct_bool: 0,
      score: 0.44,
      elapsed_ms: 1200,
      missed_tags_json: JSON.stringify(["paired_top_river"]),
    });

    const diagnoses: CoachingDiagnosisRow[] = [{
      id: "diag-1",
      user_id: "local_user",
      attempt_id: "a2",
      concept_key: "river_bluff_catching",
      diagnostic_type: "threshold_error",
      confidence: 0.9,
      created_at: "2026-03-19T12:20:00.000Z",
    }];
    refreshRetentionSchedules({
      db,
      attempts: db.prepare("SELECT * FROM attempts ORDER BY ts DESC").all() as never[],
      diagnoses,
      now: new Date(schedule?.scheduled_for ?? "2026-03-19T12:30:00.000Z"),
    });

    const updatedSchedule = getLatestRetentionSchedule(db, "local_user", "river_bluff_catching");
    const updatedIntervention = getUserInterventions(db, "local_user")[0];
    db.close();

    expect(updatedSchedule?.status).toBe("completed_fail");
    expect(updatedIntervention?.status).toBe("regressed");
  });
});
