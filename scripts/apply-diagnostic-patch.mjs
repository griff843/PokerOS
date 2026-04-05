import fs from "node:fs";
import path from "node:path";
import { validateDiagnosticPatchFile, summarizeDiagnosticPatch } from "./validate-gold-lane.mjs";

function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetPath = path.resolve(process.cwd(), options.target);
  const patchPath = path.resolve(process.cwd(), options.patch);

  if (!fs.existsSync(targetPath)) {
    fail(`Target drill file not found: ${targetPath}`);
  }
  if (!fs.existsSync(patchPath)) {
    fail(`Patch file not found: ${patchPath}`);
  }

  const patchEntries = readJsonArray(patchPath, "patch");
  const patchValidation = validateDiagnosticPatchFile(patchEntries, patchPath);
  if (!patchValidation.ok) {
    failWithErrors("Patch file failed diagnostic-patch validation", patchValidation.errors);
  }

  const drills = readJsonArray(targetPath, "target");
  const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
  const patchIds = new Set();
  const missingInTarget = [];

  for (const entry of patchEntries) {
    patchIds.add(entry.drill_id);
    if (!drillMap.has(entry.drill_id)) {
      missingInTarget.push(entry.drill_id);
    }
  }

  if (missingInTarget.length > 0) {
    fail(`Patch references drill_ids not found in target file: ${missingInTarget.join(", ")}`);
  }

  const duplicateCoverage = findDuplicatePromptIds(patchEntries);
  if (duplicateCoverage.length > 0) {
    fail(`Patch contains duplicate diagnostic prompt ids within the same drill: ${duplicateCoverage.join(", ")}`);
  }

  const untouchedDrills = drills.filter((drill) => !patchIds.has(drill.drill_id)).length;
  const updated = drills.map((drill) => {
    const patchEntry = patchEntries.find((entry) => entry.drill_id === drill.drill_id);
    if (!patchEntry) {
      return drill;
    }

    return {
      ...drill,
      diagnostic_prompts: patchEntry.diagnostic_prompts,
    };
  });

  const summary = {
    targetPath,
    patchPath,
    apply: options.apply,
    targetDrills: drills.length,
    patchedDrills: patchEntries.length,
    untouchedDrills,
    patchSummary: summarizeDiagnosticPatch(patchEntries),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!options.apply) {
    console.log("\nDry run only. Re-run with --apply to write the diagnostic prompts into the target drill file.");
    return;
  }

  fs.writeFileSync(targetPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`\nApplied ${patchEntries.length} diagnostic prompt patches to ${targetPath}`);
}

function parseArgs(args) {
  const options = {
    target: "",
    patch: "",
    apply: false,
  };

  for (const arg of args) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
      continue;
    }
    if (arg.startsWith("--patch=")) {
      options.patch = arg.slice("--patch=".length);
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  if (!options.target) {
    fail("Missing required argument: --target=<content-drill-file>");
  }
  if (!options.patch) {
    fail("Missing required argument: --patch=<diagnostic-patch-file>");
  }

  return options;
}

function readJsonArray(filePath, label) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Could not parse ${label} JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    fail(`${label} file must contain a JSON array: ${filePath}`);
  }

  return parsed;
}

function findDuplicatePromptIds(entries) {
  const duplicates = [];
  for (const entry of entries) {
    const ids = new Set();
    for (const prompt of entry.diagnostic_prompts ?? []) {
      if (ids.has(prompt.id)) {
        duplicates.push(`${entry.drill_id}:${prompt.id}`);
      }
      ids.add(prompt.id);
    }
  }
  return duplicates;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function failWithErrors(message, errors) {
  console.error(`${message}:\n`);
  for (const error of errors) {
    console.error(`- ${error.message}`);
  }
  process.exit(1);
}

main();
