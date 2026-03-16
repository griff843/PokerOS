/**
 * poker-ai-refresh — Poker App OS AI truth compiler
 *
 * Reads canonical poker docs from the repo and regenerates AI-facing context
 * artifacts under out/ai/. Run via: pnpm poker:ai:refresh
 *
 * Outputs:
 *   out/ai/context/context_bundle.md       — human-readable LLM context doc
 *   out/ai/context/context_bundle.json     — machine-readable context bundle
 *   out/ai/snapshots/doc_inventory.json    — canonical doc presence/absence
 *   out/ai/snapshots/repo_snapshot.json    — key repo surface inventory
 *   out/ai/snapshots/ai_readiness.json     — readiness assessment
 */

import { resolve, relative } from "node:path";
import { collectDocs, extractMarkdownSection, type CollectedDoc } from "./lib/poker-doc-collector.ts";
import { collectRepoInventory, type RepoInventory } from "./lib/poker-repo-inventory.ts";
import { writeTextArtifact, writeJsonArtifact, type WriteResult } from "./lib/poker-artifact-writer.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReadinessStatus = "READY" | "PARTIAL" | "BLOCKED";

interface ReadinessAssessment {
  status: ReadinessStatus;
  statusDetail: string;
  requiredDocsMissing: string[];
  warnings: string[];
  blockers: string[];
}

// ─── Repo root ────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "..");

// ─── Readiness logic ─────────────────────────────────────────────────────────

function assessReadiness(docs: CollectedDoc[], inventory: RepoInventory): ReadinessAssessment {
  const missingRequired = docs.filter((d) => d.required && !d.present);
  const missingOptional = docs.filter((d) => !d.required && !d.present);

  const blockers: string[] = [];
  const warnings: string[] = [];

  const statusDocMissing = missingRequired.find((d) =>
    d.relativePath.includes("CURRENT_SYSTEM_STATUS"),
  );
  if (statusDocMissing) {
    blockers.push("CURRENT_SYSTEM_STATUS.md is missing — cannot determine current project state");
  }

  for (const doc of missingRequired) {
    if (doc.relativePath.includes("CURRENT_SYSTEM_STATUS")) continue;
    blockers.push(`Required doc missing: ${doc.relativePath}`);
  }

  for (const doc of missingOptional) {
    warnings.push(`Optional doc missing: ${doc.relativePath}`);
  }

  if (!inventory.aiOsLayer.installed) {
    warnings.push(".claude/ directory not found — AI OS layer (skills, agents, rules) may not be installed");
  }

  let status: ReadinessStatus;
  let statusDetail: string;

  if (blockers.length > 0) {
    status = "BLOCKED";
    statusDetail = `${blockers.length} blocker(s) prevent full AI operating context`;
  } else if (warnings.length > 0) {
    status = "PARTIAL";
    statusDetail = `All required docs present. ${warnings.length} warning(s) noted.`;
  } else {
    status = "READY";
    statusDetail =
      "All required docs present. AI OS layer installed. Full operating context available.";
  }

  return {
    status,
    statusDetail,
    requiredDocsMissing: missingRequired.map((d) => d.relativePath),
    warnings,
    blockers,
  };
}

// ─── Context bundle (markdown) ────────────────────────────────────────────────

