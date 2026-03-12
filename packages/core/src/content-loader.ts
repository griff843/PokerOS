import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { NodeFileSchema } from "./schemas";
import { readCanonicalDrillsFromDirectory } from "./drills";
import { upsertNode, upsertDrill, type NodeRow, type DrillRow } from "@poker-coach/db";

/**
 * Load all node JSON files from a directory tree (e.g. content/nodes/)
 * and upsert into the database. Idempotent.
 */
export function loadNodes(db: Database.Database, nodesDir: string): number {
  let count = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".json")) {
        const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        const parsed = NodeFileSchema.parse(raw);

        let checklistMd = parsed.checklist_md;
        if (!checklistMd) {
          const mdPath = path.join(path.dirname(fullPath), "checklist.md");
          if (fs.existsSync(mdPath)) {
            const mdContent = fs.readFileSync(mdPath, "utf-8");
            const sectionRegex = new RegExp(
              `## ${parsed.node_id}[\\s\\S]*?(?=## |$)`,
              "i"
            );
            const match = mdContent.match(sectionRegex);
            checklistMd = match ? match[0].trim() : checklistMd;
          }
        }

        const row: NodeRow = {
          node_id: parsed.node_id,
          name: parsed.name,
          version: parsed.version,
          context_json: JSON.stringify(parsed.context),
          triggers_json: JSON.stringify(parsed.triggers),
          checklist_md: checklistMd,
          defaults_json: JSON.stringify(parsed.defaults),
        };
        upsertNode(db, row);
        count++;
      }
    }
  };
  walk(nodesDir);
  return count;
}

/**
 * Load canonical drill seed JSON files from a directory (e.g. content/drills/)
 * and upsert into the database. Idempotent.
 */
export function loadDrills(db: Database.Database, drillsDir: string): number {
  const drills = readCanonicalDrillsFromDirectory(drillsDir);

  for (const drill of drills) {
    const row: DrillRow = {
      drill_id: drill.drill_id,
      node_id: drill.node_id,
      prompt: drill.prompt,
      options_json: JSON.stringify(drill.options),
      answer_json: JSON.stringify(drill.answer),
      tags_json: JSON.stringify(drill.tags),
      difficulty: drill.difficulty,
      content_json: JSON.stringify(drill),
      created_at: new Date().toISOString(),
    };
    upsertDrill(db, row);
  }

  return drills.length;
}

/**
 * Load all content (nodes + drills) from the content directory. Idempotent.
 */
export function loadAllContent(
  db: Database.Database,
  contentDir: string
): { nodes: number; drills: number } {
  const nodesDir = path.join(contentDir, "nodes");
  const drillsDir = path.join(contentDir, "drills");
  const nodes = loadNodes(db, nodesDir);
  const drills = loadDrills(db, drillsDir);
  return { nodes, drills };
}

