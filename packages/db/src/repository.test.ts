import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./index";
import {
  cancelRetentionSchedule,
  completeIntervention,
  completeRetentionSchedule,
  createDiagnosis,
  createIntervention,
  createInterventionDecisionSnapshot,
  createRetentionSchedule,
  createTransferEvaluationSnapshot,
  createReflection,
  getAllAttempts,
  getAllImportedHands,
  getConceptRetentionSchedules,
  getDueRetentionSchedules,
  getInterventionOutcome,
  getLatestInterventionDecisionSnapshot,
  getLatestRetentionSchedule,
  getLatestTransferEvaluationSnapshot,
  getRecentHandImports,
  getRecentInterventionDecisionSnapshots,
  getRecentTransferEvaluationSnapshots,
  getUserDiagnosisHistory,
  getUserInterventionDecisionSnapshots,
  getUserInterventions,
  getUserRetentionSchedules,
  getUserTransferEvaluationSnapshots,
  insertAttempt,
  insertHandImport,
  insertImportedHand,
  markInterventionDecisionActedUpon,
  recordInterventionOutcome,
  startIntervention,
  supersedeRetentionSchedule,
  type ImportedHandRow,
  updateRetentionScheduleStatus,
  updateAttemptReflection,
  upsertDrill,
  upsertNode,
} from "./repository";

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-coach-db-"));
  tempDirs.push(dir);
  return path.join(dir, "coach.db");
}

