/**
 * Non-interactive drill simulation for generating proof artifacts.
 * Simulates 3 drill answers and writes proof file.
 */
import path from "node:path";
import fs from "node:fs";
import { openDatabase, getDrill, getNewDrillIds, insertAttempt, getSrs, upsertSrs } from "@poker-coach/db";
import { scoreDrill, computeSrsUpdate } from "@poker-coach/core";
import type { DrillAnswer } from "@poker-coach/core";

const cwd = process.cwd();
const dbPath = path.join(cwd, ".local", "coach.db");

if (!fs.existsSync(dbPath)) {
  console.error("Database not found. Run 'coach init' first.");
  process.exit(1);
}

const db = openDatabase(dbPath);
const drillIds = getNewDrillIds(db, 3);

if (drillIds.length === 0) {
  console.log("No drills available.");
  db.close();
  process.exit(0);
}

// Simulated answers for 3 drills
const simAnswers = [
  { answer: "A", tags: ["paired_top_river"], rationale: "Trips with paired board" },
  { answer: "B", tags: ["turn_overbet_faced"], rationale: "Overcards only vs overbet" },
  { answer: "A", tags: ["overbet_opportunity"], rationale: "Zero showdown value, raise as bluff" },
];

console.log("\nPoker Coach OS — Simulated Drill Session (3 drills)\n");

const results: string[] = [];

for (let i = 0; i < Math.min(drillIds.length, 3); i++) {
  const drillRow = getDrill(db, drillIds[i]);
  if (!drillRow) continue;

  const options = JSON.parse(drillRow.options_json) as { key: string; label: string }[];
  const answer = JSON.parse(drillRow.answer_json) as DrillAnswer;
  const sim = simAnswers[i];

  console.log(`━━━ Drill ${i + 1}/3 ━━━`);
  console.log(`Node: ${drillRow.node_id}`);
  console.log(`Prompt: ${drillRow.prompt.substring(0, 80)}...`);
  console.log(`Options: ${options.map((o) => `${o.key}: ${o.label}`).join(" | ")}`);
  console.log(`User answer: ${sim.answer}`);
  console.log(`User tags: ${sim.tags.join(", ")}`);

  const scoreResult = scoreDrill({
    userAnswer: sim.answer,
    userTags: sim.tags,
    answer,
  });
  const elapsedMs = 15000 + Math.floor(Math.random() * 10000); // simulated time

  console.log(`\n  Correct: ${answer.correct} | Your answer: ${sim.answer} — ${scoreResult.correct ? "CORRECT" : "INCORRECT"}`);
  console.log(`  Action: ${scoreResult.actionScore} | Tags: ${scoreResult.tagScore} | Total: ${scoreResult.total}`);
  if (scoreResult.missedTags.length > 0) {
    console.log(`  Missed tags: ${scoreResult.missedTags.join(", ")}`);
  }
  console.log(`  Time: ${(elapsedMs / 1000).toFixed(1)}s\n`);

  // Save attempt
  const attemptId = `att_sim_${Date.now()}_${i}`;
  insertAttempt(db, {
    attempt_id: attemptId,
    drill_id: drillRow.drill_id,
    ts: new Date().toISOString(),
    user_answer_json: JSON.stringify({ answer: sim.answer, rationale: sim.rationale }),
    correct_bool: scoreResult.correct ? 1 : 0,
    score: scoreResult.total,
    elapsed_ms: elapsedMs,
    missed_tags_json: JSON.stringify(scoreResult.missedTags),
  });

  // Update SRS
  const currentSrs = getSrs(db, drillRow.drill_id);
  const newSrs = computeSrsUpdate(currentSrs, {
    drillId: drillRow.drill_id,
    score: scoreResult.total,
    now: new Date(),
  });
  upsertSrs(db, newSrs);

  results.push(
    `Drill ${i + 1}: ${drillRow.drill_id} | Answer: ${sim.answer} | Score: ${scoreResult.total} | ${scoreResult.correct ? "PASS" : "FAIL"} | ${(elapsedMs / 1000).toFixed(1)}s`
  );
}

const avgScore = results.length > 0
  ? results.reduce((sum, r) => {
      const match = r.match(/Score: ([\d.]+)/);
      return sum + (match ? parseFloat(match[1]) : 0);
    }, 0) / results.length
  : 0;

console.log(`━━━ Session Summary ━━━`);
console.log(`  Drills completed: ${results.length}`);
console.log(`  Average score: ${avgScore.toFixed(3)}`);

// Write proof
const proofsDir = path.join(cwd, "out", "proofs");
fs.mkdirSync(proofsDir, { recursive: true });
const proofPath = path.join(proofsDir, "proof_drill_run.txt");
const proofContent = [
  `Poker Coach OS — Drill Run Proof`,
  `Date: ${new Date().toISOString()}`,
  `Command: coach drill --count 3 --timed (simulated)`,
  ``,
  `Drills run: ${results.length}`,
  `Average score: ${avgScore.toFixed(3)}`,
  ``,
  ...results,
  ``,
  `Status: COMPLETE`,
].join("\n");
fs.writeFileSync(proofPath, proofContent, "utf-8");
console.log(`\n  Proof written to: ${proofPath}`);

db.close();
