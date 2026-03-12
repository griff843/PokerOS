import Database from "better-sqlite3";

// Node operations

export interface NodeRow {
  node_id: string;
  name: string;
  version: string;
  context_json: string;
  triggers_json: string;
  checklist_md: string;
  defaults_json: string;
}

export function upsertNode(db: Database.Database, node: NodeRow): void {
  db.prepare(`
    INSERT INTO nodes (node_id, name, version, context_json, triggers_json, checklist_md, defaults_json)
    VALUES (@node_id, @name, @version, @context_json, @triggers_json, @checklist_md, @defaults_json)
    ON CONFLICT(node_id) DO UPDATE SET
      name = excluded.name,
      version = excluded.version,
      context_json = excluded.context_json,
      triggers_json = excluded.triggers_json,
      checklist_md = excluded.checklist_md,
      defaults_json = excluded.defaults_json
  `).run(node);
}

export function getAllNodes(db: Database.Database): NodeRow[] {
  return db.prepare("SELECT * FROM nodes ORDER BY node_id").all() as NodeRow[];
}

export function getNode(db: Database.Database, nodeId: string): NodeRow | undefined {
  return db.prepare("SELECT * FROM nodes WHERE node_id = ?").get(nodeId) as NodeRow | undefined;
}

// Drill operations

export interface DrillRow {
  drill_id: string;
  node_id: string;
  prompt: string;
  options_json: string;
  answer_json: string;
  tags_json: string;
  difficulty: number;
  content_json: string;
  created_at: string;
}

export function upsertDrill(db: Database.Database, drill: DrillRow): void {
  db.prepare(`
    INSERT INTO drills (drill_id, node_id, prompt, options_json, answer_json, tags_json, difficulty, content_json, created_at)
    VALUES (@drill_id, @node_id, @prompt, @options_json, @answer_json, @tags_json, @difficulty, @content_json, @created_at)
    ON CONFLICT(drill_id) DO UPDATE SET
      node_id = excluded.node_id,
      prompt = excluded.prompt,
      options_json = excluded.options_json,
      answer_json = excluded.answer_json,
      tags_json = excluded.tags_json,
      difficulty = excluded.difficulty,
      content_json = excluded.content_json
  `).run(drill);
}

export function getAllDrills(db: Database.Database): DrillRow[] {
  return db.prepare("SELECT * FROM drills ORDER BY drill_id").all() as DrillRow[];
}

export function getDrillsByNode(db: Database.Database, nodeId: string): DrillRow[] {
  return db.prepare("SELECT * FROM drills WHERE node_id = ? ORDER BY drill_id").all(nodeId) as DrillRow[];
}

export function getDrill(db: Database.Database, drillId: string): DrillRow | undefined {
  return db.prepare("SELECT * FROM drills WHERE drill_id = ?").get(drillId) as DrillRow | undefined;
}

// Attempt operations

export type AttemptPool = "baseline" | "A" | "B" | "C" | null;

export interface AttemptRow {
  attempt_id: string;
  drill_id: string;
  session_id?: string | null;
  ts: string;
  selected_action?: string | null;
  confidence?: string | null;
  tags_json?: string;
  reflection?: string | null;
  user_answer_json: string;
  correct_bool: number;
  score: number;
  elapsed_ms: number;
  missed_tags_json: string;
  active_pool?: AttemptPool;
}

export function insertAttempt(db: Database.Database, attempt: AttemptRow): void {
  db.prepare(`
    INSERT INTO attempts (
      attempt_id,
      drill_id,
      session_id,
      ts,
      selected_action,
      confidence,
      tags_json,
      reflection,
      user_answer_json,
      correct_bool,
      score,
      elapsed_ms,
      missed_tags_json,
      active_pool
    )
    VALUES (
      @attempt_id,
      @drill_id,
      @session_id,
      @ts,
      @selected_action,
      @confidence,
      @tags_json,
      @reflection,
      @user_answer_json,
      @correct_bool,
      @score,
      @elapsed_ms,
      @missed_tags_json,
      @active_pool
    )
  `).run({
    ...attempt,
    session_id: attempt.session_id ?? null,
    selected_action: attempt.selected_action ?? null,
    confidence: attempt.confidence ?? null,
    tags_json: attempt.tags_json ?? JSON.stringify([]),
    reflection: attempt.reflection ?? "",
    active_pool: attempt.active_pool ?? null,
  });
}

