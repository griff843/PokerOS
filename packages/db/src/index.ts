import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { runMigrations } from "./migrations";

export { runMigrations } from "./migrations";
export * from "./engine-manifest";
export * from "./repository";

const DEFAULT_DB_DIR = ".local";
const DEFAULT_DB_NAME = "coach.db";

export function openDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? path.join(process.cwd(), DEFAULT_DB_DIR, DEFAULT_DB_NAME);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(resolvedPath);
  runMigrations(db);
  return db;
}

