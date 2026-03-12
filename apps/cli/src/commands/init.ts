import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { openDatabase } from "@poker-coach/db";
import { loadAllContent } from "@poker-coach/core";

export const initCommand = new Command("init")
  .description("Initialize database, run migrations, and load content")
  .action(() => {
    const cwd = process.cwd();
    const dbPath = path.join(cwd, ".local", "coach.db");
    const contentDir = path.join(cwd, "content");
    const proofsDir = path.join(cwd, "out", "proofs");

    console.log("Poker Coach OS — Initializing...\n");

    // Open DB (creates .local/ dir and runs migrations)
    console.log(`  DB path: ${dbPath}`);
    const db = openDatabase(dbPath);
    console.log("  Database created and migrations applied.");

    // Load content
    console.log(`\n  Loading content from: ${contentDir}`);
    const result = loadAllContent(db, contentDir);
    console.log(`  Loaded ${result.nodes} node(s) and ${result.drills} drill(s).`);

    // Write proof
    fs.mkdirSync(proofsDir, { recursive: true });
    const proofPath = path.join(proofsDir, "proof_cli_init.txt");
    const proofContent = [
      `Poker Coach OS — Init Proof`,
      `Date: ${new Date().toISOString()}`,
      `Command: coach init`,
      ``,
      `Database: ${dbPath}`,
      `Migrations: applied`,
      `Nodes loaded: ${result.nodes}`,
      `Drills loaded: ${result.drills}`,
      ``,
      `Status: SUCCESS`,
    ].join("\n");
    fs.writeFileSync(proofPath, proofContent, "utf-8");
    console.log(`\n  Proof written to: ${proofPath}`);

    db.close();
    console.log("\nDone! Run 'coach drill' to start practicing.");
  });
