import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateGoldLane, summarize } from "./validate-gold-lane.mjs";

function main() {
  const options = parseArgs(process.argv.slice(2));
  const mainPath = path.resolve(process.cwd(), options.main);
  const batchPath = path.resolve(process.cwd(), options.batch);
  const reportPath = resolveReportPath(options.report, batchPath);

  if (!fs.existsSync(mainPath)) {
    fail(`Main gold lane file not found: ${mainPath}`, reportPath, {
      status: "failed",
      dryRun: !options.apply,
      mainPath,
      batchPath,
      errors: [`Main gold lane file not found: ${mainPath}`],
    });
  }
  if (!fs.existsSync(batchPath)) {
    fail(`Batch file not found: ${batchPath}`, reportPath, {
      status: "failed",
      dryRun: !options.apply,
      mainPath,
      batchPath,
      errors: [`Batch file not found: ${batchPath}`],
    });
  }

  const mainDrills = readJsonArray(mainPath, "main");
  const batchDrills = readJsonArray(batchPath, "batch");
  const semantic = analyzeSemanticQuality(batchDrills);
  const canonicalBatch = runCanonicalValidationForPath(batchPath);

  if (!canonicalBatch.ok) {
    failWithErrors("Batch failed canonical schema validation", formatCanonicalErrors(canonicalBatch.errors), reportPath, {
      status: "failed",
      dryRun: !options.apply,
      mainPath,
      batchPath,
      main: summarize(mainDrills),
      batch: summarize(batchDrills),
      semantic: null,
      canonical: {
        batch: canonicalBatch,
      },
    });
  }

  const batchValidation = validateGoldLane(batchDrills, batchPath, "batch");
  if (!batchValidation.ok) {
    failWithErrors("Batch validation failed", batchValidation.errors, reportPath, {
      status: "failed",
      dryRun: !options.apply,
      mainPath,
      batchPath,
      main: summarize(mainDrills),
      batch: summarize(batchDrills),
      semantic,
    });
  }

  const overlapErrors = findOverlapErrors(mainDrills, batchDrills, path.basename(batchPath));
  if (overlapErrors.length > 0) {
    failWithErrors("Batch conflicts with the existing gold lane", overlapErrors, reportPath, {
      status: "failed",
      dryRun: !options.apply,
      mainPath,
      batchPath,
      main: summarize(mainDrills),
      batch: summarize(batchDrills),
      semantic,
    });
  }

  const merged = [...mainDrills, ...batchDrills];
  const canonicalMerged = runCanonicalValidationForData(merged, batchPath);
  if (!canonicalMerged.ok) {
    failWithErrors("Merged gold lane failed canonical schema validation", formatCanonicalErrors(canonicalMerged.errors), reportPath, {
      status: "failed",
      dryRun: !options.apply,
      mainPath,
      batchPath,
      main: summarize(mainDrills),
      batch: summarize(batchDrills),
      merged: summarize(merged),
      semantic: null,
      canonical: {
        batch: canonicalBatch,
        merged: canonicalMerged,
      },
    });
  }

  const mergedValidation = validateGoldLane(merged, mainPath, "seed");
  if (!mergedValidation.ok) {
    failWithErrors("Merged gold lane failed validation", mergedValidation.errors, reportPath, {
      status: "failed",
      dryRun: !options.apply,
      mainPath,
      batchPath,
      main: summarize(mainDrills),
      batch: summarize(batchDrills),
      merged: summarize(merged),
      semantic,
    });
  }

  const review = {
    status: "passed",
    dryRun: !options.apply,
    mainPath,
    batchPath,
    reportPath,
    outputPath: options.apply ? mainPath : null,
    main: summarize(mainDrills),
    batch: summarize(batchDrills),
    merged: summarize(merged),
    semantic,
    canonical: {
      batch: canonicalBatch,
      merged: canonicalMerged,
    },
    decision: buildDecisionRecord({
      errors: [],
      semantic,
      apply: options.apply,
      manualDecision: options.decision,
      manualNotes: options.decisionNotes,
    }),
  };

  writeReviewReport(reportPath, review);

  console.log("Gold lane batch review passed.");
  console.log(JSON.stringify(review, null, 2));
  console.log(`Report written to: ${reportPath}`);

  if (!options.apply) {
    console.log("\nDry run only. Re-run with --apply to merge this batch into the main gold lane.");
    return;
  }

  fs.writeFileSync(mainPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`\nMerged ${batchDrills.length} drills into ${mainPath}`);
}

