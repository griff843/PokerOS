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
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
  diagnostic_patch: null,
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
  const result = mode === "diagnostic_patch"
    ? validateDiagnosticPatchFile(raw, filePath)
    : validateGoldLane(raw, filePath, mode);

  if (!result.ok) {
    emitFailure({
      jsonOutput,
      mode,
      filePath,
      errors: result.errors,
      summary: Array.isArray(raw)
        ? (mode === "diagnostic_patch" ? summarizeDiagnosticPatch(raw) : summarize(raw))
        : undefined,
    });
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      ok: true,
      mode,
      filePath,
      summary: mode === "diagnostic_patch" ? summarizeDiagnosticPatch(raw) : summarize(raw),
      errors: [],
    }, null, 2));
    return;
  }

  console.log("Gold lane validation passed.");
  console.log(`Mode: ${mode}`);
  console.log(JSON.stringify(mode === "diagnostic_patch" ? summarizeDiagnosticPatch(raw) : summarize(raw), null, 2));
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

export function validateDiagnosticPatchFile(entries, filePath) {
  const errors = [];

  if (!Array.isArray(entries) || entries.length === 0) {
    pushError(errors, {
      code: "empty_patch_batch",
      message: `${path.basename(filePath)} did not contain any diagnostic patch entries.`,
      path: ["file"],
      scope: "file",
    });
    return { ok: false, errors };
  }

  const seenDrillIds = new Set();
  const knownDrillIds = loadKnownDrillIds();

  for (const [index, entry] of entries.entries()) {
    const label = entry?.drill_id || `index ${index}`;
    const basePath = [index];

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      pushError(errors, {
        code: "invalid_patch_entry",
        message: `${label}: each patch entry must be an object`,
        path: basePath,
        scope: "file",
      });
      continue;
    }

    if (typeof entry.drill_id !== "string" || entry.drill_id.trim().length === 0) {
      pushError(errors, {
        code: "missing_drill_id",
        message: `${label}: drill_id is required`,
        path: [...basePath, "drill_id"],
        scope: "file",
      });
      continue;
    }

    if (seenDrillIds.has(entry.drill_id)) {
      pushError(errors, {
        drillId: entry.drill_id,
        code: "duplicate_drill_id",
        message: `${label}: duplicate drill_id in patch batch`,
        path: [...basePath, "drill_id"],
        scope: "file",
      });
    }
    seenDrillIds.add(entry.drill_id);

    if (!knownDrillIds.has(entry.drill_id)) {
      pushError(errors, {
        drillId: entry.drill_id,
        code: "unknown_drill_id",
        message: `${label}: drill_id does not match any drill under content/drills`,
        path: [...basePath, "drill_id"],
        scope: "file",
      });
    }

    const extraKeys = Object.keys(entry).filter((key) => !["drill_id", "diagnostic_prompts", "coaching_context"].includes(key));
    if (extraKeys.length > 0) {
      pushError(errors, {
        drillId: entry.drill_id,
        code: "unexpected_patch_keys",
        message: `${label}: patch entries may only include drill_id plus diagnostic_prompts or coaching_context`,
        path: basePath,
        scope: "file",
      });
    }

    const hasDiagnosticPrompts = Array.isArray(entry.diagnostic_prompts);
    const hasCoachingContext = entry.coaching_context && typeof entry.coaching_context === "object" && !Array.isArray(entry.coaching_context);

    if ((hasDiagnosticPrompts ? 1 : 0) + (hasCoachingContext ? 1 : 0) !== 1) {
      pushError(errors, {
        drillId: entry.drill_id,
        code: "invalid_patch_payload",
        message: `${label}: patch entry must include exactly one of diagnostic_prompts or coaching_context`,
        path: basePath,
        scope: "file",
      });
      continue;
    }

    if (hasDiagnosticPrompts) {
      if (entry.diagnostic_prompts.length !== 1) {
        pushError(errors, {
          drillId: entry.drill_id,
          code: "invalid_diagnostic_prompt_count",
          message: `${label}: diagnostic_prompts must contain exactly one prompt`,
          path: [...basePath, "diagnostic_prompts"],
          scope: "prompt",
        });
        continue;
      }

      validateDiagnosticPrompt(errors, entry.drill_id, label, entry.diagnostic_prompts[0], [...basePath, "diagnostic_prompts", 0]);
      continue;
    }

    validateCoachingContextPatch(errors, entry.drill_id, label, entry.coaching_context, [...basePath, "coaching_context"]);
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

export function summarizeDiagnosticPatch(entries) {
  return {
    total: entries.length,
    uniqueDrillIds: new Set(entries.map((entry) => entry?.drill_id).filter((value) => typeof value === "string")).size,
    promptCount: entries.reduce((sum, entry) => sum + (Array.isArray(entry?.diagnostic_prompts) ? entry.diagnostic_prompts.length : 0), 0),
  };
}

function validateDiagnosticPrompt(errors, drillId, label, prompt, basePath) {
  if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) {
    pushError(errors, {
      drillId,
      code: "invalid_diagnostic_prompt",
      message: `${label}: diagnostic prompt must be an object`,
      path: basePath,
      scope: "prompt",
    });
    return;
  }

  if (typeof prompt.id !== "string" || !KEBAB_CASE_PATTERN.test(prompt.id)) {
    pushError(errors, {
      drillId,
      code: "invalid_prompt_id",
      message: `${label}: diagnostic prompt id must be kebab-case`,
      path: [...basePath, "id"],
      scope: "prompt",
      promptId: prompt.id,
    });
  }

  if (typeof prompt.prompt !== "string" || prompt.prompt.trim().length === 0) {
    pushError(errors, {
      drillId,
      code: "missing_prompt_text",
      message: `${label}: diagnostic prompt text is required`,
      path: [...basePath, "prompt"],
      scope: "prompt",
      promptId: prompt.id,
    });
  }

  if (!VALID_DIAGNOSTIC_TYPES.has(prompt.type)) {
    pushError(errors, {
      drillId,
      code: "invalid_diagnostic_type",
      message: `${label}: diagnostic prompt ${prompt.id} uses invalid type "${prompt.type}"`,
      path: [...basePath, "type"],
      scope: "prompt",
      promptId: prompt.id,
    });
  }

  if (typeof prompt.concept !== "string" || prompt.concept.trim().length === 0) {
    pushError(errors, {
      drillId,
      code: "missing_prompt_concept",
      message: `${label}: diagnostic prompt ${prompt.id} must include concept`,
      path: [...basePath, "concept"],
      scope: "prompt",
      promptId: prompt.id,
    });
  }

  if (typeof prompt.expected_reasoning !== "string" || prompt.expected_reasoning.trim().length === 0) {
    pushError(errors, {
      drillId,
      code: "missing_expected_reasoning",
      message: `${label}: diagnostic prompt ${prompt.id} must include expected_reasoning`,
      path: [...basePath, "expected_reasoning"],
      scope: "prompt",
      promptId: prompt.id,
    });
  }

  if (!Array.isArray(prompt.options) || prompt.options.length !== 3) {
    pushError(errors, {
      drillId,
      code: "invalid_prompt_options_count",
      message: `${label}: diagnostic prompt ${prompt.id} must contain exactly 3 options`,
      path: [...basePath, "options"],
      scope: "prompt",
      promptId: prompt.id,
    });
    return;
  }

  let matchedExpectedCount = 0;
  let diagnosisCount = 0;

  for (const [optionIndex, option] of prompt.options.entries()) {
    if (!option || typeof option !== "object" || Array.isArray(option)) {
      pushError(errors, {
        drillId,
        code: "invalid_prompt_option",
        message: `${label}: diagnostic prompt ${prompt.id} option ${optionIndex} must be an object`,
        path: [...basePath, "options", optionIndex],
        scope: "prompt_option",
        promptId: prompt.id,
      });
      continue;
    }

    if (typeof option.id !== "string" || option.id.trim().length === 0) {
      pushError(errors, {
        drillId,
        code: "missing_option_id",
        message: `${label}: diagnostic prompt ${prompt.id} option ${optionIndex} must include id`,
        path: [...basePath, "options", optionIndex, "id"],
        scope: "prompt_option",
        promptId: prompt.id,
      });
    }

    if (typeof option.label !== "string" || option.label.trim().length === 0) {
      pushError(errors, {
        drillId,
        code: "missing_option_label",
        message: `${label}: diagnostic prompt ${prompt.id} option ${option.id ?? optionIndex} must include label`,
        path: [...basePath, "options", optionIndex, "label"],
        scope: "prompt_option",
        promptId: prompt.id,
        optionId: option.id,
      });
    }

    if (option.matches_expected === true) {
      matchedExpectedCount += 1;
      if (option.diagnosis !== undefined) {
        pushError(errors, {
          drillId,
          code: "matches_expected_with_diagnosis",
          message: `${label}: diagnostic prompt ${prompt.id} option ${option.id} cannot set diagnosis when matches_expected is true`,
          path: [...basePath, "options", optionIndex, "diagnosis"],
          scope: "prompt_option",
          promptId: prompt.id,
          optionId: option.id,
        });
      }
    }

    if (option.diagnosis !== undefined) {
      diagnosisCount += 1;
      if (!VALID_DIAGNOSES.has(option.diagnosis)) {
        pushError(errors, {
          drillId,
          code: "invalid_diagnosis",
          message: `${label}: diagnostic prompt ${prompt.id} option ${option.id} uses invalid diagnosis "${option.diagnosis}"`,
          path: [...basePath, "options", optionIndex, "diagnosis"],
          scope: "prompt_option",
          promptId: prompt.id,
          optionId: option.id,
        });
      }
    }
  }

  if (matchedExpectedCount !== 1) {
    pushError(errors, {
      drillId,
      code: "invalid_matches_expected_count",
      message: `${label}: diagnostic prompt ${prompt.id} must contain exactly one matches_expected option`,
      path: [...basePath, "options"],
      scope: "prompt",
      promptId: prompt.id,
    });
  }

  if (diagnosisCount !== 2) {
    pushError(errors, {
      drillId,
      code: "invalid_diagnosis_count",
      message: `${label}: diagnostic prompt ${prompt.id} must contain exactly two diagnosis-tagged options`,
      path: [...basePath, "options"],
      scope: "prompt",
      promptId: prompt.id,
    });
  }
}