describe("attempt persistence", () => {
  it("stores active_pool on attempts without breaking baseline attempts", () => {
    const db = openDatabase(createTempDbPath());

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
      tags_json: "[]",
      difficulty: 1,
      content_json: "{}",
      created_at: new Date().toISOString(),
    });

    insertAttempt(db, {
      attempt_id: "a1",
      drill_id: "d1",
      session_id: "s1",
      ts: "2026-03-10T12:00:00.000Z",
      selected_action: "CALL",
      confidence: "certain",
      tags_json: JSON.stringify(["paired_top_river"]),
      reflection: "Call because blockers matter.",
      user_answer_json: JSON.stringify({ answer: "CALL" }),
      correct_bool: 1,
      score: 1,
      elapsed_ms: 1200,
      missed_tags_json: JSON.stringify([]),
      active_pool: "B",
    });

    insertAttempt(db, {
      attempt_id: "a2",
      drill_id: "d1",
      ts: "2026-03-10T12:05:00.000Z",
      user_answer_json: JSON.stringify({ answer: "CALL" }),
      correct_bool: 1,
      score: 1,
      elapsed_ms: 1100,
      missed_tags_json: JSON.stringify([]),
    });

    updateAttemptReflection(db, "a1", "Updated reflection");

    const attempts = getAllAttempts(db);
    db.close();

    expect(attempts).toHaveLength(2);
    expect(attempts[0].active_pool ?? null).toBeNull();
    expect(attempts[1].active_pool).toBe("B");
    expect(attempts[1].session_id).toBe("s1");
    expect(attempts[1].selected_action).toBe("CALL");
    expect(attempts[1].confidence).toBe("certain");
    expect(attempts[1].tags_json).toBe(JSON.stringify(["paired_top_river"]));
    expect(attempts[1].reflection).toBe("Updated reflection");
  });

  it("stores diagnoses, reflections, interventions, and outcomes separately from attempts", () => {
    const db = openDatabase(createTempDbPath());

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
      tags_json: "[]",
      difficulty: 1,
      content_json: "{}",
      created_at: new Date().toISOString(),
    });

    insertAttempt(db, {
      attempt_id: "a1",
      drill_id: "d1",
      session_id: "s1",
      ts: "2026-03-10T12:00:00.000Z",
      selected_action: "CALL",
      confidence: "certain",
      tags_json: JSON.stringify(["paired_top_river"]),
      reflection: "River felt under-bluffed.",
      user_answer_json: JSON.stringify({ answer: "CALL" }),
      correct_bool: 0,
      score: 0.32,
      elapsed_ms: 1200,
      missed_tags_json: JSON.stringify(["paired_top_river"]),
      active_pool: "B",
    });

    createDiagnosis(db, {
      id: "diag-1",
      user_id: "local_user",
      attempt_id: "a1",
      concept_key: "river_bluff_catching",
      diagnostic_type: "threshold_error",
      confidence: 0.9,
      created_at: "2026-03-10T12:00:00.000Z",
    });

    createReflection(db, {
      id: "reflection-1",
      user_id: "local_user",
      attempt_id: "a1",
      reflection_text: "I over-called because I counted too many bluffs.",
      confidence_level: "certain",
      created_at: "2026-03-10T12:00:00.000Z",
    });

    const assigned = createIntervention(db, {
      id: "intervention-1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      source: "command_center",
      created_at: "2026-03-10T12:05:00.000Z",
      status: "assigned",
    });

    startIntervention(db, assigned.id);
    recordInterventionOutcome(db, {
      id: "outcome-1",
      intervention_id: assigned.id,
      evaluation_window: "3_attempts",
      pre_score: 0.34,
      post_score: 0.71,
      improved: 1,
      created_at: "2026-03-10T13:00:00.000Z",
    });
    completeIntervention(db, assigned.id);

    const diagnoses = getUserDiagnosisHistory(db, "local_user");
    const interventions = getUserInterventions(db, "local_user");
    const outcome = getInterventionOutcome(db, assigned.id);
    db.close();

    expect(diagnoses[0]?.diagnostic_type).toBe("threshold_error");
    expect(interventions[0]?.status).toBe("completed");
    expect(interventions[0]?.improved).toBe(1);
    expect(outcome?.post_score).toBe(0.71);
  });

  it("stores imported hand batches and structured hands", () => {
    const db = openDatabase(createTempDbPath());

    insertHandImport(db, {
      import_id: "import-1",
      source: "paste",
      status: "completed",
      total_hands: 1,
      parsed_hands: 1,
      unsupported_hands: 0,
      notes_json: JSON.stringify([]),
      created_at: "2026-03-11T10:00:00.000Z",
      updated_at: "2026-03-11T10:00:00.000Z",
    });

    const hand: ImportedHandRow = {
      imported_hand_id: "imported-123",
      import_id: "import-1",
      source_hand_id: "123",
      source: "paste",
      parse_status: "parsed",
      parser_version: "pokerstars_nlhe_v1",
      hero_name: "Hero",
      hero_position: "BB",
      played_at: "2026-03-10T12:00:00.000Z",
      session_label: "Alpha",
      stakes: "$0.50/$1.00 USD",
      table_name: "Alpha",
      effective_stack_bb: 100,
      raw_text: "PokerStars Hand #123",
      structured_json: JSON.stringify({ importedHandId: "imported-123", sourceHandId: "123", source: "paste", parseStatus: "parsed", parserVersion: "pokerstars_nlhe_v1", rawText: "PokerStars Hand #123", players: [], actions: [], conceptMatches: [], reviewSpots: [], importNotes: [] }),
      concept_matches_json: JSON.stringify([{ conceptKey: "river_defense" }]),
      review_spots_json: JSON.stringify([{ spotId: "river-1" }]),
      created_at: "2026-03-11T10:00:00.000Z",
    };

    insertImportedHand(db, hand);

    const imports = getRecentHandImports(db);
    const hands = getAllImportedHands(db);
    db.close();

    expect(imports[0]?.import_id).toBe("import-1");
    expect(hands[0]?.imported_hand_id).toBe("imported-123");
    expect(hands[0]?.concept_matches_json).toContain("river_defense");
  });
});


