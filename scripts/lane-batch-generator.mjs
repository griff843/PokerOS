import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    config: "",
    template: "scripts/templates/drill_batch_template.json",
    out: "",
    count: 1,
    prefix: "template_lane",
    node: "bluff_catch_01",
    title: "Template Drill",
    laneFamily: "",
    promptTemplate: "",
    metadataNotes: [],
    metadataTags: [],
    force: false,
    help: false,
  };

  for (const rawArg of argv) {
    if (rawArg === "--") {
      continue;
    }
    if (rawArg === "--force") {
      args.force = true;
      continue;
    }
    if (rawArg === "--help" || rawArg === "-h") {
      args.help = true;
      continue;
    }
    if (!rawArg.startsWith("--")) {
      continue;
    }

    const [key, rawValue = ""] = rawArg.slice(2).split("=");
    switch (key) {
      case "config":
        args.config = rawValue;
        break;
      case "template":
        args.template = rawValue;
        break;
      case "out":
        args.out = rawValue;
        break;
      case "count":
        args.count = Number.parseInt(rawValue, 10);
        break;
      case "prefix":
        args.prefix = rawValue;
        break;
      case "node":
      case "node_id":
        args.node = rawValue;
        break;
      case "title":
        args.title = rawValue;
        break;
      case "lane-family":
      case "laneFamily":
        args.laneFamily = rawValue;
        break;
      case "prompt-template":
      case "promptTemplate":
        args.promptTemplate = rawValue;
        break;
      case "metadata-note":
      case "metadataNote":
        if (rawValue) {
          args.metadataNotes.push(rawValue);
        }
        break;
      case "metadata-tag":
      case "metadataTag":
        if (rawValue) {
          args.metadataTags.push(rawValue);
        }
        break;
      default:
        throw new Error(`Unknown argument: ${rawArg}`);
    }
  }

  return args;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadTemplate(templatePath) {
  const resolved = path.resolve(process.cwd(), templatePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Template file not found: ${resolved}`);
  }
  const parsed = loadJson(resolved);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Template file must contain a non-empty JSON array: ${resolved}`);
  }
  return parsed[0];
}

function loadConfig(configPath) {
  if (!configPath) {
    return {};
  }
  const resolved = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  const parsed = loadJson(resolved);
  if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
    throw new Error(`Config file must contain a JSON object: ${resolved}`);
  }
  return parsed;
}

function mergeOptions(cliArgs, config) {
  const laneFamily = cliArgs.laneFamily || config.laneFamily || config.lane_family || "";
  const prefix = cliArgs.prefix || config.prefix || slugify(laneFamily) || "template_lane";
  const title = cliArgs.title || config.title || laneFamily || "Template Drill";
  const node = cliArgs.node || config.node || config.node_id || "bluff_catch_01";
  const count = Number.isFinite(cliArgs.count) && cliArgs.count > 0
    ? cliArgs.count
    : Number.isFinite(Number.parseInt(config.count, 10)) && Number.parseInt(config.count, 10) > 0
      ? Number.parseInt(config.count, 10)
      : 1;
  const out = cliArgs.out || config.out || "";
  const promptTemplate = cliArgs.promptTemplate || config.promptTemplate || config.prompt_template || "";
  const template = cliArgs.template || config.template || config.template_path || "scripts/templates/drill_batch_template.json";
  const metadataNotes = [
    ...asStringArray(config.metadataNotes || config.metadata_notes),
    ...cliArgs.metadataNotes,
  ];
  const metadataTags = [
    ...asStringArray(config.metadataTags || config.metadata_tags),
    ...cliArgs.metadataTags,
  ];

  return {
    out,
    template,
    count,
    prefix,
    node,
    title,
    laneFamily,
    promptTemplate,
    metadataNotes,
    metadataTags,
    force: cliArgs.force,
  };
}

function asStringArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function renderTemplate(template, context) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      return String(context[key] ?? "");
    }
    return "";
  });
}

function buildPrompt(basePrompt, options, number, context) {
  if (options.promptTemplate) {
    return renderTemplate(options.promptTemplate, {
      ...context,
      number,
      index: number,
    });
  }

  const laneIntro = options.laneFamily ? `${options.laneFamily}. ` : "";
  if (basePrompt.includes("Template prompt.")) {
    return basePrompt.replace("Template prompt.", `${laneIntro}Template prompt ${number}.`);
  }

  return `${basePrompt.trim()} ${laneIntro}Template prompt ${number}.`.trim();
}

function buildMetadata(baseMetadata, options, number, context) {
  const notes = [
    ...asStringArray(baseMetadata?.notes),
    `Lane family: ${options.laneFamily || "unspecified"}`,
    `Generated from compact lane config for ${context.prefix}_${String(number).padStart(2, "0")}.`,
    ...options.metadataNotes,
  ];

  const tags = uniqueStrings([
    ...asStringArray(baseMetadata?.tags),
    ...options.metadataTags,
    options.laneFamily ? `lane_family:${slugify(options.laneFamily)}` : null,
    `batch_prefix:${slugify(options.prefix)}`,
  ]);

  return {
    ...(baseMetadata ?? {}),
    source: baseMetadata?.source ?? "ai_generated",
    created_at: new Date().toISOString(),
    notes: uniqueStrings(notes),
    tags,
  };
}