export function updateAttemptReflection(db: Database.Database, attemptId: string, reflection: string): void {
  db.prepare("UPDATE attempts SET reflection = ? WHERE attempt_id = ?").run(reflection, attemptId);
}

export function updateAttemptRecord(db: Database.Database, attemptId: string, updates: { reflection?: string | null; user_answer_json?: string }): void {
  if (updates.reflection !== undefined) {
    db.prepare("UPDATE attempts SET reflection = ? WHERE attempt_id = ?").run(updates.reflection ?? "", attemptId);
  }
  if (updates.user_answer_json !== undefined) {
    db.prepare("UPDATE attempts SET user_answer_json = ? WHERE attempt_id = ?").run(updates.user_answer_json, attemptId);
  }
}

export function getAttempt(db: Database.Database, attemptId: string): AttemptRow | undefined {
  return db.prepare("SELECT * FROM attempts WHERE attempt_id = ?").get(attemptId) as AttemptRow | undefined;
}

export function getAttemptsBySession(db: Database.Database, sessionId: string): AttemptRow[] {
  return db.prepare("SELECT * FROM attempts WHERE session_id = ? ORDER BY ts DESC").all(sessionId) as AttemptRow[];
}

export function getAttemptsByDrill(db: Database.Database, drillId: string): AttemptRow[] {
  return db.prepare("SELECT * FROM attempts WHERE drill_id = ? ORDER BY ts DESC").all(drillId) as AttemptRow[];
}

export function getAllAttempts(db: Database.Database): AttemptRow[] {
  return db.prepare("SELECT * FROM attempts ORDER BY ts DESC").all() as AttemptRow[];
}

export function getAttemptsSince(db: Database.Database, since: string): AttemptRow[] {
  return db.prepare("SELECT * FROM attempts WHERE ts >= ? ORDER BY ts DESC").all(since) as AttemptRow[];
}

// SRS operations

export interface SrsRow {
  drill_id: string;
  due_at: string;
  interval_days: number;
  ease: number;
  repetitions: number;
  last_score: number;
}

export function upsertSrs(db: Database.Database, srs: SrsRow): void {
  db.prepare(`
    INSERT INTO srs (drill_id, due_at, interval_days, ease, repetitions, last_score)
    VALUES (@drill_id, @due_at, @interval_days, @ease, @repetitions, @last_score)
    ON CONFLICT(drill_id) DO UPDATE SET
      due_at = excluded.due_at,
      interval_days = excluded.interval_days,
      ease = excluded.ease,
      repetitions = excluded.repetitions,
      last_score = excluded.last_score
  `).run(srs);
}

export function getSrs(db: Database.Database, drillId: string): SrsRow | undefined {
  return db.prepare("SELECT * FROM srs WHERE drill_id = ?").get(drillId) as SrsRow | undefined;
}

export function getAllSrs(db: Database.Database): SrsRow[] {
  return db.prepare("SELECT * FROM srs ORDER BY due_at ASC").all() as SrsRow[];
}

export function getDueDrills(db: Database.Database, now: string, limit: number): SrsRow[] {
  return db.prepare(
    "SELECT * FROM srs WHERE due_at <= ? ORDER BY due_at ASC LIMIT ?"
  ).all(now, limit) as SrsRow[];
}

export function getNewDrillIds(db: Database.Database, limit: number): string[] {
  const rows = db.prepare(`
    SELECT d.drill_id FROM drills d
    LEFT JOIN srs s ON d.drill_id = s.drill_id
    WHERE s.drill_id IS NULL
    ORDER BY d.drill_id
    LIMIT ?
  `).all(limit) as { drill_id: string }[];
  return rows.map((r) => r.drill_id);
}

// Real hand imports

export interface HandImportRow {
  import_id: string;
  source: string;
  status: "completed" | "partial" | "failed";
  total_hands: number;
  parsed_hands: number;
  unsupported_hands: number;
  notes_json: string;
  created_at: string;
  updated_at: string;
}

