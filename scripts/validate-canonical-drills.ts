import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CanonicalDrillsFileSchema } from "../packages/core/src/schemas";

interface CanonicalValidationError {
  filePath: string;
  code: string;
  message: string;
  path: Array<string | number>;
}

function main() {
  const rawArgs = process.argv.slice(2);
  const jsonOutput = rawArgs.includes("--json");
  const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));
  const input = positionalArgs[0] ?? "content/drills";
  const resolved = path.resolve(process.cwd(), input);

  if (!fs.existsSync(resolved)) {
    emit({
      ok: false,
      rootPath: resolved,
      files: [],
      summary: { filesChecked: 0, drillsParsed: 0, errors: 1 },
      errors: [{
        filePath: resolved,
        code: "missing_path",
        message: `Path does not exist: ${resolved}`,
        path: ["file"],
      }],
      jsonOutput,
    });
    process.exit(1);
  }

  const files = collectJsonFiles(resolved);
  const errors: CanonicalValidationError[] = [];
  let drillsParsed = 0;

  for (const filePath of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const result = CanonicalDrillsFileSchema.safeParse(raw);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            filePath,
            code: issue.code,
            message: issue.message,
            path: issue.path,
          });
        }
        continue;
      }
      drillsParsed += result.data.length;
    } catch (error) {
      errors.push({
        filePath,
        code: "invalid_json",
        message: error instanceof Error ? error.message : "Failed to parse JSON",
        path: ["file"],
      });
    }
  }

  emit({
    ok: errors.length === 0,
    rootPath: resolved,
    files,
    summary: {
      filesChecked: files.length,
      drillsParsed,
      errors: errors.length,
    },
    errors,
    jsonOutput,
  });

  if (errors.length > 0) {
    process.exit(1);
  }
}

function collectJsonFiles(inputPath: string): string[] {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    return [inputPath];
  }

  return fs.readdirSync(inputPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(inputPath, entry.name));
}

function emit(args: {
  ok: boolean;
  rootPath: string;
  files: string[];
  summary: {
    filesChecked: number;
    drillsParsed: number;
    errors: number;
  };
  errors: CanonicalValidationError[];
  jsonOutput: boolean;
}) {
  if (args.jsonOutput) {
    console.log(JSON.stringify({
      ok: args.ok,
      rootPath: args.rootPath,
      files: args.files,
      summary: args.summary,
      errors: args.errors,
    }, null, 2));
    return;
  }

  if (args.ok) {
    console.log("Canonical drill validation passed.");
    console.log(JSON.stringify(args.summary, null, 2));
    return;
  }

  console.error("Canonical drill validation failed.\n");
  for (const error of args.errors) {
    console.error(`- ${path.basename(error.filePath)} ${JSON.stringify(error.path)}: ${error.message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
