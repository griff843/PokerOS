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

// Coaching memory operations

export type CoachingDiagnosticType =
  | "threshold_error"
  | "range_construction_error"
  | "blocker_blindness"
  | "line_misunderstanding"
  | "pool_assumption_error"
  | "confidence_miscalibration"
  | "calibration_error";

export type CoachingInterventionSource = "session_review" | "real_hand" | "weakness_explorer" | "command_center";
export type CoachingInterventionStatus = "assigned" | "in_progress" | "stabilizing" | "completed" | "regressed" | "abandoned";

export interface CoachingDiagnosisRow {
  id: string;
  user_id: string;
  attempt_id: string;
  concept_key: string;
  diagnostic_type: CoachingDiagnosticType;
  confidence: number;
  created_at: string;
}

export interface CoachingReflectionRow {
  id: string;
  user_id: string;
  attempt_id: string;
  reflection_text: string;
  confidence_level?: string | null;
  created_at: string;
}

export interface CoachingInterventionRow {
  id: string;
  user_id: string;
  concept_key: string;
  source: CoachingInterventionSource;
  created_at: string;
  status: CoachingInterventionStatus;
}


export type InterventionDecisionAction =
  | "assign_intervention"
  | "continue_intervention"
  | "escalate_intervention"
  | "change_intervention_strategy"
  | "add_transfer_block"
  | "run_retention_check"
  | "reopen_intervention"
  | "monitor_only"
  | "close_intervention_loop";

export type InterventionDecisionStrategy =
  | "threshold_repair"
  | "blocker_recognition"
  | "street_transition_repair"
  | "transfer_training"
  | "stabilization_reinforcement"
  | "review_habit_repair"
  | "mixed_repair";

export type InterventionDecisionConfidence = "low" | "medium" | "high";
export type InterventionDecisionIntensity = "light" | "moderate" | "high" | "intensive";

export interface InterventionDecisionSnapshotRow {
  id: string;
  user_id: string;
  concept_key: string;
  created_at: string;
  recommended_action: InterventionDecisionAction;
  recommended_strategy: InterventionDecisionStrategy;
  confidence: InterventionDecisionConfidence;
  priority: number;
  suggested_intensity: InterventionDecisionIntensity;
  recovery_stage: string;
  current_intervention_status?: CoachingInterventionStatus | null;
  reason_codes_json: string;
  supporting_signals_json: string;
  evidence_json: string;
  pattern_types_json: string;
  recurring_leak_bool: number;
  transfer_gap_bool: number;
  acted_upon_bool: number;
  linked_intervention_id?: string | null;
  source_context?: string | null;
  supersedes_decision_id?: string | null;
}

export interface InterventionOutcomeRow {
  id: string;
  intervention_id: string;
  evaluation_window: string;
  pre_score: number;
  post_score: number;
  improved: number;
  created_at: string;
}

export interface CoachingInterventionWithOutcomeRow extends CoachingInterventionRow {
  outcome_id?: string | null;
  evaluation_window?: string | null;
  pre_score?: number | null;
  post_score?: number | null;
  improved?: number | null;
  outcome_created_at?: string | null;
}

export function createDiagnosis(db: Database.Database, row: CoachingDiagnosisRow): void {
  db.prepare(`
    INSERT INTO coaching_diagnoses (id, user_id, attempt_id, concept_key, diagnostic_type, confidence, created_at)
    VALUES (@id, @user_id, @attempt_id, @concept_key, @diagnostic_type, @confidence, @created_at)
    ON CONFLICT(attempt_id) DO UPDATE SET
      user_id = excluded.user_id,
      concept_key = excluded.concept_key,
      diagnostic_type = excluded.diagnostic_type,
      confidence = excluded.confidence,
      created_at = excluded.created_at
  `).run(row);
}

export function deleteDiagnosisByAttempt(db: Database.Database, attemptId: string): void {
  db.prepare("DELETE FROM coaching_diagnoses WHERE attempt_id = ?").run(attemptId);
}

export function createReflection(db: Database.Database, row: CoachingReflectionRow): void {
  db.prepare(`
    INSERT INTO coaching_reflections (id, user_id, attempt_id, reflection_text, confidence_level, created_at)
    VALUES (@id, @user_id, @attempt_id, @reflection_text, @confidence_level, @created_at)
    ON CONFLICT(attempt_id) DO UPDATE SET
      user_id = excluded.user_id,
      reflection_text = excluded.reflection_text,
      confidence_level = excluded.confidence_level,
      created_at = excluded.created_at
  `).run({
    ...row,
    confidence_level: row.confidence_level ?? null,
  });
}

export function deleteReflectionByAttempt(db: Database.Database, attemptId: string): void {
  db.prepare("DELETE FROM coaching_reflections WHERE attempt_id = ?").run(attemptId);
}

export function createIntervention(db: Database.Database, row: CoachingInterventionRow): CoachingInterventionRow {
  const existing = db.prepare(`
    SELECT * FROM coaching_interventions
    WHERE user_id = ? AND concept_key = ? AND source = ? AND status IN ('assigned', 'in_progress', 'stabilizing')
    ORDER BY created_at DESC
    LIMIT 1
  `).get(row.user_id, row.concept_key, row.source) as CoachingInterventionRow | undefined;

  if (existing) {
    return existing;
  }

  db.prepare(`
    INSERT INTO coaching_interventions (id, user_id, concept_key, source, created_at, status)
    VALUES (@id, @user_id, @concept_key, @source, @created_at, @status)
  `).run(row);
  return row;
}

export function startIntervention(db: Database.Database, interventionId: string): void {
  db.prepare("UPDATE coaching_interventions SET status = 'in_progress' WHERE id = ? AND status IN ('assigned', 'regressed')").run(interventionId);
}

