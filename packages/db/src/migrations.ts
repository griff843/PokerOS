import Database from "better-sqlite3";

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    context_json TEXT NOT NULL DEFAULT '{}',
    triggers_json TEXT NOT NULL DEFAULT '[]',
    checklist_md TEXT NOT NULL DEFAULT '',
    defaults_json TEXT NOT NULL DEFAULT '{}'
  )`,

  `CREATE TABLE IF NOT EXISTS drills (
    drill_id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(node_id),
    prompt TEXT NOT NULL,
    options_json TEXT NOT NULL DEFAULT '[]',
    answer_json TEXT NOT NULL DEFAULT '{}',
    tags_json TEXT NOT NULL DEFAULT '[]',
    difficulty INTEGER NOT NULL DEFAULT 1,
    content_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS attempts (
    attempt_id TEXT PRIMARY KEY,
    drill_id TEXT NOT NULL REFERENCES drills(drill_id),
    session_id TEXT,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    selected_action TEXT,
    confidence TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    reflection TEXT NOT NULL DEFAULT '',
    user_answer_json TEXT NOT NULL DEFAULT '{}',
    correct_bool INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    missed_tags_json TEXT NOT NULL DEFAULT '[]',
    active_pool TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS coaching_diagnoses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
    concept_key TEXT NOT NULL,
    diagnostic_type TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS coaching_reflections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
    reflection_text TEXT NOT NULL DEFAULT '',
    confidence_level TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS coaching_interventions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    concept_key TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL
  )`,



  `CREATE TABLE IF NOT EXISTS intervention_decision_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    concept_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    engine_family TEXT NOT NULL DEFAULT 'intervention_recommendation',
    engine_name TEXT NOT NULL DEFAULT 'unknown',
    engine_version TEXT NOT NULL DEFAULT 'unknown',
    engine_schema_version TEXT NOT NULL DEFAULT 'unknown',
    engine_config_fingerprint TEXT,
    engine_ruleset_version TEXT,
    engine_authored_at TEXT,
    recommended_action TEXT NOT NULL,
    recommended_strategy TEXT NOT NULL,
    confidence TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    suggested_intensity TEXT NOT NULL,
    recovery_stage TEXT NOT NULL,
    current_intervention_status TEXT,
    reason_codes_json TEXT NOT NULL DEFAULT '[]',
    supporting_signals_json TEXT NOT NULL DEFAULT '[]',
    evidence_json TEXT NOT NULL DEFAULT '[]',
    pattern_types_json TEXT NOT NULL DEFAULT '[]',
    recurring_leak_bool INTEGER NOT NULL DEFAULT 0,
    transfer_gap_bool INTEGER NOT NULL DEFAULT 0,
    acted_upon_bool INTEGER NOT NULL DEFAULT 0,
    linked_intervention_id TEXT REFERENCES coaching_interventions(id),
    source_context TEXT,
    supersedes_decision_id TEXT REFERENCES intervention_decision_snapshots(id)
  )`,

  `CREATE TABLE IF NOT EXISTS retention_schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    concept_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    linked_intervention_id TEXT REFERENCES coaching_interventions(id),
    linked_decision_snapshot_id TEXT REFERENCES intervention_decision_snapshots(id),
    recovery_stage_at_scheduling TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    result TEXT,
    supersedes_schedule_id TEXT REFERENCES retention_schedules(id),
    superseded_by_schedule_id TEXT REFERENCES retention_schedules(id),
    evidence_json TEXT NOT NULL DEFAULT '[]'
  )`,

  `CREATE TABLE IF NOT EXISTS transfer_evaluation_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    concept_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    engine_family TEXT NOT NULL DEFAULT 'transfer_evaluation',
    engine_name TEXT NOT NULL DEFAULT 'unknown',
    engine_version TEXT NOT NULL DEFAULT 'unknown',
    engine_schema_version TEXT NOT NULL DEFAULT 'unknown',
    engine_config_fingerprint TEXT,
    engine_ruleset_version TEXT,
    engine_authored_at TEXT,
    transfer_status TEXT NOT NULL,
    transfer_confidence TEXT NOT NULL,
    evidence_sufficiency TEXT NOT NULL,
    pressure TEXT NOT NULL,
    study_sample_size INTEGER NOT NULL DEFAULT 0,
    study_performance REAL,
    study_recent_average REAL,
    study_average REAL,
    study_failed_count INTEGER NOT NULL DEFAULT 0,
    real_play_performance REAL,
    real_play_occurrences INTEGER NOT NULL DEFAULT 0,
    real_play_review_spot_count INTEGER NOT NULL DEFAULT 0,
    real_play_latest_hand_at TEXT,
    study_vs_real_play_delta REAL,
    recovery_stage TEXT NOT NULL,
    retention_state TEXT,
    retention_result TEXT,
    pattern_types_json TEXT NOT NULL DEFAULT '[]',
    supporting_evidence_json TEXT NOT NULL DEFAULT '[]',
    risk_flags_json TEXT NOT NULL DEFAULT '[]',
    linked_decision_snapshot_id TEXT REFERENCES intervention_decision_snapshots(id),
    linked_retention_schedule_id TEXT REFERENCES retention_schedules(id),
    source_context TEXT,
    supersedes_snapshot_id TEXT REFERENCES transfer_evaluation_snapshots(id)
  )`,

  `CREATE TABLE IF NOT EXISTS coaching_input_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    concept_key TEXT NOT NULL,
    snapshot_type TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    engine_family TEXT NOT NULL DEFAULT 'intervention_recommendation',
    engine_name TEXT NOT NULL DEFAULT 'unknown',
    engine_version TEXT NOT NULL DEFAULT 'unknown',
    engine_schema_version TEXT NOT NULL DEFAULT 'unknown',
    engine_config_fingerprint TEXT,
    engine_ruleset_version TEXT,
    engine_authored_at TEXT,
    payload_json TEXT NOT NULL,
    recovery_stage TEXT NOT NULL,
    retention_state TEXT,
    pattern_types_json TEXT NOT NULL DEFAULT '[]',
    diagnosis_count INTEGER NOT NULL DEFAULT 0,
    intervention_count INTEGER NOT NULL DEFAULT 0,
    study_sample_size INTEGER NOT NULL DEFAULT 0,
    real_play_occurrences INTEGER NOT NULL DEFAULT 0,
    linked_decision_snapshot_id TEXT REFERENCES intervention_decision_snapshots(id),
    linked_transfer_snapshot_id TEXT REFERENCES transfer_evaluation_snapshots(id),
    source_context TEXT,
    supersedes_snapshot_id TEXT REFERENCES coaching_input_snapshots(id)
  )`,

  `CREATE TABLE IF NOT EXISTS intervention_outcomes (
    id TEXT PRIMARY KEY,
    intervention_id TEXT NOT NULL UNIQUE REFERENCES coaching_interventions(id),
    evaluation_window TEXT NOT NULL,
    pre_score REAL NOT NULL DEFAULT 0,
    post_score REAL NOT NULL DEFAULT 0,
    improved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS srs (
    drill_id TEXT PRIMARY KEY REFERENCES drills(drill_id),
    due_at TEXT NOT NULL DEFAULT (datetime('now')),
    interval_days REAL NOT NULL DEFAULT 0,
    ease REAL NOT NULL DEFAULT 2.5,
    repetitions INTEGER NOT NULL DEFAULT 0,
    last_score REAL NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )`,

  `CREATE TABLE IF NOT EXISTS hand_imports (
    import_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    total_hands INTEGER NOT NULL DEFAULT 0,
    parsed_hands INTEGER NOT NULL DEFAULT 0,
    unsupported_hands INTEGER NOT NULL DEFAULT 0,
    notes_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS imported_hands (
    imported_hand_id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL REFERENCES hand_imports(import_id),
    source_hand_id TEXT NOT NULL,
    source TEXT NOT NULL,
    parse_status TEXT NOT NULL,
    parser_version TEXT NOT NULL,
    hero_name TEXT,
    hero_position TEXT,
    played_at TEXT,
    session_label TEXT,
    stakes TEXT,
    table_name TEXT,
    effective_stack_bb REAL,
    raw_text TEXT NOT NULL,
    structured_json TEXT NOT NULL,
    concept_matches_json TEXT NOT NULL DEFAULT '[]',
    review_spots_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_drills_node ON drills(node_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_drill ON attempts(drill_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_ts ON attempts(ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_diagnoses_user_created ON coaching_diagnoses(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_diagnoses_concept ON coaching_diagnoses(user_id, concept_key, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_reflections_user_created ON coaching_reflections(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_interventions_user_status ON coaching_interventions(user_id, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_interventions_concept ON coaching_interventions(user_id, concept_key, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_intervention_decisions_concept ON intervention_decision_snapshots(user_id, concept_key, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_intervention_decisions_created ON intervention_decision_snapshots(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_retention_schedules_concept ON retention_schedules(user_id, concept_key, scheduled_for DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_retention_schedules_status ON retention_schedules(user_id, status, scheduled_for ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_transfer_snapshots_concept ON transfer_evaluation_snapshots(user_id, concept_key, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transfer_snapshots_created ON transfer_evaluation_snapshots(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_input_snapshots_concept ON coaching_input_snapshots(user_id, concept_key, snapshot_type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_input_snapshots_created ON coaching_input_snapshots(user_id, snapshot_type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_srs_due ON srs(due_at)`,
  `CREATE INDEX IF NOT EXISTS idx_hand_imports_created ON hand_imports(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_imported_hands_played ON imported_hands(played_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_imported_hands_import ON imported_hands(import_id)`,
];

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName) as { name: string } | undefined;
  return Boolean(row?.name);
}

export function runMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const migrate = db.transaction(() => {
    for (const sql of MIGRATIONS) {
      db.exec(sql);
    }

    if (!columnExists(db, "drills", "content_json")) {
      db.exec(`ALTER TABLE drills ADD COLUMN content_json TEXT NOT NULL DEFAULT '{}'`);
    }

    if (!columnExists(db, "attempts", "active_pool")) {
      db.exec("ALTER TABLE attempts ADD COLUMN active_pool TEXT");
    }
    if (!columnExists(db, "attempts", "session_id")) {
      db.exec("ALTER TABLE attempts ADD COLUMN session_id TEXT");
    }
    if (!columnExists(db, "attempts", "selected_action")) {
      db.exec("ALTER TABLE attempts ADD COLUMN selected_action TEXT");
    }
    if (!columnExists(db, "attempts", "confidence")) {
      db.exec("ALTER TABLE attempts ADD COLUMN confidence TEXT");
    }
    if (!columnExists(db, "attempts", "tags_json")) {
      db.exec("ALTER TABLE attempts ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!columnExists(db, "attempts", "reflection")) {
      db.exec("ALTER TABLE attempts ADD COLUMN reflection TEXT NOT NULL DEFAULT ''");
    }

    if (tableExists(db, "coaching_interventions")) {
      db.exec("UPDATE coaching_interventions SET status = 'in_progress' WHERE status = 'started'");
    }

    addManifestColumns(db, "intervention_decision_snapshots", "intervention_recommendation");
    addManifestColumns(db, "transfer_evaluation_snapshots", "transfer_evaluation");
    addManifestColumns(db, "coaching_input_snapshots", "intervention_recommendation");

    if (tableExists(db, "imported_hands")) {
      if (!columnExists(db, "imported_hands", "concept_matches_json")) {
        db.exec("ALTER TABLE imported_hands ADD COLUMN concept_matches_json TEXT NOT NULL DEFAULT '[]'");
      }
      if (!columnExists(db, "imported_hands", "review_spots_json")) {
        db.exec("ALTER TABLE imported_hands ADD COLUMN review_spots_json TEXT NOT NULL DEFAULT '[]'");
      }
    }
  });

  migrate();
}

function addManifestColumns(db: Database.Database, tableName: string, defaultFamily: string): void {
  if (!tableExists(db, tableName)) {
    return;
  }

  if (!columnExists(db, tableName, "engine_family")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN engine_family TEXT NOT NULL DEFAULT '${defaultFamily}'`);
  }
  if (!columnExists(db, tableName, "engine_name")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN engine_name TEXT NOT NULL DEFAULT 'unknown'`);
  }
  if (!columnExists(db, tableName, "engine_version")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN engine_version TEXT NOT NULL DEFAULT 'unknown'`);
  }
  if (!columnExists(db, tableName, "engine_schema_version")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN engine_schema_version TEXT NOT NULL DEFAULT 'unknown'`);
  }
  if (!columnExists(db, tableName, "engine_config_fingerprint")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN engine_config_fingerprint TEXT`);
  }
  if (!columnExists(db, tableName, "engine_ruleset_version")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN engine_ruleset_version TEXT`);
  }
  if (!columnExists(db, tableName, "engine_authored_at")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN engine_authored_at TEXT`);
  }
}