function buildContextBundleMd(
  docs: CollectedDoc[],
  inventory: RepoInventory,
  readiness: ReadinessAssessment,
  generatedAt: string,
): string {
  const statusDoc = docs.find((d) => d.relativePath.includes("CURRENT_SYSTEM_STATUS"));
  const statusContent = statusDoc?.content ?? null;

  const whatIsDone = statusContent
    ? extractMarkdownSection(statusContent, "What is done")
    : "_Status doc not found._";

  const whatIsNext = statusContent
    ? extractMarkdownSection(statusContent, "What is next")
    : "_Status doc not found._";

  const activeConstraints = statusContent
    ? extractMarkdownSection(statusContent, "Active constraints")
    : "_Status doc not found._";

  const presentDocs = docs
    .filter((d) => d.present)
    .map((d) => `- \`${d.relativePath}\` — ${d.label}`)
    .join("\n");

  const missingDocs = docs
    .filter((d) => !d.present)
    .map((d) => `- \`${d.relativePath}\` — ${d.label} (${d.required ? "REQUIRED" : "optional"})`)
    .join("\n");

  const surfaceTable = inventory.surfaces
    .map((s) => `| ${s.label} | \`${s.path}\` | ${s.present ? "✓" : "✗"} |`)
    .join("\n");

  const { aiOsLayer } = inventory;

  return `# Poker Coach OS — Context Bundle

> **Generated:** ${generatedAt} (auto — run \`pnpm poker:ai:refresh\` to regenerate)
> **AI Operating Status:** **${readiness.status}** — ${readiness.statusDetail}

---

## Project Identity

**Name:** Poker Coach OS
**Domain:** Poker improvement and decision-support system
**Type:** Local-first TypeScript monorepo (pnpm + SQLite)
**Goal:** Structured, repeatable, auditable system for improving poker performance through hand review, leak detection, intervention tracking, and coaching feedback loops.

---

${whatIsDone ?? "## What is done\n\n_Could not extract from status doc._"}

---

${whatIsNext ?? "## What is next\n\n_Could not extract from status doc._"}

---

${activeConstraints ?? "## Active constraints\n\n_Could not extract from status doc._"}

---

## Key Doc Paths

| Doc | Path |
|---|---|
| Project adapter | \`docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md\` |
| Current system status | \`docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md\` |
| Drill schema | \`docs/content/DRILL_SCHEMA.md\` |
| AI readiness checklist | \`docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md\` |
| Handoff template | \`docs/ai-core/doctrine/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md\` |

---

## Canonical Docs Found

${presentDocs || "_None found._"}

${missingDocs ? `## Missing Docs\n\n${missingDocs}` : ""}

---

## Repo Surface Inventory

| Surface | Path | Present |
|---|---|---|
${surfaceTable}

---

## AI OS Layer

| Component | Status |
|---|---|
| Installed (.claude/) | ${aiOsLayer.installed ? "Yes" : "No"} |
| Skills | ${aiOsLayer.skills.length > 0 ? aiOsLayer.skills.join(", ") : "None found"} |
| Agents | ${aiOsLayer.agents.length > 0 ? aiOsLayer.agents.join(", ") : "None found"} |
| Rules | ${aiOsLayer.rules.length > 0 ? aiOsLayer.rules.join(", ") : "None found"} |

---

## Operating Rules for Architecture Sessions

- Never treat runtime truth as stable unless verified in local build
- All schema changes require migration plan
- Drill answer keys use action names (CALL/FOLD/RAISE) — not positional letters
- Classification tags use \`category:value\` format — never mix with rule tags
- Pool-variant drills require \`answer_by_pool\` — do not flatten to single answer
- Proof artifacts live in \`out/poker/sprints/<SPRINT>/\`
- Sprint closeout requires: \`pnpm test\` + \`pnpm typecheck\` + \`pnpm build:web\` + proof artifacts
- Type check command: \`pnpm typecheck\` (not \`pnpm type-check\`)

---

## How to Regenerate

\`\`\`bash
pnpm poker:ai:refresh
\`\`\`

Reads canonical docs from the repo and writes all artifacts under \`out/ai/\`.
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const generatedAt = new Date().toISOString();
  console.log("\n=== Poker App OS — AI Truth Refresh ===\n");

  // 1. Collect
  console.log("Reading canonical docs...");
  const docs = collectDocs(REPO_ROOT);

  console.log("Scanning repo inventory...");
  const inventory = collectRepoInventory(REPO_ROOT);

  // 2. Assess
  const readiness = assessReadiness(docs, inventory);

  // 3. Report what was read
  console.log("\nDoc inventory:");
  for (const doc of docs) {
    const status = doc.present ? "✓" : (doc.required ? "✗ MISSING (required)" : "- missing (optional)");
    console.log(`  ${status}  ${doc.relativePath}`);
  }

  console.log("\nRepo surfaces:");
  for (const surface of inventory.surfaces) {
    const status = surface.present ? "✓" : "✗";
    console.log(`  ${status}  ${surface.path}`);
  }

  console.log(`\nAI OS layer: ${inventory.aiOsLayer.installed ? "installed" : "NOT FOUND"}`);
  if (inventory.aiOsLayer.installed) {
    console.log(`  skills: ${inventory.aiOsLayer.skills.join(", ") || "none"}`);
    console.log(`  agents: ${inventory.aiOsLayer.agents.join(", ") || "none"}`);
    console.log(`  rules:  ${inventory.aiOsLayer.rules.join(", ") || "none"}`);
  }

  // 4. Surface blockers and warnings before writing
  if (readiness.blockers.length > 0) {
    console.log("\n[BLOCKERS]");
    for (const b of readiness.blockers) console.log(`  ✗ ${b}`);
  }
  if (readiness.warnings.length > 0) {
    console.log("\n[Warnings]");
    for (const w of readiness.warnings) console.log(`  ! ${w}`);
  }

  // Exit on blockers — do not write partial context as if it's complete
  if (readiness.status === "BLOCKED") {
    console.log(`\nStatus: BLOCKED — artifacts not written. Resolve blockers above and rerun.\n`);
    process.exit(1);
  }

  // 5. Build artifacts
  const contextBundleMd = buildContextBundleMd(docs, inventory, readiness, generatedAt);

  const contextBundleJson = {
    generated: generatedAt,
    projectName: "Poker Coach OS",
    aiOperatingStatus: readiness.status,
    statusDetail: readiness.statusDetail,
    canonicalDocsRead: docs
      .filter((d) => d.present)
      .map((d) => ({ label: d.label, path: d.relativePath, sizeBytes: d.sizeBytes })),
    missingDocs: docs
      .filter((d) => !d.present)
      .map((d) => ({ label: d.label, path: d.relativePath, required: d.required })),
    aiOsLayer: inventory.aiOsLayer,
  };

  const docInventoryJson = {
    generated: generatedAt,
    docs: docs.map((d) => ({
      label: d.label,
      path: d.relativePath,
      required: d.required,
      present: d.present,
      sizeBytes: d.sizeBytes,
    })),
    requiredPresent: docs.filter((d) => d.required && d.present).length,
    requiredMissing: docs.filter((d) => d.required && !d.present).length,
    optionalPresent: docs.filter((d) => !d.required && d.present).length,
    optionalMissing: docs.filter((d) => !d.required && !d.present).length,
  };

  const repoSnapshotJson = {
    generated: generatedAt,
    surfaces: inventory.surfaces,
    aiOsLayer: inventory.aiOsLayer,
  };

  const aiReadinessJson = {
    generated: generatedAt,
    status: readiness.status,
    statusDetail: readiness.statusDetail,
    requiredDocsMissing: readiness.requiredDocsMissing,
    warnings: readiness.warnings,
    blockers: readiness.blockers,
  };

  // 6. Write artifacts
  const OUT_BASE = resolve(REPO_ROOT, "out/ai");
  const artifacts: Array<{ label: string; result: WriteResult }> = [
    {
      label: "context_bundle.md",
      result: writeTextArtifact(`${OUT_BASE}/context/context_bundle.md`, contextBundleMd),
    },
    {
      label: "context_bundle.json",
      result: writeJsonArtifact(`${OUT_BASE}/context/context_bundle.json`, contextBundleJson),
    },
    {
      label: "doc_inventory.json",
      result: writeJsonArtifact(`${OUT_BASE}/snapshots/doc_inventory.json`, docInventoryJson),
    },
    {
      label: "repo_snapshot.json",
      result: writeJsonArtifact(`${OUT_BASE}/snapshots/repo_snapshot.json`, repoSnapshotJson),
    },
    {
      label: "ai_readiness.json",
      result: writeJsonArtifact(`${OUT_BASE}/snapshots/ai_readiness.json`, aiReadinessJson),
    },
  ];

  // 7. Report results
  console.log("\nGenerated artifacts:");
  let anyFailed = false;
  for (const { label, result } of artifacts) {
    const relPath = relative(REPO_ROOT, result.path);
    if (result.written) {
      console.log(`  ✓  ${relPath}`);
    } else {
      console.log(`  ✗  ${relPath}  ERROR: ${result.error}`);
      anyFailed = true;
    }
  }

  console.log(`\nStatus: ${readiness.status}`);
  console.log(`Detail: ${readiness.statusDetail}`);

  if (anyFailed) {
    console.log("\nOne or more artifacts failed to write. Check errors above.\n");
    process.exit(1);
  }

  console.log("\nPoker App OS AI truth bundle refreshed successfully.\n");
}

main();
