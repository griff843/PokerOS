import fs from "node:fs";
import path from "node:path";
import { readCanonicalDrillsFromDirectory } from "../../../../packages/core/src/drills";
import { openDatabase } from "../../../../packages/db/src/index";
import {
  getAllAttempts,
  getAllImportedHands,
  getAllSrs,
  getRecentHandImports,
  getUserDiagnosisHistory,
  getUserInterventionDecisionSnapshots,
  getUserInterventions,
} from "../../../../packages/db/src/repository";
import { ImportedHandSchema, type ImportedHand } from "@poker-coach/core/browser";
import { getLocalCoachingUserId } from "./coaching-memory";

export function resolveDrillsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "content", "drills"),
    path.resolve(process.cwd(), "..", "..", "content", "drills"),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ?? candidates[0];
}

export function resolveDbPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), ".local", "coach.db"),
    path.resolve(process.cwd(), "..", "..", ".local", "coach.db"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function parseImportedHand(row: { structured_json: string }): ImportedHand {
  return ImportedHandSchema.parse(JSON.parse(row.structured_json));
}

export function loadLocalStudyData() {
  const drills = readCanonicalDrillsFromDirectory(resolveDrillsDir());
  const dbPath = resolveDbPath();

  if (!dbPath) {
    return {
      drills,
      attempts: [],
      srs: [],
      importedHands: [],
      handImports: [],
      diagnoses: [],
      interventions: [],
      decisionSnapshots: [],
    };
  }

  const db = openDatabase(dbPath);
  try {
    const userId = getLocalCoachingUserId();
    return {
      drills,
      attempts: getAllAttempts(db),
      srs: getAllSrs(db),
      importedHands: getAllImportedHands(db).map((row) => parseImportedHand(row)),
      handImports: getRecentHandImports(db).map((row) => ({
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
      diagnoses: getUserDiagnosisHistory(db, userId),
      interventions: getUserInterventions(db, userId),
      decisionSnapshots: getUserInterventionDecisionSnapshots(db, userId),
    };
  } finally {
    db.close();
  }
}
