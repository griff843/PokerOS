import {
  getAllImportedHands,
  getRecentHandImports,
  insertHandImport,
  insertImportedHand,
  openDatabase,
  type HandImportRow,
} from "../../../../packages/db/src/index";
import {
  ImportedHandSchema,
  parseImportedHandsText,
  type ImportedHand,
  type ImportedHandSource,
} from "@poker-coach/core/browser";
import { resolveDbPath } from "./local-study-data";

export interface PersistedHandImportSummary {
  importId: string;
  source: string;
  status: HandImportRow["status"];
  totalHands: number;
  parsedHands: number;
  unsupportedHands: number;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

function resolveWritableDbPath(): string {
  return resolveDbPath() ?? ".local/coach.db";
}

export function hydrateImportedHandRow(row: {
  structured_json: string;
}): ImportedHand {
  return ImportedHandSchema.parse(JSON.parse(row.structured_json));
}

export function loadPersistedRealHands(): {
  hands: ImportedHand[];
  imports: PersistedHandImportSummary[];
} {
  const db = openDatabase(resolveWritableDbPath());
  try {
    return {
      hands: getAllImportedHands(db).map((row) => hydrateImportedHandRow(row)),
      imports: getRecentHandImports(db).map((row) => ({
        importId: row.import_id,
        source: row.source,
        status: row.status,
        totalHands: row.total_hands,
        parsedHands: row.parsed_hands,
        unsupportedHands: row.unsupported_hands,
        notes: JSON.parse(row.notes_json) as string[],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  } finally {
    db.close();
  }
}

export function persistImportedHandText(args: {
  text: string;
  source: ImportedHandSource;
  importedAt?: Date;
}) {
  const now = (args.importedAt ?? new Date()).toISOString();
  const importId = `hand-import-${now.replace(/[^0-9]/g, "").slice(0, 14)}`;
  const batch = parseImportedHandsText({ text: args.text, source: args.source, importedAt: args.importedAt });
  const parsedHands = batch.hands.filter((hand) => hand.parseStatus !== "unsupported").length;
  const unsupportedHands = batch.hands.filter((hand) => hand.parseStatus === "unsupported").length;
  const status = unsupportedHands === 0 ? "completed" : parsedHands > 0 ? "partial" : "failed";

  const db = openDatabase(resolveWritableDbPath());
  try {
    insertHandImport(db, {
      import_id: importId,
      source: args.source,
      status,
      total_hands: batch.hands.length,
      parsed_hands: parsedHands,
      unsupported_hands: unsupportedHands,
      notes_json: JSON.stringify(batch.importNotes),
      created_at: now,
      updated_at: now,
    });

    for (const hand of batch.hands) {
      insertImportedHand(db, {
        imported_hand_id: hand.importedHandId,
        import_id: importId,
        source_hand_id: hand.sourceHandId,
        source: hand.source,
        parse_status: hand.parseStatus,
        parser_version: hand.parserVersion,
        hero_name: hand.heroName ?? null,
        hero_position: hand.heroPosition ?? null,
        played_at: hand.playedAt ?? null,
        session_label: hand.sessionLabel ?? null,
        stakes: hand.stakes ?? null,
        table_name: hand.tableName ?? null,
        effective_stack_bb: hand.effectiveStackBb ?? null,
        raw_text: hand.rawText,
        structured_json: JSON.stringify(hand),
        concept_matches_json: JSON.stringify(hand.conceptMatches),
        review_spots_json: JSON.stringify(hand.reviewSpots),
        created_at: now,
      });
    }
  } finally {
    db.close();
  }

  return {
    importId,
    status,
    totalHands: batch.hands.length,
    parsedHands,
    unsupportedHands,
    notes: batch.importNotes,
    hands: batch.hands,
  };
}

