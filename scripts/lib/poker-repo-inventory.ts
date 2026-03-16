import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export interface SurfaceEntry {
  label: string;
  path: string;
  present: boolean;
}

export interface AiOsLayer {
  installed: boolean;
  skills: string[];
  agents: string[];
  rules: string[];
}

export interface RepoInventory {
  surfaces: SurfaceEntry[];
  aiOsLayer: AiOsLayer;
}

const REPO_SURFACES: Array<{ label: string; relativePath: string }> = [
  { label: "CLI entry", relativePath: "apps/cli/src/index.ts" },
  { label: "Table Sim", relativePath: "apps/table-sim/src" },
  { label: "Core package", relativePath: "packages/core/src" },
  { label: "DB package", relativePath: "packages/db/src" },
  { label: "Drills API route", relativePath: "apps/table-sim/src/app/api/drills/route.ts" },
  { label: "Drill schema doc", relativePath: "docs/content/DRILL_SCHEMA.md" },
  { label: "Architecture map", relativePath: "docs/poker-coach-os/ARCHITECTURE_MAP.md" },
  { label: "Status doc", relativePath: "docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md" },
  { label: "AI adapter", relativePath: "docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md" },
];

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function listDirectories(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export function collectRepoInventory(repoRoot: string): RepoInventory {
  const surfaces: SurfaceEntry[] = REPO_SURFACES.map(({ label, relativePath }) => ({
    label,
    path: relativePath,
    present: existsSync(resolve(repoRoot, relativePath)),
  }));

  const claudeDir = resolve(repoRoot, ".claude");
  const installed = existsSync(claudeDir);

  const skills = listDirectories(resolve(claudeDir, "skills"));
  const agents = listMarkdownFiles(resolve(claudeDir, "agents"));
  const rules = listMarkdownFiles(resolve(claudeDir, "rules"));

  return {
    surfaces,
    aiOsLayer: { installed, skills, agents, rules },
  };
}
