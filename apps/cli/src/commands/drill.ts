import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import {
  openDatabase,
  getAllDrills,
  getAllAttempts,
  getAllSrs,
  insertAttempt,
  getSrs,
  upsertSrs,
  type AttemptPool,
} from "@poker-coach/db";
import {
  scoreCanonicalDrill,
  computeSrsUpdate,
  VALID_TAGS,
  tagLabel,
  parseStoredCanonicalDrill,
  generateSessionPlan,
  type DrillOption,
} from "@poker-coach/core";
import type { RuleTag } from "@poker-coach/core";

const ACTIVE_POOLS = new Set<Exclude<AttemptPool, null>>(["baseline", "A", "B", "C"]);

function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function buildCliOptionMap(options: DrillOption[]) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return options.map((option, index) => ({
    letter: letters[index] ?? `${index + 1}`,
    option,
  }));
}

function resolveUserAnswer(input: string, mappedOptions: ReturnType<typeof buildCliOptionMap>): string {
  const normalized = input.toUpperCase().trim();
  const byLetter = mappedOptions.find((item) => item.letter === normalized);
  if (byLetter) return byLetter.option.key;

  const byKey = mappedOptions.find((item) => item.option.key.toUpperCase() === normalized);
  if (byKey) return byKey.option.key;

  return normalized;
}

function parseActivePool(raw: string): Exclude<AttemptPool, null> {
  const normalized = raw.trim();
  if (ACTIVE_POOLS.has(normalized as Exclude<AttemptPool, null>)) {
    return normalized as Exclude<AttemptPool, null>;
  }

  console.error(`Invalid pool '${raw}'. Use one of: baseline, A, B, C.`);
  process.exit(1);
}

