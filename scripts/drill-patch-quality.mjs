import fs from "node:fs";
import path from "node:path";

const DEFAULT_TARGET = path.resolve(process.cwd(), "out", "reports", "gold-lane-reviews", "pending");
const COACHING_FIELDS = ["key_concept", "difficulty_reason", "why_preferred_line_works", "follow_up"];

const rawArgs = process.argv.slice(2);
const jsonOutput = rawArgs.includes("--json");
const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));
const targetPath = path.resolve(process.cwd(), positionalArgs[0] ?? DEFAULT_TARGET);

const files = resolveTargets(targetPath);
const reports = files.map(analyzeFile);
const totals = summarizeReports(reports);

if (jsonOutput) {
  console.log(JSON.stringify({ targetPath, totals, reports }, null, 2));
  process.exit(totals.errorCount > 0 ? 1 : 0);
}

console.log("Drill patch quality");
console.log(`Target: ${targetPath}`);
console.log(`Files checked: ${reports.length}`);
console.log(`Errors: ${totals.errorCount}`);
console.log(`Warnings: ${totals.warningCount}`);
console.log("");

for (const report of reports) {
  console.log(`${path.basename(report.file)} :: ${report.entryCount} entries`);
  if (report.errors.length === 0 && report.warnings.length === 0) {
    console.log("- clean");
    continue;
  }

  for (const error of report.errors) {
    console.log(`- ERROR [${error.kind}] ${error.message}`);
  }
  for (const warning of report.warnings) {
    console.log(`- WARN  [${warning.kind}] ${warning.message}`);
  }
  console.log("");
}

process.exit(totals.errorCount > 0 ? 1 : 0);

function resolveTargets(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Path not found: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(inputPath)
      .filter((name) => name.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => path.join(inputPath, name));
  }

  return [inputPath];
}

function analyzeFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = Array.isArray(raw) ? raw : [];
  const errors = [];
  const warnings = [];

  if (!Array.isArray(raw)) {
    errors.push({
      kind: "invalid_file_shape",
      message: "Top-level JSON must be an array.",
    });
    return { file: filePath, entryCount: 0, errors, warnings };
  }

  const exactFieldTracker = initTracker(COACHING_FIELDS);
  const abstractFieldTracker = initTracker(COACHING_FIELDS);
  const promptTracker = new Map();
  const promptTemplateTracker = new Map();

  entries.forEach((entry, index) => {
    const entryId = getEntryId(entry, index);

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push({
        kind: "invalid_entry",
        message: `${entryId}: entry must be an object`,
      });
      return;
    }

    const hasDrillShape = typeof entry.drill_id === "string" && typeof entry.prompt === "string";
    const hasPatchShape = typeof entry.drill_id === "string";
    if (!hasDrillShape && !hasPatchShape) {
      errors.push({
        kind: "missing_drill_id",
        message: `${entryId}: missing drill_id`,
      });
      return;
    }

    const coachingContext = entry.coaching_context;
    if (coachingContext && typeof coachingContext === "object" && !Array.isArray(coachingContext)) {
      for (const field of COACHING_FIELDS) {
        const value = coachingContext[field];
        if (typeof value === "string" && value.trim().length > 0) {
          trackValue(exactFieldTracker[field], value.trim(), entry.drill_id);
          trackValue(abstractFieldTracker[field], abstractText(value), entry.drill_id);
          if (value.trim().length < 40 && field !== "follow_up") {
            warnings.push({
              kind: "short_coaching_field",
              message: `${entry.drill_id}: coaching_context.${field} looks too short to teach much`,
            });
          }
        }
      }
    }

    const prompts = Array.isArray(entry.diagnostic_prompts) ? entry.diagnostic_prompts : [];
    prompts.forEach((prompt, promptIndex) => {
      if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) {
        errors.push({
          kind: "invalid_prompt",
          message: `${entry.drill_id}: diagnostic_prompts[${promptIndex}] must be an object`,
        });
        return;
      }

      if (typeof prompt.prompt === "string" && prompt.prompt.trim()) {
        trackValue(promptTracker, prompt.prompt.trim(), `${entry.drill_id}:${prompt.id ?? promptIndex}`);
        trackValue(promptTemplateTracker, abstractText(prompt.prompt), `${entry.drill_id}:${prompt.id ?? promptIndex}`);
      }

      if (typeof prompt.expected_reasoning !== "string" || prompt.expected_reasoning.trim().length < 20) {
        warnings.push({
          kind: "weak_expected_reasoning",
          message: `${entry.drill_id}: diagnostic prompt ${prompt.id ?? promptIndex} has weak expected_reasoning`,
        });
      }
    });
  });

  warnings.push(...buildDuplicateWarnings(exactFieldTracker, "exact_duplicate"));
  warnings.push(...buildDuplicateWarnings(abstractFieldTracker, "possible_template_duplicate", 3));
  warnings.push(...buildPromptWarnings(promptTracker, "exact_duplicate_prompt"));
  warnings.push(...buildPromptWarnings(promptTemplateTracker, "possible_template_prompt_duplicate", 3));

  return {
    file: filePath,
    entryCount: entries.length,
    errors,
    warnings,
  };
}

function summarizeReports(reports) {
  return reports.reduce(
    (summary, report) => {
      summary.errorCount += report.errors.length;
      summary.warningCount += report.warnings.length;
      return summary;
    },
    { errorCount: 0, warningCount: 0 },
  );
}

function initTracker(fields) {
  return Object.fromEntries(fields.map((field) => [field, new Map()]));
}

function getEntryId(entry, index) {
  return typeof entry?.drill_id === "string" ? entry.drill_id : `index ${index}`;
}

function trackValue(map, key, drillId) {
  const current = map.get(key) ?? [];
  current.push(drillId);
  map.set(key, current);
}

function buildDuplicateWarnings(trackers, kind, minCount = 2) {
  const warnings = [];

  for (const [field, tracker] of Object.entries(trackers)) {
    for (const [value, drillIds] of tracker.entries()) {
      if (drillIds.length < minCount) {
        continue;
      }
      warnings.push({
        kind,
        message: `${field} repeats across ${drillIds.length} entries (${drillIds.join(", ")}) :: "${truncate(value)}"`,
      });
    }
  }

  return warnings;
}

function buildPromptWarnings(tracker, kind, minCount = 2) {
  const warnings = [];

  for (const [value, promptIds] of tracker.entries()) {
    if (promptIds.length < minCount) {
      continue;
    }
    warnings.push({
      kind,
      message: `diagnostic prompt text repeats across ${promptIds.length} entries (${promptIds.join(", ")}) :: "${truncate(value)}"`,
    });
  }

  return warnings;
}

function abstractText(input) {
  return input
    .toLowerCase()
    .replace(/\b(btn|co|hj|lj|utg|mp|bb|sb)\b/g, "<pos>")
    .replace(/\b(preflop|flop|turn|river)\b/g, "<street>")
    .replace(/\b(pool|live pool)\s*[abc]\b/g, "<pool>")
    .replace(/\b[a2-9tjqk]{2}(?:s|o)?\b/g, "<combo>")
    .replace(/\b[2-9tjqka][shdc]\b/g, "<card>")
    .replace(/\b\d+(?:\.\d+)?(?:bb|%| percent| pct)?\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 88) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