export function completeIntervention(db: Database.Database, interventionId: string): void {
  db.prepare("UPDATE coaching_interventions SET status = 'completed' WHERE id = ? AND status IN ('stabilizing', 'in_progress')").run(interventionId);
}

export function updateInterventionStatus(db: Database.Database, interventionId: string, status: CoachingInterventionStatus): void {
  db.prepare("UPDATE coaching_interventions SET status = ? WHERE id = ?").run(status, interventionId);
}

export function recordInterventionOutcome(db: Database.Database, row: InterventionOutcomeRow): void {
  db.prepare(`
    INSERT INTO intervention_outcomes (id, intervention_id, evaluation_window, pre_score, post_score, improved, created_at)
    VALUES (@id, @intervention_id, @evaluation_window, @pre_score, @post_score, @improved, @created_at)
    ON CONFLICT(intervention_id) DO UPDATE SET
      evaluation_window = excluded.evaluation_window,
      pre_score = excluded.pre_score,
      post_score = excluded.post_score,
      improved = excluded.improved,
      created_at = excluded.created_at
  `).run(row);
}

export function getUserInterventions(db: Database.Database, userId: string): CoachingInterventionWithOutcomeRow[] {
  return db.prepare(`
    SELECT
      interventions.*,
      outcomes.id AS outcome_id,
      outcomes.evaluation_window,
      outcomes.pre_score,
      outcomes.post_score,
      outcomes.improved,
      outcomes.created_at AS outcome_created_at
    FROM coaching_interventions AS interventions
    LEFT JOIN intervention_outcomes AS outcomes ON outcomes.intervention_id = interventions.id
    WHERE interventions.user_id = ?
    ORDER BY interventions.created_at DESC
  `).all(userId) as CoachingInterventionWithOutcomeRow[];
}

export function getUserDiagnosisHistory(db: Database.Database, userId: string, limit = 100): CoachingDiagnosisRow[] {
  return db.prepare(`
    SELECT * FROM coaching_diagnoses
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as CoachingDiagnosisRow[];
}

export function getUserReflections(db: Database.Database, userId: string, limit = 100): CoachingReflectionRow[] {
  return db.prepare(`
    SELECT * FROM coaching_reflections
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as CoachingReflectionRow[];
}


export function createInterventionDecisionSnapshot(db: Database.Database, row: InterventionDecisionSnapshotRow): InterventionDecisionSnapshotRow {
  db.prepare(`
    INSERT INTO intervention_decision_snapshots (
      id,
      user_id,
      concept_key,
      created_at,
      recommended_action,
      recommended_strategy,
      confidence,
      priority,
      suggested_intensity,
      recovery_stage,
      current_intervention_status,
      reason_codes_json,
      supporting_signals_json,
      evidence_json,
      pattern_types_json,
      recurring_leak_bool,
      transfer_gap_bool,
      acted_upon_bool,
      linked_intervention_id,
      source_context,
      supersedes_decision_id
    )
    VALUES (
      @id,
      @user_id,
      @concept_key,
      @created_at,
      @recommended_action,
      @recommended_strategy,
      @confidence,
      @priority,
      @suggested_intensity,
      @recovery_stage,
      @current_intervention_status,
      @reason_codes_json,
      @supporting_signals_json,
      @evidence_json,
      @pattern_types_json,
      @recurring_leak_bool,
      @transfer_gap_bool,
      @acted_upon_bool,
      @linked_intervention_id,
      @source_context,
      @supersedes_decision_id
    )
  `).run({
    ...row,
    current_intervention_status: row.current_intervention_status ?? null,
    linked_intervention_id: row.linked_intervention_id ?? null,
    source_context: row.source_context ?? null,
    supersedes_decision_id: row.supersedes_decision_id ?? null,
  });
  return row;
}

export function getRecentInterventionDecisionSnapshots(
  db: Database.Database,
  userId: string,
  conceptKey: string,
  limit = 20
): InterventionDecisionSnapshotRow[] {
  return db.prepare(`
    SELECT * FROM intervention_decision_snapshots
    WHERE user_id = ? AND concept_key = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(userId, conceptKey, limit) as InterventionDecisionSnapshotRow[];
}

export function getUserInterventionDecisionSnapshots(
  db: Database.Database,
  userId: string,
  limit = 100
): InterventionDecisionSnapshotRow[] {
  return db.prepare(`
    SELECT * FROM intervention_decision_snapshots
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(userId, limit) as InterventionDecisionSnapshotRow[];
}

export function getLatestInterventionDecisionSnapshot(
  db: Database.Database,
  userId: string,
  conceptKey: string
): InterventionDecisionSnapshotRow | undefined {
  return db.prepare(`
    SELECT * FROM intervention_decision_snapshots
    WHERE user_id = ? AND concept_key = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(userId, conceptKey) as InterventionDecisionSnapshotRow | undefined;
}

export function markInterventionDecisionActedUpon(
  db: Database.Database,
  decisionId: string,
  linkedInterventionId?: string | null
): void {
  db.prepare(`
    UPDATE intervention_decision_snapshots
    SET acted_upon_bool = 1,
        linked_intervention_id = COALESCE(?, linked_intervention_id)
    WHERE id = ?
  `).run(linkedInterventionId ?? null, decisionId);
}

export function getInterventionOutcome(db: Database.Database, interventionId: string): InterventionOutcomeRow | undefined {
  return db.prepare("SELECT * FROM intervention_outcomes WHERE intervention_id = ?").get(interventionId) as InterventionOutcomeRow | undefined;
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


