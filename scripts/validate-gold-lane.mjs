import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_NODES = new Set(["bluff_catch_01", "bluff_catch_02"]);
const VALID_SOURCES = new Set(["manual", "ai_generated", "session_import", "solver"]);
const VALID_DIAGNOSTIC_TYPES = new Set([
  "line_understanding",
  "threshold",
  "range_construction",
  "blocker",
  "pool_assumption",
  "street_shift",
  "mix_reasoning",
]);
const VALID_DIAGNOSES = new Set([
  "line_misunderstanding",
  "threshold_error",
  "range_construction_error",
  "blocker_blindness",
  "pool_assumption_error",
  "confidence_miscalibration",
]);
const MODES = {
  seed: {
    node1: 4,
    node2: 2,
    withSteps: 1,
    paired: 1,
    scareAce: 1,
    overbet: 1,
    blockerSensitive: 1,
  },
  batch: {
    node1: 4,
    node2: 4,
    withSteps: 2,
    paired: 3,
    scareAce: 3,
    overbet: 3,
    blockerSensitive: 3,
  },
};

export function main() {
  const rawArgs = process.argv.slice(2);
  const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));
  const modeArg = rawArgs.find((arg) => arg.startsWith("--mode="));
  const jsonOutput = rawArgs.includes("--json");
  const mode = modeArg ? modeArg.split("=")[1] : "batch";
  if (!(mode in MODES)) {
    emitFailure({
      jsonOutput,
      mode,
      filePath: null,
      errors: [
        {
          code: "invalid_mode",
          message: `Unknown mode: ${mode}`,
          path: ["mode"],
          scope: "file",
        },
      ],
    });
    process.exit(1);
  }

  const input = positionalArgs[0] ?? "content/drills/live_cash_gold_btn_bb_river.json";
  const filePath = path.resolve(process.cwd(), input);

  if (!fs.existsSync(filePath)) {
    emitFailure({
      jsonOutput,
      mode,
      filePath,
      errors: [
        {
          code: "missing_file",
          message: `Gold lane file not found: ${filePath}`,
          path: ["file"],
          scope: "file",
        },
      ],
    });
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const result = validateGoldLane(raw, filePath, mode);

  if (!result.ok) {
    emitFailure({
      jsonOutput,
      mode,
      filePath,
      errors: result.errors,
      summary: Array.isArray(raw) ? summarize(raw) : undefined,
    });
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      ok: true,
      mode,
      filePath,
      summary: summarize(raw),
      errors: [],
    }, null, 2));
    return;
  }

  console.log("Gold lane validation passed.");
  console.log(`Mode: ${mode}`);
  console.log(JSON.stringify(summarize(raw), null, 2));
}

