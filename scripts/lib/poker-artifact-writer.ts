import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface WriteResult {
  path: string;
  written: boolean;
  error?: string;
}

export function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function writeTextArtifact(filePath: string, content: string): WriteResult {
  try {
    ensureDir(filePath);
    writeFileSync(filePath, content, "utf-8");
    return { path: filePath, written: true };
  } catch (err) {
    return { path: filePath, written: false, error: String(err) };
  }
}

export function writeJsonArtifact(filePath: string, data: unknown): WriteResult {
  return writeTextArtifact(filePath, JSON.stringify(data, null, 2) + "\n");
}
