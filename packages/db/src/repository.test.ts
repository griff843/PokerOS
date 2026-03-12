import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./index";
import {
  completeIntervention,
  createDiagnosis,
  createIntervention,
  createReflection,
  getAllAttempts,
  getAllImportedHands,
  getInterventionOutcome,
  getRecentHandImports,
  getUserDiagnosisHistory,
  getUserInterventions,
  insertAttempt,
  insertHandImport,
  insertImportedHand,
  recordInterventionOutcome,
  startIntervention,
  type ImportedHandRow,
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