function ensureRequiredSections(drill, context) {
  const label = context.laneFamily || context.title;

  drill.coaching_context ??= {};
  drill.coaching_context.range_support ??= {
    threshold_notes: [`${label} threshold note placeholder.`],
    blocker_notes: [`${label} blocker note placeholder.`],
  };
  drill.coaching_context.range_support.threshold_notes ??= [`${label} threshold note placeholder.`];
  drill.coaching_context.range_support.blocker_notes ??= [`${label} blocker note placeholder.`];
  drill.coaching_context.what_changed_by_street ??= [
    { street: "turn", detail: `${label} turn-range shift placeholder.` },
    { street: "river", detail: `${label} river-range shift placeholder.` },
  ];
  drill.coaching_context.follow_up ??= `${label} follow-up placeholder.`;
  drill.coaching_context.follow_up_concepts ??= ["concept:blocker_effect"];
  drill.coaching_context.common_mistakes ??= [`${label} common mistake placeholder.`];

  drill.diagnostic_prompts ??= [{
    id: `${context.prefix}_line_01`,
    type: "line_understanding",
    prompt: `${label} line-understanding placeholder.`,
    expected_reasoning: `${label} expected reasoning placeholder.`,
    options: [
      {
        id: `${context.prefix}_line_01_a`,
        label: "Placeholder option A",
        diagnosis: "line_misunderstanding",
      },
      {
        id: `${context.prefix}_line_01_b`,
        label: "Placeholder option B",
        diagnosis: "threshold_error",
      },
      {
        id: `${context.prefix}_line_01_c`,
        label: "Placeholder option C",
        diagnosis: "blocker_blindness",
      },
    ],
  }];

  return drill;
}

function cloneDrill(base, options, index) {
  const number = String(index + 1).padStart(2, "0");
  const context = {
    prefix: options.prefix,
    title: options.title,
    laneFamily: options.laneFamily,
    node: options.node,
    laneSlug: slugify(options.laneFamily),
  };
  const drill = JSON.parse(JSON.stringify(base));

  drill.drill_id = `${options.prefix}_${number}`;
  drill.node_id = options.node;
  drill.title = `${options.title} ${number}`;
  drill.prompt = buildPrompt(base.prompt, options, number, context);
  drill.metadata = buildMetadata(base.metadata, options, number, context);
  drill.diagnostic_prompts = (drill.diagnostic_prompts ?? []).map((prompt, promptIndex) => ({
    ...prompt,
    id: `${options.prefix}_line_${number}_${promptIndex + 1}`,
    options: (prompt.options ?? []).map((option, optionIndex) => ({
      ...option,
      id: `${options.prefix}_line_${number}_${promptIndex + 1}_${String.fromCharCode(97 + optionIndex)}`,
    })),
  }));

  return ensureRequiredSections(drill, context);
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function printHelp() {
  console.log([
    "Lane batch generator",
    "",
    "Usage:",
    "  pnpm drill:batch -- --config=<path>",
    "  pnpm drill:batch -- --out=<path> --count=<N> --prefix=<prefix> --title=<title> --lane-family=<family>",
    "",
    "Config fields:",
    "  out, count, prefix, title, node/node_id, laneFamily/lane_family, promptTemplate/prompt_template, metadataNotes/metadata_notes, metadataTags/metadata_tags",
    "",
    "Placeholders supported in promptTemplate:",
    "  {{number}}, {{index}}, {{prefix}}, {{title}}, {{node}}, {{laneFamily}}, {{laneSlug}}",
  ].join("\n"));
}

function main() {
  const cliArgs = parseArgs(process.argv.slice(2));
  if (cliArgs.help) {
    printHelp();
    return;
  }

  const config = loadConfig(cliArgs.config);
  const options = mergeOptions(cliArgs, config);

  if (!options.out) {
    throw new Error("Missing required --out=<path> argument.");
  }
  if (!Number.isFinite(options.count) || options.count <= 0) {
    throw new Error("--count must be a positive integer.");
  }
  if (!options.template) {
    throw new Error("Missing template path.");
  }

  const base = loadTemplate(options.template);
  const drills = Array.from({ length: options.count }, (_, index) => cloneDrill(base, options, index));
  const outPath = path.resolve(process.cwd(), options.out);

  if (fs.existsSync(outPath) && !options.force) {
    throw new Error(`Output file already exists: ${outPath}. Use --force to overwrite.`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(drills, null, 2)}\n`, "utf8");

  console.log(`Scaffolded ${drills.length} drill(s) to ${outPath}`);
}

main();