export const drillCommand = new Command("drill")
  .description("Run a drill session")
  .option("--count <n>", "Number of drills to run", "10")
  .option("--timed", "Enable timing for each drill", false)
  .option("--pool <pool>", "Active pool: baseline, A, B, or C", "baseline")
  .action(async (opts) => {
    const count = parseInt(opts.count, 10);
    const timed = opts.timed;
    const activePool = parseActivePool(opts.pool);
    const cwd = process.cwd();
    const dbPath = path.join(cwd, ".local", "coach.db");

    if (!fs.existsSync(dbPath)) {
      console.error("Database not found. Run 'coach init' first.");
      process.exit(1);
    }

    const db = openDatabase(dbPath);
    const allDrills = getAllDrills(db).map(parseStoredCanonicalDrill);
    const attempts = getAllAttempts(db);
    const srs = getAllSrs(db);
    const sessionPlan = generateSessionPlan(
      { count, activePool },
      { drills: allDrills, attempts, srs, now: new Date() }
    );

    if (sessionPlan.drills.length === 0) {
      console.log("No drills available. Run 'coach init' to load content.");
      db.close();
      return;
    }

    console.log("\nPoker Coach OS - Drill Session");
    console.log(`  Pool: ${sessionPlan.metadata.activePool}`);
    console.log(
      `  Drills: ${sessionPlan.metadata.selectedCount} (${sessionPlan.metadata.reviewCount} review, ${sessionPlan.metadata.newCount} new)`
    );
    if (sessionPlan.metadata.weaknessTargets.length > 0) {
      console.log(
        `  Weakness targets: ${sessionPlan.metadata.weaknessTargets.slice(0, 3).map((target) => target.key).join(", ")}`
      );
    }
    if (timed) console.log("  Timer: ON\n");
    else console.log("");

    const rl = createPrompt();
    const results: string[] = [];
    const activeTags = VALID_TAGS.filter((t) => t !== "multiway_context");

    for (let i = 0; i < sessionPlan.drills.length; i++) {
      const selectedDrill = sessionPlan.drills[i];
      const drill = selectedDrill.drill;
      const options = drill.options;
      const optionMap = buildCliOptionMap(options);

      console.log(`- - - Drill ${i + 1}/${sessionPlan.drills.length} - - -`);
      console.log(`Node: ${drill.node_id}`);
      console.log(`Title: ${drill.title}`);
      console.log(`Selected: ${selectedDrill.reason.replace(/_/g, " ")}`);
      console.log(`Pool: ${sessionPlan.metadata.activePool}`);
      if (selectedDrill.matchedWeaknessTargets.length > 0) {
        console.log(`Targets: ${selectedDrill.matchedWeaknessTargets.join(", ")}`);
      }
      console.log(`\n${drill.prompt}\n`);

      for (const mapped of optionMap) {
        console.log(`  ${mapped.letter}: ${mapped.option.label} [${mapped.option.key}]`);
      }

      const startMs = Date.now();
      const userInput = await ask(rl, "\nYour answer (letter or action): ");
      const userAnswer = resolveUserAnswer(userInput, optionMap);

      console.log("\nSelect applicable rule tags (comma-separated numbers):");
      for (let t = 0; t < activeTags.length; t++) {
        console.log(`  ${t + 1}. ${activeTags[t]} - ${tagLabel(activeTags[t] as RuleTag)}`);
      }
      const tagInput = await ask(rl, "Tags (e.g. 1,3): ");
      const userTags = tagInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => {
          const idx = parseInt(s, 10) - 1;
          return idx >= 0 && idx < activeTags.length ? activeTags[idx] : s;
        });

      const rationale = await ask(rl, "Rationale (optional, press Enter to skip): ");
      const elapsedMs = Date.now() - startMs;

      const scoreResult = scoreCanonicalDrill({
        userAnswer,
        userTags,
        drill,
        activePool: sessionPlan.metadata.activePool,
      });
      const correctOption = options.find(
        (option) => option.key.toUpperCase() === scoreResult.answer.correct.toUpperCase()
      );

      console.log(`\n  Correct answer: ${scoreResult.answer.correct}${correctOption ? ` - ${correctOption.label}` : ""}`);
      console.log(`  Your answer: ${userAnswer.toUpperCase()} - ${scoreResult.correct ? "CORRECT" : "INCORRECT"}`);
      console.log(`  Action score: ${scoreResult.actionScore}`);
      console.log(`  Tag score: ${scoreResult.tagScore}`);
      console.log(`  Total score: ${scoreResult.total}`);
      if (scoreResult.missedTags.length > 0) {
        console.log(`  Missed tags: ${scoreResult.missedTags.join(", ")}`);
      }
      if (scoreResult.answer.explanation) {
        console.log(`  Explanation: ${scoreResult.answer.explanation}`);
      }
      if (timed) {
        console.log(`  Time: ${(elapsedMs / 1000).toFixed(1)}s`);
      }
      console.log("");

      const attemptId = `att_${Date.now()}_${i}`;
      insertAttempt(db, {
        attempt_id: attemptId,
        drill_id: drill.drill_id,
        ts: new Date().toISOString(),
        user_answer_json: JSON.stringify({
          answer: userAnswer,
          rationale,
          active_pool: sessionPlan.metadata.activePool,
        }),
        correct_bool: scoreResult.correct ? 1 : 0,
        score: scoreResult.total,
        elapsed_ms: timed ? elapsedMs : 0,
        missed_tags_json: JSON.stringify(scoreResult.missedTags),
        active_pool: sessionPlan.metadata.activePool,
      });

      const currentSrs = getSrs(db, drill.drill_id);
      const newSrs = computeSrsUpdate(currentSrs, {
        drillId: drill.drill_id,
        score: scoreResult.total,
        now: new Date(),
      });
      upsertSrs(db, newSrs);

      results.push(
        `Drill ${i + 1}: ${drill.drill_id} | Pool: ${sessionPlan.metadata.activePool} | Reason: ${selectedDrill.reason} | Answer: ${userAnswer.toUpperCase()} | Score: ${scoreResult.total} | ${scoreResult.correct ? "PASS" : "FAIL"}${timed ? ` | ${(elapsedMs / 1000).toFixed(1)}s` : ""}`
      );
    }

    rl.close();

    const totalScore = results.length > 0
      ? results.reduce((sum, resultLine) => {
          const match = resultLine.match(/Score: ([\d.]+)/);
          return sum + (match ? parseFloat(match[1]) : 0);
        }, 0) / results.length
      : 0;

    console.log("\n- - - Session Summary - - -");
    console.log(`  Pool: ${sessionPlan.metadata.activePool}`);
    console.log(`  Drills completed: ${results.length}`);
    console.log(`  Average score: ${totalScore.toFixed(3)}`);

    const proofsDir = path.join(cwd, "out", "proofs");
    fs.mkdirSync(proofsDir, { recursive: true });
    const proofPath = path.join(proofsDir, "proof_drill_run.txt");
    const proofContent = [
      "Poker Coach OS - Drill Run Proof",
      `Date: ${new Date().toISOString()}`,
      `Command: coach drill --count ${count}${timed ? " --timed" : ""} --pool ${activePool}`,
      `Session metadata: ${JSON.stringify(sessionPlan.metadata)}`,
      "",
      `Drills run: ${results.length}`,
      `Average score: ${totalScore.toFixed(3)}`,
      "",
      ...results,
      "",
      "Status: COMPLETE",
    ].join("\n");
    fs.writeFileSync(proofPath, proofContent, "utf-8");
    console.log(`  Proof written to: ${proofPath}`);

    db.close();
  });