describe("intervention decision snapshots", () => {
  it("stores, links, and reads decision history in newest-first order", () => {
    const db = openDatabase(createTempDbPath());

    const first = createInterventionDecisionSnapshot(db, {
      id: "decision-1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      created_at: "2026-03-10T12:00:00.000Z",
      recommended_action: "assign_intervention",
      recommended_strategy: "threshold_repair",
      confidence: "high",
      priority: 92,
      suggested_intensity: "high",
      recovery_stage: "active_repair",
      current_intervention_status: null,
      reason_codes_json: JSON.stringify(["new_diagnosis_without_intervention", "threshold_pattern"]),
      supporting_signals_json: JSON.stringify([{ kind: "diagnosis", code: "diagnosis_count", detail: "2 stored diagnosis entries are attached to this concept." }]),
      evidence_json: JSON.stringify(["Recent misses remain under threshold."]),
      pattern_types_json: JSON.stringify(["persistent_threshold_leak"]),
      recurring_leak_bool: 1,
      transfer_gap_bool: 0,
      acted_upon_bool: 0,
      linked_intervention_id: null,
      source_context: "intervention_plan_api",
      supersedes_decision_id: null,
    });

    const intervention = createIntervention(db, {
      id: "intervention-1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      source: "command_center",
      created_at: "2026-03-10T12:01:00.000Z",
      status: "assigned",
    });

    markInterventionDecisionActedUpon(db, first.id, intervention.id);

    createInterventionDecisionSnapshot(db, {
      id: "decision-2",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      created_at: "2026-03-10T12:30:00.000Z",
      recommended_action: "continue_intervention",
      recommended_strategy: "threshold_repair",
      confidence: "medium",
      priority: 74,
      suggested_intensity: "moderate",
      recovery_stage: "stabilizing",
      current_intervention_status: "in_progress",
      reason_codes_json: JSON.stringify(["active_intervention_improving", "threshold_pattern"]),
      supporting_signals_json: JSON.stringify([{ kind: "intervention", code: "in_progress", detail: "Latest intervention status is in progress." }]),
      evidence_json: JSON.stringify(["Recent scores are improving."]),
      pattern_types_json: JSON.stringify(["persistent_threshold_leak"]),
      recurring_leak_bool: 1,
      transfer_gap_bool: 0,
      acted_upon_bool: 0,
      linked_intervention_id: null,
      source_context: "session_plan",
      supersedes_decision_id: first.id,
    });

    const latest = getLatestInterventionDecisionSnapshot(db, "local_user", "river_bluff_catching");
    const conceptHistory = getRecentInterventionDecisionSnapshots(db, "local_user", "river_bluff_catching", 10);
    const userHistory = getUserInterventionDecisionSnapshots(db, "local_user", 10);
    db.close();

    expect(latest?.id).toBe("decision-2");
    expect(conceptHistory.map((entry) => entry.id)).toEqual(["decision-2", "decision-1"]);
    expect(userHistory.map((entry) => entry.id)).toEqual(["decision-2", "decision-1"]);
    expect(conceptHistory[1]?.acted_upon_bool).toBe(1);
    expect(conceptHistory[1]?.linked_intervention_id).toBe(intervention.id);
    expect(conceptHistory[0]?.supersedes_decision_id).toBe("decision-1");
  });
});

describe("retention schedules", () => {
  it("stores, updates, and reads retention schedules in audit order", () => {
    const db = openDatabase(createTempDbPath());

    createRetentionSchedule(db, {
      id: "ret-1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      created_at: "2026-03-12T12:00:00.000Z",
      scheduled_for: "2026-03-19T12:00:00.000Z",
      status: "scheduled",
      reason: "recovered_validation",
      linked_intervention_id: null,
      linked_decision_snapshot_id: null,
      recovery_stage_at_scheduling: "recovered",
      priority: 58,
      completed_at: null,
      result: null,
      supersedes_schedule_id: null,
      superseded_by_schedule_id: null,
      evidence_json: JSON.stringify(["Recovered concepts need explicit validation."]),
    });

    createRetentionSchedule(db, {
      id: "ret-2",
      user_id: "local_user",
      concept_key: "turn_defense",
      created_at: "2026-03-12T12:10:00.000Z",
      scheduled_for: "2026-03-14T12:00:00.000Z",
      status: "due",
      reason: "stabilizing_followup",
      linked_intervention_id: null,
      linked_decision_snapshot_id: null,
      recovery_stage_at_scheduling: "stabilizing",
      priority: 72,
      completed_at: null,
      result: null,
      supersedes_schedule_id: null,
      superseded_by_schedule_id: null,
      evidence_json: JSON.stringify(["Stabilizing concepts need nearer follow-up."]),
    });

    updateRetentionScheduleStatus(db, "ret-1", "overdue");
    completeRetentionSchedule(db, "ret-2", "pass", "2026-03-14T13:00:00.000Z");

    createRetentionSchedule(db, {
      id: "ret-3",
      user_id: "local_user",
      concept_key: "turn_defense",
      created_at: "2026-03-14T14:00:00.000Z",
      scheduled_for: "2026-03-17T12:00:00.000Z",
      status: "scheduled",
      reason: "recurrence_guard",
      linked_intervention_id: null,
      linked_decision_snapshot_id: null,
      recovery_stage_at_scheduling: "recovered",
      priority: 68,
      completed_at: null,
      result: null,
      supersedes_schedule_id: "ret-2",
      superseded_by_schedule_id: null,
      evidence_json: JSON.stringify(["Recurring leaks justify another guardrail check."]),
    });
    supersedeRetentionSchedule(db, "ret-2", "ret-3");
    cancelRetentionSchedule(db, "ret-3");

    const latest = getLatestRetentionSchedule(db, "local_user", "turn_defense");
    const conceptHistory = getConceptRetentionSchedules(db, "local_user", "turn_defense");
    const due = getDueRetentionSchedules(db, "local_user");
    const userSchedules = getUserRetentionSchedules(db, "local_user");
    db.close();

    expect(latest?.id).toBe("ret-3");
    expect(latest?.status).toBe("canceled");
    expect(conceptHistory.map((entry) => entry.id)).toEqual(["ret-3", "ret-2"]);
    expect(conceptHistory[1]?.status).toBe("superseded");
    expect(conceptHistory[1]?.superseded_by_schedule_id).toBe("ret-3");
    expect(due.map((entry) => entry.id)).toEqual(["ret-1"]);
    expect(userSchedules).toHaveLength(3);
  });
});