export interface ImportedHandRow {
  imported_hand_id: string;
  import_id: string;
  source_hand_id: string;
  source: string;
  parse_status: string;
  parser_version: string;
  hero_name?: string | null;
  hero_position?: string | null;
  played_at?: string | null;
  session_label?: string | null;
  stakes?: string | null;
  table_name?: string | null;
  effective_stack_bb?: number | null;
  raw_text: string;
  structured_json: string;
  concept_matches_json: string;
  review_spots_json: string;
  created_at: string;
}

export function insertHandImport(db: Database.Database, row: HandImportRow): void {
  db.prepare(`
    INSERT INTO hand_imports (
      import_id,
      source,
      status,
      total_hands,
      parsed_hands,
      unsupported_hands,
      notes_json,
      created_at,
      updated_at
    )
    VALUES (
      @import_id,
      @source,
      @status,
      @total_hands,
      @parsed_hands,
      @unsupported_hands,
      @notes_json,
      @created_at,
      @updated_at
    )
  `).run(row);
}

export function updateHandImport(db: Database.Database, importId: string, updates: Pick<HandImportRow, "status" | "total_hands" | "parsed_hands" | "unsupported_hands" | "notes_json" | "updated_at">): void {
  db.prepare(`
    UPDATE hand_imports
    SET status = @status,
        total_hands = @total_hands,
        parsed_hands = @parsed_hands,
        unsupported_hands = @unsupported_hands,
        notes_json = @notes_json,
        updated_at = @updated_at
    WHERE import_id = @import_id
  `).run({ import_id: importId, ...updates });
}

export function getRecentHandImports(db: Database.Database, limit = 10): HandImportRow[] {
  return db.prepare("SELECT * FROM hand_imports ORDER BY created_at DESC LIMIT ?").all(limit) as HandImportRow[];
}

export function insertImportedHand(db: Database.Database, row: ImportedHandRow): void {
  db.prepare(`
    INSERT INTO imported_hands (
      imported_hand_id,
      import_id,
      source_hand_id,
      source,
      parse_status,
      parser_version,
      hero_name,
      hero_position,
      played_at,
      session_label,
      stakes,
      table_name,
      effective_stack_bb,
      raw_text,
      structured_json,
      concept_matches_json,
      review_spots_json,
      created_at
    )
    VALUES (
      @imported_hand_id,
      @import_id,
      @source_hand_id,
      @source,
      @parse_status,
      @parser_version,
      @hero_name,
      @hero_position,
      @played_at,
      @session_label,
      @stakes,
      @table_name,
      @effective_stack_bb,
      @raw_text,
      @structured_json,
      @concept_matches_json,
      @review_spots_json,
      @created_at
    )
    ON CONFLICT(imported_hand_id) DO UPDATE SET
      import_id = excluded.import_id,
      parse_status = excluded.parse_status,
      hero_name = excluded.hero_name,
      hero_position = excluded.hero_position,
      played_at = excluded.played_at,
      session_label = excluded.session_label,
      stakes = excluded.stakes,
      table_name = excluded.table_name,
      effective_stack_bb = excluded.effective_stack_bb,
      raw_text = excluded.raw_text,
      structured_json = excluded.structured_json,
      concept_matches_json = excluded.concept_matches_json,
      review_spots_json = excluded.review_spots_json
  `).run({
    ...row,
    hero_name: row.hero_name ?? null,
    hero_position: row.hero_position ?? null,
    played_at: row.played_at ?? null,
    session_label: row.session_label ?? null,
    stakes: row.stakes ?? null,
    table_name: row.table_name ?? null,
    effective_stack_bb: row.effective_stack_bb ?? null,
  });
}

export function getAllImportedHands(db: Database.Database): ImportedHandRow[] {
  return db.prepare("SELECT * FROM imported_hands ORDER BY COALESCE(played_at, created_at) DESC, imported_hand_id DESC").all() as ImportedHandRow[];
}

export function getImportedHand(db: Database.Database, importedHandId: string): ImportedHandRow | undefined {
  return db.prepare("SELECT * FROM imported_hands WHERE imported_hand_id = ?").get(importedHandId) as ImportedHandRow | undefined;
}

export function getImportedHandsByImportId(db: Database.Database, importId: string): ImportedHandRow[] {
  return db.prepare("SELECT * FROM imported_hands WHERE import_id = ? ORDER BY COALESCE(played_at, created_at) DESC").all(importId) as ImportedHandRow[];
}

// Settings operations

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function getSetting(db: Database.Database, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

