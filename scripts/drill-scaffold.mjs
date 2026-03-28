import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    out: "",
    count: 1,
    prefix: "template_lane",
    node: "bluff_catch_01",
    title: "Template Drill",
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, rawValue = ""] = arg.slice(2).split("=");
    if (key === "out") args.out = rawValue;
    if (key === "count") args.count = Number.parseInt(rawValue, 10);
    if (key === "prefix") args.prefix = rawValue;
    if (key === "node") args.node = rawValue;
    if (key === "title") args.title = rawValue;
  }

  if (!args.out) {
    throw new Error("Missing required --out=<path> argument.");
  }

  if (!Number.isFinite(args.count) || args.count <= 0) {
    throw new Error("--count must be a positive integer.");
  }

  return args;
}

function loadTemplate() {
  const templatePath = path.resolve(process.cwd(), "scripts", "templates", "drill_batch_template.json");
  return JSON.parse(fs.readFileSync(templatePath, "utf8"));
}

function cloneDrill(base, args, index) {
  const number = String(index + 1).padStart(2, "0");
  const drillId = `${args.prefix}_${number}`;
  const promptIdBase = `${args.prefix}_line_${number}`;

  return {
    ...base,
    drill_id: drillId,
    node_id: args.node,
    title: `${args.title} ${number}`,
    prompt: base.prompt.replace("Template prompt.", `Template prompt ${number}.`),
    diagnostic_prompts: (base.diagnostic_prompts ?? []).map((prompt, promptIndex) => ({
      ...prompt,
      id: `${promptIdBase}_${promptIndex + 1}`,
      options: (prompt.options ?? []).map((option, optionIndex) => ({
        ...option,
        id: `${promptIdBase}_${promptIndex + 1}_${String.fromCharCode(97 + optionIndex)}`,
      })),
    })),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const [base] = loadTemplate();
  const drills = Array.from({ length: args.count }, (_, index) => cloneDrill(base, args, index));
  const outPath = path.resolve(process.cwd(), args.out);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(drills, null, 2)}\n`, "utf8");

  console.log(`Scaffolded ${drills.length} drill(s) to ${outPath}`);
}

main();