describe("transfer evaluation snapshots", () => {
  it("stores and reads transfer history in newest-first audit order", () => {
    const db = openDatabase(createTempDbPath());

    createTransferEvaluationSnapshot(db, {
      id: "transfer-1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      created_at: "2026-03-12T12:00:00.000Z",
      transfer_status: "transfer_validated",
      transfer_confidence: "high",
      evidence_sufficiency: "strong",
      pressure: "low",
      study_sample_size: 6,
      study_performance: 0.76,
      study_recent_average: 0.76,
      study_average: 0.64,
      study_failed_count: 1,
      real_play_performance: 0.82,
      real_play_occurrences: 4,
      real_play_review_spot_count: 0,
      real_play_latest_hand_at: "2026-03-12T11:00:00.000Z",
      study_vs_real_play_delta: -0.06,
      recovery_stage: "recovered",
      retention_state: "completed_pass",
      retention_result: "pass",
      pattern_types_json: JSON.stringify([]),
      supporting_evidence_json: JSON.stringify(["Imported hands are staying clean."]),
      risk_flags_json: JSON.stringify([]),
      linked_decision_snapshot_id: null,
      linked_retention_schedule_id: null,
      source_context: "concept_case_api",
      supersedes_snapshot_id: null,
    });

    createTransferEvaluationSnapshot(db, {
      id: "transfer-2",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      created_at: "2026-03-12T13:00:00.000Z",
      transfer_status: "transfer_regressed",
      transfer_confidence: "high",
      evidence_sufficiency: "strong",
      pressure: "high",
      study_sample_size: 7,
      study_performance: 0.78,
      study_recent_average: 0.78,
      study_average: 0.67,
      study_failed_count: 1,
      real_play_performance: 0.21,
      real_play_occurrences: 4,
      real_play_review_spot_count: 4,
      real_play_latest_hand_at: "2026-03-12T12:45:00.000Z",
      study_vs_real_play_delta: 0.57,
      recovery_stage: "recovered",
      retention_state: "due",
      retention_result: "pass",
      pattern_types_json: JSON.stringify(["real_play_transfer_gap"]),
      supporting_evidence_json: JSON.stringify(["Imported hands are again producing repeated review spots."]),
      risk_flags_json: JSON.stringify(["validated_transfer_slipping", "recovery_contradicted_by_real_play"]),
      linked_decision_snapshot_id: null,
      linked_retention_schedule_id: null,
      source_context: "intervention_plan_api",
      supersedes_snapshot_id: "transfer-1",
    });

    const latest = getLatestTransferEvaluationSnapshot(db, "local_user", "river_bluff_catching");
    const conceptHistory = getRecentTransferEvaluationSnapshots(db, "local_user", "river_bluff_catching", 10);
    const userHistory = getUserTransferEvaluationSnapshots(db, "local_user", 10);
    db.close();

    expect(latest?.id).toBe("transfer-2");
    expect(conceptHistory.map((entry) => entry.id)).toEqual(["transfer-2", "transfer-1"]);
    expect(userHistory.map((entry) => entry.id)).toEqual(["transfer-2", "transfer-1"]);
    expect(conceptHistory[0]?.linked_decision_snapshot_id).toBeNull();
    expect(conceptHistory[0]?.supersedes_snapshot_id).toBe("transfer-1");
  });
});