function parseArgs(rawArgs) {
  const options = {
    main: "content/drills/live_cash_gold_btn_bb_river.json",
    batch: "",
    apply: false,
    report: "",
    decision: "",
    decisionNotes: "",
  };

  for (const arg of rawArgs) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg.startsWith("--main=")) {
      options.main = arg.slice("--main=".length);
      continue;
    }
    if (arg.startsWith("--batch=")) {
      options.batch = arg.slice("--batch=".length);
      continue;
    }
    if (arg.startsWith("--report=")) {
      options.report = arg.slice("--report=".length);
      continue;
    }
    if (arg.startsWith("--decision=")) {
      options.decision = arg.slice("--decision=".length);
      continue;
    }
    if (arg.startsWith("--decision-notes=")) {
      options.decisionNotes = arg.slice("--decision-notes=".length);
      continue;
    }
    fail(`Unknown argument: ${arg}`, null, {
      status: "failed",
      dryRun: !options.apply,
      errors: [`Unknown argument: ${arg}`],
    });
  }

  if (!options.batch) {
    fail("Missing required argument: --batch=<path-to-batch-json>", null, {
      status: "failed",
      dryRun: !options.apply,
      errors: ["Missing required argument: --batch=<path-to-batch-json>"],
    });
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

function findOverlapErrors(mainDrills, batchDrills, batchName) {
  const errors = [];
  const mainIds = new Set(mainDrills.map((drill) => drill.drill_id));
  const batchIds = new Set();

  for (const drill of batchDrills) {
    if (batchIds.has(drill.drill_id)) {
      errors.push(`${drill.drill_id}: duplicate drill_id inside ${batchName}`);
    }
    batchIds.add(drill.drill_id);

    if (mainIds.has(drill.drill_id)) {
      errors.push(`${drill.drill_id}: drill_id already exists in the main gold lane`);
    }
  }

  return errors;
}

function resolveReportPath(reportArg, batchPath) {
  if (reportArg) {
    return path.resolve(process.cwd(), reportArg);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const batchBase = path.basename(batchPath, path.extname(batchPath));
  return path.resolve(process.cwd(), "out", "reports", "gold-lane-reviews", `${timestamp}_${batchBase}.md`);
}

function writeReviewReport(reportPath, review) {
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, renderReviewReport(review), "utf8");
}

function renderReviewReport(review) {
  const lines = [
    "# Gold Lane Batch Review",
    "",
    `- Status: ${review.status}`,
    `- Dry run: ${review.dryRun ? "yes" : "no"}`,
    review.mainPath ? `- Main lane: ${review.mainPath}` : null,
    review.batchPath ? `- Batch: ${review.batchPath}` : null,
    review.outputPath ? `- Output: ${review.outputPath}` : null,
    review.reportPath ? `- Report: ${review.reportPath}` : null,
    "",
  ].filter(Boolean);

  if (review.main) {
    lines.push("## Main Lane Summary", "", "```json", JSON.stringify(review.main, null, 2), "```", "");
  }
  if (review.batch) {
    lines.push("## Batch Summary", "", "```json", JSON.stringify(review.batch, null, 2), "```", "");
  }
  if (review.canonical) {
    lines.push("## Canonical Validation", "");
    if (review.canonical.batch) {
      lines.push("### Batch File", "", "```json", JSON.stringify(summarizeCanonicalResult(review.canonical.batch), null, 2), "```", "");
    }
    if (review.canonical.merged) {
      lines.push("### Merged Result", "", "```json", JSON.stringify(summarizeCanonicalResult(review.canonical.merged), null, 2), "```", "");
    }
  }
  if (review.merged) {
    lines.push("## Merged Summary", "", "```json", JSON.stringify(review.merged, null, 2), "```", "");
  }
  if (review.decision) {
    lines.push("## Editorial Decision", "");
    lines.push(`- Recommended: ${review.decision.recommended}`);
    lines.push(`- Final: ${review.decision.final}`);
    lines.push(`- Reason: ${review.decision.reason}`);
    if (review.decision.notes) {
      lines.push(`- Notes: ${review.decision.notes}`);
    }
    lines.push("");
    lines.push("Decision checklist:");
    lines.push(`- [ ] ACCEPT`);
    lines.push(`- [ ] NEEDS_REWRITE`);
    lines.push(`- [ ] REJECT`);
    lines.push("");
  }
  if (review.semantic) {
    lines.push("## Semantic Review Signals", "", "```json", JSON.stringify(review.semantic.summary, null, 2), "```", "");

    if (review.semantic.softFlags.length > 0) {
      lines.push("## Soft Flags", "");
      for (const flag of review.semantic.softFlags) {
        lines.push(`- ${flag}`);
      }
      lines.push("");
    }

    lines.push("## Reviewer Checklist", "");
    for (const item of review.semantic.checklist) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push("");

    if (review.semantic.spotChecks.length > 0) {
      lines.push("## Spot Check Candidates", "");
      for (const item of review.semantic.spotChecks) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }
  }
  if (review.errors?.length) {
    lines.push("## Errors", "");
    for (const error of review.errors) {
      lines.push(`- ${error}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runCanonicalValidationForPath(filePath) {
  return runCanonicalValidation([filePath]);
}

function runCanonicalValidationForData(drills, contextPath) {
  const tempFile = path.join(os.tmpdir(), `gold-lane-canonical-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tempFile, `${JSON.stringify(drills, null, 2)}\n`, "utf8");

  try {
    return runCanonicalValidation([tempFile]);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

function runCanonicalValidation(args) {
  const commandArgs = ["exec", "tsx", "scripts/validate-canonical-drills.ts", "--json", ...args];
  const result = spawnSync("pnpm", commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  const rawOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const parsed = tryParseCanonicalOutput(rawOutput);

  if (parsed) {
    return parsed;
  }

  return {
    ok: false,
    rootPath: args[0] ?? "",
    files: args,
    summary: { filesChecked: 0, drillsParsed: 0, errors: 1 },
    errors: [{
      filePath: args[0] ?? "",
      code: "validator_process_error",
      message: rawOutput || `Canonical validator exited with code ${result.status ?? "unknown"}.`,
      path: ["process"],
    }],
  };
}

function tryParseCanonicalOutput(rawOutput) {
  if (!rawOutput) {
    return null;
  }

  const start = rawOutput.indexOf("{");
  if (start === -1) {
    return null;
  }

  try {
    return JSON.parse(rawOutput.slice(start));
  } catch {
    return null;
  }
}

function formatCanonicalErrors(errors) {
  return errors.map((error) => {
    const location = Array.isArray(error.path) && error.path.length > 0
      ? error.path.map(String).join(".")
      : "file";
    return `${path.basename(error.filePath)} ${location}: ${error.message}`;
  });
}

function summarizeCanonicalResult(result) {
  return {
    ok: result.ok,
    rootPath: result.rootPath,
    files: result.files,
    summary: result.summary,
    errors: result.errors?.length ?? 0,
  };
}

function buildDecisionRecord({ errors, semantic, apply, manualDecision, manualNotes }) {
  const normalizedManual = normalizeDecision(manualDecision);
  const recommended = getRecommendedDecision(errors, semantic, apply);
  const final = normalizedManual ?? recommended;
  const reason = normalizedManual
    ? `Manual reviewer override from CLI`
    : getDecisionReason(recommended, errors, semantic, apply);

  return {
    recommended,
    final,
    reason,
    notes: manualNotes || "",
  };
}

function normalizeDecision(value) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "accepted" || normalized === "accept") {
    return "ACCEPT";
  }
  if (normalized === "needs_rewrite" || normalized === "needs-rewrite" || normalized === "rewrite") {
    return "NEEDS_REWRITE";
  }
  if (normalized === "rejected" || normalized === "reject") {
    return "REJECT";
  }

  fail(`Unknown decision value: ${value}. Use accept, needs_rewrite, or reject.`);
}

function getRecommendedDecision(errors, semantic, apply) {
  if (errors.length > 0) {
    return "REJECT";
  }
  if (apply) {
    return "ACCEPT";
  }
  if ((semantic?.softFlags.length ?? 0) > 0 || (semantic?.spotChecks.length ?? 0) > 0) {
    return "NEEDS_REWRITE";
  }
  return "ACCEPT";
}

function getDecisionReason(recommended, errors, semantic, apply) {
  if (recommended === "REJECT") {
    return errors.length > 0
      ? "Hard validation or merge conflicts are present."
      : "The batch is not ready for merge.";
  }
  if (recommended === "NEEDS_REWRITE") {
    const flagCount = (semantic?.softFlags.length ?? 0) + (semantic?.spotChecks.length ?? 0);
    return `The batch clears hard gates but still has ${flagCount} semantic review signal(s) worth fixing before merge.`;
  }
  return apply
    ? "The batch passed review and was merged into the main gold lane."
    : "The batch passed hard checks and has no current semantic blockers.";
}

function analyzeSemanticQuality(drills) {
  const summary = {
    withStreetShiftNotes: countBy(drills, (drill) => (drill.coaching_context?.what_changed_by_street?.length ?? 0) > 0),
    withCommonMistakes: countBy(drills, (drill) =>
      Boolean(drill.coaching_context?.common_mistake) || (drill.coaching_context?.common_mistakes?.length ?? 0) > 0),
    withFollowUp: countBy(drills, (drill) => Boolean(drill.coaching_context?.follow_up)),
    withPoolVariants: countBy(drills, (drill) => Boolean(drill.answer_by_pool)),
    withMeaningfulPoolShifts: countBy(drills, hasMeaningfulPoolShift),
    withThresholdNotes: countBy(drills, (drill) => (drill.coaching_context?.range_support?.threshold_notes?.length ?? 0) > 0),
    withBlockerNotes: countBy(drills, (drill) => (drill.coaching_context?.range_support?.blocker_notes?.length ?? 0) > 0),
    avgAnswerExplanationChars: average(drills.map((drill) => (drill.answer?.explanation ?? "").length)),
    avgRangeSections: average(drills.map(countRangeSections)),
  };

  const softFlags = [];
  const spotChecks = [];

  for (const drill of drills) {
    const flags = [];
    const label = `${drill.drill_id} (${drill.title})`;

    if ((drill.coaching_context?.what_changed_by_street?.length ?? 0) === 0) {
      flags.push("missing street-shift notes");
    }
    if (!drill.coaching_context?.follow_up) {
      flags.push("missing follow-up concept");
    }
    if (!hasMeaningfulPoolShift(drill) && drill.answer_by_pool) {
      flags.push("pool variants present but action never changes");
    }
    if ((drill.answer?.explanation ?? "").length < 260) {
      flags.push("baseline explanation is short");
    }
    if (countRangeSections(drill) < 2) {
      flags.push("thin range bucket structure");
    }
    if ((drill.coaching_context?.range_support?.threshold_notes?.length ?? 0) === 0) {
      flags.push("missing threshold notes");
    }

    if (flags.length > 0) {
      softFlags.push(`${label}: ${flags.join(", ")}`);
    }

    const spotCheckScore =
      ((drill.answer?.explanation ?? "").length < 260 ? 1 : 0) +
      ((drill.coaching_context?.what_changed_by_street?.length ?? 0) === 0 ? 1 : 0) +
      (!hasMeaningfulPoolShift(drill) && drill.answer_by_pool ? 1 : 0) +
      (countRangeSections(drill) < 2 ? 1 : 0);

    if (spotCheckScore >= 2) {
      spotChecks.push(`${label}: review for strategic thinness before merge`);
    }
  }

  const checklist = [
    "At least 3 drills were read end-to-end for actual threshold logic, not just schema correctness.",
    "Explanations identify which value hands survive the line and which bluffs still arrive by river.",
    "Turn-action logic is specific about what got removed or preserved, not generic 'line got weaker/stronger' prose.",
    "Pool variants only appear where the action or practical threshold meaningfully shifts.",
    "Blocker analysis points in the correct direction and does not confuse blocking bluffs with blocking value.",
    "Kicker-quality drills actually explain why the combo crosses threshold rather than relying on hand labels like 'top pair' or 'trips'.",
    "Multi-step drills have a real setup decision on the turn and are not just two loosely connected quiz cards.",
    "No obvious card-swap clones are present where the teaching point is materially unchanged.",
  ];

  return {
    summary,
    softFlags,
    spotChecks,
    checklist,
  };
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(1));
}

function countRangeSections(drill) {
  const support = drill.coaching_context?.range_support;
  return [
    support?.value_buckets,
    support?.bluff_buckets,
    support?.bluff_catchers,
    support?.combo_groups,
  ].filter((section) => (section?.length ?? 0) > 0).length;
}

function hasMeaningfulPoolShift(drill) {
  const baseline = drill.answer?.correct;
  if (!drill.answer_by_pool) {
    return false;
  }

  return Object.values(drill.answer_by_pool).some((poolAnswer) => poolAnswer?.correct && poolAnswer.correct !== baseline);
}

function fail(message, reportPath = null, review = null) {
  if (reportPath && review) {
    const completeReview = {
      ...review,
      reportPath,
      decision: review.decision ?? buildDecisionRecord({
        errors: review.errors ?? [message],
        semantic: review.semantic,
        apply: false,
        manualDecision: null,
        manualNotes: "",
      }),
    };
    writeReviewReport(reportPath, {
      ...completeReview,
    });
    console.error(`Report written to: ${reportPath}\n`);
  }
  console.error(message);
  process.exit(1);
}

function failWithErrors(message, errors, reportPath = null, review = null) {
  if (reportPath && review) {
    const completeReview = {
      ...review,
      reportPath,
      errors,
      decision: review.decision ?? buildDecisionRecord({
        errors,
        semantic: review.semantic,
        apply: false,
        manualDecision: null,
        manualNotes: "",
      }),
    };
    writeReviewReport(reportPath, {
      ...completeReview,
    });
    console.error(`Report written to: ${reportPath}\n`);
  }
  console.error(`${message}:\n`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

main();
