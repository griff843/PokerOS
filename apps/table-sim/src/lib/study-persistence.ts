import { getAttempt, getAllAttempts, openDatabase, updateAttemptRecord } from "../../../../packages/db/src/index";
import { insertAttempt, type AttemptRow } from "../../../../packages/db/src/repository";
import { resolveDbPath } from "./local-study-data";
import { toAttemptInsertRow, type PersistedAttemptRecord, type StoredAttemptPayload } from "./study-attempts";

function resolveWritableDbPath(): string {
  return resolveDbPath() ?? ".local/coach.db";
}

export function persistAttempt(record: PersistedAttemptRecord): void {
  const db = openDatabase(resolveWritableDbPath());
  try {
    insertAttempt(db, toAttemptInsertRow(record));
  } finally {
    db.close();
  }
}

export function persistAttemptPatch(args: { attemptId: string; reflection?: string; payload?: StoredAttemptPayload }): AttemptRow | undefined {
  const db = openDatabase(resolveWritableDbPath());
  try {
    updateAttemptRecord(db, args.attemptId, {
      reflection: args.reflection,
      user_answer_json: args.payload ? JSON.stringify(args.payload) : undefined,
    });
    return getAttempt(db, args.attemptId);
  } finally {
    db.close();
  }
}

export function loadPersistedAttempts(): AttemptRow[] {
  const db = openDatabase(resolveWritableDbPath());
  try {
    return getAllAttempts(db);
  } finally {
    db.close();
  }
}