function validateCoachingContextPatch(errors, drillId, label, context, basePath) {
  const keys = Object.keys(context);
  const partialRefineKeys = ["key_concept", "difficulty_reason", "why_preferred_line_works"];
  const isRefinedReplacement = keys.length > 0 && keys.every((key) => partialRefineKeys.includes(key));

  if (isRefinedReplacement) {
    for (const field of keys) {
      if (typeof context[field] !== "string" || context[field].trim().length === 0) {
        pushError(errors, {
          drillId,
          code: "missing_coaching_context_field",
          message: `${label}: coaching_context.${field} must be a non-empty string`,
          path: [...basePath, field],
          scope: "drill",
        });
      }
    }
    return;
  }

  const requiredStringFields = [
    "key_concept",
    "range_context",
    "difficulty_reason",
    "why_preferred_line_works",
    "follow_up",
  ];

  for (const field of requiredStringFields) {
    if (typeof context[field] !== "string" || context[field].trim().length === 0) {
      pushError(errors, {
        drillId,
        code: "missing_coaching_context_field",
        message: `${label}: coaching_context.${field} must be a non-empty string`,
        path: [...basePath, field],
        scope: "drill",
      });
    }
  }

  if (!Array.isArray(context.range_notes) || context.range_notes.length < 2 || context.range_notes.some((note) => typeof note !== "string" || note.trim().length === 0)) {
    pushError(errors, {
      drillId,
      code: "invalid_range_notes",
      message: `${label}: coaching_context.range_notes must be an array of at least 2 non-empty strings`,
      path: [...basePath, "range_notes"],
      scope: "drill",
    });
  }

  if (!Array.isArray(context.follow_up_concepts) || context.follow_up_concepts.length === 0 || context.follow_up_concepts.some((item) => typeof item !== "string" || !item.startsWith("concept:"))) {
    pushError(errors, {
      drillId,
      code: "invalid_follow_up_concepts",
      message: `${label}: coaching_context.follow_up_concepts must be a non-empty array of concept:* strings`,
      path: [...basePath, "follow_up_concepts"],
      scope: "drill",
    });
  }

  if (context.what_changed_by_street !== undefined) {
    if (!Array.isArray(context.what_changed_by_street) || context.what_changed_by_street.length === 0) {
      pushError(errors, {
        drillId,
        code: "invalid_what_changed_by_street",
        message: `${label}: coaching_context.what_changed_by_street must be a non-empty array when present`,
        path: [...basePath, "what_changed_by_street"],
        scope: "drill",
      });
    } else {
      for (const [index, note] of context.what_changed_by_street.entries()) {
        if (!note || typeof note !== "object" || Array.isArray(note)) {
          pushError(errors, {
            drillId,
            code: "invalid_street_change_note",
            message: `${label}: coaching_context.what_changed_by_street[${index}] must be an object`,
            path: [...basePath, "what_changed_by_street", index],
            scope: "drill",
          });
          continue;
        }

        if (!["preflop", "flop", "turn", "river"].includes(note.street)) {
          pushError(errors, {
            drillId,
            code: "invalid_street_change_street",
            message: `${label}: coaching_context.what_changed_by_street[${index}].street must be canonical`,
            path: [...basePath, "what_changed_by_street", index, "street"],
            scope: "drill",
          });
        }

        if (typeof note.detail !== "string" || note.detail.trim().length === 0) {
          pushError(errors, {
            drillId,
            code: "invalid_street_change_detail",
            message: `${label}: coaching_context.what_changed_by_street[${index}].detail must be a non-empty string`,
            path: [...basePath, "what_changed_by_street", index, "detail"],
            scope: "drill",
          });
        }
      }
    }
  }

  if (!context.range_support || typeof context.range_support !== "object" || Array.isArray(context.range_support)) {
    pushError(errors, {
      drillId,
      code: "missing_range_support",
      message: `${label}: coaching_context.range_support is required`,
      path: [...basePath, "range_support"],
      scope: "drill",
    });
    return;
  }

  for (const bucketKey of ["value_buckets", "bluff_buckets"]) {
    const buckets = context.range_support[bucketKey];
    if (!Array.isArray(buckets) || buckets.length === 0) {
      pushError(errors, {
        drillId,
        code: "missing_range_support_bucket",
        message: `${label}: coaching_context.range_support.${bucketKey} must be a non-empty array`,
        path: [...basePath, "range_support", bucketKey],
        scope: "drill",
      });
      continue;
    }

    for (const [index, bucket] of buckets.entries()) {
      if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) {
        pushError(errors, {
          drillId,
          code: "invalid_range_bucket",
          message: `${label}: coaching_context.range_support.${bucketKey}[${index}] must be an object`,
          path: [...basePath, "range_support", bucketKey, index],
          scope: "drill",
        });
        continue;
      }

      if (typeof bucket.label !== "string" || bucket.label.trim().length === 0) {
        pushError(errors, {
          drillId,
          code: "missing_range_bucket_label",
          message: `${label}: coaching_context.range_support.${bucketKey}[${index}].label must be non-empty`,
          path: [...basePath, "range_support", bucketKey, index, "label"],
          scope: "drill",
        });
      }

      if (!Array.isArray(bucket.combos) || bucket.combos.length === 0 || bucket.combos.some((combo) => typeof combo !== "string" || combo.trim().length === 0)) {
        pushError(errors, {
          drillId,
          code: "missing_range_bucket_combos",
          message: `${label}: coaching_context.range_support.${bucketKey}[${index}].combos must be a non-empty string array`,
          path: [...basePath, "range_support", bucketKey, index, "combos"],
          scope: "drill",
        });
      }

      if (typeof bucket.note !== "string" || bucket.note.trim().length === 0) {
        pushError(errors, {
          drillId,
          code: "missing_range_bucket_note",
          message: `${label}: coaching_context.range_support.${bucketKey}[${index}].note must be non-empty`,
          path: [...basePath, "range_support", bucketKey, index, "note"],
          scope: "drill",
        });
      }
    }
  }
}

function loadKnownDrillIds() {
  const drillsDir = path.resolve(process.cwd(), "content", "drills");
  const drillIds = new Set();

  if (!fs.existsSync(drillsDir)) {
    return drillIds;
  }

  for (const fileName of fs.readdirSync(drillsDir)) {
    if (!fileName.endsWith(".json")) continue;
    const filePath = path.join(drillsDir, fileName);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(raw)) continue;
    for (const drill of raw) {
      if (typeof drill?.drill_id === "string") {
        drillIds.add(drill.drill_id);
      }
    }
  }

  return drillIds;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