export function validateGoldLane(drills, filePath, mode) {
  const errors = [];
  const targets = MODES[mode];

  if (!Array.isArray(drills) || drills.length === 0) {
    pushError(errors, {
      code: "empty_batch",
      message: `${path.basename(filePath)} did not contain any drills.`,
      path: ["file"],
      scope: "file",
    });
    return { ok: false, errors };
  }

  const ids = new Set();
  const categoryCounts = {
    paired: 0,
    scareAce: 0,
    overbet: 0,
    blockerSensitive: 0,
  };

  drills.forEach((drill, index) => {
    const label = drill.drill_id || `index ${index}`;
    const basePath = [index];

    if (ids.has(drill.drill_id)) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "duplicate_drill_id",
        message: `${label}: duplicate drill_id`,
        path: [...basePath, "drill_id"],
        scope: "drill",
      });
    }
    ids.add(drill.drill_id);

    if (!EXPECTED_NODES.has(drill.node_id)) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "invalid_node_id",
        message: `${label}: node_id must stay inside bluff_catch_01 / bluff_catch_02`,
        path: [...basePath, "node_id"],
        scope: "drill",
      });
    }

    if (drill.scenario?.pot_type !== "SRP") {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "invalid_pot_type",
        message: `${label}: pot_type must remain SRP`,
        path: [...basePath, "scenario", "pot_type"],
        scope: "drill",
      });
    }

    if (drill.scenario?.street !== "river") {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "invalid_street",
        message: `${label}: scenario.street must remain river`,
        path: [...basePath, "scenario", "street"],
        scope: "drill",
      });
    }

    if (!(drill.scenario?.hero_position === "BB" && drill.scenario?.villain_position === "BTN")) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "invalid_positions",
        message: `${label}: lane must remain BB vs BTN`,
        path: [...basePath, "scenario"],
        scope: "drill",
      });
    }

    if (!Array.isArray(drill.scenario?.action_history) || drill.scenario.action_history.length === 0) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "missing_action_history",
        message: `${label}: scenario.action_history is required`,
        path: [...basePath, "scenario", "action_history"],
        scope: "drill",
      });
    }

    if (!Array.isArray(drill.diagnostic_prompts) || drill.diagnostic_prompts.length === 0) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "missing_diagnostic_prompts",
        message: `${label}: diagnostic_prompts are required`,
        path: [...basePath, "diagnostic_prompts"],
        scope: "drill",
      });
    }

    if (!drill.coaching_context?.range_support) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "missing_range_support",
        message: `${label}: coaching_context.range_support is required`,
        path: [...basePath, "coaching_context", "range_support"],
        scope: "drill",
      });
    } else {
      validateRangeSupport(errors, drill, basePath);
    }

    if (drill.metadata?.source && !VALID_SOURCES.has(drill.metadata.source)) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "invalid_metadata_source",
        message: `${label}: metadata.source must be a canonical source enum`,
        path: [...basePath, "metadata", "source"],
        scope: "drill",
      });
    }

    for (const [promptIndex, prompt] of (drill.diagnostic_prompts ?? []).entries()) {
      if (!VALID_DIAGNOSTIC_TYPES.has(prompt.type)) {
        pushError(errors, {
          drillId: drill.drill_id,
          code: "invalid_diagnostic_type",
          message: `${label}: diagnostic prompt ${prompt.id} uses invalid type "${prompt.type}"`,
          path: [...basePath, "diagnostic_prompts", promptIndex, "type"],
          scope: "prompt",
          promptId: prompt.id,
        });
      }

      for (const [optionIndex, option] of (prompt.options ?? []).entries()) {
        if (option.diagnosis && !VALID_DIAGNOSES.has(option.diagnosis)) {
          pushError(errors, {
            drillId: drill.drill_id,
            code: "invalid_diagnosis",
            message: `${label}: diagnostic prompt ${prompt.id} option ${option.id} uses invalid diagnosis "${option.diagnosis}"`,
            path: [...basePath, "diagnostic_prompts", promptIndex, "options", optionIndex, "diagnosis"],
            scope: "prompt_option",
            promptId: prompt.id,
            optionId: option.id,
          });
        }
      }
    }

    validateSteps(errors, drill, basePath);

    const tags = new Set([...(drill.answer?.required_tags ?? []), ...(drill.tags ?? [])]);
    if (tags.has("paired_top_river") || (drill.tags ?? []).includes("board:paired")) {
      categoryCounts.paired += 1;
    }
    if (tags.has("scare_river_ace") || (drill.tags ?? []).includes("board:ace_scare")) {
      categoryCounts.scareAce += 1;
    }
    if (tags.has("overbluff_punish") || (drill.tags ?? []).includes("board:brick_river")) {
      categoryCounts.overbet += 1;
    }
    if (tags.has("blocker_effect") || (drill.tags ?? []).includes("board:four_liner")) {
      categoryCounts.blockerSensitive += 1;
    }
  });

  if (drills.filter((drill) => drill.node_id === "bluff_catch_01").length < targets.node1) {
    pushError(errors, {
      code: "insufficient_node1",
      message: `Need at least ${targets.node1} drills on bluff_catch_01.`,
      path: ["summary", "node1"],
      scope: "summary",
    });
  }

  if (drills.filter((drill) => drill.node_id === "bluff_catch_02").length < targets.node2) {
    pushError(errors, {
      code: "insufficient_node2",
      message: `Need at least ${targets.node2} drills on bluff_catch_02.`,
      path: ["summary", "node2"],
      scope: "summary",
    });
  }

  if (drills.filter((drill) => Array.isArray(drill.steps) && drill.steps.length > 0).length < targets.withSteps) {
    pushError(errors, {
      code: "insufficient_steps",
      message: `Need at least ${targets.withSteps} drills with multi-step sequences.`,
      path: ["summary", "withSteps"],
      scope: "summary",
    });
  }

  if (categoryCounts.paired < targets.paired) {
    pushError(errors, {
      code: "insufficient_paired",
      message: `Need at least ${targets.paired} paired-top river spots; found ${categoryCounts.paired}.`,
      path: ["summary", "paired"],
      scope: "summary",
    });
  }

  if (categoryCounts.scareAce < targets.scareAce) {
    pushError(errors, {
      code: "insufficient_scare_ace",
      message: `Need at least ${targets.scareAce} scare-ace spots; found ${categoryCounts.scareAce}.`,
      path: ["summary", "scareAce"],
      scope: "summary",
    });
  }

  if (categoryCounts.overbet < targets.overbet) {
    pushError(errors, {
      code: "insufficient_overbet",
      message: `Need at least ${targets.overbet} overbet or polar-defense spots; found ${categoryCounts.overbet}.`,
      path: ["summary", "overbet"],
      scope: "summary",
    });
  }

  if (categoryCounts.blockerSensitive < targets.blockerSensitive) {
    pushError(errors, {
      code: "insufficient_blocker_sensitive",
      message: `Need at least ${targets.blockerSensitive} blocker-sensitive spots; found ${categoryCounts.blockerSensitive}.`,
      path: ["summary", "blockerSensitive"],
      scope: "summary",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateRangeSupport(errors, drill, basePath) {
  const label = drill.drill_id || `index ${basePath[0]}`;
  const rangeSupport = drill.coaching_context?.range_support;
  for (const bucketKey of ["value_buckets", "bluff_buckets", "bluff_catchers", "combo_groups"]) {
    const buckets = rangeSupport?.[bucketKey];
    if (!Array.isArray(buckets)) continue;
    for (const [bucketIndex, bucket] of buckets.entries()) {
      if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) {
        pushError(errors, {
          drillId: drill.drill_id,
          code: "invalid_range_bucket",
          message: `${label}: ${bucketKey}[${bucketIndex}] must be a canonical range bucket object`,
          path: [...basePath, "coaching_context", "range_support", bucketKey, bucketIndex],
          scope: "drill",
        });
        continue;
      }

      if (typeof bucket.label !== "string" || bucket.label.trim().length === 0) {
        pushError(errors, {
          drillId: drill.drill_id,
          code: "missing_range_bucket_label",
          message: `${label}: ${bucketKey}[${bucketIndex}] must include a non-empty label`,
          path: [...basePath, "coaching_context", "range_support", bucketKey, bucketIndex, "label"],
          scope: "drill",
        });
      }

      if (!Array.isArray(bucket.combos) || bucket.combos.length === 0 || bucket.combos.some((combo) => typeof combo !== "string" || combo.trim().length === 0)) {
        pushError(errors, {
          drillId: drill.drill_id,
          code: "missing_range_bucket_combos",
          message: `${label}: ${bucketKey}[${bucketIndex}] must include a non-empty combos array`,
          path: [...basePath, "coaching_context", "range_support", bucketKey, bucketIndex, "combos"],
          scope: "drill",
        });
      }
    }
  }
}

function validateSteps(errors, drill, basePath) {
  const label = drill.drill_id || `index ${basePath[0]}`;
  if (!Array.isArray(drill.steps)) return;

  for (const [stepIndex, step] of drill.steps.entries()) {
    const stepPath = [...basePath, "steps", stepIndex];

    if (!step || typeof step !== "object" || Array.isArray(step)) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "invalid_step",
        message: `${label}: steps[${stepIndex}] must be an object`,
        path: stepPath,
        scope: "drill",
      });
      continue;
    }

    if (typeof step.step_id !== "string" || step.step_id.trim().length === 0) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "missing_step_id",
        message: `${label}: steps[${stepIndex}] must include step_id`,
        path: [...stepPath, "step_id"],
        scope: "drill",
      });
    }

    if (!["flop", "turn", "river"].includes(step.street)) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "invalid_step_street",
        message: `${label}: steps[${stepIndex}] must include a canonical street`,
        path: [...stepPath, "street"],
        scope: "drill",
      });
    }

    if (!step.decision_point || typeof step.decision_point !== "object" || Array.isArray(step.decision_point)) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "missing_step_decision_point",
        message: `${label}: steps[${stepIndex}] must include decision_point`,
        path: [...stepPath, "decision_point"],
        scope: "drill",
      });
    } else if (step.decision_point.street !== step.street) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "step_street_mismatch",
        message: `${label}: steps[${stepIndex}] decision_point.street must match step.street`,
        path: [...stepPath, "decision_point", "street"],
        scope: "drill",
      });
    }

    if (!step.answer || typeof step.answer !== "object" || Array.isArray(step.answer)) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "missing_step_answer",
        message: `${label}: steps[${stepIndex}] must include answer`,
        path: [...stepPath, "answer"],
        scope: "drill",
      });
    } else if (!Array.isArray(step.answer.required_tags) || step.answer.required_tags.length === 0) {
      pushError(errors, {
        drillId: drill.drill_id,
        code: "missing_step_required_tags",
        message: `${label}: steps[${stepIndex}].answer.required_tags must be present`,
        path: [...stepPath, "answer", "required_tags"],
        scope: "drill",
      });
    }
  }
}

function pushError(target, error) {
  target.push(error);
}

function emitFailure({ jsonOutput, mode, filePath, errors, summary }) {
  if (jsonOutput) {
    console.log(JSON.stringify({
      ok: false,
      mode,
      filePath,
      summary,
      errors,
    }, null, 2));
    return;
  }

  console.error("Gold lane validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error.message}`);
  }
}

export function summarize(drills) {
  return {
    total: drills.length,
    node1: drills.filter((drill) => drill.node_id === "bluff_catch_01").length,
    node2: drills.filter((drill) => drill.node_id === "bluff_catch_02").length,
    withDiagnostics: drills.filter((drill) => (drill.diagnostic_prompts?.length ?? 0) > 0).length,
    withRangeSupport: drills.filter((drill) => Boolean(drill.coaching_context?.range_support)).length,
    withSteps: drills.filter((drill) => (drill.steps?.length ?? 0) > 0).length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
