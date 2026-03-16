import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface DocDefinition {
  label: string;
  relativePath: string;
  required: boolean;
}

export interface CollectedDoc extends DocDefinition {
  absolutePath: string;
  present: boolean;
  content: string | null;
  sizeBytes: number | null;
}

export const CANONICAL_POKER_DOCS: DocDefinition[] = [
  {
    label: "Current System Status",
    relativePath: "docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md",
    required: true,
  },
  {
    label: "Project Adapter",
    relativePath: "docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md",
    required: true,
  },
  {
    label: "AI Bootstrap Readiness Checklist",
    relativePath: "docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md",
    required: true,
  },
  {
    label: "AI Skill Wave 2 Plan",
    relativePath: "docs/ai/AI_SKILL_WAVE_2_PLAN_v1.md",
    required: false,
  },
  {
    label: "Drill Schema",
    relativePath: "docs/content/DRILL_SCHEMA.md",
    required: false,
  },
];

export function collectDocs(repoRoot: string): CollectedDoc[] {
  return CANONICAL_POKER_DOCS.map((def) => {
    const absolutePath = resolve(repoRoot, def.relativePath);
    const present = existsSync(absolutePath);

    if (!present) {
      return { ...def, absolutePath, present: false, content: null, sizeBytes: null };
    }

    const content = readFileSync(absolutePath, "utf-8");
    const sizeBytes = statSync(absolutePath).size;

    return { ...def, absolutePath, present: true, content, sizeBytes };
  });
}

/**
 * Extract a top-level (##) section from markdown content by section name.
 * Returns the section text (header included) up to the next ## header, or null if not found.
 */
export function extractMarkdownSection(content: string, sectionName: string): string | null {
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === `## ${sectionName}`);
  if (startIdx === -1) return null;

  const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith("## "));
  const sectionLines = endIdx === -1 ? lines.slice(startIdx) : lines.slice(startIdx, endIdx);

  return sectionLines.join("\n").trimEnd();
}
