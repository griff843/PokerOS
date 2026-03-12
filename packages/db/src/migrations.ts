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
  `CREATE INDEX IF NOT EXISTS idx_srs_due ON srs(due_at)`,
  `CREATE INDEX IF NOT EXISTS idx_hand_imports_created ON hand_imports(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_imported_hands_played ON imported_hands(played_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_imported_hands_import ON imported_hands(import_id)`,
];

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
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

    if (!columnExists(db, "imported_hands", "concept_matches_json")) {
      db.exec("ALTER TABLE imported_hands ADD COLUMN concept_matches_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!columnExists(db, "imported_hands", "review_spots_json")) {
      db.exec("ALTER TABLE imported_hands ADD COLUMN review_spots_json TEXT NOT NULL DEFAULT '[]'");
    }
  });

  migrate();
}

